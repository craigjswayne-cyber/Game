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
import { SIM_EN, EN_FLAT, MOVE_EN } from './commentary.en'
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
  /** 3 never dropped by thin() (key moments, scores, cards, the reason for every stoppage and restart),
   *  2 the play itself, 1 a note worth hearing, 0 colour. thin() and feed() drop from the bottom. */
  priority: number
  /** the lines that flash on screen (owner, 24 Nov: "flicking through and then it flashes when there's a
   *  key moment, a try or a penalty goal"): never dropped by feed(); null for every other line */
  flash: 'try' | 'goal' | 'card' | 'key' | null
  /** suggested seconds on screen at life speed */
  hold: number
  /** 'tick' the short ticker register for the run of play (3 to 8 words), 'full' a sentence */
  reg: 'tick' | 'full'
  /** set by thin() when it fits the lines to the pitch's schedule: the second of viewing the line goes up */
  at?: number
  /** a sentence too long for the ticker (over 90 characters) is shown as two lines: which half this is */
  part?: 1 | 2
}

/** a line as the ticker shows it: when (viewing seconds, on the pitch's schedule) and for how long */
export interface Shown {
  line: Line
  at: number
  hold: number
  /** its index in the lines given to feed() (the line itself may be a copy: a phase number said as a count) */
  i: number
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

export interface FeedOpts {
  /** new lines a second at most in fast forward (default 3) */
  maxPerSec?: number
  /** seconds between new lines at life speed at least (default 0.6) */
  clipGap?: number
}

/**
 * Kind/result pairs that get no line of their own, and why. Every other pair
 * the record can hold gets at least one line every time it happens
 * (tests/simcommentary.test.ts holds both halves of that).
 */
export const SILENT: Record<string, string> = {
  'intoTouch/carried': 'said at the carry that went into touch, and as the reason at the lineout',
  'notStraight/scrum': 'said at the lineout (not straight) and as the reason at the scrum',
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
  kickCaught: ['catch'],
  koStart: ['kickoff'], koSecond: ['kickoff'], koAfterScore: ['kickoff'], restartNotTen: ['restartError'], restartOut: ['restartError'],
  dropDead: ['dropout22'], dropPenMiss: ['dropout22'], dropDropMiss: ['dropout22'], dropOut: ['dropout22'],
  dropGlHeld: ['goalLineDropout'], dropGlTouched: ['goalLineDropout'], dropGl: ['goalLineDropout'],
  catchKo: ['catch'], regatherKo: ['catch'], catchKick: ['catch'], regatherKick: ['catch'], catchDrop: ['catch'], regatherDrop: ['catch'], chargeRegather: ['catch'],
  carryBig: ['carry'], carryBack: ['carry'], offload: ['offload'],
  tickPass: ['carry', 'lineBreak'], tickHands: ['carry', 'lineBreak'], tickCarry: ['carry'], tickCarryOn: ['carry'], tickToTouch: ['kick'], tickGain: ['carry'], tickHeld: ['carry'], tickTackle: ['carry'], tickNear: ['carry'], tickLine: ['carry'], tickOver: ['carry'],
  tickLaunch: ['carry', 'lineBreak'], tickFirst: ['carry', 'lineBreak'],
  shOneOut: ['carry', 'lineBreak'], shPod: ['carry', 'lineBreak'], shTipOn: ['carry', 'lineBreak'], shSnipe: ['carry', 'lineBreak'], shPullBack: ['carry', 'lineBreak'],
  shPodTen: ['carry', 'lineBreak'], shMiss: ['carry', 'lineBreak'], shLoop: ['carry', 'lineBreak'], shWrap: ['carry', 'lineBreak'], shSwitch: ['carry', 'lineBreak'], shKickPass: ['carry', 'lineBreak'],
  tickRuckQuick: ['ruck'], tickRuckSlow: ['ruck'], tickRuckNext: ['ruck'], phaseCount: ['ruck'], tickRunOn: ['lineBreak'], tickChase: ['lineBreak'], tickHalfway: ['lineBreak', 'carry'], tickIntoTwentyTwo: ['lineBreak', 'carry'], turnoverIsolated: ['ruck'], yellowRepeated: ['yellowCard'], tickScrumSet: ['scrum'], tickRuck: ['ruck'], tickRuckNear: ['ruck'], tickRuckWhistle: ['ruck'], tickRuckStuck: ['ruck'], tickContest: ['catch'], tickScrumWon: ['scrum'], pickGo: ['carry'], carryTouch: ['carry'], intercepted: ['carry'], phases: ['ruck'], turnover: ['ruck'],
  breakClean: ['lineBreak'], breakHauled: ['lineBreak'], breakLastGasp: ['lineBreak'], interceptRun: ['lineBreak'], interceptHauled: ['lineBreak'],
  forwardPass: ['forwardPass'], unplayableRuck: ['unplayable'], unplayableMaul: ['unplayable'],
  koKnock: ['knockOn'], highKnock: ['knockOn'], chaseKnock: ['knockOn'], contactKnock: ['knockOn'],
  kickBox: ['kick'], kickLong: ['kick'], kickHigh: ['kick'], kickGrubber: ['kick'], kickCross: ['kick'], kickChip: ['kick'], tickFlight: ['kick', 'kickoff', 'dropout22', 'goalLineDropout'], tickRoll: ['kick'], kickOther: ['kick'], kickTouch: ['kick'], penTouch: ['kick'],
  fiftyTwentyTwo: ['kick'], outFull: ['kick'], kickDead: ['kick'], chargedDown: ['kick'], freeKickKick: ['kick'],
  bouncedOut: ['intoTouch'], ranDead: ['deadBall'], touchedDown: ['deadBall'],
  scrumKnock: ['scrum'], scrumForward: ['scrum'], scrumNotStraight: ['scrum'], scrumUnplayable: ['scrum'], scrumRestart: ['scrum'], scrumChoice: ['scrum'], scrum: ['scrum'],
  scrumAgainstHead: ['scrum'], scrumFree: ['scrum'],
  loTouch: ['lineout'], loPen: ['lineout'], loFifty: ['lineout'], loFull: ['lineout'], loBounced: ['lineout'], loCarried: ['lineout'], loFreeTouch: ['lineout'], loQuick: ['lineout'], lo: ['lineout'],
  loWon: ['lineout'], loStolen: ['lineout'], loNotStraight: ['lineout'], loPenalty: ['lineout'],
  maulOut: ['maul'], tickMaul: ['maul'], tickMaulStop: ['maul'], tickStop: ['knockOn', 'forwardPass', 'restartError'], maulNoGain: ['maul'], maulOver: ['maul'], maulDown: ['maul'],
  penRuckDef: ['penalty'], penRuckAtt: ['penalty'], penScrum: ['penalty'], penMaul: ['penalty'], penLineout: ['penalty'], penKick: ['penalty'], pen: ['penalty'],
  freeScrum: ['freeKick'], freeLineout: ['freeKick'], free: ['freeKick'], tapPen: ['tap'], tapFree: ['tap'], tapNear: ['tap'], tapQuick: ['tap'],
  yellowCynical: ['yellowCard'], yellowFoul: ['yellowCard'], yellowPenTry: ['yellowCard'], red: ['redCard'], binBack: ANY, injured: ['injury'], subInjury: ['substitution'], subMade: ['substitution'], subRefused: ['substitution'],
  tryClose: ['try'], tryWide: ['try'], tryBreak: ['try'], tryMaul: ['try'], tryPickGo: ['try'], tryCharge: ['try'], tryInterception: ['try'], tryAgain: ['try'], penaltyTry: ['penaltyTry'],
  heldUp: ['heldUp'], heldUpMaul: ['heldUp'], conOver: ['conversion'], conWide: ['conversion'],
  penAim: ['penaltyGoal'], penOver: ['penaltyGoal'], penWide: ['penaltyGoal'], dropOver: ['dropGoal'], dropWide: ['dropGoal'],
  flashTry: ['try'], flashPenTry: ['penaltyTry'], flashCon: ['conversion'], flashConMiss: ['conversion'], flashPen: ['penaltyGoal'], flashPenMiss: ['penaltyGoal'],
  flashDrop: ['dropGoal'], flashDropMiss: ['dropGoal'], flashYellow: ['yellowCard'], flashRed: ['redCard'], scoreLine: ['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal'],
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
  'scoreLine', 'binBack', 'subMade', 'subRefused', 'halfTime', 'fullTime', 'winBy', 'draw', 'turnover', 'chargedDown',
])
/** priority 1 (a note worth hearing) and 0 (colour); every other line is 2 */
const PRI: Record<string, number> = {
  ...Object.fromEntries([...SUMMARY].map(b => [b, 1])),
  statTackles: 0, statCarries: 0, statMetres: 0, statLineout: 0, offenderPens: 0, pensTotal: 0, possession: 0, tries: 1, ballTen: 0,
  handlingCount: 0, outFullCount: 0, turnoversCount: 0, tryType: 0, introVenue: 0, weatherKnock: 0, subFirst: 0, backFromBin: 0,
  phases: 0, loWon: 0, carryBack: 0, catchKick: 1, catchKo: 1, catchDrop: 1, maulOut: 1, maulNoGain: 1, freeKickKick: 1,
  winBy: 3, binBack: 3,
  shOneOut: 1, shPod: 1, shTipOn: 1, shSnipe: 1, shPullBack: 1, shPodTen: 1, shMiss: 1, shLoop: 1, shWrap: 1, shSwitch: 1, shKickPass: 1,
  tickCarryOn: -1, tickToTouch: -1, tickRuckQuick: 1, tickRuckSlow: 0, tickRuckNext: 0, phaseCount: 0, tickRunOn: 1, tickChase: 1, tickHalfway: 1, tickIntoTwentyTwo: 1, tickScrumSet: 0,
  tickPass: 1, tickHands: 1, tickCarry: 1, tickGain: 1, tickHeld: 1, tickTackle: 0, tickNear: 2, tickLine: 2, tickOver: 2, tickLaunch: 1, tickFirst: 1,
  tickRuck: 0, tickRuckNear: 1, tickRuckWhistle: 1, tickRuckStuck: 1, tickFlight: 0, tickRoll: 0, tickMaul: 1, tickMaulStop: 1, tickStop: 0, tickContest: 1, tickScrumWon: 1,
}
const priorityOf = (base: string, level: Line['level']) => (level === 'key' || MUST.has(base) ? 3 : PRI[base] ?? 2)

