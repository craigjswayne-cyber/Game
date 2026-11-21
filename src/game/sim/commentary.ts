// THE COMMENTARY (2.0.0, docs/match-sim-spec.md sections 2 and 7).
//
// Owner, 20 November 2026: "There is still no connection with players,
// commentary & graphics." The old commentary was written from a pool of lines
// about a match the engine had not played: "all the territory with
// Northampton" when Northampton had only just kicked off, a breakdown penalty
// with no breakdown. Here every line is written from the match record
// (record.ts) and from nothing else.
//
// THE RULE. A line says what happened in one Play (its index is Line.n), and
// may lean only on that Play and the Plays before it. It never looks ahead:
// "scrum to Glasgow" is said at the scrum, with the knock-on before it as the
// reason, not at the knock-on. Even the law's own meaning of a result waits
// for the play that carries it out: "their throw" after a penalty kicked to
// touch is said at the lineout, because the whistle for half-time or full
// time can come first.
//
// Lines are keys and values, not sentences (commentary.en.ts has the words),
// so the game's other languages can be added key for key. Each line has a few
// wordings; the one used is chosen from the play's index, so a re-run of the
// same match reads the same.
//
// WHAT IS NOT SAID, ON PURPOSE (SILENT below): routine carries and rucks
// (about 120 of each a match) are folded into a phase count every few phases
// and a line for a big carry or a big hit; a play that only completes the one
// before it (the carry that was knocked on, the touch after a man was
// bundled out) is said once, at whichever of the two carries the detail.
import type { Play, PlayKind, SimResult } from './record'
import { SIM_EN, EN_FLAT } from './commentary.en'
import { K } from './skeleton'

export interface Line {
  /** the index of the Play this line describes */
  n: number
  /** the match clock of that Play, in seconds */
  t: number
  key: string
  params: Record<string, string | number>
  level: 'key' | 'normal' | 'minor'
  /** the side the line is about, or null (half-time, full time) */
  side: 0 | 1 | null
}

export interface Names {
  teams: [string, string]
  /** a player's name from his id; '' when he is not known */
  player(id: string): string
}

/**
 * Kind/result pairs that get no line of their own, and why. Every other pair
 * the record can hold gets at least one line every time it happens
 * (tests/simcommentary.test.ts holds both halves of that).
 */
export const SILENT: Record<string, string> = {
  'carry/gainLine': 'routine: said only for a carry of 10 metres or more (carryBig)',
  'carry/held': 'routine: said only when the carrier is driven back 2.5 metres or more (carryBack)',
  'carry/knockedOn': 'said at the knockOn play that follows it',
  'carry/forwardPass': 'said at the forwardPass play that follows it',
  'carry/overTheLine': 'said at the try or the heldUp that follows it',
  'ruck/recycled': 'routine: folded into a phase count at 5, 8, 11 ... phases (phases)',
  'ruck/penaltyWon': 'said at the penalty that follows it, with the man penalised',
  'ruck/penaltyLost': 'said at the penalty that follows it, with the man who won it',
  'ruck/unplayable': 'said at the unplayable play that follows it',
  'maul/stopped': 'said at the unplayable play that follows it',
  'intoTouch/carried': 'said at the carry that went into touch, and as the reason at the lineout',
  'notStraight/scrum': 'said at the lineout (not straight) and as the reason at the scrum',
}

/** the bases a summary of the match so far is written with (not a description of one play) */
export const SUMMARY = new Set(['territory', 'possession', 'tries', 'run', 'binBack', 'winBy', 'draw', 'tryAgain'])

/** bases used only when the record has an order this file does not expect: the tests hold them at zero */
export const FALLBACK = new Set(['dropOut', 'dropGl', 'scrum', 'lo', 'pen', 'free', 'kickOther'])

