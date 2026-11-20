// THE DIRECTOR (2.0.0 rebuild, 20 Nov 2026): one account of the match.
//
// Owner, 20 Nov 2026: "At the moment it's hard to understand - commentary,
// graphics and animation are all doing different things - they need to be in
// harmony." His examples: a knock-on plate with nobody of that side near the
// ball; a side kicking to touch and throwing in itself; "kick to touch" on
// the label and no kick on the pitch.
//
// The engine's lines are folded, in order, through the laws (law.ts). Where a
// line follows legally from the last, it is one beat. Where the engine has
// skipped a step, the step is supplied here, ONCE, with the side, the place
// and the reason the laws require, and it is a beat like any other: the
// pitch plays it, the label names it and the commentary says it, all from
// the same record. Nothing downstream decides anything about the match.
//
// It is a pure fold over the events, so a replay and a reload direct the
// same match the same way, and it draws nothing from the match rng: no
// result, score, card or penalty count can move. A supplied step is never a
// score, a card or a penalty; those are the engine's alone.
import type { MatchEvent } from '../../game/model'
import { Laws, type LawEvent } from './law'
import { readLine, type Phase, type PhaseKind } from './phase'

/** what a beat shows: a phase of play, or one of the stoppages the engine does not write */
export type BeatKind = PhaseKind | 'knockon' | 'intotouch'

