// THE COMMENTARY (2.0.0, docs/match-sim-spec.md sections 2 and 7).
//
// Owner, 20 November 2026: "There is still no connection with players,
// commentary & graphics." The old commentary was written from a pool of lines
// about a match the engine had not played: "all the territory with
// Northampton" when Northampton had only just kicked off, a breakdown penalty
// with no breakdown. Here every line is written from the match record
// (record.ts) and from nothing else, plus the plain facts the game passes in
// about the occasion (Context: the weather, a derby, the table).
//
// THE RULE. A line says what happened in one Play (its index is Line.n), and
// may lean only on that Play and the Plays before it. It never looks ahead:
// "scrum to Glasgow" is said at the scrum, with the knock-on before it as the
// reason, not at the knock-on. The law's meaning of a result waits for the
// play that carries it out: "their throw" after a penalty kicked to touch is
// said at the lineout, because the whistle for half-time can come first.
// The one look ahead is to stay quiet: a kick the other side catches is said
// once, with the catch ("the Glasgow box kick is taken by Steward").
//
// MORE TO SAY (owner, 22 November 2026: "we need more commentary notes to
// keep it engaging and clear", "the games shouldn't feel repetitive"). Beside
// the play itself, notes worked out from the record so far: the story of the
// score (lead changes, comebacks, runs, two-score games, the last ten
// minutes), the men (a goal kicker's count, tackles, carries, turnovers,
// lineout takes, a man back from the bin, a replacement's first touch), the
// sides (territory, penalties against them, set-piece record, visits to the
// 22, handling errors) and the choice at each penalty. Every one is worked
// out again, independently, in tests/simcommentary.test.ts.
//
// SPEED. The pitch shows every play, mostly on fast forward. Each line has a
// priority (3: never dropped: key moments, scores, cards and every reason
// for a stoppage or restart; 2: the play; 1: a note worth hearing; 0:
// colour), and thin() takes the pitch's schedule and drops the lowest until
// no more than one new line comes every 1.4 seconds of viewing, never
// dropping a priority 3 line.
//
// NO REPETITION. Each line has several wordings (commentary.en.ts). Within a
// match a line uses every wording before it repeats one, and the same
// sentence is never written twice within twelve lines. The choice depends
// only on the record, so a re-run reads the same.
//
// Lines are keys and values, not sentences, so the game's other languages
// can be added key for key.
import type { Play, PlayKind, SimResult } from './record'
import { SIM_EN, EN_FLAT } from './commentary.en'
import { K } from './skeleton'

export interface Line {
  /** the index of the Play this line describes */
  n: number
  /** the referee's clock at that Play (Play.clock), in seconds: what the screen shows as the minute.
   *  The second half starts at 2400. (Play.t, the playing time, for records made before clock existed.) */
  t: number
  key: string
  params: Record<string, string | number>
  level: 'key' | 'normal' | 'minor'
  /** the side the line is about, or null (half-time, full time) */
  side: 0 | 1 | null
  /** 3 never dropped (key moments, scores, cards, the reason for every stoppage and restart),
   *  2 the play itself, 1 a note worth hearing, 0 colour. thin() drops from the bottom. */
  priority: number
}

export interface Names {
  teams: [string, string]
  /** a player's name from his id; '' when he is not known */
  player(id: string): string
}

/** plain facts about the occasion, passed in by the game (none of it is read from game state here) */
export interface Context {
  /** a league match, where four tries earn a bonus point (src/game/season/tables.ts applyToTable) */
  bonusPoints?: boolean
  derby?: boolean
  /** the cup or stage, as a proper name to show (a knockout tie) */
  cup?: string
  /** league positions before the match, home then away */
  table?: [number, number]
  venue?: string
  /** the fixture's weather (model Weather) */
  weather?: 'Dry' | 'Damp' | 'Rain' | 'Wind' | 'Snow'
  /** the ground (model Surface) */
  surface?: 'grass' | 'hybrid' | 'artificial'
  /** each side's captain, by the record's player id */
  captains?: [string | undefined, string | undefined]
}

export interface CommentaryOpts {
  /** 'fast' leaves out colour (priority 0) before any schedule is known; thin() does the rest */
  density?: 'full' | 'fast'
}

/** one play of the pitch's schedule (src/ui/livepitch/fromRecord.ts Slot): viewing seconds */
export interface SlotLike { n: number; start: number; dur?: number; speed?: number }

/**
 * Kind/result pairs that get no line of their own, and why. Every other pair
 * the record can hold gets at least one line every time it happens
 * (tests/simcommentary.test.ts holds both halves of that).
 */
export const SILENT: Record<string, string> = {
  'carry/gainLine': 'routine: said for a carry of 10 metres or more, a pick and go near the line, or a man\'s milestone',
  'carry/held': 'routine: said for a pick and go near the line, or a man\'s milestone',
  'carry/drivenBack': 'routine: said when the carrier is driven back 2.5 metres or more (carryBack), a pick and go near the line, or a milestone',
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
  'kick/inPlay': 'when the other side catches it cleanly, said once, with the catch (kickCaught)',
}

/** lines about the match so far (the score, the men, the sides, the occasion), not a description of one play */
export const SUMMARY = new Set([
  'territory', 'possession', 'tries', 'run', 'binBack', 'winBy', 'draw', 'tryAgain',
  'firstScore', 'leadTaken', 'levelScores', 'biggestLead', 'comeback', 'comebackLevel', 'comebackLead', 'twoScore', 'beforeHalf', 'afterHalf',
  'bonusTry', 'lateTrail', 'lateLast', 'lateRed', 'lateLevel', 'lateRedLevel', 'scoreManUp', 'scoreManDown',
  'binOutcomeWon', 'binOutcomeLost', 'binOutcomeLevel',
  'goalRun', 'goalPerfect', 'missRun', 'statTackles', 'statCarries', 'statMetres', 'statTurnovers', 'statLineout', 'statSteals',
  'offenderPens', 'scrumPensWon', 'backFromBin', 'subFirst', 'capPosts', 'capCorner', 'capTap', 'capScrum',
  'choicePosts', 'choiceCorner', 'choiceTap', 'choiceScrum',
  'ballTen', 'pensWarn', 'pensTotal', 'loRecord', 'scRecord', 'entries', 'outFullCount', 'handlingCount', 'turnoversCount', 'tryType',
  'introDerby', 'introCup', 'introTable', 'introVenue', 'wxDamp', 'wxRain', 'wxWind', 'wxSnow', 'surfArtificial', 'weatherKnock',
])

/** bases used only when the record has an order this file does not expect: the tests hold them at zero */
export const FALLBACK = new Set(['dropOut', 'dropGl', 'scrum', 'lo', 'pen', 'free', 'kickOther'])

