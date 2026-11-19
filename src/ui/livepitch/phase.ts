// THE LIVE PITCH (2.0.0): what the play looks like after each line.
//
// Owner, 16 Nov 2026, with a clip of another manager's match view: "V2.0.0 of
// Phase Rugby Manager - in game should be evolved into this. This is exactly
// what I want." The pitch stays on screen for the whole match, and every line
// of commentary moves the thirty men into the shape of what the line says: a
// scrum looks like a scrum, a lineout has a line, a kick goes up and comes
// down where the next line picks it up.
//
// NOTHING HERE IS INVENTED FOR THE LOOK OF IT. Each line already carries what
// it depicts: its key (scrum3, kickBox2, pbpRuck4, off_offFeet1), where the
// engine had the ball (fld), whose line it is (teamId) and who did it
// (playerId). This file reads those and nothing else. It never touches the
// match rng, so it cannot move a result, and it is a pure fold over the events
// so the same match always draws the same way, on a replay and after a reload.

import type { MatchEvent } from '../../game/model'

export type PhaseKind =
  | 'kickoff' | 'scrum' | 'lineout' | 'maul' | 'ruck' | 'carry' | 'kick' | 'catch'
  | 'try' | 'con' | 'goal' | 'dropout' | 'penalty' | 'heldup' | 'break' | 'hold'

export type BannerKind = 'try' | 'con' | 'conMiss' | 'pen' | 'penMiss' | 'dg' | 'dgMiss' | 'yc' | 'rc' | 'notry' | 'pentry'

export interface Banner {
  kind: BannerKind
  /** the side the banner is about (the scorer, the man carded) */
  teamId: string
  name?: string
  min: number
  /** the line it belongs to, so it is shown once */
  at: number
}

export interface Phase {
  kind: PhaseKind
  /** the side with the ball is the home side */
  homeBall: boolean
  /** the ball, in field metres: x 0 (home try line) .. 100 (away try line), y 0..70 */
  x: number
  y: number
  /** the man on the ball, when the line names him */
  carrier?: number
  /** set by the pitch once a restart has been kicked: the chase is on */
  flying?: boolean
  /** how a try is scored, read from the words: from close in, out wide, through the line, off a kick, or from a long way out */
  tryKind?: 'close' | 'wide' | 'break' | 'kick' | 'long' | 'maul'
  /** a kick into space: nobody of theirs is under it */
  space?: boolean
  /** where a kick comes down, and how high it goes (metres) */
  to?: { x: number; y: number }
  hang?: number
  /** a kick at goal that went over */
  good?: boolean
  /** the label on the pitch: an i18n key and its values */
  label: string
  n?: number
  /** the line this phase is drawn from */
  at: number
  banner?: Banner
  /** a called move's name, as an i18n key (the line's move_k) */
  move?: string
  /** set by the sim, not the reader: the three forwards nearest this
   *  breakdown, the two defenders nearest it, and the man just tackled, so
   *  the men who are there are the ones drawn there */
  ruckers?: number[]
  tacklers?: number[]
  downMan?: number | null
}

/** the key without its variant number or the women's-game suffix: 'comm.scrum3_f' is 'scrum' */
export function stem(k?: string): string {
  if (!k) return ''
  return k.replace(/^comm\./, '').replace(/_f$/, '').replace(/\d+$/, '')
}

/** a small, stable hash of a line's index, for the bits a line does not say
 *  (how far across the field the ruck is). Stable so a replay draws the same. */
function wob(i: number, salt = 0): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13
  return (h % 10000) / 10000
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** lines about the side WITHOUT the ball: the tackler, the defensive line, the
 *  man who gave the penalty away */
const DEFENDING = /^(defSet|defHit|off_|notBackTen|heldUp|flav(8|12|15|23)$|ycRepeated|yc|rc)/

/**
 * ---- WHAT ONE LINE SHOWS ----
 *
 * Returns null for a line that does not move the play (the crowd, the weather,
 * a coach's note, a substitution): the pitch holds the shape it had.
 */