/** the ticker register: short lines for the run of play */
export const TICK = new Set([
  'shOneOut', 'shPod', 'shTipOn', 'shSnipe', 'shPullBack', 'shPodTen', 'shMiss', 'shLoop', 'shWrap', 'shSwitch', 'shKickPass',
  'tickCarryOn', 'tickToTouch', 'tickRuckQuick', 'tickRuckSlow', 'tickRuckNext', 'phaseCount', 'tickRunOn', 'tickChase', 'tickHalfway', 'tickIntoTwentyTwo', 'tickScrumSet',
  'tickPass', 'tickHands', 'tickCarry', 'tickGain', 'tickHeld', 'tickTackle', 'tickNear', 'tickLine', 'tickOver', 'tickLaunch', 'tickFirst', 'tickRuck', 'tickRuckNear', 'tickRuckWhistle', 'tickRuckStuck',
  'tickContest', 'tickScrumWon', 'carryBig', 'carryBack', 'pickGo', 'offload', 'catchKo', 'catchKick', 'catchDrop',
  'kickBox', 'kickLong', 'kickHigh', 'kickGrubber', 'kickCross', 'kickChip', 'kickOther', 'freeKickKick', 'tickFlight', 'tickRoll', 'tickMaul', 'tickMaulStop', 'tickStop',
])
const flashOf = (base: string, level: Line['level']): Line['flash'] =>
  base === 'flashTry' || base === 'flashPenTry' ? 'try'
    : base === 'flashCon' || base === 'flashPen' || base === 'flashDrop' ? 'goal'
    : base === 'flashYellow' || base === 'flashRed' ? 'card'
    : level === 'key' ? 'key' : null