const ANY: PlayKind[] = ['kickoff', 'dropout22', 'goalLineDropout', 'scrum', 'lineout', 'tap', 'carry', 'ruck', 'maul', 'lineBreak', 'kick', 'catch',
  'knockOn', 'forwardPass', 'notStraight', 'unplayable', 'restartError', 'intoTouch', 'outOnFull', 'deadBall', 'heldUp', 'penalty', 'freeKick',
  'try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'halfTime', 'fullTime']

/** the kinds of Play each base may be written for */
export const BASE_KINDS: Record<string, PlayKind[]> = {
  zoneOwnEnd: [], zoneOwnHalf: [], zoneOppHalf: [], zoneOppEnd: [],
  koStart: ['kickoff'], koSecond: ['kickoff'], koAfterScore: ['kickoff'], restartError: ['restartError'],
  dropDead: ['dropout22'], dropPenMiss: ['dropout22'], dropDropMiss: ['dropout22'], dropOut: ['dropout22'],
  dropGlHeld: ['goalLineDropout'], dropGlTouched: ['goalLineDropout'], dropGl: ['goalLineDropout'],
  catchKo: ['catch'], regatherKo: ['catch'], catchKick: ['catch'], regatherKick: ['catch'], catchDrop: ['catch'], regatherDrop: ['catch'], chargeRegather: ['catch'],
  carryBig: ['carry'], carryBack: ['carry'], carryTouch: ['carry'], phases: ['ruck'], turnover: ['ruck'],
  breakClean: ['lineBreak'], breakHauled: ['lineBreak'], breakLastGasp: ['lineBreak'], forwardPass: ['forwardPass'],
  unplayableRuck: ['unplayable'], unplayableMaul: ['unplayable'],
  koKnock: ['knockOn'], highKnock: ['knockOn'], chaseKnock: ['knockOn'], contactKnock: ['knockOn'],
  kickBox: ['kick'], kickLong: ['kick'], kickHigh: ['kick'], kickGrubber: ['kick'], kickOther: ['kick'], kickTouch: ['kick'], penTouch: ['kick'],
  fiftyTwentyTwo: ['kick'], outFull: ['kick'], kickDead: ['kick'], chargedDown: ['kick'], freeKickKick: ['kick'],
  bouncedOut: ['intoTouch'], ranDead: ['deadBall'], touchedDown: ['deadBall'],
  scrumKnock: ['scrum'], scrumForward: ['scrum'], scrumNotStraight: ['scrum'], scrumUnplayable: ['scrum'], scrumRestart: ['scrum'], scrumChoice: ['scrum'], scrum: ['scrum'],
  scrumAgainstHead: ['scrum'], scrumFree: ['scrum'],
  loTouch: ['lineout'], loPen: ['lineout'], loFifty: ['lineout'], loFull: ['lineout'], loBounced: ['lineout'], loCarried: ['lineout'], loFreeTouch: ['lineout'], lo: ['lineout'],
  loWon: ['lineout'], loStolen: ['lineout'], loNotStraight: ['lineout'], loPenalty: ['lineout'],
  maulOut: ['maul'], maulNoGain: ['maul'], maulOver: ['maul'], maulDown: ['maul'],
  penRuckDef: ['penalty'], penRuckAtt: ['penalty'], penScrum: ['penalty'], penMaul: ['penalty'], penLineout: ['penalty'], penKick: ['penalty'], pen: ['penalty'],
  freeScrum: ['freeKick'], freeLineout: ['freeKick'], free: ['freeKick'], tapPen: ['tap'], tapFree: ['tap'],
  yellowCynical: ['yellowCard'], yellowFoul: ['yellowCard'], yellowPenTry: ['yellowCard'], red: ['redCard'], binBack: ANY, penaltyTry: ['penaltyTry'],
  tryClose: ['try'], tryWide: ['try'], tryBreak: ['try'], tryMaul: ['try'], tryCharge: ['try'], tryAgain: ['try'],
  heldUp: ['heldUp'], heldUpMaul: ['heldUp'], conOver: ['conversion'], conWide: ['conversion'],
  penAim: ['penaltyGoal'], penOver: ['penaltyGoal'], penWide: ['penaltyGoal'], dropOver: ['dropGoal'], dropWide: ['dropGoal'],
  run: ['conversion', 'penaltyGoal', 'dropGoal', 'penaltyTry'],
  halfTime: ['halfTime'], fullTime: ['fullTime'], tries: ['halfTime', 'fullTime'], possession: ['halfTime', 'fullTime'], winBy: ['fullTime'], draw: ['fullTime'],
  territory: ['scrum', 'lineout', 'penalty'],
}

/** placeholders that name a man: a wording is only used when each it names is named */
const NAME_PH = ['player', 'player2', 'oppPlayer'] as const
const NEEDS: Record<string, string[][]> = Object.fromEntries(
  Object.entries(SIM_EN).map(([b, list]) => [b, list.map(s => NAME_PH.filter(k => s.includes(`{${k}}`)))]),
)

const mix = (a: number) => {
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b); a = Math.imul(a ^ (a >>> 16), 0x45d9f3b)
  return (a ^ (a >>> 16)) >>> 0
}
const strHash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0; return h }