export function readLine(e: MatchEvent, i: number, homeId: string, prev: Phase | null, next?: MatchEvent, up = false): Phase | null {
  const p = readLine0(e, i, homeId, prev, next, up)
  const mk = e.v?.move_k
  if (p && typeof mk === 'string') p.move = mk
  // ONE PASSAGE OF PLAY, NOT A HUNDRED SNAPSHOTS (18 Nov 2026, owner: "It
  // should flow as one", "players running in strange areas"; own audit: play
  // jumped a median of 19 metres between one line and the next, so thirty
  // men ran 218 metres a minute relocating). The engine says roughly where
  // on the field each line is. The pitch now treats that as where play is
  // heading, not where it instantly is: an ordinary phase moves on at most a
  // carry's length from where the ball actually was, and catches the engine
  // up over the next line or two. Scores, restarts and kicks are exact.
  // THE LINEOUT IS WHERE IT WENT OUT (owner, 19 Nov 2026: "ball gets kicked
  // into touch, lineout happens miles away from it"). The kick's landing spot
  // and the engine's place for the lineout were worked out separately.
  if (p && prev && p.kind === 'lineout' && prev.kind === 'kick' && prev.label === 'lp.kickTouch' && prev.to) {
    p.x = clamp(prev.to.x, 5, 95)
    p.y = prev.to.y < 35 ? Math.min(p.y, 35 - Math.abs(p.y - 35)) : Math.max(p.y, 35 + Math.abs(p.y - 35))
    return p
  }
  if (p && prev) {
    const from = prev.to && (prev.kind === 'kick' || prev.kind === 'kickoff' || prev.kind === 'dropout') ? prev.to : prev
    const soon = next?.type === 'TRY'
    const step = p.kind === 'ruck' || p.kind === 'carry' || p.kind === 'penalty' || p.kind === 'maul' ? 12
      : p.kind === 'scrum' ? 10 : p.kind === 'lineout' ? 30 : p.kind === 'kick' || p.kind === 'catch' ? 16 : 0
    if (step && !soon && Math.abs(from.x - 50) < 60) {
      const nx = from.x + clamp(p.x - from.x, -step, step)
      const dx = nx - p.x
      p.x = clamp(nx, 1, 99)
      if (p.to) p.to = { x: clamp(p.to.x + dx, 1, 99), y: p.to.y }
      if (p.kind !== 'lineout') p.y = clamp(from.y + clamp(p.y - from.y, -16, 16), 3, 67)
    }
  }
  // A TURNOVER IS NAMED: when the ball changes hands in open play, with no
  // kick and no whistle between, the pitch says so while it shows it (the
  // strip, the steal at the ruck or the intercept: sim.ts)
  const open = (k: PhaseKind) => k === 'ruck' || k === 'carry'
  if (p && prev && prev.homeBall !== p.homeBall && open(prev.kind) && open(p.kind) && (p.label === 'lp.ruck' || p.label === 'lp.carry' || p.label === 'lp.tackle')) p.label = 'lp.turnover'
  return p
}