const HOLD = { try: 4, goal: 3, card: 3.5, key: 2.5 } as const
/** a man's numbers and a side's counts: at most one every twenty seconds of the match clock */
const STATS = new Set(['statTackles', 'statCarries', 'statMetres', 'statTurnovers', 'statLineout', 'statSteals', 'offenderPens', 'pensTotal',
  'turnoversCount', 'handlingCount', 'outFullCount', 'tryType', 'scrumPensWon', 'loRecord', 'scRecord', 'entries', 'subFirst', 'backFromBin'])

/** placeholders the record may or may not fill (a man's name, the reason for a penalty): a wording is
 *  only used when each it holds is filled, and the wordings that say the most are used first */
const NAME_PH = ['player', 'player2', 'oppPlayer', 'cause_k', 'move_k', 'zone_k', 'phase'] as const
const NEEDS: Record<string, string[][]> = Object.fromEntries(
  Object.entries(SIM_EN).map(([b, list]) => [b, list.map(s => NAME_PH.filter(k => s.includes(`{${k}}`)))]),
)
/** a man said in some wordings and not others, even when he is the main one: he never decides which wordings may be used */
const SECONDARY: Record<string, string> = { tickChase: 'player', turnoverIsolated: 'player', penRuckAtt: 'player', shPod: 'player2', shWrap: 'player2', shSwitch: 'player2', shOneOut: 'player2', tickTackle: 'player', tickHeld: 'oppPlayer', tickLaunch: 'player', tryPickGo: 'player2', tryClose: 'player2', tryWide: 'player2', tryBreak: 'player2', breakClean: 'player2', breakHauled: 'player2', carryBig: 'player2' }

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

/** the plays at whose end a side really holds the ball (a kick in flight, a restart, a dead ball do not count) */
export const HOLDS = new Set<PlayKind>(['carry', 'offload', 'ruck', 'maul', 'lineBreak', 'lineout', 'scrum', 'penalty', 'freeKick', 'tap', 'catch', 'try', 'conversion', 'penaltyGoal'])
/** a side holds the ball inside the other side's 22 at the end of this play; null for a play that says nothing either way */
export const in22 = (p: Play, s: 0 | 1): boolean | null => (HOLDS.has(p.kind) ? p.ball === s && toLine(s, p.x) <= 22 : null)

/** the men a line must name when the record names them, beyond its main man */
const REQUIRED: Record<string, string[]> = {
  loStolen: ['oppPlayer'], loWon: ['player2'], turnover: ['oppPlayer'], turnoverIsolated: ['oppPlayer'], intercepted: ['oppPlayer'],
  subMade: ['player2'], subInjury: ['player2'], subRefused: ['player2'], chargedDown: ['oppPlayer'], carryTouch: ['oppPlayer'],
  breakHauled: ['oppPlayer'], breakLastGasp: ['oppPlayer'], interceptHauled: ['oppPlayer'], contactKnock: ['oppPlayer'],
}

/** the fewest wordings a match keeps for a line in its voice (see commentate) */
const VOICE_MIN = 3

/** the phase-play shapes (round 5 record): the line that says how the ball got to him */
const SHAPE_BASE: Record<string, string> = {
  oneOut: 'shOneOut', pod: 'shPod', tipOn: 'shTipOn', snipe: 'shSnipe', pullBack: 'shPullBack', podOff10: 'shPodTen',
  miss: 'shMiss', loop: 'shLoop', wraparound: 'shWrap', switch: 'shSwitch', kickPass: 'shKickPass',
}