/** how far a side is from the line it attacks: side 0 plays towards x = 100 */
export const toLine = (s: 0 | 1, x: number) => (s === 0 ? 100 - x : x)
/** metres from the mark to the middle of the posts */
export const toPosts = (s: 0 | 1, x: number, y: number) => Math.round(Math.hypot(toLine(s, x), y - 35))
const zoneKey = (s: 0 | 1, x: number) => {
  const d = toLine(s, x)
  return d <= 22 ? 'sim.zoneOppEnd1' : d < 50 ? 'sim.zoneOppHalf1' : d < 78 ? 'sim.zoneOwnHalf1' : 'sim.zoneOwnEnd1'
}

/** seconds of ball in play in each team's attacking half, over the plays of this half up to `upto` whose clock is after `since` */
export function territory(plays: Play[], upto: number, since: number): [number, number] {
  const w: [number, number] = [0, 0]
  for (let i = upto; i >= 0 && plays[i].t > since; i--) {
    const p = plays[i]
    if (p.kind === 'halfTime') break
    if (p.live <= 0) continue
    if (p.x > 50) w[0] += p.live
    else if (p.x < 50) w[1] += p.live
  }
  return w
}

/** seconds of ball in play each side had the ball, over plays 0..upto (the side with it when the play began) */
export function possession(plays: Play[], upto: number): [number, number] {
  const w: [number, number] = [0, 0]
  for (let i = 0; i <= upto; i++) {
    const owner = i > 0 ? plays[i - 1].ball : plays[i].side
    w[owner] += plays[i].live
  }
  return w
}