export interface Beat extends Omit<Phase, 'kind'> {
  kind: BeatKind
  /** the engine line it belongs to (a supplied beat belongs to the line it leads into) */
  src: number
  /** true when the engine wrote no line for this and the laws required it */
  supplied?: boolean
  /** who did it, for a stoppage: the man with the ball, or the man tackling him */
  who?: 'carrier' | 'tackler'
  /** the side that did it is the home side (a knock-on, a ball put into touch) */
  byHome?: boolean
  /** the set piece was won by the side that did not put it in */
  stolen?: boolean
  /** words for the commentary feed, as an i18n key: said when the beat is played */
  say?: string
  /** the move under the laws this beat makes, when the words say more than the picture's kind does
   *  (a try ruled out for a forward pass is a stoppage; a grubber that runs dead is a kick, then a dead ball) */
  law?: LawEvent
  then?: LawEvent
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** the move, under the laws, that a line makes; null for a line that makes none */
export function lawOf(p: Phase): LawEvent | null {
  switch (p.kind) {
    case 'kickoff': return 'KICKOFF'
    case 'dropout': return 'DROPOUT'
    case 'scrum': return 'SCRUM'
    case 'lineout': return 'LINEOUT'
    case 'maul': case 'ruck': case 'carry': case 'catch': return 'PLAY'
    // a TMO review or a try ruled out moves nothing by itself: the line after says what the referee gave
    case 'heldup': return p.label === 'lp.tmo' ? null : 'DEAD'
    case 'kick': return p.label === 'lp.kickTouch' || p.label === 'lp.outFull' || p.label === 'lp.fifty22' ? 'TOUCH' : 'KICK'
    case 'try': return 'TRY'
    case 'con': return 'CON'
    // a card is shown at a stoppage that has already been given
    case 'penalty': return p.banner && (p.banner.kind === 'yc' || p.banner.kind === 'rc') ? null : 'PENALTY'
    case 'goal': return p.label === 'lp.drop' ? (p.good ? 'DROPGOAL' : 'DROPMISS') : (p.good ? 'GOAL' : 'GOALMISS')
    case 'break': return p.label === 'lp.halfTime' ? 'HALF' : null
    default: return null
  }
}

export interface Directed {
  /** the beats to play for each engine line, in order (empty for a line that shows nothing) */
  beats: Beat[][]
  /** lines the laws could not reach: held at zero by the test */
  lost: number
  /** how many beats were supplied */
  supplied: number
  /** engine lines that are not shown on Extended, pitch or feed: colour that contradicts the play */
  hidden: boolean[]
}

/** THE ENGINE'S COLOUR LINES (owner, 20 Nov 2026, on the first rebuilt match:
 *  "There is still no connection with players, commentary & graphics ... All
 *  the territory is with Northampton - Northampton have only just kicked off
 *  ... turnover again"). The engine draws these from a pool without looking
 *  at who has the ball, so acting each one out made the ball change hands
 *  fifteen times a match for no reason. They are colour, not events: one
 *  that is about the side WITHOUT the ball is left out, and play stays with
 *  the side that has it until something really changes hands. */
const COLOUR = /^(pbp|defSet|defHit|moveShape|moveGain|flavWind|flavWet|styles\.cAtk_|flav(1|2|6|8|11|14|15|16|19|22|23|24|26)$)/
/** a line that sums the match up: only said once there has been play to sum up, and only when it is true */
const SUMMARY = /^(terr|day_|styles\.cDef_)/
/** a penalty given at a breakdown: there has to have been one */
const AT_RUCK = /^(off_(offFeet|notRoll|notRelease|offsideRuck|sideEntry|handsRuck|beyondRuck)|cyn_ruck)/
const rawKey = (k?: string) => (k ?? '').replace(/^comm\./, '').replace(/_f$/, '')

export function direct(events: MatchEvent[], homeId: string, up?: (i: number) => boolean): Directed {
  const L = new Laws()
  const out: Beat[][] = []
  const hidden: boolean[] = events.map(() => false)
  /** lines played since the half began; the last colour line left out, to tell one stray line from a real change of hands */
  let played = 0, strays = 0
  let lastKind: BeatKind | null = null
  let cur: Phase | null = null
  let lost = 0, supplied = 0
  // ---- what the director keeps, that the engine does not ----
  /** where the ball is, and which side has it */
  const ball = { x: 50, y: 35 }
  let poss: boolean = true
  /** the last thing that moved the ball was a kick (so a change of hands is a catch, not a turnover) */
  let kicked = false
  /** who kicks off next; who kicked off the match */
  let koSide: boolean | null = null
  let firstKO: boolean | null = null
  /** the mark and the side for the restart that is waiting */
  let mark = { x: 50, y: 35 }
  let throwSide: boolean = true, putIn: boolean = true, doSide: boolean = true, doGoalLine: boolean = false
  /** the side a penalty was given to, while it is still to be taken */
  let penSide: boolean | null = null
  /** the kick the ball is still in the air from, so the director can say where it came down */
  let lastKick: Beat | null = null
  let lastKickPen = false

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const p = readLine(e, i, homeId, cur, events[i + 1], e.type === 'TRY' && !!up?.(i))
    const key = rawKey(e.k)
    if (!p) {
      // a summary of the match so far is not said before there is a match to sum up, or when the ball is somewhere else
      if (SUMMARY.test(key)) {
        const home = e.teamId === homeId
        const wrong = key.startsWith('terrCamped') ? (home ? ball.x < 55 : ball.x > 45) : key.startsWith('terrMiddle') ? (ball.x < 25 || ball.x > 75) : false
        if (played < 10 || wrong) hidden[i] = true
      }
      out.push([]); continue
    }
    let law = lawOf(p)
    // WHAT THE REFEREE GAVE (20 Nov 2026, read against the picture: "NO TRY...
    // Offside, and a penalty to the defence" was followed by a lineout). The
    // line says how play restarts, and the director takes it at its word.
    const noTry = /^tmoNoTry/.test(key)
    if (noTry) law = /^tmoNoTry(5|6|7)$/.test(key) ? 'PENALTY' : key === 'tmoNoTry1' ? 'DEAD' : key === 'tmoNoTry4' ? 'TOUCH' : 'STOP'
    /** a kick the words say went dead: the defence restarts with a drop-out */
    const deadKick = key === 'kickPin2' || key === 'kickPin4'
    // colour about the side that does not have the ball: one such line is left out. A second
    // in a row means the engine really has them playing, and that is shown as the turnover it is.
    if (law === 'PLAY' && COLOUR.test(key) && p.homeBall !== poss && !kicked && L.state === 'open') {
      if (strays++ === 0) { hidden[i] = true; out.push([]); continue }
    }
    if (law === 'PLAY') { if (p.homeBall === poss) strays = 0 } else if (law) strays = 0
    if (law === 'HALF') played = 0; else if (law) played++
    cur = p
    const row: Beat[] = []
    const add = (b: Beat) => { row.push(b); if (b.supplied) supplied++ }
    // THEY HAVE TO HAVE THE BALL TO SCORE WITH IT (20 Nov 2026, seen: one side
    // was through four phases and the next line had the other side over the
    // line). A try, or a try under review, by the side that did not have the
    // ball is preceded by the turnover that gave it to them.
    if ((law === 'TRY' || p.label === 'lp.tmo') && !noTry && p.homeBall !== poss && !kicked && L.state === 'open') {
      add({ src: i, at: i, supplied: true, kind: 'carry', homeBall: p.homeBall, x: clamp(ball.x, 3, 97), y: clamp(ball.y, 5, 65), label: 'lp.turnover', say: 'lp.say.turnover' })
      poss = p.homeBall; lastKind = 'carry'
    }
    if (!law) { row.push({ ...p, src: i }); out.push(row); continue }

    // A PENALTY AT THE BREAKDOWN HAS A BREAKDOWN (owner, 20 Nov 2026: "penalty
    // for a breakdown without a breakdown ever taking place"). The side with
    // the ball carries, is tackled, and the ruck forms; then the whistle.
    if (law === 'PENALTY' && AT_RUCK.test(key) && L.state === 'open' && lastKind !== 'ruck' && lastKind !== 'maul') {
      const d = poss ? 1 : -1
      const at = { x: clamp(ball.x + d * 4, 3, 97), y: clamp(ball.y + (ball.y < 35 ? 3 : -3), 5, 65) }
      add({ src: i, at: i, supplied: true, kind: 'ruck', homeBall: poss, x: at.x, y: at.y, label: 'lp.tackle', say: 'lp.say.tackled' })
      ball.x = at.x; ball.y = at.y; kicked = false; lastKind = 'ruck'
    }
    let path = L.bridge(law)
    if (path == null) { lost++; L.jump(law); path = [] }
    for (const step of path) {
      const before = L.state
      L.go(step)
      const sup = { src: i, at: i, supplied: true as const }
      switch (step) {
        case 'KICKOFF': {
          const k: boolean = koSide ?? !p.homeBall, d = k ? 1 : -1
          const to = { x: 50 + d * 22, y: clamp(p.y, 13, 57) }
          add({ ...sup, kind: 'kickoff', homeBall: k, x: 50, y: 35, to, hang: 11, label: 'lp.restart', say: 'lp.say.restart' })
          ball.x = to.x; ball.y = to.y; poss = !k; kicked = true; koSide = null
          break
        }
        case 'DROPOUT': {
          const x = doGoalLine ? (doSide ? 1 : 99) : (doSide ? 21 : 79), d = doSide ? 1 : -1
          const to = { x: clamp(x + d * 30, 3, 97), y: clamp(p.y, 14, 56) }
          add({ ...sup, kind: 'dropout', homeBall: doSide, x, y: 35, to, hang: 14, label: doGoalLine ? 'lp.dropout' : 'lp.dropout22', say: doGoalLine ? 'lp.say.goalLine' : 'lp.say.dropout22' })
          ball.x = to.x; ball.y = to.y; poss = !doSide; kicked = true
          break
        }
        case 'TOUCH': {
          // the engine's next line is a lineout to side Y at p.x; say how the ball got there
          const Y: boolean = p.homeBall, X: boolean = poss, top = p.y < 35
          const edge = top ? -1 : 71, lx = clamp(p.x, 6, 94)
          const gain = (lx - ball.x) * (X ? 1 : -1)
          let ownThrow = false
          // (a man is only run or bundled into touch when he is near it: from the middle of the field it is kicked there)
          const far = Math.abs(ball.y - (top ? 0 : 70)) > 16
          if (kicked && lastKick && Y !== X) {
            // their kick was the one that went out: it is that kick, finding touch
            lastKick.to = { x: lx, y: edge }; lastKick.label = 'lp.kickTouch'; lastKick.say = 'lp.say.kickTouch'
            // (a penalty kicked to touch is the kicker's own throw: the side the line names then took it against the throw)
            if (lastKickPen) ownThrow = true
          } else if (kicked && lastKick) {
            // their kick is fielded by a defender who is taken into touch with it: the kicking side's throw
            add({ ...sup, kind: 'intotouch', homeBall: !X, x: lx, y: top ? 1 : 69, who: 'carrier', byHome: !X, label: 'lp.intoTouch', say: 'lp.say.defOut' })
          } else if (before === 'penalty' && penSide === Y) {
            // a penalty kicked to touch: their own throw (law 18.8)
            add({ ...sup, kind: 'kick', homeBall: Y, x: ball.x, y: ball.y, to: { x: lx, y: edge }, hang: 7, label: 'lp.kickTouch', say: 'lp.say.penTouch' })
          } else if (before === 'penalty' && penSide === X && Y !== X) {
            // their penalty, kicked to touch: their own throw, and the other side then takes it against the throw
            add({ ...sup, kind: 'kick', homeBall: X, x: ball.x, y: ball.y, to: { x: lx, y: edge }, hang: 7, label: 'lp.kickTouch', say: 'lp.say.penTouch' })
            ownThrow = true
          } else if (Y !== X && (gain > 8 || far)) {
            // the side with the ball kicks it out: the other side's throw
            add({ ...sup, kind: 'kick', homeBall: X, x: ball.x, y: ball.y, to: { x: lx, y: edge }, hang: 7, label: 'lp.kickTouch', say: 'lp.say.kickTouch' })
          } else if (Y !== X) {
            // the man with the ball is put into touch: the other side's throw
            add({ ...sup, kind: 'intotouch', homeBall: X, x: clamp(lx, 2, 98), y: top ? 1 : 69, who: 'carrier', byHome: X, label: 'lp.intoTouch', say: 'lp.say.carriedOut' })
          } else if (gain > 8 || far) {
            // they kick ahead and a defender plays it into touch: the kicking side's throw
            add({ ...sup, kind: 'kick', homeBall: X, x: ball.x, y: ball.y, to: { x: lx, y: top ? 3 : 67 }, hang: 6, label: 'lp.kickAhead', say: 'lp.say.kickAhead' })
            add({ ...sup, kind: 'intotouch', homeBall: !X, x: lx, y: top ? 1 : 69, who: 'carrier', byHome: !X, label: 'lp.intoTouch', say: 'lp.say.defOut' })
          } else {
            // the tackler knocks it out of his hands and into touch: the carrying side's throw
            add({ ...sup, kind: 'intotouch', homeBall: X, x: clamp(lx, 2, 98), y: top ? 1 : 69, who: 'tackler', byHome: !X, label: 'lp.intoTouch', say: 'lp.say.knockedOut' })
          }
          mark = { x: lx, y: top ? 0 : 70 }; throwSide = ownThrow ? X : Y; ball.x = lx; ball.y = mark.y; kicked = false; penSide = null
          break
        }
        case 'LINEOUT': {
          const stolen: boolean = (law === 'PLAY' || law === 'KICK' || law === 'TRY') && p.homeBall !== throwSide
          add({ ...sup, kind: 'lineout', homeBall: throwSide, x: mark.x, y: mark.y, label: 'lp.lineout', stolen, say: stolen ? 'lp.say.lineoutStolen' : 'lp.say.lineout' })
          ball.x = mark.x; ball.y = mark.y < 35 ? 5 : 65; poss = stolen ? !throwSide : throwSide; kicked = false
          break
        }
        case 'STOP': {
          // the next line is a scrum to side Y: the other side knocked it on
          const Y: boolean = p.homeBall, X: boolean = poss
          const fwd = /tmoFwd|fwdPass/.test(e.k ?? '')
          const at = { x: clamp(ball.x, 5, 95), y: clamp(ball.y, 5, 65) }
          add({ ...sup, kind: 'knockon', homeBall: X, x: at.x, y: at.y, who: Y !== X ? 'carrier' : 'tackler', byHome: !Y,
            label: fwd ? 'lp.forwardPass' : 'lp.knockOn', say: fwd ? 'lp.say.forwardPass' : Y !== X ? 'lp.say.knockOn' : 'lp.say.knockOnTackle' })
          mark = at; putIn = Y; kicked = false
          break
        }
        case 'SCRUM': {
          const stolen: boolean = (law === 'PLAY' || law === 'KICK' || law === 'TRY') && p.homeBall !== putIn
          add({ ...sup, kind: 'scrum', homeBall: putIn, x: mark.x, y: mark.y, label: 'lp.scrum', stolen, say: stolen ? 'lp.say.scrumAgainstHead' : 'lp.say.scrum' })
          ball.x = mark.x; ball.y = mark.y; poss = stolen ? !putIn : putIn; kicked = false
          break
        }
        case 'DEAD': { doSide = !poss; doGoalLine = true; break }
        case 'CON': { koSide = !poss; break }   // a try with no conversion written (a penalty try): straight to the restart
        default: break
      }
    }
    L.go(law)
    if (deadKick) L.go('DEAD')

    // ---- the engine's own line, put where the laws say it is ----
    const b: Beat = { ...p, src: i }
    if (noTry) b.law = law
    if (deadKick) b.then = 'DEAD'
    // PLAY GOES ON FROM WHERE THE BALL IS. The engine's place for a line is
    // where its own count of the field had got to; after a step it did not
    // write (a kick-off, a drop-out, a lineout) the ball is somewhere else.
    // Open play is put within a carry of where the ball really is, and the
    // reader carries on from there.
    if ((law === 'PLAY' || law === 'KICK' || law === 'TOUCH' || law === 'PENALTY') && path.length) {
      const lim = law === 'PLAY' ? 12 : 8
      const nx = clamp(ball.x + clamp(b.x - ball.x, -lim, lim), 1, 99), dx = nx - b.x
      const ny = clamp(ball.y + clamp(b.y - ball.y, -16, 16), 3, 67)
      b.x = nx; b.y = ny
      if (b.to) b.to = { x: clamp(b.to.x + dx, law === 'TOUCH' ? 6 : 1, law === 'TOUCH' ? 94 : 99), y: b.to.y }
      p.x = b.x; p.y = b.y; if (p.to && b.to) p.to = { ...b.to }
    }
    switch (law) {
      case 'KICKOFF':
        if (firstKO == null && p.at >= 0) firstKO = p.homeBall
        koSide = null; ball.x = p.to?.x ?? 50; ball.y = p.to?.y ?? 35; poss = !p.homeBall; kicked = true
        break
      case 'DROPOUT': ball.x = p.to?.x ?? p.x; ball.y = p.to?.y ?? p.y; poss = !p.homeBall; kicked = true; break
      case 'SCRUM':
        // where it was stopped, when the director knows; the side the line says
        if (path.includes('STOP')) { b.x = mark.x; b.y = mark.y }
        ball.x = b.x; ball.y = b.y; poss = p.homeBall; kicked = false; penSide = null
        break
      case 'LINEOUT': {
        // WHOSE THROW (law 18): the side that did not put it out, unless it was a penalty or a 50:22.
        // The engine's line says who came away with it; when that is not the side throwing, it was stolen.
        const viaTouch = path.includes('TOUCH') || L.state === 'open'
        if (viaTouch && throwSide !== p.homeBall) { b.homeBall = throwSide; b.stolen = true; b.say = 'lp.say.lineoutStolen' }
        b.x = mark.x; b.y = mark.y
        ball.x = b.x; ball.y = b.y < 35 ? 5 : 65; poss = p.homeBall; kicked = false
        break
      }
      case 'TOUCH': {
        const X = p.homeBall, full = p.label === 'lp.outFull', own = p.label === 'lp.fifty22' || penSide === X
        const tx = clamp(full ? p.x : (p.to?.x ?? p.x), 6, 94), top = (p.to?.y ?? p.y) < 35
        mark = { x: tx, y: top ? 0 : 70 }; throwSide = own ? X : !X
        ball.x = tx; ball.y = mark.y; kicked = false; penSide = null
        break
      }
      case 'KICK':
        // a kick by the side that did not have it: they won it back first, and that is said
        if (p.homeBall !== poss && !kicked && !path.length) b.say = 'lp.say.turnover'
        lastKickPen = penSide === p.homeBall
        ball.x = p.to?.x ?? p.x; ball.y = p.to?.y ?? p.y; poss = p.homeBall; kicked = true; penSide = null; lastKick = b
        break
      case 'PLAY':
        if (p.homeBall !== poss && !kicked && p.label !== 'lp.turnover' && !path.length) { b.label = 'lp.turnover'; b.say = 'lp.say.turnover' }
        ball.x = p.x; ball.y = p.y; poss = p.homeBall; kicked = false; penSide = null
        break
      case 'PENALTY': {
        // (a try ruled out for an offence is a penalty to the side that was defending)
        const to: boolean = noTry ? !p.homeBall : p.homeBall
        const px = noTry ? clamp(p.x, 6, 94) : p.x
        penSide = to; mark = { x: px, y: p.y }; ball.x = px; ball.y = p.y; poss = to; kicked = false
        break
      }
      case 'STOP': b.byHome = p.homeBall; mark = { x: clamp(p.x, 5, 95), y: clamp(p.y, 5, 65) }; putIn = !p.homeBall; ball.x = mark.x; ball.y = mark.y; kicked = false; penSide = null; break
      case 'GOAL': case 'DROPGOAL': koSide = !p.homeBall; penSide = null; break
      case 'GOALMISS': case 'DROPMISS': doSide = !p.homeBall; doGoalLine = false; penSide = null; break
      case 'DEAD': doSide = !p.homeBall; doGoalLine = true; penSide = null; break
      case 'TRY': poss = p.homeBall; penSide = null; break
      case 'CON': koSide = !p.homeBall; break
      case 'HALF': koSide = firstKO == null ? null : !firstKO; penSide = null; break
      default: break
    }
    if (deadKick) {
      // it goes dead over the line it was kicked at: a goal-line drop-out when the defence touches it down, a 22 when it simply runs out
      b.to = { x: p.homeBall ? 104 : -4, y: b.to?.y ?? b.y }
      doSide = !p.homeBall; doGoalLine = key === 'kickPin2'; kicked = false; lastKick = null
    }
    if (law !== 'KICK') lastKick = null
    add(b)
    lastKind = b.kind
    out.push(row)
  }
  return { beats: out, lost, supplied, hidden }
}