/** the ticker's first word on a carry: the called move, the shape, the run of passes, or the pass that put him in */
function howItCame(p: Play, player: string, player2: string): { base: string; params: Record<string, string | number | undefined> } | null {
  if (p.shape === 'launch') return p.move && MOVE_EN[p.move] ? { base: 'tickLaunch', params: { player, move_k: `moves.say.${p.move}` } } : { base: 'tickFirst', params: { player, zone_k: zoneKey(p.side, p.x) } }
  const sh = p.shape ? SHAPE_BASE[p.shape] : undefined
  if (sh) return { base: sh, params: { player, player2 } }
  if ((p.passes ?? 0) >= 2) return { base: 'tickHands', params: { player, zone_k: zoneKey(p.side, p.x) } }
  if (player2) return { base: 'tickPass', params: { player, player2 } }
  return null
}

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
  // ---- THE VOICE (owner, 24 Nov: "the games shouldn't feel repetitive"): each match, seeded from its sides and its
  // record, favours about two in five of each line's wordings, so two matches read differently
  const voice = mix(strHash(T.join('|')) ^ Math.imul(plays.length, 7919) ^ Math.imul(result.score[0] * 61 + result.score[1], 104729))
  const inVoice = (base: string, i: number) => mix(voice ^ strHash(base) ^ Math.imul(i + 1, 0x9e3779b1)) % 100 < 40
  // ---- a man named with his shirt number in the last six lines is named without it (a flash, or his first mention, keeps it)
  const lastNamed = new Map<string, number>()
  /** every sentence said so far this match */
  const said = new Set<string>()

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
  let lastLead = ''
  let penChoices = 0, knockCount = 0, statAt = -99, statClock = -Infinity
  /** a man's numbers are said at most once every eight plays */
  const statOk = (n: number) => n - statAt >= 8

  for (const p of plays) {
    const n = p.n
    const clock = p.clock ?? p.t
    let j = 0
    const say = (base: string, level: Line['level'], side: 0 | 1 | null, extra: Record<string, string | number | undefined> = {}) => {
      const priority = priorityOf(base, level)
      if (opts.density === 'fast' && priority <= 0) return
      // a man's numbers and a side's counts: one every twenty seconds of the clock at most
      if (STATS.has(base) && clock - statClock < 20) return
      // a note is never said straight after another of its own kind (the line that says what happened always is)
      const note = SUMMARY.has(base) || base === 'phases'
      const last = out[out.length - 1]
      if (note && last && last.key.slice(4).replace(/\d+$/, '') === base) return
      const params: Record<string, string | number> = {}
      if (side !== null) { params.team = T[side]; params.opp = T[other(side)] }
      for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') params[k] = v
      // ("phase 1" says nothing after a break or a set piece: only a count of 2 or more is said)
      if (typeof params.phase === 'number' && params.phase < 2) delete params.phase
      const list = SIM_EN[base]
      if (!list) throw new Error(`commentary: no words for ${base}`)
      const ok = list.map((_, i) => i).filter(i => NEEDS[base][i].every(k => params[k] !== undefined))
      if (!ok.length) return
      // a wording must name the main man, give a penalty's reason and offender, and name the roles REQUIRED holds;
      // the other men and the place it may give or not (the more ways to say a line, the less two matches read alike)
      const need = [...(REQUIRED[base] ?? []), 'player', 'cause_k', ...(/^(pen|free)/.test(base) ? ['oppPlayer'] : [])].filter(k => params[k] !== undefined && k !== SECONDARY[base])
      const full = ok.filter(i => need.every(k => (NEEDS[base][i] as string[]).includes(k)))
      // (when no wording names them all, those that name the most)
      const most = Math.max(...ok.map(i => NEEDS[base][i].length))
      const u = used.get(base) ?? list.map(() => 0)
      const all = full.length ? full : ok.filter(i => NEEDS[base][i].length === most)
      // the match's own wordings first (at least four of them, topped up in the voice's order), the rest only when those clash
      const rank = (i: number) => mix(voice ^ strHash(base) ^ Math.imul(i + 1, 0x9e3779b1))
      const mine = all.filter(i => inVoice(base, i))
      for (const i of [...all].sort((a, b) => rank(a) - rank(b))) { if (mine.length >= Math.min(VOICE_MIN, all.length)) break; if (!mine.includes(i)) mine.push(i) }
      const byUse = (xs: number[]) => xs.sort((a, b) => u[a] - u[b] || mix(n * 131 + j * 17 + a * 7 + strHash(base)) - mix(n * 131 + j * 17 + b * 7 + strHash(base)))
      const others = byUse(all.filter(i => !mine.includes(i)))
      byUse(mine)
      // the shirt number: dropped for a man named with it in the last six lines
      const flashing = flashOf(base, level) !== null
      for (const k of ['player', 'player2', 'oppPlayer']) {
        const v = params[k]
        if (typeof v !== 'string') continue
        const m = /^(.*) \((\d+)\)$/.exec(v)
        const seen = lastNamed.get(v)
        if (m && !flashing && seen !== undefined && out.length - seen <= 6) params[k] = m[1]
        else lastNamed.set(v, out.length)
      }
      // (the sentence itself: two wordings that leave out different values can read the same)
      const sig = (i: number) => fill(list[i], params).replace(/ \(\d+\)/g, '')
      // a sentence not yet said this match first (the match's own wordings, then the others), then one not said lately
      const fresh = (x: number) => !said.has(sig(x))
      const order = [...mine.filter(fresh), ...others.filter(fresh), ...mine, ...others]
      let i = order.find(x => !recent.includes(sig(x)))
      if (i === undefined) { if (note) return; i = order[0] }
      said.add(sig(i))
      u[i]++; used.set(base, u)
      recent.push(sig(i)); if (recent.length > 12) recent.shift()
      j++
      if (STATS.has(base)) statClock = clock
      const flash = flashOf(base, level), reg = TICK.has(base) ? 'tick' as const : 'full' as const
      // how long it stays up: a flash by its kind, a ticker line 1.2 s, a sentence by its length (about 18 letters a second)
      const len = fill(list[i], params).length
      const hold = flash ? HOLD[flash] : reg === 'tick' ? 1.2 : Math.round(Math.min(4.5, Math.max(2, len / 18)) * 10) / 10
      const line: Line = { n, t: clock, key: `sim.${base}${i + 1}`, params, level, side, priority, flash, hold, reg }
      // over 90 characters: two lines, what happened and who, then the consequence (the flash stays on the first)
      const halves = len > 90 ? halvesOf(fill(list[i], params)) : null
      if (halves) {
        out.push({ ...line, part: 1, hold: flash ? hold : Math.max(2, Math.round(halves[0].length / 18 * 10) / 10) })
        out.push({ ...line, part: 2, flash: null, level: level === 'key' ? 'normal' : level, hold: Math.max(2, Math.round(halves[1].length / 18 * 10) / 10) })
      } else out.push(line)
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
        say('tickFlight', 'minor', s, { zone_k: zoneKey(s, p.x) })
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
        else if (!reg && p.contested) say('tickContest', 'normal', s, { player })
        else say(reg ? 'regatherKick' : 'catchKick', reg ? 'normal' : 'minor', s, { player })
        break
      }
      case 'carry': {
        const player = nm(p.who), oppPlayer = nm(p.vs?.[0]), g = p.gain ?? 0, d = toLine(s, p.x)
        const player2 = nm(p.with?.[0])
        if (p.result === 'intoTouch') say('carryTouch', 'normal', s, { player, oppPlayer })
        else if (p.result === 'intercepted') say('intercepted', 'key', s, { player, oppPlayer })
        else if (p.result === 'knockedOn' || p.result === 'forwardPass') { const lead = howItCame(p, player, player2); if (lead) say(lead.base, 'minor', s, lead.params); say('tickCarry', 'minor', s, { player }) }
        else if (p.result === 'overTheLine') { const lead = howItCame(p, player, player2); if (lead) say(lead.base, 'minor', s, lead.params); say('tickOver', 'normal', s, { player }) }
        else if (p.result === 'gainLine' || p.result === 'held' || p.result === 'drivenBack') {
          // THE TICKER: how the ball got to him (the move, the pass, the hands), then what came of it
          let lead = howItCame(p, player, player2)
          const leadSig = lead ? `${lead.base}|${player}|${player2}` : ''
          if (lead && leadSig === lastLead) lead = null
          lastLead = leadSig
          if (lead) say(lead.base, 'minor', s, lead.params)
          // (a filler, true of any carry, for a carry shown long at life speed: the first line to go)
          say('tickCarryOn', 'minor', s, { player, zone_k: zoneKey(s, p.x) })
          if (d <= 10 && d >= 0.5) say(p.shape === 'pickAndGo' || (!p.passes && d <= 5) ? 'pickGo' : d <= 3 ? 'tickLine' : 'tickNear', 'normal', s, { player, d: Math.max(1, Math.round(d)) })
          else if (g >= 10) say('carryBig', 'normal', s, { player, player2: lead ? '' : player2, m: Math.round(g) })
          else if (g <= -2.5) say('carryBack', 'minor', s, { player, oppPlayer })
          else if (g >= 4) say('tickGain', 'minor', s, { player, m: Math.round(g) })
          else if (p.result !== 'gainLine') say('tickHeld', 'minor', s, { player, oppPlayer })
          else if (lead) say('tickTackle', 'minor', s, { player, oppPlayer })
          else say('tickCarry', 'minor', s, { player })
        }
        break
      }
      case 'offload': say('offload', 'normal', s, { player: nm(p.who), player2: nm(p.with?.[0]) }); break
      case 'ruck': {
        if (p.result === 'recycled') {
          const ph = p.phase ?? 0, d = toLine(s, p.x)
          // (the carry has just said how far out: the ruck line then says how the ball came back, not the distance again)
          const lastOut = out[out.length - 1]
          const saidD = lastOut && lastOut.n === n - 1 && lastOut.params.d === Math.max(1, Math.round(d))
          if (d <= 10 && !saidD) say('tickRuckNear', 'minor', s, { phase: ph, d: Math.max(1, Math.round(d)), player: nm(p.who) })
          else if (ph >= 5 && (ph - 5) % 3 === 0) say('phases', 'minor', s, { phase: ph, zone_k: zoneKey(s, p.x) })
          else if (p.speed === 'quick') say('tickRuckQuick', 'minor', s, { phase: ph, zone_k: zoneKey(s, p.x), player: nm(p.who) })
          else if (p.speed === 'slow') say('tickRuckSlow', 'minor', s, { phase: ph, zone_k: zoneKey(s, p.x), player: nm(p.who) })
          else say('tickRuck', 'minor', s, { phase: ph, zone_k: zoneKey(s, p.x), player: nm(p.who) })
        } else if (p.result === 'penaltyWon' || p.result === 'penaltyLost') say('tickRuckWhistle', 'minor', s, { player: nm(p.who) })
        else if (p.result === 'unplayable') say('tickRuckStuck', 'minor', s, { player: nm(p.who) })
        else if (p.result === 'turnover') {
          const inside = p.x <= 22 || p.x >= 78
          const broke = prev?.kind === 'lineBreak' && prev.side === s
          say(broke ? 'turnoverIsolated' : 'turnover', inside ? 'key' : 'normal', s, { oppPlayer: nm(p.vs?.[0]), player: broke ? nm(p.who) : undefined })
        }
        break
      }
      case 'lineBreak': {
        const player = nm(p.who), oppPlayer = nm(p.vs?.[0]), player2 = nm(p.with?.[0])
        if (p.result !== 'interception' && p.result !== 'interceptionHauled') { const lead = howItCame(p, player, player2); if (lead && lead.base !== 'tickPass') say(lead.base, 'minor', s, lead.params) }
        // the run itself, from where it started to where it ended (the record has both): halfway, the 22
        const from = prev ? toLine(s, prev.x) : 100, to = toLine(s, p.x)
        const crossings = () => { if (from > 50 && to <= 50) say('tickHalfway', 'minor', s, { player }); if (from > 22 && to <= 22) say('tickIntoTwentyTwo', 'minor', s, { player }) }
        // a long run is long on screen: a word for about every 15 metres of it
        const runOn = (base: string, extra: Record<string, string>) => {
          const k = Math.min(2, Math.max(1, Math.round((from - to) / 15)))
          say(base, 'minor', s, extra)
          if (k > 1) say('tickRunOn', 'minor', s, { player: extra.player })
        }
        if (p.result === 'interception') { say('interceptRun', 'key', s, { player }); crossings(); runOn('tickRunOn', { player }) }
        else if (p.result === 'interceptionHauled') { crossings(); say('interceptHauled', 'key', s, { player, oppPlayer, zone_k: zoneKey(s, p.x) }) }
        else if (p.result === 'clean') { say('breakClean', 'key', s, { player, player2 }); crossings(); runOn('tickRunOn', { player }) }
        else if (p.result === 'heldShort') { crossings(); say('tickChase', 'minor', s, { player, oppPlayer }); say('breakLastGasp', 'key', s, { player, oppPlayer, d: Math.max(1, Math.round(toLine(s, p.x))) }) }
        else {
          const d = toLine(s, p.x)
          if (d <= 5) say('breakLastGasp', 'key', s, { player, oppPlayer, d: Math.max(1, Math.round(d)) })
          else { crossings(); say('tickRunOn', 'minor', s, { player }); say('breakHauled', 'key', s, { player, player2, oppPlayer, m: Math.round(p.gain ?? 0) }) }
          // (the run first, then the key line that brings him down: nothing after it reads as if he were still going)
        }
        break
      }
      case 'kick': {
        const player = nm(p.who), m = Math.round(p.gain ?? 0)
        if (prev?.kind === 'freeKick') say('freeKickKick', 'minor', s)
        switch (p.result) {
          case 'inPlay': {
            const base = p.kick === 'box' ? 'kickBox' : p.kick === 'long' ? 'kickLong' : p.kick === 'upAndUnder' ? 'kickHigh' : p.kick === 'grubber' ? 'kickGrubber'
              : p.kick === 'crossField' ? 'kickCross' : p.kick === 'chip' ? 'kickChip' : 'kickOther'
            say(base, 'normal', s, { player, m })
            // the ball in the air (or on the ground) while the chase goes up: what the kind of kick says, nothing more
            say(p.kick === 'grubber' ? 'tickRoll' : 'tickFlight', 'minor', s, { zone_k: zoneKey(s, p.x) })
            break
          }
          case 'touch': say('kickTouch', 'normal', s, { player, m }); say('tickToTouch', 'minor', s, { zone_k: zoneKey(s, p.x) }); break
          case 'penaltyToTouch': say('penTouch', 'normal', s, { player, m, zone_k: zoneKey(s, p.x) }); say('tickToTouch', 'minor', s, { zone_k: zoneKey(s, p.x) }); say('tickToTouch', 'minor', s, { zone_k: zoneKey(s, p.x) }); break
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
        say('tickStop', 'minor', s, { zone_k: zoneKey(s, p.x) })
        if (context.weather === 'Rain' || context.weather === 'Damp' || context.weather === 'Snow') { if (++knockCount % 3 === 2) say('weatherKnock', 'minor', null) }
        break
      }
      // the passer and the man it was meant for, only when the record names both (`who` alone may be either)
      case 'forwardPass': say('forwardPass', 'normal', s, p.with?.[0] ? { player: nm(p.who), player2: nm(p.with[0]) } : {}); say('tickStop', 'minor', s, { zone_k: zoneKey(s, p.x) }); break
      case 'unplayable': say(prev?.kind === 'maul' ? 'unplayableMaul' : 'unplayableRuck', 'normal', s); break
      case 'restartError': say(p.result === 'outOnFull' ? 'restartOut' : 'restartNotTen', 'normal', s, { player: prev?.kind === 'kickoff' && prev.side === s ? nm(prev.who) : '' }); say('tickStop', 'minor', s, { zone_k: zoneKey(s, p.x) }); break
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
        say('tickFlight', 'minor', s, { zone_k: zoneKey(s, p.x) })
        break
      }
      case 'goalLineDropout': {
        const base = prev?.kind === 'heldUp' && prev.side === o ? 'dropGlHeld' : prev?.kind === 'deadBall' && prev.side === o ? 'dropGlTouched' : 'dropGl'
        say(base, 'normal', s, { player: nm(p.who) })
        say('tickFlight', 'minor', s, { zone_k: zoneKey(s, p.x) })
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
        say('flashYellow', 'key', s, { player: nm(p.who) })
        say(p.result === 'cynical' ? 'yellowCynical' : p.result === 'penaltyTry' ? 'yellowPenTry' : p.result === 'repeated' ? 'yellowRepeated' : 'yellowFoul', 'normal', s, { player: nm(p.who), men: onField(s) })
        break
      }
      case 'redCard': {
        reds[s]++
        if (p.who) offIds.add(p.who)
        say('flashRed', 'key', s, { player: nm(p.who) })
        say('red', 'normal', s, { player: nm(p.who), men: onField(s) })
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
        say('flashTry', 'key', s, { player })
        say(base, 'normal', s, { player, player2: nm(p.with?.[0]) })
        say('scoreLine', 'normal', null, score)
        if (p.who) {
          const c = (tryCount.get(p.who) ?? 0) + 1
          tryCount.set(p.who, c)
          if (c >= 2 && player && nthKey(c)) say('tryAgain', 'minor', s, { player, nth_k: nthKey(c) })
        }
        tries[s]++
        if (context.bonusPoints && tries[s] === 4) say('bonusTry', 'minor', s)
        const tk = p.result === 'maul' ? 'Maul' : p.result === 'wide' ? 'Wide' : p.result === 'break' ? 'Break' : p.result === 'close' ? 'Close' : p.result === 'interception' ? 'Interception' : ''
        if (tk) { const c = (tryKinds[s].get(tk) ?? 0) + 1; tryKinds[s].set(tk, c); if (c >= 2) say('tryType', 'minor', s, { count: c, type_k: `sim.type${tk}1` }) }
        break
      }
      case 'penaltyTry': {
        say('flashPenTry', 'key', s)
        say('penaltyTry', 'normal', s)
        say('scoreLine', 'normal', null, score)
        tries[s]++
        if (context.bonusPoints && tries[s] === 4) say('bonusTry', 'minor', s)
        break
      }
      case 'conversion': say(p.good ? 'flashCon' : 'flashConMiss', 'key', s, { player: nm(p.who) }); say('scoreLine', 'normal', null, score); break
      case 'penaltyGoal': {
        say('penAim', 'normal', s, { player: nm(p.who), m: toPosts(s, p.x, p.y) })
        say(p.good ? 'flashPen' : 'flashPenMiss', 'key', s, { player: nm(p.who) })
        say('scoreLine', 'normal', null, score)
        break
      }
      case 'dropGoal': {
        say(p.good ? 'flashDrop' : 'flashDropMiss', 'key', s, { player: nm(p.who), m: toPosts(s, p.x, p.y) })
        say(p.good ? 'dropOver' : 'dropWide', 'normal', s, { player: nm(p.who), m: toPosts(s, p.x, p.y) })
        if (p.good) say('scoreLine', 'normal', null, score)
        break
      }
      case 'scrum': {
        const reason = prev?.kind === 'knockOn' && prev.side === o ? 'scrumKnock'
          : prev?.kind === 'forwardPass' && prev.side === o ? 'scrumForward'
          : prev?.kind === 'notStraight' && prev.side === o ? 'scrumNotStraight'
          : prev?.kind === 'unplayable' ? 'scrumUnplayable'
          : prev?.kind === 'restartError' && prev.side === o ? 'scrumRestart'
          : before?.kind === 'penalty' && before.side === s ? 'scrumChoice' : 'scrum'
        say(reason, 'normal', s)
        say('tickScrumSet', 'minor', s, { zone_k: zoneKey(s, p.x) })
        if (p.result === 'won') say('tickScrumWon', 'minor', s, { zone_k: zoneKey(s, p.x) })
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
        say('tickMaul', 'minor', s, { player })
        if (p.result === 'stopped') say('tickMaulStop', 'minor', s, { player })
        else if (p.result === 'ballOut') say(g >= 3 ? 'maulOut' : 'maulNoGain', 'minor', s, { m: g, player })
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
      if (now === null) continue
      if (now && !entry.inside[side]) { entry.inside[side] = true; entry.n[side]++; entry.from[side] = [p.score[0], p.score[1]] }
      else if (!now && entry.inside[side]) {
        entry.inside[side] = false
        const got = p.score[side] - entry.from[side][side]
        entry.pts[side] += got
        if (got === 0 && entry.n[side] >= 3 && entry.n[side] - entry.lastSaid[side] >= 3) { say('entries', 'minor', side, { count: entry.n[side], pts: entry.pts[side] }); entry.lastSaid[side] = entry.n[side] }
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
 * Fit the lines to the pitch's schedule. With no `gap`, the lines feed() shows (round 5, the ticker),
 * each with `at` and `hold` set. With a `gap`, the round 4 rule: `slots` is the schedule from the
 * pitch (src/ui/livepitch/fromRecord.ts schedule(): { n, start, dur, speed },
 * viewing seconds). Every priority 3 line is kept. Every other line is kept
 * only if no kept line is within `gap` seconds of viewing of it, highest
 * priority first, then in order. So the feed never brings more than one new
 * line every `gap` seconds except where the key moments and the reasons for
 * stoppages themselves come quicker.
 */
export function thin(lines: Line[], slots: SlotLike[], gap?: number): Line[] {
  // with no gap given: the ticker of feed(), each line with its second on screen (`at`) and its hold
  if (gap === undefined) return feed(lines, slots).map(x => ({ ...x.line, at: x.at, hold: x.hold }))
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

/** a long sentence in two: at the first full stop (or ! or ?) after the first fifteen letters, else at a colon */
export function halvesOf(t: string): [string, string] | null {
  const m = /[.!?] (?=\S)/g
  let x: RegExpExecArray | null
  while ((x = m.exec(t))) if (x.index >= 15 && x.index < t.length - 10) return [t.slice(0, x.index + 1), t.slice(x.index + 2)]
  const c = t.indexOf(': ')
  if (c >= 15 && c < t.length - 10) return [t.slice(0, c) + '.', t.charAt(c + 2).toUpperCase() + t.slice(c + 3)]
  return null
}

const ONE: Record<string, string> = { tries: 'try', penalties: 'penalty', carries: 'carry', men: 'man' }

/**
 * THE TICKER (owner, 24 Nov 2026: "a lot faster paced, a bit like the old Football Manager, where it's
 * flicking through and then it flashes when there's a key moment"). Given the pitch's schedule
 * (src/ui/livepitch/fromRecord.ts schedule(): { n, start, dur, speed } in viewing seconds), when each
 * line goes up and for how long:
 *  - a line goes up no earlier than its play's start and no later than 0.8 s into the next play
 *  - a flash line (try, goal, card, key moment) is never dropped and is given its hold before the next flash
 *  - in fast forward (speed above FAST, 1.5) no more than opts.maxPerSec new lines a second (default 3);
 *    at life speed lines are spaced opts.clipGap apart (default 0.6 s)
 *  - where there are more lines than room, the lowest priority go first; the lines of one play are
 *    spread through its slot, so the ticker keeps moving; a ticker line stays up until the next, up to 3 s
 * Returned in time order; the lines keep the order of the record.
 */
/** a slot faster than this is fast forward (life speed on the pitch reads about 1.1 in its schedule) */
export const FAST = 1.5

export function feed(lines: Line[], slots: SlotLike[], opts: FeedOpts = {}): Shown[] {
  const maxPerSec = opts.maxPerSec ?? 3, clipGap = opts.clipGap ?? 0.6
  const ms = slots.some(x => x.start > 2000)
  const sl = slots.map(x => ({ n: x.n, start: ms ? x.start / 1000 : x.start, dur: (ms ? (x.dur ?? 0) / 1000 : x.dur ?? 0), speed: x.speed ?? 1 }))
  const byN = new Map<number, number>()
  sl.forEach((x, i) => byN.set(x.n, i))
  const gapAt = (t: number) => {
    // the speed of the slot showing at time t
    let lo = 0, hi = sl.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (sl[mid].start <= t) lo = mid; else hi = mid - 1 }
    return (sl[lo]?.speed ?? 1) > FAST ? 1 / maxPerSec : clipGap
  }
  // each line's window, and the spot in it it would like (the lines of one play spread through its slot)
  const perPlay = new Map<number, number>()
  for (const l of lines) perPlay.set(l.n, (perPlay.get(l.n) ?? 0) + 1)
  const seen = new Map<number, number>()
  const cand = lines.map((l, idx) => {
    const i = byN.get(l.n)
    if (i === undefined) return null
    const a = sl[i], nx = sl[i + 1]
    // (up to 0.8 s into the next play at most, so the words never fall more than a play behind the picture)
    // (in fast forward, inside its own play; at life speed up to 0.8 s into the next: never more than a play behind the picture)
    const lo = a.start, hi = a.speed > FAST && nx ? Math.max(a.start + a.dur, a.start + 0.05) : nx ? nx.start + Math.min(nx.dur, 0.8) : a.start + Math.max(a.dur, 4)
    const k = seen.get(l.n) ?? 0, m = perPlay.get(l.n)!
    seen.set(l.n, k + 1)
    const want = a.start + (a.dur * k) / m
    return { l, idx, lo, hi, want }
  })
  // the lines placed so far, in time order
  const placed: { t: number; flash: boolean; hold: number }[] = []
  const firstAt = (t: number) => { let lo = 0, hi = placed.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (placed[mid].t < t) lo = mid + 1; else hi = mid } return lo }
  const free = (t: number, flash: boolean, hold: number) => {
    for (let i = firstAt(t - 4.01); i < placed.length && placed[i].t <= t + 4.01; i++) {
      const q = placed[i]
      const g = Math.min(gapAt(q.t), gapAt(t))
      if (Math.abs(q.t - t) < g - 1e-9) return false
      // a flash line keeps the screen for its hold before the next flash
      if (flash && q.flash && (t >= q.t ? t - q.t < q.hold : q.t - t < hold)) return false
      // and nothing new comes up for two seconds after a flash, so it can be read
      if (q.flash && t > q.t && t - q.t < 2) return false
      if (flash && t < q.t && q.t - t < 2) return false
    }
    return true
  }
  const put = (t: number, flash: boolean, hold: number) => placed.splice(firstAt(t), 0, { t, flash, hold })
  // flashes first; then each play's best line (so every play gets a word when there is room); then the rest
  const best = new Map<number, number>()
  for (const c of cand) if (c) { const b = best.get(c.l.n); if (b === undefined || lines[b].priority < c.l.priority) best.set(c.l.n, c.idx) }
  const tier = (c: NonNullable<typeof cand[number]>) => (c.l.flash ? 0 : best.get(c.l.n) === c.idx ? 1 : 2)
  const order = cand.filter(Boolean).sort((a, b) => tier(a!) - tier(b!) || b!.l.priority - a!.l.priority || a!.idx - b!.idx)
  const keep: { c: NonNullable<typeof cand[number]>; t: number }[] = []
  for (const c of order) {
    if (!c) continue
    const h = c.l.hold
    let t: number | null = null
    const step = 0.05
    for (let d = 0; d <= c.hi - c.lo + step; d += step) {
      for (const x of [c.want + d, c.want - d]) if (x >= c.lo && x <= c.hi && free(x, !!c.l.flash, h)) { t = x; break }
      if (t !== null) break
    }
    if (t === null && c.l.flash) t = Math.max(c.lo, Math.min(c.hi, c.want))
    if (t === null) continue
    put(t, !!c.l.flash, h)
    keep.push({ c, t })
  }
  // the ticker lines in the order of the record, their times in order: both windows run in order, so each
  // line stays inside its own (a flash keeps the time it was given)
  const tick = keep.filter(k => !k.c.l.flash)
  const times = tick.map(k => k.t).sort((a, b) => a - b)
  tick.sort((a, b) => a.c.idx - b.c.idx).forEach((k, i) => { k.t = times[i] })
  keep.sort((a, b) => a.t - b.t || a.c.idx - b.c.idx)
  // a bare phase number only when the phase before it was shown too; otherwise the count ("8 phases now")
  let lastPhase = -1, lastPhaseN = -99
  for (const k of keep) {
    const l = k.c.l, ph = l.params.phase
    const w0 = EN_FLAT[l.key] ?? ''
    if (typeof ph !== 'number' || !w0.includes('{phase}')) continue
    // (a count, "6 phases", is a phase line shown: it sets the number the next bare one must follow)
    if (/[Pp]hase \{phase\}/.test(w0) && ph > 1 && (l.n - lastPhaseN > 4 || (ph !== lastPhase + 1 && ph !== lastPhase))) {
      const w = SIM_EN.phaseCount.map((_, i) => i).filter(i => (SIM_EN.phaseCount[i].match(/\{(\w+)\}/g) ?? []).every(x => l.params[x.slice(1, -1)] !== undefined))
      if (w.length) k.c = { ...k.c, l: { ...l, key: `sim.phaseCount${w[mix(l.n * 31 + ph) % w.length] + 1}` } }
    }
    // (the phase before must be a line of this passage: within a few plays, not one from before a try or a kick)
    lastPhase = ph; lastPhaseN = l.n
  }
  // a line stays up until the next one comes: a ticker line for up to 3 s, a sentence up to 5 s, a flash up to 6 s
  return keep.map((k, i) => {
    const next = keep[i + 1]
    const hold = !next ? k.c.l.hold : Math.max(k.c.l.hold, Math.min(k.c.l.flash ? 6 : k.c.l.reg === 'tick' ? 3 : 5, next.t - k.t))
    return { line: k.c.l, at: k.t, hold, i: k.c.idx }
  })
}

/** a line in English (the name the pitch uses) */
export const text = (line: Line): string => render(line)

/** a line in English */
export function render(line: Line): string {
  // (English: one of a thing, not "1 metres")
  const whole = fill(EN_FLAT[line.key] ?? line.key, line.params)
  const halves = line.part ? halvesOf(whole) : null
  const s = (halves ? halves[line.part! - 1] : whole).replace(/\b1 (metres|minutes|points|tackles|visits|times|lineouts|turnovers|phases|tries|penalties|carries|men)\b/g,
    (_, w: string) => `1 ${ONE[w] ?? w.slice(0, -1)}`)
    // ("an 8-metre drive", "an 11-point lead")
    .replace(/\b([Aa]) (8\d*|11|18)(?=[- ])/g, '$1n $2')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fill(s: string, params: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (all, k: string) => {
    const v = params[k]
    if (v === undefined) return all
    if (k.endsWith('_k')) { const key = String(v); return key.startsWith('moves.say.') ? MOVE_EN[key.slice(10)] ?? key : fill(EN_FLAT[key] ?? key, params) }
    return String(v)
  })
}