export function commentate(result: SimResult, names: Names): Line[] {
  const plays = result.plays
  const T = names.teams
  const out: Line[] = []
  const nm = (id: string | undefined) => {
    if (!id) return ''
    try { return names.player(id) || '' } catch { return '' }
  }
  const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)

  // what the record has told us so far
  const bins: { side: 0 | 1; until: number }[] = []
  const reds: [number, number] = [0, 0]
  const tryCount = new Map<string, number>()
  /** which side a man is on, learned from plays where only his own side can be named */
  const idSide = new Map<string, 0 | 1>()
  let halfStart = 0
  let lastTerr = -Infinity
  let runSide: 0 | 1 | null = null, runPts = 0, runSaid = 0
  let prevScore: [number, number] = [0, 0]

  for (const p of plays) {
    const n = p.n
    let j = 0
    const say = (base: string, level: Line['level'], side: 0 | 1 | null, extra: Record<string, string | number | undefined> = {}) => {
      const params: Record<string, string | number> = {}
      if (side !== null) { params.team = T[side]; params.opp = T[other(side)] }
      for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') params[k] = v
      const list = SIM_EN[base]
      if (!list) throw new Error(`commentary: no words for ${base}`)
      const ok = list.map((_, i) => i).filter(i => NEEDS[base][i].every(k => params[k] !== undefined))
      const most = Math.max(...ok.map(i => NEEDS[base][i].length))
      const c = ok.filter(i => NEEDS[base][i].length === most)
      const i = c[mix(n * 131 + j * 17 + strHash(base)) % c.length]
      j++
      out.push({ n, t: p.t, key: `sim.${base}${i + 1}`, params, level, side })
    }
    const prev = plays[n - 1] as Play | undefined
    /** the play before, stepping back over cards (a card comes between a penalty and what is done with it) */
    const before = (() => { let i = n - 1; while (i >= 0 && (plays[i].kind === 'yellowCard' || plays[i].kind === 'redCard')) i--; return plays[i] as Play | undefined })()
    const s = p.side, o = other(s)
    const score = { home: T[0], away: T[1], hs: p.score[0], as: p.score[1] }

    // learn sides from roles that can only be the side's own man
    if (p.who && (p.kind === 'carry' || p.kind === 'kick' || p.kind === 'catch' || p.kind === 'lineBreak')) idSide.set(p.who, s)

    // a man back from the bin
    for (let b = bins.length - 1; b >= 0; b--) {
      if (p.t >= bins[b].until) {
        const side = bins[b].side
        bins.splice(b, 1)
        const men = 15 - reds[side] - bins.filter(x => x.side === side).length
        say('binBack', 'normal', side, { men })
      }
    }

    switch (p.kind) {
      case 'kickoff': {
        if (prev?.kind === 'halfTime') halfStart = p.t - p.live - p.dead
        const base = !prev ? 'koStart' : prev.kind === 'halfTime' ? 'koSecond' : 'koAfterScore'
        say(base, 'normal', s, { player: nm(p.who) })
        break
      }
      case 'catch': {
        const player = nm(p.who)
        if (p.result === 'chargeDownRegathered') { say('chargeRegather', 'normal', s, { player }); break }
        const reg = p.result === 'regathered'
        if (prev?.kind === 'kickoff') say(reg ? 'regatherKo' : 'catchKo', reg ? 'normal' : 'minor', s, { player })
        else if (prev?.kind === 'dropout22' || prev?.kind === 'goalLineDropout') say(reg ? 'regatherDrop' : 'catchDrop', reg ? 'normal' : 'minor', s, { player })
        else say(reg ? 'regatherKick' : 'catchKick', reg ? 'normal' : 'minor', s, { player })
        break
      }
      case 'carry': {
        const player = nm(p.who), oppPlayer = nm(p.vs?.[0]), g = p.gain ?? 0
        if (p.result === 'intoTouch') say('carryTouch', 'normal', s, { player, oppPlayer })
        else if (p.result === 'gainLine' && g >= 10) say('carryBig', 'normal', s, { player, m: Math.round(g) })
        else if ((p.result === 'held' || p.result === 'gainLine') && g <= -2.5) say('carryBack', 'minor', s, { player, oppPlayer })
        break
      }
      case 'ruck': {
        if (p.result === 'recycled') {
          const ph = p.phase ?? 0
          if (ph >= 5 && (ph - 5) % 3 === 0) say('phases', 'minor', s, { phase: ph, zone_k: zoneKey(s, p.x) })
        } else if (p.result === 'turnover') {
          const in22 = p.x <= 22 || p.x >= 78
          say('turnover', in22 ? 'key' : 'normal', s, { oppPlayer: nm(p.vs?.[0]) })
        }
        break
      }
      case 'lineBreak': {
        const player = nm(p.who), oppPlayer = nm(p.vs?.[0])
        if (p.result === 'clean') say('breakClean', 'key', s, { player })
        else {
          const d = toLine(s, p.x)
          if (d <= 5) say('breakLastGasp', 'key', s, { player, oppPlayer, d: Math.max(1, Math.round(d)) })
          else say('breakHauled', 'key', s, { player, oppPlayer, m: Math.round(p.gain ?? 0) })
        }
        break
      }
      case 'kick': {
        const player = nm(p.who), m = Math.round(p.gain ?? 0)
        if (prev?.kind === 'freeKick') say('freeKickKick', 'minor', s)
        switch (p.result) {
          case 'inPlay': {
            const base = p.kick === 'box' ? 'kickBox' : p.kick === 'long' ? 'kickLong' : p.kick === 'upAndUnder' ? 'kickHigh' : p.kick === 'grubber' ? 'kickGrubber' : 'kickOther'
            say(base, 'normal', s, { player, m })
            break
          }
          case 'touch': say('kickTouch', 'normal', s, { player, m }); break
          case 'penaltyToTouch': say('penTouch', 'normal', s, { player, m, zone_k: zoneKey(s, p.x) }); break
          case 'fiftyTwentyTwo': say('fiftyTwentyTwo', 'normal', s, { player }); break
          case 'outOnFull': say('outFull', 'normal', s, { player }); break
          case 'dead': say('kickDead', 'normal', s, { player }); break
          case 'chargedDown': say('chargedDown', 'normal', s, { player, oppPlayer: nm(p.vs?.[0]) }); break
        }
        break
      }
      case 'knockOn': {
        const player = nm(p.who)
        const base = p.result === 'underTheRestart' ? 'koKnock' : p.result === 'underTheHighBall' ? 'highKnock' : p.result === 'inTheChase' ? 'chaseKnock' : 'contactKnock'
        say(base, 'normal', s, { player, oppPlayer: base === 'contactKnock' ? nm(p.vs?.[0]) : undefined })
        break
      }
      case 'forwardPass': say('forwardPass', 'normal', s, { player: nm(p.who) }); break
      case 'unplayable': say(prev?.kind === 'maul' ? 'unplayableMaul' : 'unplayableRuck', 'normal', s); break
      case 'restartError': say('restartError', 'normal', s); break
      case 'intoTouch': {
        if (p.result === 'bounced') say('bouncedOut', 'normal', s, { player: prev?.kind === 'kick' && prev.side === s ? nm(prev.who) : '' })
        break
      }
      case 'deadBall': say(p.result === 'touchedDown' ? 'touchedDown' : 'ranDead', 'normal', s); break
      case 'heldUp': {
        if (prev?.kind === 'maul') say('heldUpMaul', 'key', s)
        else say('heldUp', 'key', s, { player: prev?.kind === 'carry' && prev.side === s ? nm(prev.who) : '' })
        break
      }
      case 'dropout22': {
        const base = prev?.kind === 'deadBall' && prev.side === o ? 'dropDead'
          : prev?.kind === 'penaltyGoal' && prev.side === o ? 'dropPenMiss'
          : prev?.kind === 'dropGoal' && prev.side === o ? 'dropDropMiss' : 'dropOut'
        say(base, 'normal', s)
        break
      }
      case 'goalLineDropout': {
        const base = prev?.kind === 'heldUp' && prev.side === o ? 'dropGlHeld' : prev?.kind === 'deadBall' && prev.side === o ? 'dropGlTouched' : 'dropGl'
        say(base, 'normal', s)
        break
      }
      case 'penalty': {
        const zone_k = zoneKey(s, p.x)
        if (prev?.kind === 'ruck' && prev.result === 'penaltyWon' && prev.side === s) say('penRuckDef', 'normal', s, { zone_k, oppPlayer: nm(prev.vs?.[0]) })
        else if (prev?.kind === 'ruck' && prev.result === 'penaltyLost' && prev.side === o) say('penRuckAtt', 'normal', s, { zone_k, player: nm(prev.vs?.[0]) })
        else if (prev?.kind === 'scrum' && prev.result === 'penaltyWon' && prev.side === s) say('penScrum', 'normal', s, { zone_k, oppPlayer: nm(prev.vs?.[0]) })
        else if (prev?.kind === 'scrum' && prev.result === 'penaltyLost' && prev.side === o) say('penScrum', 'normal', s, { zone_k, oppPlayer: nm(prev.who) })
        else if (prev?.kind === 'maul' && prev.result === 'pulledDown' && prev.side === s) say('penMaul', 'normal', s, { zone_k })
        else if (prev?.kind === 'lineout' && prev.result === 'penalty') say('penLineout', 'normal', s, { zone_k })
        else if (prev?.kind === 'kick' && prev.result === 'inPlay') say('penKick', 'normal', s, { zone_k })
        else say('pen', 'normal', s, { zone_k })
        break
      }
      case 'freeKick': {
        const base = prev?.kind === 'scrum' && prev.result === 'freeKick' ? 'freeScrum' : prev?.kind === 'lineout' && prev.result === 'penalty' ? 'freeLineout' : 'free'
        say(base, 'normal', s)
        break
      }
      case 'tap': say(before?.kind === 'freeKick' ? 'tapFree' : 'tapPen', 'normal', s); break
      case 'yellowCard': {
        bins.push({ side: s, until: p.t - p.live - p.dead + K.BIN_S })
        const men = 15 - reds[s] - bins.filter(x => x.side === s).length
        say(p.result === 'cynical' ? 'yellowCynical' : p.result === 'penaltyTry' ? 'yellowPenTry' : 'yellowFoul', 'key', s, { player: nm(p.who), men })
        break
      }
      case 'redCard': {
        reds[s]++
        const men = 15 - reds[s] - bins.filter(x => x.side === s).length
        say('red', 'key', s, { player: nm(p.who), men })
        break
      }
      case 'try': {
        let who = p.who
        // a charge-down try: the record's scorer is named only if he is known to be on the scoring side
        if (p.result === 'chargeDown' && who && idSide.get(who) !== s) who = undefined
        const player = nm(who)
        const base = p.result === 'close' ? 'tryClose' : p.result === 'wide' ? 'tryWide' : p.result === 'break' ? 'tryBreak' : p.result === 'maul' ? 'tryMaul' : 'tryCharge'
        say(base, 'key', s, { player })
        if (who) {
          const c = (tryCount.get(who) ?? 0) + 1
          tryCount.set(who, c)
          if (c >= 2 && player) say('tryAgain', 'key', s, { player, count: c })
        }
        break
      }
      case 'penaltyTry': say('penaltyTry', 'key', s, score); break
      case 'conversion': say(p.good ? 'conOver' : 'conWide', 'key', s, { player: nm(p.who), ...score }); break
      case 'penaltyGoal': {
        say('penAim', 'key', s, { player: nm(p.who), m: toPosts(s, p.x, p.y) })
        say(p.good ? 'penOver' : 'penWide', 'key', s, { player: nm(p.who), ...score })
        break
      }
      case 'dropGoal': say(p.good ? 'dropOver' : 'dropWide', 'key', s, { m: toPosts(s, p.x, p.y), ...(p.good ? score : {}) }); break
      case 'scrum': {
        const reason = prev?.kind === 'knockOn' && prev.side === o ? 'scrumKnock'
          : prev?.kind === 'forwardPass' && prev.side === o ? 'scrumForward'
          : prev?.kind === 'notStraight' && prev.side === o ? 'scrumNotStraight'
          : prev?.kind === 'unplayable' ? 'scrumUnplayable'
          : prev?.kind === 'restartError' && prev.side === o ? 'scrumRestart'
          : before?.kind === 'penalty' && before.side === s ? 'scrumChoice' : 'scrum'
        say(reason, 'normal', s)
        if (p.result === 'againstTheHead') say('scrumAgainstHead', 'normal', s)
        else if (p.result === 'freeKick') say('scrumFree', 'normal', s)
        break
      }
      case 'lineout': {
        const pp = plays[n - 2] as Play | undefined
        const reason = prev?.kind === 'intoTouch' && prev.side === o ? (prev.result === 'carried' ? 'loCarried' : 'loBounced')
          : prev?.kind === 'kick' && prev.result === 'touch' && prev.side === o ? (pp?.kind === 'freeKick' ? 'loFreeTouch' : 'loTouch')
          : prev?.kind === 'kick' && prev.result === 'penaltyToTouch' && prev.side === s ? 'loPen'
          : prev?.kind === 'kick' && prev.result === 'fiftyTwentyTwo' && prev.side === s ? 'loFifty'
          : prev?.kind === 'kick' && prev.result === 'outOnFull' && prev.side === o ? 'loFull' : 'lo'
        say(reason, 'normal', s)
        if (p.result === 'won') say('loWon', 'minor', s, { player: nm(p.who), player2: nm(p.with?.[0]) })
        else if (p.result === 'stolen') say('loStolen', 'normal', s, { player: nm(p.who), oppPlayer: nm(p.vs?.[0]) })
        else if (p.result === 'notStraight') say('loNotStraight', 'normal', s, { player: nm(p.who) })
        else if (p.result === 'penalty') say('loPenalty', 'normal', s)
        break
      }
      case 'maul': {
        const g = Math.round(p.gain ?? 0)
        if (p.result === 'ballOut') say(g >= 3 ? 'maulOut' : 'maulNoGain', 'minor', s, { m: g })
        else if (p.result === 'driven') say('maulOver', 'key', s)
        else if (p.result === 'pulledDown') say('maulDown', 'normal', s)
        break
      }
      case 'halfTime':
      case 'fullTime': {
        const ft = p.kind === 'fullTime'
        say(ft ? 'fullTime' : 'halfTime', 'normal', null, score)
        const tr: [number, number] = [0, 0]
        for (let i = 0; i <= n; i++) if (plays[i].kind === 'try' || plays[i].kind === 'penaltyTry') tr[plays[i].side]++
        say('tries', 'minor', null, { home: T[0], away: T[1], ht: tr[0], at: tr[1] })
        if (ft) {
          if (p.score[0] === p.score[1]) say('draw', 'normal', null)
          else say('winBy', 'normal', null, { winner: T[p.score[0] > p.score[1] ? 0 : 1], margin: Math.abs(p.score[0] - p.score[1]) })
        }
        const ps = possession(plays, n), tot = ps[0] + ps[1]
        if (tot > 0) { const hp = Math.round(100 * ps[0] / tot); say('possession', 'minor', null, { home: T[0], away: T[1], hp, ap: 100 - hp }) }
        if (!ft) { halfStart = Infinity; lastTerr = -Infinity }
        break
      }
    }

    // points without reply, said once the score is complete (after the conversion, the kick, the drop)
    const d0 = p.score[0] - prevScore[0], d1 = p.score[1] - prevScore[1]
    if (d0 > 0 || d1 > 0) {
      const by: 0 | 1 = d0 > 0 ? 0 : 1
      if (runSide === by) runPts += d0 + d1
      else { runSide = by; runPts = d0 + d1; runSaid = 0 }
      prevScore = [p.score[0], p.score[1]]
    }
    if ((p.kind === 'conversion' || p.kind === 'penaltyGoal' || p.kind === 'dropGoal' || p.kind === 'penaltyTry') && runSide === p.side && runPts >= 15 && runPts >= runSaid + 10) {
      say('run', 'normal', p.side, { count: runPts })
      runSaid = runPts
    }

    // territory over the last ten minutes, said at a stoppage, at most every fifteen minutes, and only ten minutes into a half
    if ((p.kind === 'scrum' || p.kind === 'lineout' || p.kind === 'penalty') && p.t - halfStart >= 600 && p.t - lastTerr >= 900) {
      const w = territory(plays, n, p.t - 600), tot = w[0] + w[1]
      if (tot >= 120) {
        for (const side of [0, 1] as const) {
          const pct = Math.round(100 * w[side] / tot)
          if (pct >= 70) { say('territory', 'minor', side, { pct }); lastTerr = p.t }
        }
      }
    }
  }
  return out
}

/** a line in English */
export function render(line: Line): string {
  return fill(EN_FLAT[line.key] ?? line.key, line.params)
}

function fill(s: string, params: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (all, k: string) => {
    const v = params[k]
    if (v === undefined) return all
    if (k.endsWith('_k')) return fill(EN_FLAT[String(v)] ?? String(v), params)
    return String(v)
  })
}