const ANY: PlayKind[] = ['kickoff', 'dropout22', 'goalLineDropout', 'scrum', 'lineout', 'tap', 'carry', 'offload', 'ruck', 'maul', 'lineBreak', 'kick', 'catch',
  'knockOn', 'forwardPass', 'notStraight', 'unplayable', 'restartError', 'intoTouch', 'outOnFull', 'deadBall', 'heldUp', 'penalty', 'freeKick',
  'try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'halfTime', 'fullTime', 'substitution', 'injury']
const SCORES: PlayKind[] = ['conversion', 'penaltyGoal', 'dropGoal', 'penaltyTry']
const STOPS: PlayKind[] = ['penalty', 'freeKick', 'scrum', 'lineout', 'kickoff', 'dropout22', 'goalLineDropout']
/** words put inside other lines, never lines of their own */
const INNER = /^(zone|cause|nth|kind|type|need)[A-Z]/

/** the kinds of Play each base may be written for */
export const BASE_KINDS: Record<string, PlayKind[]> = {
  ...Object.fromEntries(Object.keys(SIM_EN).filter(b => INNER.test(b)).map(b => [b, [] as PlayKind[]])),
  koStart: ['kickoff'], koSecond: ['kickoff'], koAfterScore: ['kickoff'], restartNotTen: ['restartError'], restartOut: ['restartError'],
  dropDead: ['dropout22'], dropPenMiss: ['dropout22'], dropDropMiss: ['dropout22'], dropOut: ['dropout22'],
  dropGlHeld: ['goalLineDropout'], dropGlTouched: ['goalLineDropout'], dropGl: ['goalLineDropout'],
  catchKo: ['catch'], regatherKo: ['catch'], catchKick: ['catch'], kickCaught: ['catch'], regatherKick: ['catch'], catchDrop: ['catch'], regatherDrop: ['catch'], chargeRegather: ['catch'],
  carryBig: ['carry'], carryBack: ['carry'], offload: ['offload'], pickGo: ['carry'], carryTouch: ['carry'], intercepted: ['carry'], phases: ['ruck'], turnover: ['ruck'],
  breakClean: ['lineBreak'], breakHauled: ['lineBreak'], breakLastGasp: ['lineBreak'], interceptRun: ['lineBreak'], interceptHauled: ['lineBreak'],
  forwardPass: ['forwardPass'], unplayableRuck: ['unplayable'], unplayableMaul: ['unplayable'],
  koKnock: ['knockOn'], highKnock: ['knockOn'], chaseKnock: ['knockOn'], contactKnock: ['knockOn'],
  kickBox: ['kick'], kickLong: ['kick'], kickHigh: ['kick'], kickGrubber: ['kick'], kickCross: ['kick'], kickChip: ['kick'], kickOther: ['kick'], kickTouch: ['kick'], penTouch: ['kick'],
  fiftyTwentyTwo: ['kick'], outFull: ['kick'], kickDead: ['kick'], chargedDown: ['kick'], freeKickKick: ['kick'],
  bouncedOut: ['intoTouch'], ranDead: ['deadBall'], touchedDown: ['deadBall'],
  scrumKnock: ['scrum'], scrumForward: ['scrum'], scrumNotStraight: ['scrum'], scrumUnplayable: ['scrum'], scrumRestart: ['scrum'], scrumChoice: ['scrum'], scrum: ['scrum'],
  scrumAgainstHead: ['scrum'], scrumFree: ['scrum'],
  loTouch: ['lineout'], loPen: ['lineout'], loFifty: ['lineout'], loFull: ['lineout'], loBounced: ['lineout'], loCarried: ['lineout'], loFreeTouch: ['lineout'], loQuick: ['lineout'], lo: ['lineout'],
  loWon: ['lineout'], loStolen: ['lineout'], loNotStraight: ['lineout'], loPenalty: ['lineout'],
  maulOut: ['maul'], maulNoGain: ['maul'], maulOver: ['maul'], maulDown: ['maul'],
  penRuckDef: ['penalty'], penRuckAtt: ['penalty'], penScrum: ['penalty'], penMaul: ['penalty'], penLineout: ['penalty'], penKick: ['penalty'], pen: ['penalty'],
  freeScrum: ['freeKick'], freeLineout: ['freeKick'], free: ['freeKick'], tapPen: ['tap'], tapFree: ['tap'], tapNear: ['tap'], tapQuick: ['tap'],
  yellowCynical: ['yellowCard'], yellowFoul: ['yellowCard'], yellowPenTry: ['yellowCard'], red: ['redCard'], binBack: ANY, injured: ['injury'], subInjury: ['substitution'], subMade: ['substitution'], subRefused: ['substitution'],
  tryClose: ['try'], tryWide: ['try'], tryBreak: ['try'], tryMaul: ['try'], tryPickGo: ['try'], tryCharge: ['try'], tryInterception: ['try'], tryAgain: ['try'], penaltyTry: ['penaltyTry'],
  heldUp: ['heldUp'], heldUpMaul: ['heldUp'], conOver: ['conversion'], conWide: ['conversion'],
  penAim: ['penaltyGoal'], penOver: ['penaltyGoal'], penWide: ['penaltyGoal'], dropOver: ['dropGoal'], dropWide: ['dropGoal'],
  halfTime: ['halfTime'], fullTime: ['fullTime'], tries: ['halfTime', 'fullTime'], possession: ['halfTime', 'fullTime'], winBy: ['fullTime'], draw: ['fullTime'],
  // notes
  run: SCORES, firstScore: SCORES, leadTaken: SCORES, levelScores: SCORES, biggestLead: SCORES, comeback: SCORES, comebackLevel: SCORES, comebackLead: SCORES,
  twoScore: SCORES, beforeHalf: SCORES, afterHalf: SCORES, scoreManUp: SCORES, scoreManDown: SCORES, bonusTry: ['try', 'penaltyTry'], tryType: ['try'],
  lateTrail: STOPS, lateLast: STOPS, lateRed: STOPS, lateLevel: STOPS, lateRedLevel: STOPS,
  binOutcomeWon: ANY, binOutcomeLost: ANY, binOutcomeLevel: ANY,
  goalRun: ['conversion', 'penaltyGoal'], goalPerfect: ['conversion', 'penaltyGoal'], missRun: ['conversion', 'penaltyGoal'],
  statTackles: ['carry'], statCarries: ['carry', 'lineBreak'], statMetres: ['carry', 'lineBreak'], statTurnovers: ['ruck', 'carry', 'lineout'],
  statLineout: ['lineout'], statSteals: ['lineout'], offenderPens: ['penalty', 'freeKick'], scrumPensWon: ['penalty'],
  backFromBin: ANY, subFirst: ANY,
  capPosts: ['penaltyGoal'], capCorner: ['kick'], capTap: ['tap'], capScrum: ['scrum'],
  choicePosts: ['penaltyGoal'], choiceCorner: ['kick'], choiceTap: ['tap'], choiceScrum: ['scrum'],
  territory: ['scrum', 'lineout', 'penalty'], ballTen: ['scrum', 'lineout', 'penalty'], pensWarn: ['penalty'], pensTotal: ['penalty'],
  loRecord: ['lineout'], scRecord: ['scrum'], entries: ANY, outFullCount: ['kick'], handlingCount: ['knockOn', 'forwardPass'],
  turnoversCount: ['ruck', 'carry', 'lineout', 'scrum'],
  introDerby: ['kickoff'], introCup: ['kickoff'], introTable: ['kickoff'], introVenue: ['kickoff'],
  wxDamp: ['kickoff'], wxRain: ['kickoff'], wxWind: ['kickoff'], wxSnow: ['kickoff'], surfArtificial: ['kickoff'], weatherKnock: ['knockOn'],
}

/** priority 3: never dropped. Every key line, plus each line that says why play stopped or how it restarts */
export const MUST = new Set([
  'koStart', 'koSecond', 'restartNotTen', 'restartOut', 'dropDead', 'dropPenMiss', 'dropDropMiss', 'dropOut', 'dropGlHeld', 'dropGlTouched', 'dropGl',
  'carryTouch', 'forwardPass', 'unplayableRuck', 'unplayableMaul', 'koKnock', 'highKnock', 'chaseKnock', 'contactKnock',
  'kickTouch', 'penTouch', 'fiftyTwentyTwo', 'outFull', 'kickDead', 'bouncedOut', 'ranDead', 'touchedDown',
  'scrumKnock', 'scrumForward', 'scrumNotStraight', 'scrumUnplayable', 'scrumRestart', 'scrumChoice', 'scrum', 'scrumAgainstHead', 'scrumFree',
  'loTouch', 'loPen', 'loFifty', 'loFull', 'loBounced', 'loCarried', 'loFreeTouch', 'loQuick', 'lo', 'loStolen', 'loNotStraight', 'loPenalty',
  'maulDown', 'penRuckDef', 'penRuckAtt', 'penScrum', 'penMaul', 'penLineout', 'penKick', 'pen', 'freeScrum', 'freeLineout', 'free', 'tapPen', 'tapFree', 'tapNear', 'tapQuick', 'injured', 'subInjury',
  'binBack', 'subMade', 'subRefused', 'halfTime', 'fullTime', 'winBy', 'draw', 'turnover', 'chargedDown',
])
/** priority 1 (a note worth hearing) and 0 (colour); every other line is 2 */
const PRI: Record<string, number> = {
  ...Object.fromEntries([...SUMMARY].map(b => [b, 1])),
  statTackles: 0, statCarries: 0, statMetres: 0, statLineout: 0, offenderPens: 0, pensTotal: 0, possession: 0, tries: 1, ballTen: 0,
  handlingCount: 0, outFullCount: 0, turnoversCount: 0, tryType: 0, introVenue: 0, weatherKnock: 0, subFirst: 0, backFromBin: 0,
  phases: 0, loWon: 0, carryBack: 0, catchKick: 1, catchKo: 1, catchDrop: 1, maulOut: 1, maulNoGain: 1, freeKickKick: 1,
  winBy: 3, binBack: 3,
}
const priorityOf = (base: string, level: Line['level']) => (level === 'key' || MUST.has(base) ? 3 : PRI[base] ?? 2)

/** placeholders the record may or may not fill (a man's name, the reason for a penalty): a wording is
 *  only used when each it holds is filled, and the wordings that say the most are used first */
const NAME_PH = ['player', 'player2', 'oppPlayer', 'cause_k'] as const
const NEEDS: Record<string, string[][]> = Object.fromEntries(
  Object.entries(SIM_EN).map(([b, list]) => [b, list.map(s => NAME_PH.filter(k => s.includes(`{${k}}`)))]),
)
/** the passer is said in some wordings and not others: it does not decide which wordings may be used */
const SECONDARY: Record<string, string> = { tryPickGo: 'player2', tryClose: 'player2', tryWide: 'player2', tryBreak: 'player2', breakClean: 'player2', breakHauled: 'player2', carryBig: 'player2' }

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
const NTH = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six']
const nthKey = (c: number) => (c >= 2 && c <= 6 ? `sim.nth${NTH[c]}1` : undefined)

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

/** seconds of ball in play each side had the ball (the side with it when the play began), over plays `from`..`upto` */
export function possession(plays: Play[], upto: number, from = 0): [number, number] {
  const w: [number, number] = [0, 0]
  for (let i = from; i <= upto; i++) {
    const owner = i > 0 ? plays[i - 1].ball : plays[i].side
    w[owner] += plays[i].live
  }
  return w
}

/** a side has the ball inside the other side's 22 at the end of this play */
export const in22 = (p: Play, s: 0 | 1) => p.ball === s && toLine(s, p.x) <= 22 && p.kind !== 'halfTime' && p.kind !== 'fullTime'

/** the key for a penalty's reason, when the words have one */
const causeKey = (c: string | undefined) => {
  if (!c) return undefined
  const b = 'cause' + c[0].toUpperCase() + c.slice(1)
  return SIM_EN[b] ? `sim.${b}1` : undefined
}

export function commentate(result: SimResult, names: Names, context: Context = {}, opts: CommentaryOpts = {}): Line[] {
  const plays = result.plays
  const T = names.teams
  const out: Line[] = []
  const nm = (id: string | undefined) => {
    if (!id) return ''
    try { return names.player(id) || '' } catch { return '' }
  }
  const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)
  const CARD = new Set(['yellowCard', 'redCard'])
  const both = (): [number, number] => [0, 0]

  // ---- the wording memory: each line uses every wording before it repeats one, and no sentence twice in twelve lines
  const used = new Map<string, number[]>()
  const recent: string[] = []

  // ---- what the record has told us so far
  const bins: { side: 0 | 1; until: number; who?: string; at: [number, number] }[] = []
  const back: { side: 0 | 1; who?: string; at: [number, number] }[] = []
  const reds = both()
  const onField = (side: 0 | 1) => 15 - reds[side] - bins.filter(x => x.side === side).length
  const offIds = new Set<string>()
  const watchFirst = new Map<string, { base: 'backFromBin' | 'subFirst'; side: 0 | 1 }>()
  let halfStart = 0, lastTerr = -Infinity, lastBall = -Infinity
  let runSide: 0 | 1 | null = null, runPts = 0, runSaid = 0
  let prevScore: [number, number] = [0, 0], seqStart: [number, number] = [0, 0]
  let maxMargin = 0, bigSaid = 0
  const comebackSaid = [false, false]
  let inSecond = false
  const halfSaid = new Set<string>()
  const tries = both(), tryKinds: [Map<string, number>, Map<string, number>] = [new Map(), new Map()]
  const tryCount = new Map<string, number>()
  const kicker = new Map<string, { made: number; taken: number; miss: number }>()
  const stat = new Map<string, { tk: number; car: number; m: number; to: number; lo: number; st: number; pens: number }>()
  const st = (id: string) => { let v = stat.get(id); if (!v) { v = { tk: 0, car: 0, m: 0, to: 0, lo: 0, st: 0, pens: 0 }; stat.set(id, v) } return v }
  const pensAt: [number[], number[]] = [[], []], warnSaid = both(), scrumPens = both()
  const loOwn = both(), loLost = both(), scOwn = both(), scLost = both()
  const outFull = both(), handling = both(), turnWon = both()
  const entry = { n: both(), pts: both(), lastSaid: both(), inside: [false, false], from: [[0, 0], [0, 0]] as [number, number][] }
  let lastLate = -Infinity, lateScore = ''
  let penChoices = 0, knockCount = 0, carryNoteAt = -99, statAt = -99
  /** a man's numbers are said at most once every eight plays */
  const statOk = (n: number) => n - statAt >= 8

  for (const p of plays) {
    const n = p.n
    const clock = p.clock ?? p.t
    let j = 0
    const say = (base: string, level: Line['level'], side: 0 | 1 | null, extra: Record<string, string | number | undefined> = {}) => {
      const priority = priorityOf(base, level)
      if (opts.density === 'fast' && priority === 0) return
      // a note is never said straight after another of its own kind (the line that says what happened always is)
      const note = SUMMARY.has(base) || base === 'phases'
      const last = out[out.length - 1]
      if (note && last && last.key.slice(4).replace(/\d+$/, '') === base) return
      const params: Record<string, string | number> = {}
      if (side !== null) { params.team = T[side]; params.opp = T[other(side)] }
      for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') params[k] = v
      const list = SIM_EN[base]
      if (!list) throw new Error(`commentary: no words for ${base}`)
      const sec = SECONDARY[base]
      const prim = (i: number) => NEEDS[base][i].filter(k => k !== sec).length
      const ok = list.map((_, i) => i).filter(i => NEEDS[base][i].every(k => params[k] !== undefined))
      const most = Math.max(...ok.map(prim))
      const u = used.get(base) ?? list.map(() => 0)
      const c = ok.filter(i => prim(i) === most)
        .sort((a, b) => u[a] - u[b] || mix(n * 131 + j * 17 + a * 7 + strHash(base)) - mix(n * 131 + j * 17 + b * 7 + strHash(base)))
      const sig = (i: number) => `sim.${base}${i + 1}|${JSON.stringify(params)}`
      let i = c.find(x => !recent.includes(sig(x)))
      if (i === undefined) { if (note) return; i = c[0] }
      u[i]++; used.set(base, u)
      recent.push(sig(i)); if (recent.length > 12) recent.shift()
      j++
      out.push({ n, t: clock, key: `sim.${base}${i + 1}`, params, level, side, priority })
    }
    /** the play before, stepping back over substitutions (made while the ball is dead, between a stoppage and its restart) */
    const prev = (() => { let i = n - 1; while (i >= 0 && plays[i].kind === 'substitution') i--; return plays[i] as Play | undefined })()
    /** the same, stepping back over cards too (a card comes between a penalty and what is done with it) */
    const before = (() => { let i = n - 1; while (i >= 0 && (CARD.has(plays[i].kind) || plays[i].kind === 'substitution')) i--; return plays[i] as Play | undefined })()
    const s = p.side, o = other(s)
    const score = { home: T[0], away: T[1], hs: p.score[0], as: p.score[1] }

    // men back from the bin (by the record's own return second), said at the first play that is not a card
    for (let b = bins.length - 1; b >= 0; b--) if (p.t >= bins[b].until) { back.push(bins[b]); if (bins[b].who) watchFirst.set(bins[b].who!, { base: 'backFromBin', side: bins[b].side }); bins.splice(b, 1) }
    if (!CARD.has(p.kind) && back.length) {
      for (const b of back) {
        say('binBack', 'normal', b.side, { men: onField(b.side) })
        const a = p.score[b.side] - b.at[b.side], c = p.score[other(b.side)] - b.at[other(b.side)]
        say(a > c ? 'binOutcomeWon' : a < c ? 'binOutcomeLost' : 'binOutcomeLevel', 'minor', b.side, { a, b: c })
      }
      back.length = 0
    }

    switch (p.kind) {
      case 'kickoff': {
        if (prev?.kind === 'halfTime') halfStart = p.clock !== undefined ? 2400 : p.t - p.live - p.dead
        const base = !prev ? 'koStart' : prev.kind === 'halfTime' ? 'koSecond' : 'koAfterScore'
        say(base, 'normal', s, { player: nm(p.who) })
        if (!prev) {
          if (context.venue) say('introVenue', 'minor', null, { venue: context.venue })
          if (context.cup) say('introCup', 'minor', null, { cup: context.cup, home: T[0], away: T[1] })
          else if (context.derby) say('introDerby', 'minor', null, { home: T[0], away: T[1] })
          if (context.table && !context.cup) say('introTable', 'minor', null, { home: T[0], away: T[1], hp: context.table[0], ap: context.table[1] })
          if (context.weather && context.weather !== 'Dry') say(`wx${context.weather}`, 'minor', null)
          if (context.surface === 'artificial') say('surfArtificial', 'minor', null)
        }
        break
      }
      case 'catch': {
        const player = nm(p.who)
        if (p.result === 'chargeDownRegathered') { say('chargeRegather', 'normal', s, { player }); break }
        const reg = p.result === 'regathered'
        if (prev?.kind === 'kickoff') say(reg ? 'regatherKo' : 'catchKo', reg ? 'normal' : 'minor', s, { player })
        else if (prev?.kind === 'dropout22' || prev?.kind === 'goalLineDropout') say(reg ? 'regatherDrop' : 'catchDrop', reg ? 'normal' : 'minor', s, { player })
        else if (!reg && prev?.kind === 'kick' && prev.result === 'inPlay' && prev.side === o && !out.some(l => l.n === prev.n)) {
          const kk = prev.kick === 'box' ? 'Box' : prev.kick === 'long' ? 'Long' : prev.kick === 'upAndUnder' ? 'High' : prev.kick === 'grubber' ? 'Grubber'
            : prev.kick === 'crossField' ? 'Cross' : prev.kick === 'chip' ? 'Chip' : 'Other'
          say('kickCaught', 'normal', s, { player, kick_k: `sim.kind${kk}1` })
        } else say(reg ? 'regatherKick' : 'catchKick', reg ? 'normal' : 'minor', s, { player })
        break
      }
      case 'carry': {
        const player = nm(p.who), oppPlayer = nm(p.vs?.[0]), g = p.gain ?? 0, d = toLine(s, p.x)
        if (p.result === 'intoTouch') say('carryTouch', 'normal', s, { player, oppPlayer })
        else if (p.result === 'intercepted') say('intercepted', 'key', s, { player, oppPlayer })
        else if (p.result === 'gainLine' && g >= 10) { say('carryBig', 'normal', s, { player, player2: nm(p.with?.[0]), m: Math.round(g) }); carryNoteAt = n }
        else if ((p.result === 'held' || p.result === 'gainLine' || p.result === 'drivenBack') && n - carryNoteAt >= 6) {
          if (d <= 5 && d >= 0.5 && !p.passes && p.result !== 'drivenBack') { say('pickGo', 'minor', s, { player, d: Math.max(1, Math.round(d)) }); carryNoteAt = n }
          else if (g <= -2.5) { say('carryBack', 'minor', s, { player, oppPlayer }); carryNoteAt = n }
        }
        break
      }
      case 'offload': say('offload', 'normal', s, { player: nm(p.who), player2: nm(p.with?.[0]) }); break
      case 'ruck': {
        if (p.result === 'recycled') {
          const ph = p.phase ?? 0
          if (ph >= 5 && (ph - 5) % 3 === 0) say('phases', 'minor', s, { phase: ph, zone_k: zoneKey(s, p.x) })
        } else if (p.result === 'turnover') {
          const inside = p.x <= 22 || p.x >= 78
          say('turnover', inside ? 'key' : 'normal', s, { oppPlayer: nm(p.vs?.[0]) })
        }
        break
      }
      case 'lineBreak': {
        const player = nm(p.who), oppPlayer = nm(p.vs?.[0]), player2 = nm(p.with?.[0])
        if (p.result === 'interception') say('interceptRun', 'key', s, { player })
        else if (p.result === 'interceptionHauled') say('interceptHauled', 'key', s, { player, oppPlayer, zone_k: zoneKey(s, p.x) })
        else if (p.result === 'clean') say('breakClean', 'key', s, { player, player2 })
        else {
          const d = toLine(s, p.x)
          if (d <= 5) say('breakLastGasp', 'key', s, { player, oppPlayer, d: Math.max(1, Math.round(d)) })
          else say('breakHauled', 'key', s, { player, player2, oppPlayer, m: Math.round(p.gain ?? 0) })
        }
        break
      }
      case 'kick': {
        const player = nm(p.who), m = Math.round(p.gain ?? 0)
        if (prev?.kind === 'freeKick') say('freeKickKick', 'minor', s)
        switch (p.result) {
          case 'inPlay': {
            // (the one look ahead: caught cleanly by the other side, it is said once, with the catch)
            const nx = plays[n + 1]
            if (nx?.kind === 'catch' && nx.result === 'caught' && nx.side === o && prev?.kind !== 'freeKick') break
            const base = p.kick === 'box' ? 'kickBox' : p.kick === 'long' ? 'kickLong' : p.kick === 'upAndUnder' ? 'kickHigh' : p.kick === 'grubber' ? 'kickGrubber'
              : p.kick === 'crossField' ? 'kickCross' : p.kick === 'chip' ? 'kickChip' : 'kickOther'
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
        if (context.weather === 'Rain' || context.weather === 'Damp' || context.weather === 'Snow') { if (++knockCount % 3 === 2) say('weatherKnock', 'minor', null) }
        break
      }
      // the passer and the man it was meant for, only when the record names both (`who` alone may be either)
      case 'forwardPass': say('forwardPass', 'normal', s, p.with?.[0] ? { player: nm(p.who), player2: nm(p.with[0]) } : {}); break
      case 'unplayable': say(prev?.kind === 'maul' ? 'unplayableMaul' : 'unplayableRuck', 'normal', s); break
      case 'restartError': say(p.result === 'outOnFull' ? 'restartOut' : 'restartNotTen', 'normal', s, { player: prev?.kind === 'kickoff' && prev.side === s ? nm(prev.who) : '' }); break
      case 'intoTouch': {
        if (p.result === 'bounced') say('bouncedOut', 'normal', s, { player: prev?.kind === 'kick' && prev.side === s ? nm(prev.who) : '' })
        break
      }
      case 'deadBall': say(p.result === 'touchedDown' ? 'touchedDown' : 'ranDead', 'normal', s); break
      case 'heldUp': {
        if (prev?.kind === 'maul') say('heldUpMaul', 'key', s, { player: nm(p.who) })
        else say('heldUp', 'key', s, { player: nm(p.who) || (prev?.kind === 'carry' && prev.side === s ? nm(prev.who) : '') })
        break
      }
      case 'dropout22': {
        const base = prev?.kind === 'deadBall' && prev.side === o ? 'dropDead'
          : prev?.kind === 'penaltyGoal' && prev.side === o ? 'dropPenMiss'
          : prev?.kind === 'dropGoal' && prev.side === o ? 'dropDropMiss' : 'dropOut'
        say(base, 'normal', s, { player: nm(p.who) })
        break
      }
      case 'goalLineDropout': {
        const base = prev?.kind === 'heldUp' && prev.side === o ? 'dropGlHeld' : prev?.kind === 'deadBall' && prev.side === o ? 'dropGlTouched' : 'dropGl'
        say(base, 'normal', s, { player: nm(p.who) })
        break
      }
      case 'penalty': {
        const zone_k = zoneKey(s, p.x), cause_k = causeKey(p.cause)
        // the man penalised: the record's offender, else the man the play before names against this side
        const off = (fallback: string | undefined) => nm(p.offender) || nm(fallback)
        const atScrum = prev?.kind === 'scrum' && ((prev.result === 'penaltyWon' && prev.side === s) || (prev.result === 'penaltyLost' && prev.side === o))
        if (prev?.kind === 'ruck' && prev.result === 'penaltyWon' && prev.side === s) say('penRuckDef', 'normal', s, { zone_k, cause_k, oppPlayer: off(prev.vs?.[0]) })
        else if (prev?.kind === 'ruck' && prev.result === 'penaltyLost' && prev.side === o) say('penRuckAtt', 'normal', s, { zone_k, cause_k, player: nm(prev.vs?.[0]), oppPlayer: nm(p.offender) })
        else if (atScrum) say('penScrum', 'normal', s, { zone_k, cause_k, oppPlayer: off(prev!.result === 'penaltyWon' ? prev!.vs?.[0] : prev!.who) })
        else if (prev?.kind === 'maul' && prev.result === 'pulledDown' && prev.side === s) say('penMaul', 'normal', s, { zone_k, cause_k, oppPlayer: off(prev.vs?.[0]) })
        else if (prev?.kind === 'lineout' && prev.result === 'penalty') say('penLineout', 'normal', s, { zone_k, cause_k, oppPlayer: nm(p.offender) })
        else if (prev?.kind === 'kick' && prev.result === 'inPlay') say('penKick', 'normal', s, { zone_k, cause_k, oppPlayer: nm(p.offender) })
        else say('pen', 'normal', s, { zone_k, cause_k, oppPlayer: nm(p.offender) })
        // the count against them
        pensAt[o].push(p.t)
        const last15 = pensAt[o].filter(x => x > p.t - 900).length
        if (p.offender) { const v = st(p.offender); v.pens++; if (v.pens >= 2) say('offenderPens', 'minor', s, { oppPlayer: nm(p.offender), count: v.pens }) }
        if (last15 >= 4 && last15 > warnSaid[o]) { say('pensWarn', 'minor', s, { count: last15 }); warnSaid[o] = last15 }
        else if (pensAt[o].length >= 6 && pensAt[o].length % 3 === 0) say('pensTotal', 'minor', s, { count: pensAt[o].length })
        if (last15 < 4) warnSaid[o] = Math.min(warnSaid[o], 3)
        if (atScrum) { scrumPens[s]++; if (scrumPens[s] >= 2) say('scrumPensWon', 'minor', s, { count: scrumPens[s] }) }
        break
      }
      case 'freeKick': {
        const base = prev?.kind === 'scrum' && prev.result === 'freeKick' ? 'freeScrum' : prev?.kind === 'lineout' && prev.result === 'penalty' ? 'freeLineout' : 'free'
        say(base, 'normal', s, { cause_k: causeKey(p.cause), oppPlayer: base === 'free' ? undefined : nm(p.offender) })
        break
      }
      case 'tap': {
        const base = before?.kind === 'freeKick' ? 'tapFree' : p.result === 'tapAndGo' ? 'tapNear' : p.result === 'quickTap' ? 'tapQuick' : 'tapPen'
        say(base, 'normal', s, { player: nm(p.who), d: base === 'tapNear' ? Math.max(1, Math.round(toLine(s, p.x))) : undefined })
        break
      }
      case 'yellowCard': {
        bins.push({ side: s, until: p.until ?? p.t - p.live - p.dead + K.BIN_S, who: p.who, at: [p.score[0], p.score[1]] })
        say(p.result === 'cynical' ? 'yellowCynical' : p.result === 'penaltyTry' ? 'yellowPenTry' : 'yellowFoul', 'key', s, { player: nm(p.who), men: onField(s) })
        break
      }
      case 'redCard': {
        reds[s]++
        if (p.who) offIds.add(p.who)
        say('red', 'key', s, { player: nm(p.who), men: onField(s) })
        break
      }
      case 'injury': { say('injured', 'normal', s, { player: nm(p.who) }); if (p.who) offIds.add(p.who); break }
      case 'substitution': {
        say(p.result !== 'made' ? 'subRefused' : p.cause === 'injury' ? 'subInjury' : 'subMade', 'normal', s, { player: nm(p.who), player2: nm(p.with?.[0]) })
        if (p.result === 'made') { if (p.who) offIds.add(p.who); if (p.with?.[0]) watchFirst.set(p.with[0], { base: 'subFirst', side: s }) }
        break
      }
      case 'try': {
        const player = nm(p.who)
        const base = p.result === 'close' ? 'tryClose' : p.result === 'wide' ? 'tryWide' : p.result === 'break' ? 'tryBreak' : p.result === 'maul' ? 'tryMaul' : p.result === 'pickAndGo' ? 'tryPickGo'
          : p.result === 'interception' ? 'tryInterception' : 'tryCharge'
        say(base, 'key', s, { player, player2: nm(p.with?.[0]) })
        if (p.who) {
          const c = (tryCount.get(p.who) ?? 0) + 1
          tryCount.set(p.who, c)
          if (c >= 2 && player && nthKey(c)) say('tryAgain', 'key', s, { player, nth_k: nthKey(c) })
        }
        tries[s]++
        if (context.bonusPoints && tries[s] === 4) say('bonusTry', 'minor', s)
        const tk = p.result === 'maul' ? 'Maul' : p.result === 'wide' ? 'Wide' : p.result === 'break' ? 'Break' : p.result === 'close' ? 'Close' : p.result === 'interception' ? 'Interception' : ''
        if (tk) { const c = (tryKinds[s].get(tk) ?? 0) + 1; tryKinds[s].set(tk, c); if (c >= 2) say('tryType', 'minor', s, { count: c, type_k: `sim.type${tk}1` }) }
        break
      }
      case 'penaltyTry': {
        say('penaltyTry', 'key', s, score)
        tries[s]++
        if (context.bonusPoints && tries[s] === 4) say('bonusTry', 'minor', s)
        break
      }
      case 'conversion': say(p.good ? 'conOver' : 'conWide', 'key', s, { player: nm(p.who), ...score }); break
      case 'penaltyGoal': {
        say('penAim', 'key', s, { player: nm(p.who), m: toPosts(s, p.x, p.y) })
        say(p.good ? 'penOver' : 'penWide', 'key', s, { player: nm(p.who), ...score })
        break
      }
      case 'dropGoal': say(p.good ? 'dropOver' : 'dropWide', 'key', s, { player: nm(p.who), m: toPosts(s, p.x, p.y), ...(p.good ? score : {}) }); break
      case 'scrum': {
        const reason = prev?.kind === 'knockOn' && prev.side === o ? 'scrumKnock'
          : prev?.kind === 'forwardPass' && prev.side === o ? 'scrumForward'
          : prev?.kind === 'notStraight' && prev.side === o ? 'scrumNotStraight'
          : prev?.kind === 'unplayable' ? 'scrumUnplayable'
          : prev?.kind === 'restartError' && prev.side === o ? 'scrumRestart'
          : before?.kind === 'penalty' && before.side === s ? 'scrumChoice' : 'scrum'
        say(reason, 'normal', s)
        if (p.result === 'againstTheHead') say('scrumAgainstHead', 'normal', s, { oppPlayer: nm(p.vs?.[0]) })
        else if (p.result === 'freeKick') say('scrumFree', 'normal', s)
        scOwn[s]++
        if (p.result === 'againstTheHead' || p.result === 'penaltyLost') { scLost[s]++; if (scLost[s] >= 2) say('scRecord', 'minor', s, { lost: scLost[s], total: scOwn[s] }) }
        break
      }
      case 'lineout': {
        const pp = prev ? (() => { let i = prev.n - 1; while (i >= 0 && plays[i].kind === 'substitution') i--; return plays[i] as Play | undefined })() : undefined
        const reason = prev?.kind === 'intoTouch' && prev.side === o ? (prev.result === 'carried' ? 'loCarried' : 'loBounced')
          : prev?.kind === 'kick' && prev.result === 'touch' && prev.side === o ? (pp?.kind === 'freeKick' ? 'loFreeTouch' : 'loTouch')
          : prev?.kind === 'kick' && prev.result === 'penaltyToTouch' && prev.side === s ? 'loPen'
          : prev?.kind === 'kick' && prev.result === 'fiftyTwentyTwo' && prev.side === s ? 'loFifty'
          : prev?.kind === 'kick' && prev.result === 'outOnFull' && prev.side === o ? 'loFull' : 'lo'
        if (p.result === 'quick') { say('loQuick', 'normal', s, { player: nm(p.who) }); break }
        say(reason, 'normal', s)
        if (p.result === 'won') say('loWon', 'minor', s, { player: nm(p.who), player2: nm(p.with?.[0]) })
        else if (p.result === 'stolen') say('loStolen', 'normal', s, { player: nm(p.who), oppPlayer: nm(p.vs?.[0]) })
        else if (p.result === 'notStraight') say('loNotStraight', 'normal', s, { player: nm(p.who) })
        else if (p.result === 'penalty') say('loPenalty', 'normal', s, { player: nm(p.who) })
        loOwn[s]++
        if (p.result === 'stolen' || p.result === 'notStraight') { loLost[s]++; if (loLost[s] >= 2) say('loRecord', 'minor', s, { lost: loLost[s], total: loOwn[s] }) }
        if (p.result === 'won' && p.with?.[0]) { const v = st(p.with[0]); v.lo++; if (v.lo >= 4 && v.lo % 2 === 0) say('statLineout', 'minor', s, { player2: nm(p.with[0]), count: v.lo }) }
        if (p.result === 'stolen' && p.vs?.[0]) { const v = st(p.vs[0]); v.st++; if (v.st >= 2) say('statSteals', 'minor', o, { player: nm(p.vs[0]), count: v.st, nth_k: nthKey(v.st) }) }
        break
      }
      case 'maul': {
        const g = Math.round(p.gain ?? 0), player = nm(p.who)
        if (p.result === 'ballOut') say(g >= 3 ? 'maulOut' : 'maulNoGain', 'minor', s, { m: g, player })
        else if (p.result === 'driven') say('maulOver', 'key', s, { player })
        else if (p.result === 'pulledDown') say('maulDown', 'normal', s, { oppPlayer: nm(p.vs?.[0]), player })
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
        if (!ft) { halfStart = Infinity; lastTerr = -Infinity; lastBall = -Infinity; inSecond = true }
        break
      }
    }

    // ---- the men: milestones, first touches
    if ((p.kind === 'carry' || p.kind === 'lineBreak') && p.who && p.result !== 'intercepted') {
      const v = st(p.who), m0 = v.m
      v.car++; v.m += Math.max(0, p.gain ?? 0)
      const crossed = [50, 100, 150, 200].find(x => m0 < x && v.m >= x)
      if (statOk(n) && v.car >= 10 && v.car % 5 === 0) { say('statCarries', 'minor', s, { player: nm(p.who), count: v.car, m: Math.round(v.m) }); statAt = n }
      else if (statOk(n) && crossed && crossed >= 100) { say('statMetres', 'minor', s, { player: nm(p.who), m: crossed }); statAt = n }
    }
    if (p.kind === 'carry' && p.vs) {
      let said = false
      for (const id of new Set(p.vs)) { const v = st(id); v.tk++; if (!said && statOk(n) && v.tk >= 15 && v.tk % 5 === 0) { say('statTackles', 'minor', o, { player: nm(id), count: v.tk }); said = true; statAt = n } }
    }
    const stealer = (p.kind === 'ruck' && p.result === 'turnover') || (p.kind === 'carry' && p.result === 'intercepted') ? p.vs?.[0] : undefined
    if (stealer) { const v = st(stealer); v.to++; if (v.to >= 2 && nthKey(v.to)) say('statTurnovers', 'minor', o, { player: nm(stealer), nth_k: nthKey(v.to) }) }
    const wonBy: 0 | 1 | null = stealer || (p.kind === 'lineout' && p.result === 'stolen') || (p.kind === 'scrum' && p.result === 'againstTheHead') ? o : null
    if (wonBy !== null) { turnWon[wonBy]++; if (turnWon[wonBy] >= 4 && turnWon[wonBy] % 2 === 0) say('turnoversCount', 'minor', wonBy, { count: turnWon[wonBy] }) }
    if ((p.kind === 'knockOn' || p.kind === 'forwardPass') && ++handling[s] >= 4 && handling[s] % 2 === 0) say('handlingCount', 'minor', s, { count: handling[s] })
    if (p.kind === 'kick' && p.result === 'outOnFull' && ++outFull[s] >= 2) say('outFullCount', 'minor', s, { count: outFull[s] })
    if (watchFirst.size && p.kind !== 'substitution') {
      for (const id of [p.who, ...(p.vs ?? []), ...(p.with ?? [])]) {
        const w = id ? watchFirst.get(id) : undefined
        if (w && id && !CARD.has(p.kind)) { watchFirst.delete(id); say(w.base, 'minor', w.side, { player: nm(id) }); break }
      }
    }

    // ---- the goal kickers
    if ((p.kind === 'conversion' || p.kind === 'penaltyGoal') && p.who) {
      const k = kicker.get(p.who) ?? { made: 0, taken: 0, miss: 0 }
      k.taken++; if (p.good) { k.made++; k.miss = 0 } else k.miss++
      kicker.set(p.who, k)
      const player = nm(p.who)
      if (k.miss >= 2) say('missRun', 'minor', s, { player, count: k.miss })
      else if (k.taken >= 3 && k.made === k.taken) say('goalPerfect', 'minor', s, { player, made: k.made })
      else if (k.taken >= 4 && k.taken % 2 === 0) say('goalRun', 'minor', s, { player, made: k.made, taken: k.taken })
    }

    // ---- the choice at a penalty, and who made it
    if (before?.kind === 'penalty' && before.side === s && (p.kind === 'penaltyGoal' || (p.kind === 'kick' && p.result === 'penaltyToTouch') || p.kind === 'tap' || p.kind === 'scrum')) {
      const m = toPosts(s, before.x, before.y)
      const ch = p.kind === 'penaltyGoal' ? 'Posts' : p.kind === 'kick' ? 'Corner' : p.kind === 'tap' ? 'Tap' : 'Scrum'
      const cap = context.captains?.[s]
      const capOn = cap && !offIds.has(cap) && !bins.some(b => b.who === cap)
      if (m <= 45) {
        penChoices++
        if (capOn && penChoices % 2 === 0) say(`cap${ch}`, 'minor', s)
        else if (penChoices % 2 === 1 && ch !== 'Scrum') say(`choice${ch}`, 'minor', s, { m })
      }
    }

    // ---- the score story, said once the score is complete (after the conversion, the kick, the drop)
    const d0 = p.score[0] - prevScore[0], d1 = p.score[1] - prevScore[1]
    if (p.kind === 'try') seqStart = [prevScore[0], prevScore[1]]
    else if (d0 > 0 || d1 > 0) seqStart = [prevScore[0], prevScore[1]]
    if (d0 > 0 || d1 > 0) {
      const by: 0 | 1 = d0 > 0 ? 0 : 1
      if (runSide === by) runPts += d0 + d1
      else { runSide = by; runPts = d0 + d1; runSaid = 0 }
    }
    if (SCORES.includes(p.kind)) {
      // the score before this scoring passage (before the try, for a conversion) and after it
      const Bf: [number, number] = p.kind === 'conversion' ? seqStart : [prevScore[0], prevScore[1]]
      const A = p.score
      const scored = A[s] > Bf[s]
      if (scored) {
        const lb = Bf[s] - Bf[o], la = A[s] - A[o]
        if (Bf[0] === 0 && Bf[1] === 0) say('firstScore', 'minor', s)
        else if (lb <= 0 && la > 0 && !(Bf[0] === 0 && Bf[1] === 0)) say('leadTaken', 'minor', s)
        else if (la === 0) say('levelScores', 'minor', s)
        // a comeback: they were ten or more behind at some point, now within a score
        const deficit = maxDefBefore(plays, n, s)
        if (deficit >= 10 && la >= -7 && !comebackSaid[s]) {
          comebackSaid[s] = true
          say(la > 0 ? 'comebackLead' : la === 0 ? 'comebackLevel' : 'comeback', 'minor', s, { deficit, margin: -la })
        }
        if (la > maxMargin && la >= 10 && la >= bigSaid + 5) { say('biggestLead', 'minor', s, { margin: la }); bigSaid = la }
        if (la >= 8 && la <= 14 && lb <= 7) say('twoScore', 'minor', s, { margin: la })
        const half = inSecond ? 2 : 1
        if (half === 1 && clock >= 2100 && !halfSaid.has(`1:${s}`)) { say('beforeHalf', 'minor', s); halfSaid.add(`1:${s}`) }
        if (half === 2 && clock - 2400 <= 300 && clock >= 2400 && !halfSaid.has(`2:${s}`)) { say('afterHalf', 'minor', s); halfSaid.add(`2:${s}`) }
        if (onField(o) < 15) say('scoreManUp', 'minor', s, { men: onField(o) })
        if (onField(s) < 15) say('scoreManDown', 'minor', s, { men: onField(s) })
        if (runSide === s && runPts >= 15 && runPts >= runSaid + 10) { say('run', 'normal', s, { count: runPts }); runSaid = runPts }
      }
      maxMargin = Math.max(maxMargin, Math.abs(A[0] - A[1]))
    }
    if (d0 > 0 || d1 > 0) prevScore = [p.score[0], p.score[1]]

    // ---- the last ten minutes of a close game
    if (inSecond && STOPS.includes(p.kind) && clock >= 4200) {
      const d = Math.abs(p.score[0] - p.score[1]), key = p.score.join(':')
      if (d <= 7 && (key !== lateScore || clock - lastLate >= 150)) {
        const trail: 0 | 1 = p.score[0] < p.score[1] ? 0 : 1
        const mins = Math.ceil((4800 - clock) / 60)
        const need = d <= 2 ? 'WinKick' : d === 3 ? 'LevelKick' : d === 4 ? 'WinTry' : d === 5 ? 'LevelTry' : d === 6 ? 'WinConTry' : 'LevelConTry'
        let said = true
        if (d === 0) { if (clock >= 4800) say('lateRedLevel', 'minor', null); else if (mins >= 2) say('lateLevel', 'minor', null, { mins }); else said = false }
        else if (clock >= 4800) say('lateRed', 'minor', trail, { d, need_k: `sim.need${need}1` })
        else if (mins <= 1) say('lateLast', 'minor', trail, { d, need_k: `sim.need${need}1` })
        else say('lateTrail', 'minor', trail, { d, mins, need_k: `sim.need${need}1` })
        if (said) { lastLate = clock; lateScore = key }
      }
    }

    // ---- visits to the 22: how many, and what came of them (said when one ends with nothing)
    for (const side of [0, 1] as const) {
      const now = in22(p, side)
      if (now && !entry.inside[side]) { entry.inside[side] = true; entry.n[side]++; entry.from[side] = [p.score[0], p.score[1]] }
      else if (!now && entry.inside[side]) {
        entry.inside[side] = false
        const got = p.score[side] - entry.from[side][side]
        entry.pts[side] += got
        if (got === 0 && entry.n[side] >= 3 && entry.n[side] - entry.lastSaid[side] >= 2) { say('entries', 'minor', side, { count: entry.n[side], pts: entry.pts[side] }); entry.lastSaid[side] = entry.n[side] }
      }
    }

    // ---- territory and the ball over the last ten minutes, at a stoppage, at most every fifteen minutes each,
    // and only once the referee's clock is ten minutes into the half
    if ((p.kind === 'scrum' || p.kind === 'lineout' || p.kind === 'penalty') && clock - halfStart >= 600) {
      if (p.t - lastTerr >= 900) {
        const w = territory(plays, n, p.t - 600), tot = w[0] + w[1]
        if (tot >= 120) for (const side of [0, 1] as const) {
          const pct = Math.round(100 * w[side] / tot)
          if (pct >= 70) { say('territory', 'minor', side, { pct }); lastTerr = p.t }
        }
      }
      if (p.t - lastBall >= 900 && p.t - lastTerr >= 300) {
        let from = n
        while (from > 0 && plays[from - 1].t > p.t - 600 && plays[from - 1].kind !== 'halfTime') from--
        const w = possession(plays, n, from), tot = w[0] + w[1]
        if (tot >= 120) for (const side of [0, 1] as const) {
          const pct = Math.round(100 * w[side] / tot)
          if (pct >= 68) { say('ballTen', 'minor', side, { pct }); lastBall = p.t }
        }
      }
    }
  }
  return out
}

/** the most a side has been behind, over the plays before n */
function maxDefBefore(plays: Play[], n: number, s: 0 | 1): number {
  let m = 0
  for (let i = 0; i < n; i++) m = Math.max(m, plays[i].score[s === 0 ? 1 : 0] - plays[i].score[s])
  return m
}

/**
 * Fit the lines to the pitch's schedule. `slots` is the schedule from the
 * pitch (src/ui/livepitch/fromRecord.ts schedule(): { n, start, dur, speed },
 * viewing seconds). Every priority 3 line is kept. Every other line is kept
 * only if no kept line is within `gap` seconds of viewing of it, highest
 * priority first, then in order. So the feed never brings more than one new
 * line every `gap` seconds except where the key moments and the reasons for
 * stoppages themselves come quicker.
 */
export function thin(lines: Line[], slots: SlotLike[], gap = 1.4): Line[] {
  const at = new Map<number, number>()
  for (const s of slots) at.set(s.n, s.start > 2000 ? s.start / 1000 : s.start)
  const time = (l: Line) => at.get(l.n) ?? NaN
  const keep = new Array<boolean>(lines.length).fill(false)
  const kept: number[] = []
  const near = (x: number) => kept.some(y => Math.abs(y - x) < gap)
  const order = lines.map((_, i) => i).sort((a, b) => lines[b].priority - lines[a].priority || a - b)
  for (const i of order) {
    const l = lines[i], x = time(l)
    if (l.priority >= 3 || Number.isNaN(x)) { keep[i] = true; if (!Number.isNaN(x)) kept.push(x); continue }
    if (!near(x)) { keep[i] = true; kept.push(x) }
  }
  return lines.filter((_, i) => keep[i])
}

/** a line in English */
export function render(line: Line): string {
  // (English: one metre, one minute)
  const s = fill(EN_FLAT[line.key] ?? line.key, line.params).replace(/\b1 metres\b/g, '1 metre').replace(/\b1 minutes\b/g, '1 minute')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fill(s: string, params: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (all, k: string) => {
    const v = params[k]
    if (v === undefined) return all
    if (k.endsWith('_k')) return fill(EN_FLAT[String(v)] ?? String(v), params)
    return String(v)
  })
}