function readLine0(e: MatchEvent, i: number, homeId: string, prev: Phase | null, next?: MatchEvent, up = false): Phase | null {
  const s = stem(e.k)
  /** the key with its number: 'flav9' and 'flav3' are different moments */
  const raw = (e.k ?? '').replace(/^comm\./, '').replace(/_f$/, '')
  const isHome = e.teamId === homeId
  const known = !!e.teamId
  const fld = e.fld ?? prev?.x ?? 50
  const prevY = prev?.y ?? 35
  // the side with the ball: the line's own side, or the other one when the
  // line is about the defence
  const defLine = DEFENDING.test(raw)
  const homeBall = known ? (defLine ? !isHome : isHome) : (prev?.homeBall ?? true)
  const dir = homeBall ? 1 : -1
  // across the field, the ball wanders from where it was rather than jumping
  // (and it comes back towards the middle: left to wander it ended up down a touchline for whole passages)
  const drift = (span: number, lo = 9, hi = 61) => clamp(prevY + (35 - prevY) * 0.22 + (wob(i, 1) - 0.5) * span, lo, hi)
  const base = { homeBall, x: clamp(fld, 1, 99), at: i, carrier: e.playerId }

  // ---- the score and the cards first: they are what the banner is for
  if (e.type === 'TRY' || s.startsWith('penTry')) {
    const pen = s.startsWith('penTry')
    // a try is grounded over the line it was scored at, wherever the engine
    // last had the ball; a penalty try under the posts
    // THE TRY THE WORDS DESCRIBE (owner, 18 Nov 2026: "moves to score tries
    // should be better"). Every try used to be the same run. The line says
    // how it was scored, and the pitch now plays that.
    const n = Number(/^try(\d+)/.exec(raw)?.[1] ?? 0)
    const tryKind: Phase['tryKind'] = pen ? 'close'
      : /^try(Intercept|Charge)/.test(raw) || n === 13 || n === 24 ? 'long'
      : n === 8 || n === 14 ? 'kick'
      : n === 4 ? 'maul'
      : [1, 4, 10, 15, 18, 25].includes(n) ? 'close'
      : [2, 6, 9, 20, 22, 26].includes(n) ? 'wide'
      // A MAN UP, THEY SCORE OUT WIDE (owner, 19 Nov 2026: "if a team goes
      // down to 14 then the opposition should look to exploit it"): a try
      // through the middle becomes the overlap, finished in the corner
      : n && up ? 'wide'
      : n ? 'break'
      : (['break', 'wide', 'close'] as const)[i % 3]
    // out wide it is in the corner, on the side with more room; from close in it is near where the ball was
    // WHERE IT IS SCORED FITS THE KICK THAT FOLLOWS (owner, 19 Nov 2026:
    // "kicks at goal should be realistic to where they are"). The engine
    // decides whether the conversion goes over from the kicker and the
    // weather, and has no place for the try. The pitch does, and it can see
    // the next line: a conversion that is missed, or one the words put on
    // the touchline, follows a try out wide; a routine one follows a try
    // nearer the posts. The odds are untouched; the picture agrees with them.
    const nk = (next?.k ?? '').replace(/^comm\./, '')
    const conMiss = /^con(Wide|Post)/.test(nk)
    const conTouch = nk === 'con3' || nk === 'con8'
    const conEasy = nk === 'con4' || nk === 'con5' || nk === 'con7'
    const far = prevY < 35 ? 1 : -1   // the side with more room
    const u2 = Math.abs(wob(i, 2)) % 1
    const posts = n === 5 || n === 21
    const y = pen || (posts && !conMiss) ? 35 + (u2 - 0.5) * 6
      : posts ? 35 - far * (11 + u2 * 6)
      // (the corner on the side the ball is already on: it used to be the far one, a fifty-metre run across the field)
      : tryKind === 'wide' || conTouch ? (far < 0 ? 64.5 - u2 * 3 : 5.5 + u2 * 3)
      // (a missed conversion follows a try out wide ON THE SIDE THE BALL IS ON: it was the far side,
      // so a man stopped a metre short by one touchline scored forty metres away by the other)
      : conMiss ? 35 - far * (19 + u2 * 9)
      : conEasy ? 35 + (u2 - 0.5) * 12
      // (from close in it goes down within a few metres of where the ball was)
      : tryKind === 'close' || tryKind === 'maul' ? clamp(prevY + (u2 - 0.5) * 9, 6, 64)
      : 35 + far * (4 + u2 * 16)
    return { ...base, homeBall: isHome, kind: 'try', x: isHome ? 101.5 : -1.5, y, label: 'lp.try', tryKind,
      banner: { kind: pen ? 'pentry' : 'try', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.type === 'CON' || s === 'conWide' || s === 'conPost') {
    const good = e.type === 'CON'
    // in line with the try, fifteen to twenty metres out
    const ty = prev?.kind === 'try' || prev?.kind === 'con' ? prev.y : 35
    // (in line with where it was grounded, as the law has it; and the wider
    // it was scored, the further back the kicker goes to open up the posts)
    const y = clamp(ty, 5, 65)
    const out = clamp(13 + Math.abs(y - 35) * 0.72, 13, 34)
    return { ...base, homeBall: isHome, kind: 'con', x: isHome ? 100 - out : out, y, good, label: 'lp.con',
      to: { x: isHome ? 104 : -4, y: good ? 35 : 35 + (wob(i, 3) < 0.5 ? -6 : 6) }, hang: 9,
      banner: { kind: good ? 'con' : 'conMiss', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.type === 'PEN' || e.type === 'DG' || s.startsWith('penWide') || s.startsWith('penPost') || s.startsWith('dropMiss')) {
    const good = e.type === 'PEN' || e.type === 'DG'
    const drop = e.type === 'DG' || s.startsWith('dropMiss')
    const x = clamp(fld, isHome ? 50 : 8, isHome ? 92 : 50)
    // (a penalty that is missed was a hard one: out towards the touchline.
    // One that goes over is from in front or nearly so.)
    const y = drop ? drift(16, 18, 52) : good ? clamp(35 + (prevY - 35) * 0.55, 14, 56) : clamp(35 + (prevY < 35 ? -1 : 1) * (20 + Math.abs(wob(i, 6)) % 1 * 8), 8, 62)
    return { ...base, homeBall: isHome, kind: 'goal', x, y, good, label: drop ? 'lp.drop' : 'lp.goalKick',
      to: { x: isHome ? 104 : -4, y: good ? 35 : 35 + (wob(i, 3) < 0.5 ? -7 : 7) }, hang: drop ? 7 : 10,
      banner: { kind: drop ? (good ? 'dg' : 'dgMiss') : (good ? 'pen' : 'penMiss'), teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.type === 'YC' || e.type === 'RC') {
    // the play stops where it was; the man walks
    return { ...(prev ?? { ...base, kind: 'penalty', y: prevY, label: 'lp.penalty' }), at: i, kind: 'penalty', label: 'lp.penalty',
      banner: { kind: e.type === 'YC' ? 'yc' : 'rc', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.fx === 'NOTRY' || s.startsWith('tmoNoTry')) {
    return { ...base, homeBall: isHome, kind: 'heldup', x: isHome ? 99 : 1, y: prevY, label: 'lp.tmo',
      banner: { kind: 'notry', teamId: e.teamId, name: e.playerName, min: e.min, at: i } }
  }
  if (e.fx === 'TMO' || s.startsWith('tmoReview')) {
    return { ...base, homeBall: isHome, kind: 'heldup', x: isHome ? 101 : -1, y: prevY, label: 'lp.tmo' }
  }

  // ---- the whistles
  if (e.type === 'KO') {
    return kickoff(base, isHome || !known, i, 'lp.kickoff', next)
  }
  if (s.startsWith('restart')) return kickoff({ ...base }, isHome, i, 'lp.restart', next)
  if (e.type === 'HT' || e.type === 'FT' || e.type === 'BRK') {
    return { ...base, kind: 'break', x: 50, y: 35, label: e.type === 'FT' ? 'lp.fullTime' : e.type === 'HT' ? 'lp.halfTime' : 'lp.break' }
  }

  // ---- set piece
  if (e.fx === 'SCRUM' || s.startsWith('scrum') || s.startsWith('moveCallSc') || s.startsWith('fk_scrum') || s.startsWith('off_scrum') || s.startsWith('chargeScrum') || s.startsWith('tmoFwdScrum')) {
    const pen = s.startsWith('off_') || s.startsWith('fk_')
    // (a scrum is never set within five metres of a goal line or a touchline:
    // Law 19. The packs are drawn larger than life, so the mark is kept far
    // enough out for both of them to be on the field.)
    return { ...base, x: pen ? base.x : clamp(base.x, 8, 92), kind: pen ? 'penalty' : 'scrum', y: clamp(drift(12), 15, 55), label: pen ? 'lp.penalty' : 'lp.scrum' }
  }
  if (e.fx === 'LINEOUT' || s.startsWith('lineout') || s.startsWith('moveCallLo') || s.startsWith('fk_lineout') || s.startsWith('off_lineout') || s.startsWith('off_lifter') || s.startsWith('chargeLineout') || raw === 'flav9' || raw === 'flav18' || raw === 'flav13') {
    const pen = s.startsWith('off_') || s.startsWith('fk_')
    // the throw is on the touchline nearer the ball, and a maul set off it
    const maul = raw === 'lineout5'
    return { ...base, kind: pen ? 'penalty' : maul ? 'maul' : 'lineout', y: prevY < 35 ? 0 : 70, label: pen ? 'lp.penalty' : maul ? 'lp.maul' : 'lp.lineout' }
  }
  if (e.fx === 'MAUL' || raw === 'flav6' || s.startsWith('off_maul') || s === 'tryMaulRumbles' || s === 'tryPackDrive') {
    const y = prev?.kind === 'lineout' ? (prev.y < 35 ? 8 : 62) : drift(8)
    return { ...base, kind: 'maul', y, label: 'lp.maul' }
  }

  // ---- the quick tap, and the penalty for not being back ten that it draws
  if (s === 'quickTapPhases' || s === 'quickTapMid') return { ...base, kind: 'carry', y: prevY, label: 'lp.quickTap' }
  if (s === 'notBackTen') return { ...base, kind: 'penalty', y: prevY, label: 'lp.notBackTen' }
  // ---- penalties and free kicks in open play
  if (s.startsWith('off_') || s.startsWith('fk_') || s === 'penKickableAsk' || raw === 'flav4') {
    return { ...base, kind: 'penalty', y: drift(6), label: 'lp.penalty' }
  }
  if (s === 'penTouchOwnHalf') {
    return { ...base, kind: 'kick', y: prevY, to: { x: clamp(fld + dir * 28, 3, 97), y: prevY < 35 ? -1 : 71 }, hang: 8, label: 'lp.kickTouch' }
  }

  // ---- OUT ON THE FULL, AND THE 50:22 (owner, 19 Nov 2026: "if a player kicks
  // the ball out on the full, it should say that ... its important things are
  // clear to the user what has happened"). The engine has always written both;
  // the pitch drew neither. Out on the full flies over the touchline without
  // landing; the 50:22 lands in the field and bounces out inside their 22.
  if (s.startsWith('outFull')) {
    return { ...base, kind: 'kick', y: prevY, to: { x: clamp(fld + dir * 30, 3, 97), y: prevY < 35 ? -4 : 74 }, hang: 16, label: 'lp.outFull' }
  }
  if (s.startsWith('fifty22')) {
    return { ...base, kind: 'kick', y: prevY, to: { x: isHome ? 86 : 14, y: prevY < 35 ? -1 : 71 }, hang: 7, label: 'lp.fifty22' }
  }
  // ---- the 22 drop-out after a missed kick at goal (the engine writes it now)
  if (s.startsWith('do22_')) {
    const x = isHome ? 21 : 79
    return { ...base, homeBall: isHome, kind: 'dropout', x, y: 35, to: { x: clamp(x + (isHome ? 1 : -1) * 30, 3, 97), y: drift(30) }, hang: 14, label: 'lp.dropout22' }
  }
  // ---- kicks: off the boot here, down where the next line picks it up
  if (s.startsWith('kick') && !s.startsWith('kickField') || raw === 'flav7' || raw === 'flav10' || raw === 'flav17' || s === 'gldo' || s.startsWith('chargeDown')) {
    if (s === 'gldo') {
      const x = isHome ? 1 : 99
      return { ...base, homeBall: isHome, kind: 'dropout', x, y: 35, to: { x: clamp(x + (isHome ? 1 : -1) * 32, 3, 97), y: drift(30) }, hang: 14, label: 'lp.dropout' }
    }
    if (s.startsWith('chargeDown')) return { ...base, kind: 'carry', y: drift(6), label: 'lp.chargeDown' }
    const touch = s.startsWith('kickTouch') || s.startsWith('kickExit') || raw === 'flav7'
    const box = s.startsWith('kickBox')
    const up = s.startsWith('kickUp') || raw === 'flav17'
    const pin = s.startsWith('kickPin') || raw === 'flav10'
    const dist = touch ? 30 : box ? 22 : up ? 24 : pin ? 30 : 38
    const nx = next?.fld
    // the next line knows where it landed; trust it when it is downfield
    let tx = nx != null && (nx - fld) * dir > 5 ? nx : fld + dir * dist
    tx = clamp(tx, pin ? -3 : 2, pin ? 103 : 98)
    const ty = touch ? (prevY < 35 ? -1 : 71) : drift(26, 6, 64)
    return { ...base, kind: 'kick', y: prevY, to: { x: tx, y: ty }, hang: box || up ? 18 : touch ? 9 : pin ? 2 : 13,
      label: touch ? 'lp.kickTouch' : box ? 'lp.boxKick' : up ? 'lp.upAndUnder' : pin ? 'lp.grubber' : 'lp.kick' }
  }
  if (s.startsWith('kickField') || raw === 'flav5' || raw === 'flav20') {
    return { ...base, kind: 'catch', y: prev?.to?.y != null ? clamp(prev.to.y, 4, 66) : prevY, x: prev?.to?.x != null ? clamp(prev.to.x, 1, 99) : base.x, label: 'lp.catch' }
  }

  // ---- open play
  if (s.startsWith('pbpRuck') || s.startsWith('pbpPhases') || raw === 'flav3' || raw === 'flav16' || s.startsWith('pbpWet') || s.startsWith('day_breakdown')) {
    if (s.startsWith('day_')) return null
    return { ...base, kind: 'ruck', y: drift(10), label: s.startsWith('pbpPhases') ? 'lp.phases' : raw === 'flav3' ? 'lp.turnover' : 'lp.ruck',
      n: typeof e.v?.n === 'number' ? e.v.n : undefined }
  }
  if (s.startsWith('pbp') || s.startsWith('move') || s.startsWith('flav') || s.startsWith('defSet') || s.startsWith('defHit') || s.startsWith('heldUp') || s.startsWith('chargeRegather') || s.startsWith('chargeSafe') || raw.startsWith('styles.cAtk') || raw.startsWith('styles.cTurn') || s.startsWith('tryInter')) {
    if (s.startsWith('heldUp')) return { ...base, kind: 'heldup', x: homeBall ? 100.5 : -0.5, y: prevY, label: 'lp.heldUp' }
    const tackled = s.startsWith('defHit') || s.startsWith('defSet')
    // a carry in the 22 is near the posts, a run from deep starts wide
    return { ...base, kind: tackled ? 'ruck' : 'carry', y: drift(tackled ? 8 : 18), label: tackled ? 'lp.tackle' : 'lp.carry' }
  }
  return null
}

function kickoff(base: { homeBall: boolean; x: number; at: number; carrier?: number }, kickerHome: boolean, i: number, label: string, next?: MatchEvent): Phase {
  const d = kickerHome ? 1 : -1
  // it comes down where the next line picks the play up, when that is in
  // the receivers' half; otherwise a standard restart
  const nx = next?.fld
  // A KICK-OFF LANDS IN THE FIELD (owner, 17 Nov 2026: "Kicked it dead from
  // the kick off so should be a scrum back"). It used to be able to come
  // down nine metres into the stand. It goes at least ten metres and comes
  // down between the ten-metre line and the 22, inside the 15-metre lines:
  // never into touch, never dead.
  const far = nx != null && (nx - 50) * d > 10 ? (nx - 50) * d : 14 + Math.abs(wob(i, 4)) % 1 * 14
  const tx = 50 + d * clamp(far, 12, 30)
  return { ...base, homeBall: kickerHome, kind: 'kickoff', x: 50, y: 35,
    to: { x: tx, y: clamp(35 + ((Math.abs(wob(i, 5)) % 1) - 0.5) * 44, 13, 57) }, hang: 16, label }
}

/** the shape after the first `upto` lines: the latest phase, the banner that
 *  belongs to the newest line if it has one, and the possession run's length */
/** has the side this line belongs to more men on the field than the other (cards shown before it) */
export function manUpAt(events: MatchEvent[], i: number): boolean {
  const e = events[i]
  if (!e?.teamId) return false
  let mine = 0, theirs = 0
  for (let k = 0; k < i; k++) {
    const c = events[k]
    if (!c.teamId || (c.type !== 'YC' && c.type !== 'RC')) continue
    if (c.type === 'YC' && e.min - c.min >= 10) continue
    if (c.teamId === e.teamId) mine++; else theirs++
  }
  return theirs > mine
}

export function phaseAt(events: MatchEvent[], upto: number, homeId: string): Phase {
  let cur: Phase | null = null
  for (let i = 0; i < Math.min(upto, events.length); i++) {
    const p = readLine(events[i], i, homeId, cur, events[i + 1], events[i].type === 'TRY' && manUpAt(events, i))
    if (p) cur = p
  }
  return cur ?? { kind: 'kickoff', homeBall: true, x: 50, y: 35, at: -1, label: 'lp.kickoff' }
}
