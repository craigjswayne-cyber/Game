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
  /** the detail that follows a key moment's flash headline (its opening cry, "Line break!", is not said twice) */
  after?: boolean
  /** set by feed() in fast forward: one line for a run of plays, first to last, shown for the whole run */
  run?: [number, number]
  /** the pre-match block: said before the kick-off (feed() shows it while the teams run out, before the first play) */
  pre?: boolean
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
  // ---- the occasion in full (overnight run, 26 Nov; context.ts contextFromGame reads them off the game) ----
  /** the derby's own name ('the East Midlands derby') */
  derbyName?: string
  compName?: string
  /** a league fixture: its round, of how many */
  round?: number
  rounds?: number
  /** a knockout tie: 'QF', 'SF', 'F', 'BAR' */
  stage?: string
  /** the league table before kick-off, in order, and the two clubs' ids (home, away) */
  standings?: { id: string; pts: number; w: number; pd: number; tf: number; pf: number; p: number }[]
  clubIds?: [string, string]
  /** the first competitive match of the season for both sides */
  firstMatch?: boolean
  /** each side's last five results before this one, oldest first ('WWLDW') */
  form?: [string, string]
  /** the last time they met this season: the week, whether today's home side was at home, the score (today's home side first) */
  lastMet?: { week: number; sameVenue: boolean; homeScore: number; awayScore: number }
  /** the referee and what he is known for: 'fussy' (at the breakdown), 'jackal' (lets it go), 'scrumTight', 'shortFuse', 'flow', 'stopStart' */
  referee?: { name: string; traits: string[] }
  attendance?: number
  capacity?: number
  /** each man in the match by the record's id: his side, shirt, season and career so far, his kicks at goal this season */
  men?: Record<string, ContextMan>
  /** the team news worth saying */
  news?: ContextNews[]
  /** each side's next fixture */
  next?: [{ opp: string; home: boolean; week: number } | undefined, { opp: string; home: boolean; week: number } | undefined]
}

export interface ContextMan {
  side: 0 | 1
  shirt: number
  apps: number; tries: number; points: number
  careerApps: number; careerTries: number; careerPoints: number
  kickMade?: number; kickAtt?: number
}
/** debut: his first senior game; clubDebut: his first for this club; milestone: an n-th appearance; oldClub: against
 *  a club he has played for; return: back after n weeks injured; absent: a leading man not in the 23 (named, not an id) */
export interface ContextNews {
  kind: 'debut' | 'clubDebut' | 'milestone' | 'oldClub' | 'return' | 'absent'
  side: 0 | 1
  id?: string
  name?: string
  starts?: boolean
  n?: number
  why?: 'injured' | 'suspended'
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
  'talkWorks', 'subWhyBin', 'subWhyPens', 'subWhyLegs', 'subWhyLate', 'decidedFront', 'decidedTry', 'decidedKick', 'halfBall', 'motm',
  'standTries', 'standSteals', 'standTackles', 'standCarries', 'refHotRepeat', 'penRepeat', 'refWarning', 'refWarningAnon', 'coachShort', 'coachChase', 'coachProtect', 'coachWet', 'coachScrum', 'coachFrontRow', 'postTackler', 'postJackal', 'postCulprit', 'windFirst', 'windSecond',
  // the overnight run: the occasion, the men's stories, the co-commentator, the crowd, the story after the whistle
  'preRunIn', 'preFull', 'preCrowd', 'preDerbyName', 'preCupStage', 'preRound', 'preFirst', 'preTop', 'preBottom', 'preClose', 'formAllWon', 'formAllLost', 'formSome', 'metHere', 'metThere', 'metDrew', 'newsDebutStart', 'newsDebutBench', 'newsClubStart', 'newsClubBench', 'newsMilestone', 'newsOldClub', 'newsReturn', 'newsAbsent', 'preRef', 'refKnown', 'careerTry', 'droughtEnds', 'seasonTries', 'oldClubScores', 'careerPoints', 'kickForm', 'crowdHomeRoar', 'crowdHomeCheer', 'crowdAway', 'crowdHush', 'crowdSiege', 'anaKicking', 'anaHands', 'anaWide', 'anaMiddle', 'anaCollide', 'anaStopped', 'anaJackal', 'tipBreakdown', 'anaScrumBad', 'tipScrum', 'anaPensRuck', 'tipPens', 'anaPensOffside', 'anaInTheirHalf', 'duelHalf', 'duelFull', 'postUp', 'postDown', 'postStay', 'postBonusTry', 'postBonusLose', 'postCupWon', 'postCupThrough', 'postStat', 'postMgrGood', 'postMgrBad', 'postMgrMixed', 'postNext', 'motmNums', 'debutFirst', 'clubFirst', 'returnFirst', 'debutHalf',
])

/** bases used only when the record has an order this file does not expect: the tests hold them at zero */
export const FALLBACK = new Set(['dropOut', 'dropGl', 'scrum', 'lo', 'pen', 'free', 'kickOther'])

const ANY: PlayKind[] = ['kickoff', 'dropout22', 'goalLineDropout', 'scrum', 'lineout', 'tap', 'carry', 'offload', 'ruck', 'maul', 'lineBreak', 'kick', 'catch',
  'knockOn', 'forwardPass', 'notStraight', 'unplayable', 'restartError', 'intoTouch', 'outOnFull', 'deadBall', 'heldUp', 'penalty', 'freeKick',
  'try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'yellowCard', 'redCard', 'halfTime', 'fullTime', 'substitution', 'injury']
const SCORES: PlayKind[] = ['conversion', 'penaltyGoal', 'dropGoal', 'penaltyTry']
const STOPS: PlayKind[] = ['penalty', 'freeKick', 'scrum', 'lineout', 'kickoff', 'dropout22', 'goalLineDropout']
/** words put inside other lines, never lines of their own */
const INNER = /^(zone|cause|nth|kind|type|need|how|tone|who|why|stage|out|ord|where)[A-Z]|^(refFussy|refJackal|refScrumTight|refShortFuse|refFlow|refStopStart|refHotOffside|duelTries|duelBreaks|duelTurnovers|duelCarries|duelTackles|edgeBreaks|edgeTurnovers|edgePens)$/

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
  tickRuckQuick: ['ruck'], tickRuckSlow: ['ruck'], tickRuckNext: ['ruck'], phaseCount: ['ruck'], tickRunOn: ['lineBreak'], tickBeaten: ['lineBreak'], subRefusedWhy: ['substitution'], subCover: ['substitution'], tickChase: ['lineBreak'], tickHalfway: ['lineBreak', 'carry'], tickIntoTwentyTwo: ['lineBreak', 'carry'], turnoverIsolated: ['ruck'], yellowRepeated: ['yellowCard'], tickScrumSet: ['scrum'], tickRuck: ['ruck'], tickRuckNear: ['ruck'], tickRuckWhistle: ['ruck'], tickRuckStuck: ['ruck'], tickContest: ['catch'], tickScrumWon: ['scrum'], pickGo: ['carry'], carryTouch: ['carry'], intercepted: ['carry'], phases: ['ruck'], turnover: ['ruck'],
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
  hlBreak: ['lineBreak'], hlTurnover: ['ruck'], hlLastGasp: ['lineBreak'], hlHeldUp: ['heldUp'], hlHeldUpMaul: ['heldUp'], hlMaulOver: ['maul'], hlPicked: ['carry'], hlIntercept: ['lineBreak'],
  runPhases: ['carry', 'ruck', 'offload'], runQuick: ['carry', 'ruck', 'offload'], runGain: ['carry', 'ruck', 'offload'], runNoGain: ['carry', 'ruck', 'offload'], runBack: ['carry', 'ruck', 'offload'],
  runTwentyTwo: ['carry', 'ruck', 'offload'], runHalf: ['carry', 'ruck', 'offload'], runWide: ['carry', 'ruck', 'offload'], runStart: ['carry', 'ruck', 'offload'], runShort: ['carry', 'ruck', 'offload'],
  fillOver: ['carry'], fillLoose: ['carry', 'knockOn'], fillBreak: ['lineBreak'], fillRuck: ['ruck'], fillPhase: ['ruck'], fillDefence: ['ruck'], fillCarry: ['carry', 'offload'], fillKick: ['kick'], fillLineout: ['lineout'], fillScrum: ['scrum'], fillMaul: ['maul'], fillClock: ANY, fillGoal: ['conversion', 'penaltyGoal'],
  mgrPosts: ['penaltyGoal'], mgrTurnCorner: ['kick'], mgrTurnTap: ['tap'], mgrTurnScrum: ['scrum'], mgrCorner: ['kick'], mgrTap: ['tap'], mgrScrum: ['scrum'],
  capCallPosts: ['penaltyGoal'], capCallCorner: ['kick'], capCallTap: ['tap'], capCallScrum: ['scrum'],
  callPaysTry: ['try', 'penaltyTry'], callCornerLost: ['lineout'], callScrumLost: ['scrum'], callPostsGood: ['penaltyGoal'], callPostsMiss: ['penaltyGoal'],
  tacChange: ANY, talkHt: ['kickoff'], talkPre: ['kickoff'], talkWorks: ANY,
  subWhyBin: ['substitution'], subWhyPens: ['substitution'], subWhyLegs: ['substitution'], subWhyLate: ['substitution'],
  subTry: ['try'], subSteal: ['ruck', 'carry'], subPen: ['penalty'], subMiss: ['try'],
  decidedFront: ['fullTime'], decidedTry: ['fullTime'], decidedKick: ['fullTime'], halfBall: ['halfTime', 'fullTime'], motm: ['fullTime'],
  standTries: ['halfTime', 'fullTime'], standSteals: ['halfTime', 'fullTime'], standTackles: ['halfTime', 'fullTime'], standCarries: ['halfTime', 'fullTime'],
  preRunIn: ['kickoff'], preFull: ['kickoff'], preCrowd: ['kickoff'], preDerbyName: ['kickoff'], preCupStage: ['kickoff'], preRound: ['kickoff'], preFirst: ['kickoff'], preTop: ['kickoff'], preBottom: ['kickoff'], preClose: ['kickoff'], formAllWon: ['kickoff'], formAllLost: ['kickoff'], formSome: ['kickoff'], metHere: ['kickoff'], metThere: ['kickoff'], metDrew: ['kickoff'], newsDebutStart: ['kickoff'], newsDebutBench: ['kickoff'], newsClubStart: ['kickoff'], newsClubBench: ['kickoff'], newsMilestone: ['kickoff'], newsOldClub: ['kickoff'], newsReturn: ['kickoff'], newsAbsent: ['kickoff'], preRef: ['kickoff'], refKnown: ['kickoff'], careerTry: ['try'], droughtEnds: ['try'], seasonTries: ['try'], oldClubScores: ['try'], careerPoints: ['try', 'conversion', 'penaltyGoal', 'dropGoal'], kickForm: ['conversion', 'penaltyGoal'], crowdHomeRoar: ['try'], crowdHomeCheer: ['try'], crowdAway: ['try'], crowdHush: ['penaltyGoal'], crowdSiege: ['ruck'], anaKicking: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaHands: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaWide: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaMiddle: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaCollide: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaStopped: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaJackal: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], tipBreakdown: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaScrumBad: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], tipScrum: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaPensRuck: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], tipPens: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaPensOffside: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], anaInTheirHalf: ['conversion', 'penaltyGoal', 'dropGoal', 'scrum', 'lineout', 'penalty', 'halfTime'], duelHalf: ['halfTime'], duelFull: ['fullTime'], postUp: ['fullTime'], postDown: ['fullTime'], postStay: ['fullTime'], postBonusTry: ['fullTime'], postBonusLose: ['fullTime'], postCupWon: ['fullTime'], postCupThrough: ['fullTime'], postStat: ['fullTime'], postMgrGood: ['fullTime'], postMgrBad: ['fullTime'], postMgrMixed: ['fullTime'], postNext: ['fullTime'], motmNums: ['fullTime'], debutFirst: ANY, debutHalf: ['halfTime'], clubFirst: ANY, returnFirst: ANY,
windFirst: ['kickoff'], windSecond: ['kickoff'], windKickWith: ['kick'], windKickInto: ['kick'], windGoalWith: ['penaltyGoal', 'conversion'], windGoalInto: ['penaltyGoal', 'conversion'], windGoalMiss: ['penaltyGoal', 'conversion'], scShove: ['scrum'], scEight: ['scrum'], scBackRow: ['scrum'], scrumPushover: ['scrum'], tryPushover: ['try'], loOptFront: ['lineout'], loOptMiddle: ['lineout'], loOptTail: ['lineout'], koShort: ['kickoff'], koLong: ['kickoff'], coachFrontRow: ANY, postTackler: ['fullTime'], postJackal: ['fullTime'], postCulprit: ['fullTime'],
  refHotRepeat: ['penalty'], penRepeat: ['penalty'], refWarning: ['penalty'], refWarningAnon: ['penalty'],
  coachShort: ANY, coachChase: ANY, coachProtect: ANY, coachWet: ANY, coachScrum: ANY,
  heldUp: ['heldUp'], heldUpMaul: ['heldUp'], tryMid: ['try'], conOver: ['conversion'], conWide: ['conversion'],
  penAim: ['penaltyGoal'], penOver: ['penaltyGoal'], penWide: ['penaltyGoal'], dropOver: ['dropGoal'], dropWide: ['dropGoal'],
  flashTry: ['try'], flashPenTry: ['penaltyTry'], flashCon: ['conversion'], flashConMiss: ['conversion'], flashPen: ['penaltyGoal'], flashPenMiss: ['penaltyGoal'],
  flashDrop: ['dropGoal'], flashDropMiss: ['dropGoal'], flashYellow: ['yellowCard'], flashRed: ['redCard'], flashRedSecond: ['redCard'], redSecond: ['redCard'], scoreLine: ['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal'],
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
  'maulDown', 'penRuckDef', 'penRuckAtt', 'penScrum', 'penMaul', 'penLineout', 'penKick', 'pen', 'freeScrum', 'freeLineout', 'free', 'tapPen', 'tapFree', 'tapNear', 'tapQuick', 'injured', 'subInjury', 'subRefusedWhy',
  'scoreLine', 'binBack', 'subMade', 'subRefused', 'halfTime', 'fullTime', 'winBy', 'draw', 'turnover', 'chargedDown',
  // the manager's decisions and what came of them (round 8): every one acknowledged
  'mgrPosts', 'mgrTurnCorner', 'mgrTurnTap', 'mgrTurnScrum', 'mgrCorner', 'mgrTap', 'mgrScrum', 'capCallPosts', 'capCallCorner', 'capCallTap', 'capCallScrum',
  'callPaysTry', 'callCornerLost', 'callScrumLost', 'callPostsGood', 'callPostsMiss', 'tacChange', 'talkHt', 'talkPre', 'talkWorks',
  'subTry', 'subSteal', 'subPen', 'subMiss', 'decidedFront', 'decidedTry', 'decidedKick', 'motm',
  'refWarning', 'refWarningAnon', 'coachShort', 'coachChase', 'coachProtect', 'coachWet', 'coachScrum', 'coachFrontRow', 'scrumPushover',
])
/** priority 1 (a note worth hearing) and 0 (colour); every other line is 2 */
const PRI: Record<string, number> = {
  ...Object.fromEntries([...SUMMARY].map(b => [b, 1])),
  statTackles: 0, statCarries: 0, statMetres: 0, statLineout: 0, offenderPens: 0, pensTotal: 0, possession: 0, tries: 1, ballTen: 0,
  handlingCount: 0, outFullCount: 0, turnoversCount: 0, tryType: 0, introVenue: 0, weatherKnock: 0, subFirst: 0, backFromBin: 0,
  phases: 0, loWon: 0, carryBack: 0, catchKick: 1, catchKo: 1, catchDrop: 1, maulOut: 1, maulNoGain: 1, freeKickKick: 1,
  winBy: 3, binBack: 3,
  crowdHomeRoar: 0, crowdHomeCheer: 0, crowdAway: 0, crowdHush: 0, crowdSiege: 0, anaKicking: 0, anaHands: 0, anaWide: 0, anaMiddle: 0, anaCollide: 0, anaStopped: 0, anaJackal: 0, tipBreakdown: 0, anaScrumBad: 0, tipScrum: 0, anaPensRuck: 0, tipPens: 0, anaPensOffside: 0, anaInTheirHalf: 0,
  shOneOut: 1, shPod: 1, shTipOn: 1, shSnipe: 1, shPullBack: 1, shPodTen: 1, shMiss: 1, shLoop: 1, shWrap: 1, shSwitch: 1, shKickPass: 1,
  tickCarryOn: -1, tickToTouch: -1, tickRuckQuick: 1, tickRuckSlow: 0, tickRuckNext: 0, phaseCount: 0, tickRunOn: 1, tickBeaten: 1, tickChase: 1, tickHalfway: 1, tickIntoTwentyTwo: 1, tickScrumSet: 0,
  tickPass: 1, tickHands: 1, tickCarry: 1, tickGain: 1, tickHeld: 1, tickTackle: 0, tickNear: 2, tickLine: 2, tickOver: 2, tickLaunch: 1, tickFirst: 1,
  tickRuck: 0, tickRuckNear: 1, tickRuckWhistle: 1, tickRuckStuck: 1, tickFlight: 0, tickRoll: 0, tickMaul: 1, tickMaulStop: 1, tickStop: 0, tickContest: 1, tickScrumWon: 1,
}
const priorityOf = (base: string, level: Line['level']) => (level === 'key' || MUST.has(base) ? 3 : PRI[base] ?? 2)

/** the ticker register: short lines for the run of play */
export const TICK = new Set([
  'shOneOut', 'shPod', 'shTipOn', 'shSnipe', 'shPullBack', 'shPodTen', 'shMiss', 'shLoop', 'shWrap', 'shSwitch', 'shKickPass',
  'scShove', 'scEight', 'scBackRow', 'loOptFront', 'loOptMiddle', 'loOptTail', 'koShort', 'koLong', 'windKickWith', 'windKickInto',
  'tickBeaten', 'tickCarryOn', 'tickToTouch', 'tickRuckQuick', 'tickRuckSlow', 'tickRuckNext', 'phaseCount', 'tickRunOn', 'tickChase', 'tickHalfway', 'tickIntoTwentyTwo', 'tickScrumSet',
  'tickPass', 'tickHands', 'tickCarry', 'tickGain', 'tickHeld', 'tickTackle', 'tickNear', 'tickLine', 'tickOver', 'tickLaunch', 'tickFirst', 'tickRuck', 'tickRuckNear', 'tickRuckWhistle', 'tickRuckStuck',
  'tickContest', 'tickScrumWon', 'carryBig', 'carryBack', 'pickGo', 'offload', 'catchKo', 'catchKick', 'catchDrop',
  'kickBox', 'kickLong', 'kickHigh', 'kickGrubber', 'kickCross', 'kickChip', 'kickOther', 'freeKickKick', 'tickFlight', 'tickRoll', 'tickMaul', 'tickMaulStop', 'tickStop',
  'runPhases', 'runQuick', 'runGain', 'runNoGain', 'runBack', 'runTwentyTwo', 'runHalf', 'runWide', 'runStart', 'runShort',
  'fillOver', 'fillLoose', 'fillBreak', 'fillRuck', 'fillPhase', 'fillDefence', 'fillCarry', 'fillKick', 'fillLineout', 'fillScrum', 'fillMaul', 'fillClock', 'fillGoal',
])
const flashOf = (base: string, level: Line['level']): Line['flash'] =>
  base === 'flashTry' || base === 'flashPenTry' ? 'try'
    : base === 'flashCon' || base === 'flashPen' || base === 'flashDrop' ? 'goal'
    : base === 'flashYellow' || base === 'flashRed' || base === 'flashRedSecond' ? 'card'
    : level === 'key' ? 'key' : null
const HOLD = { try: 4, goal: 3, card: 3.5, key: 2.5 } as const
/** a key moment's flash is a short headline (48 letters or fewer); its full line follows as the detail */
const HEAD: Record<string, string> = {
  breakClean: 'hlBreak', breakHauled: 'hlBreak', breakLastGasp: 'hlLastGasp', turnover: 'hlTurnover', turnoverIsolated: 'hlTurnover',
  heldUp: 'hlHeldUp', heldUpMaul: 'hlHeldUpMaul', maulOver: 'hlMaulOver', intercepted: 'hlPicked', interceptRun: 'hlIntercept', interceptHauled: 'hlIntercept',
}
/** wordings that stand out when heard often: at most one time in seven of their line, never a match's own */
const RARE = new Set(['{player} presents quickly.', 'Lightning ruck over {player}.', '{player} goes down, and it is out in a flash.'])
/** the opening cry a detail line drops, the headline having said it */
const CRY = /^(Line break|Turnover|Held up|Intercepted|Break)! |\. (Turnover|Held up)!$/
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
const SECONDARY: Record<string, string> = { hlPicked: 'player', tryMid: 'player2', tickChase: 'player', turnoverIsolated: 'player', penRuckAtt: 'player', shPod: 'player2', shWrap: 'player2', shSwitch: 'player2', shOneOut: 'player2', tickTackle: 'player', tickHeld: 'oppPlayer', tickLaunch: 'player', tryPickGo: 'player2', tryClose: 'player2', tryWide: 'player2', tryBreak: 'player2', breakClean: 'player2', breakHauled: 'player2', carryBig: 'player2' }

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

/**
 * HOW A TRY WAS SCORED, from the record rather than its one word (coordinator, round 7: "a close-range pod
 * carry then 'Out wide, Kata has the room'"): where the scoring run started, how it was carried, where it was
 * grounded. A break or a run of 22 metres or more is a break; a pick and go, or a carry from 3 metres with no
 * pass, is a pick and go; grounded within 15 metres of touch is out wide; from 12 metres or less, close range;
 * otherwise a run from {d} metres. A maul, an interception or a charge-down is as the record says.
 */
export function tryHow(P: Play[], p: Play): { base: string; d: number; startD: number; wide: boolean } {
  const s = p.side
  let k = p.n - 1
  while (k >= 0 && !['carry', 'lineBreak', 'maul', 'offload', 'catch', 'kick'].includes(P[k].kind)) k--
  const last = P[k] ?? p
  const before = k > 0 ? P[k - 1] : last
  const startD = Math.round(toLine(s, before.x))
  const wide = p.y < 15 || p.y > 55
  const d = Math.max(1, startD)
  if (p.result === 'maul') return { base: 'tryMaul', d, startD, wide }
  if (p.result === 'pushover') return { base: 'tryPushover', d, startD, wide }
  if (p.result === 'interception') return { base: 'tryInterception', d, startD, wide }
  if (!['close', 'wide', 'break', 'pickAndGo'].includes(p.result)) return { base: 'tryCharge', d, startD, wide }
  if (last.kind === 'lineBreak' || startD >= 22) return { base: 'tryBreak', d, startD, wide }
  if (last.shape === 'pickAndGo' || (startD <= 3 && !last.passes)) return { base: 'tryPickGo', d, startD, wide }
  if (wide) return { base: 'tryWide', d, startD, wide }
  return { base: startD <= 12 ? 'tryClose' : 'tryMid', d, startD, wide }
}

/** THE MANAGER'S DECISIONS as the record carries them (GAMEPLAY, round 8; every field optional: nothing is said
 *  that is not written). `callBy`: who decided a penalty, `tactics` where a change took effect, `talk` the
 *  half-time talk on the second-half kick-off; on the result, `managed` the user's side and `motm` the man of the match. */
interface DecPlay {
  call?: 'posts' | 'corner' | 'tap' | 'scrum'
  callBy?: 'manager' | 'standing' | 'captain'
  tactics?: { side: 0 | 1; set: Record<string, unknown>; was?: Record<string, unknown> }
  talk?: { side: 0 | 1; tone: string; pre?: boolean }
}
/** the half-time and full-time blocks name the man who stood out, the scorer who decided it and the player of
 *  the match. harmonycheck C05 asks a named man to be in the line's own play (the whistle), so until the
 *  overseer lets a summary at the whistle name a man from earlier in the match, this one switch turns them off */
export const NAMED_SUMMARY = true
/** the defender a line break beat (Play.beat), by name: harmonycheck C05 does not read `beat` yet, so until it does
 *  the line says a tackle was missed without naming the man */
export const NAMED_BEAT = true
/** the overnight run's whistle lines that name a man from earlier in the match (the duel of the opposites, the
 *  player of the match's numbers, the day's top tackler, jackal and penalty-giver, the debutant at the break):
 *  harmonycheck C05 checks a fixed list of named whistle lines (NAMED_SUMMARY_BASES), so until these join it
 *  this one switch keeps them off */
export const NAMED_WHISTLE_MORE = false
/** why the game refused the manager's change (Play.cause on a refused substitution, fromMatch.ts decide()) */
const REFUSED_WHY: Record<string, string> = { 'not on the field': 'sim.whyNotOn1', 'in the bin or sent off': 'sim.whyBinned1', 'not on the bench': 'sim.whyNotBench1', refused: 'sim.whyLaws1' }
const decOf = (q: Play | undefined) => q as (Play & DecPlay) | undefined
/** a tactics change in a few words: the dial that moved most, and which way (a change under 15 of 100 is not said) */
const TAC_WORDS: [string, string, string][] = [
  ['style', 'howWider', 'howTighter'], ['tempo', 'howQuicker', 'howSlower'], ['kicking', 'howKickMore', 'howKickLess'],
  ['aggression', 'howHarder', 'howCleaner'], ['defLine', 'howRush', 'howDrift'], ['defWidth', 'howSpread', 'howNarrow'],
  ['ruckContest', 'howContest', 'howFanOut'], ['ruckCommit', 'howCommit', 'howCommitLess'],
]
export function tacticsWords(t: NonNullable<DecPlay['tactics']>): string | undefined {
  let best: string | undefined, by = 14
  for (const [k, up, down] of TAC_WORDS) {
    const a = Number(t.was?.[k] ?? 50), b = Number(t.set[k])
    if (!Number.isFinite(b) || !(k in t.set)) continue
    if (Math.abs(b - a) > by) { by = Math.abs(b - a); best = b > a ? up : down }
  }
  if (!best && 'exit' in t.set && t.set.exit !== t.was?.exit) best = 'howExit'
  if (!best && 'kickStyle' in t.set && t.set.kickStyle !== t.was?.kickStyle) best = 'howKickPlan'
  return best ? `sim.${best}1` : undefined
}

/** which of the referee's hot spots (RefereeView.hot) each penalty's cause falls under */
const HOT_OF: Record<string, string> = {
  notRollingAway: 'breakdown', holdingOn: 'breakdown', notReleasing: 'breakdown', sealingOff: 'breakdown',
  offside: 'offside', handsInRuck: 'offside', offsideAtKick: 'offside', offsideAtLineout: 'offside',
  collapsing: 'scrum', standingUp: 'scrum', notBinding: 'scrum', earlyEngagement: 'scrum',
}
/** what the referee is hot on (RefereeView.hot), in words */
const HOT_WORD: Record<string, string> = { breakdown: 'sim.refFussy1', offside: 'sim.refHotOffside1', scrum: 'sim.refScrumTight1', cards: 'sim.refShortFuse1', flow: 'sim.refFlow1' }
/** the other coach's change (Play.coach.mode), in words */
const COACH_BASE: Record<string, string> = { exploitShort: 'coachShort', chase: 'coachChase', protect: 'coachProtect', wet: 'coachWet', targetScrum: 'coachScrum', frontRow: 'coachFrontRow' }

/** the knockout stages the pre-match block can name */
const STAGES = new Set(['QF', 'SF', 'F'])

/** the record each commentate() result was written from, so feed() can write a line for a run of plays and a
 *  short true word for a quiet moment on the pitch's schedule (only for that array, as commentate() returned it) */
const SOURCE = new WeakMap<Line[], { plays: Play[]; T: [string, string]; nm: (id: string | undefined) => string }>()

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
  const recentTpl: string[] = []
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
  const watchFirst = new Map<string, { base: string; side: 0 | 1 }>()
  for (const nw of context.news ?? []) if (nw.id && (nw.kind === 'debut' || nw.kind === 'clubDebut' || nw.kind === 'return')) watchFirst.set(nw.id, { base: nw.kind === 'debut' ? 'debutFirst' : nw.kind === 'clubDebut' ? 'clubFirst' : 'returnFirst', side: nw.side })
  const oldBoys = new Set((context.news ?? []).filter(x => x.kind === 'oldClub' && x.id).map(x => x.id!))
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
  // ---- the manager's decisions, watched for ten minutes of clock: a penalty call, a replacement, the half-time talk
  type CallWatch = { side: 0 | 1; ch: string; who_k: string; n: number; clock: number; seen: boolean }
  let callWatch: CallWatch | null = null
  const subWatch: { side: 0 | 1; on: string; clock: number }[] = []
  let talkWatch: { side: 0 | 1; at: [number, number] } | null = null
  const cameOn = new Set<string>()
  const sideOf = new Map<string, 0 | 1>()
  const DECIDE = 600
  let penChoices = 0, knockCount = 0, statAt = -99, statClock = -Infinity
  /** a man's numbers are said at most once every eight plays */
  const statOk = (n: number) => n - statAt >= 8

  let preBlock = false
  const penCause = new Map<string, number>()
  // ---- THE MATCH IN NUMBERS, each side's, for the co-commentator and the full-time story (overnight run)
  type Tally = { kicks: number; car: number; gl: number; m: number; wide: number; breaks: number; tw: number; pens: number; pensRuck: number; pensScrum: number; pensOff: number; scrumBad: number; loLost: number; live: number; inOpp: number }
  const tally = (): Tally => ({ kicks: 0, car: 0, gl: 0, m: 0, wide: 0, breaks: 0, tw: 0, pens: 0, pensRuck: 0, pensScrum: 0, pensOff: 0, scrumBad: 0, loLost: 0, live: 0, inOpp: 0 })
  const tot: [Tally, Tally] = [tally(), tally()]
  let win: [Tally, Tally] = [tally(), tally()], anaAt = 0, anaN = 0, drinks = 0
  const today = new Map<string, { tries: number; pts: number; kMade: number; kAtt: number; breaks: number }>()
  const td = (id: string) => { let v = today.get(id); if (!v) { v = { tries: 0, pts: 0, kMade: 0, kAtt: 0, breaks: 0 }; today.set(id, v) } return v }
  const kickSaid = new Set<string>()
  let mgrGood = 0, mgrBad = 0, sieged = false
  const crowdBig = (context.attendance ?? 0) >= 10000
  const ORD = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen']
  const ordKey = (k: number) => (k >= 1 && k <= 16 ? `sim.ord${ORD[k]}1` : undefined)
  const fmtN = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const manName = (id: string | undefined) => nm(id)

  for (const p of plays) {
    const n = p.n
    const clock = p.clock ?? p.t
    let j = 0
    const say = (base: string, level: Line['level'], side: 0 | 1 | null, extra: Record<string, string | number | undefined> = {}, after = false): void => {
      // a key moment: the short flash headline, then the full line as its detail (never dropped)
      if (level === 'key' && HEAD[base] && !after) { say(HEAD[base], 'key', side, extra); return say(base, 'normal', side, extra, true) }
      const priority = after ? 3 : priorityOf(base, level)
      if (opts.density === 'fast' && priority <= 0) return
      // a man's numbers and a side's counts: one every twenty seconds of the clock at most
      if (STATS.has(base) && clock - statClock < 20) return
      // a note is never said straight after another of its own kind (the line that says what happened always is)
      const note = SUMMARY.has(base) || base === 'phases'
      const last = out[out.length - 1]
      if (note && !preBlock && last && last.key.slice(4).replace(/\d+$/, '') === base) return
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
      const mine = all.filter(i => inVoice(base, i) && !RARE.has(list[i]))
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
      // (and a wording not used in the last eight lines, nor three times already, before one that has: "Lightning ruck over"
      // twice running, or "presents quickly" every other ruck, reads as a machine)
      // (a wording that stands out, "presents quickly", is kept for now and then: never the match's own, and after the rest)
      const rested = (x: number) => fresh(x) && !recentTpl.includes(`${base}${x}`) && (!RARE.has(list[x]) || u[x] * 6 < Math.max(1, u.reduce((a, b) => a + b, 0)))
      // (a ticker line 70 letters or fewer with these names: a long name takes the wordings that leave room for it)
      // (a flash 48 or fewer)
      const cap = flashOf(base, level) ? 48 : TICK.has(base) ? 70 : Infinity
      const fits = (x: number) => fill(list[x], params).length <= cap
      const groups = [mine.filter(rested), others.filter(rested), mine.filter(fresh), others.filter(fresh), mine, others]
      const order = [...groups.flatMap(g => g.filter(fits)), ...groups.flat()]
      let i = order.find(x => !recent.includes(sig(x)))
      if (i === undefined) { if (note) return; i = order[0] }
      said.add(sig(i))
      u[i]++; used.set(base, u)
      recent.push(sig(i)); if (recent.length > 12) recent.shift()
      recentTpl.push(`${base}${i}`); if (recentTpl.length > 8) recentTpl.shift()
      j++
      if (STATS.has(base)) statClock = clock
      const flash = flashOf(base, level), reg = TICK.has(base) ? 'tick' as const : 'full' as const
      // how long it stays up: a flash by its kind, a ticker line 1.2 s, a sentence by its length (about 18 letters a second)
      const said0 = fill(list[i], params), whole = after ? said0.replace(CRY, m => (m.startsWith('.') ? '.' : '')) : said0
      const len = whole.length
      const hold = flash ? HOLD[flash] : reg === 'tick' ? 1.2 : Math.round(Math.min(4.5, Math.max(2, len / 18)) * 10) / 10
      const line: Line = { n, t: clock, key: `sim.${base}${i + 1}`, params, level, side, priority, flash, hold, reg, ...(after ? { after: true } : {}), ...(preBlock ? { pre: true } : {}) }
      // over 90 characters: two lines, what happened and who, then the consequence (the flash stays on the first)
      const halves = len > 90 ? halvesOf(whole.replace(/^./, c => c.toUpperCase())) : null
      if (halves) {
        out.push({ ...line, part: 1, hold: flash ? hold : Math.max(2, Math.round(halves[0].length / 18 * 10) / 10) })
        out.push({ ...line, part: 2, flash: null, level: level === 'key' ? 'normal' : level, hold: Math.max(2, Math.round(halves[1].length / 18 * 10) / 10) })
      } else out.push(line)
    }
    /** the pre-match block: only what the context holds (contextFromGame reads it off the game) */
    const preMatch = () => {
      const c = context, H = T[0], A = T[1]
      // the ground and the crowd
      if (c.venue && c.attendance && c.capacity && c.attendance >= 0.95 * c.capacity) say('preFull', 'minor', null, { venue: c.venue, att: fmtN(c.attendance) })
      else if (c.venue && c.attendance) say('preCrowd', 'minor', null, { venue: c.venue, att: fmtN(c.attendance) })
      else if (c.venue) say('introVenue', 'minor', null, { venue: c.venue })
      // the fixture and what is at stake
      if (c.derbyName) say('preDerbyName', 'minor', null, { derby: c.derbyName, home: H, away: A })
      else if (c.derby) say('introDerby', 'minor', null, { home: H, away: A })
      if (c.cup) say(c.stage && STAGES.has(c.stage) ? 'preCupStage' : 'introCup', 'minor', null, { cup: c.cup, home: H, away: A, stage_k: c.stage && STAGES.has(c.stage) ? `sim.stage${c.stage}1` : undefined })
      else if (c.compName && c.round && c.rounds) say('preRound', 'minor', null, { comp: c.compName, round: c.round, rounds: c.rounds, home: H, away: A })
      if (c.firstMatch) say('preFirst', 'minor', null)
      if (c.table && !c.cup) say('introTable', 'minor', null, { home: H, away: A, hp: c.table[0], ap: c.table[1] })
      if (c.table && !c.cup && c.standings && c.clubIds) {
        const rows = c.standings, last = rows.length
        const at = c.clubIds.map(id => rows.find(r => r.id === id))
        for (const sd of [0, 1] as const) {
          const pos = c.table[sd], r = at[sd]
          if (!r || r.p === 0) continue
          // the run-in: five rounds or fewer left, in the top two
          const left = c.rounds && c.round ? c.rounds - c.round + 1 : 99
          if (left <= 5 && pos <= 2) say('preRunIn', 'minor', sd, { pos_k: ordKey(pos), left, gap: pos === 2 ? rows[0].pts - r.pts : undefined })
          if (pos === 1) say('preTop', 'minor', sd, { gap: rows[1] ? r.pts - rows[1].pts : undefined })
          else if (pos === last) say('preBottom', 'minor', sd, { gap: rows[last - 2] ? rows[last - 2].pts - r.pts : undefined })
        }
        if (at[0] && at[1] && at[0].p > 0 && Math.abs(at[0].pts - at[1].pts) <= 3) say('preClose', 'minor', null, { home: H, away: A, gap: Math.abs(at[0].pts - at[1].pts) || undefined })
      }
      // form, and the last meeting
      if (c.form) for (const sd of [0, 1] as const) {
        const f = c.form[sd], nn = f.length, w = [...f].filter(x => x === 'W').length
        if (nn < 3) continue
        say(w === nn ? 'formAllWon' : w === 0 && !f.includes('D') ? 'formAllLost' : 'formSome', 'minor', sd, { n: nn, w })
      }
      if (c.lastMet) {
        const m = c.lastMet, wHome = m.homeScore > m.awayScore
        say(m.homeScore === m.awayScore ? 'metDrew' : m.sameVenue ? 'metHere' : 'metThere', 'minor', null,
          { week: m.week, winner: m.homeScore === m.awayScore ? undefined : wHome ? H : A, a: Math.max(m.homeScore, m.awayScore), b: Math.min(m.homeScore, m.awayScore) })
      }
      // the team news
      // (the milestones, old boys and returns first; two debuts a side at most; five stories in all)
      let said = 0
      const RANK: Record<string, number> = { milestone: 0, oldClub: 1, return: 2, absent: 3, debut: 4, clubDebut: 5 }
      const debuts = [0, 0]
      for (const nw of [...(c.news ?? [])].sort((a, b) => RANK[a.kind] - RANK[b.kind])) {
        if (said >= 5) break
        if ((nw.kind === 'debut' || nw.kind === 'clubDebut') && debuts[nw.side]++ >= 2) continue
        const who = nw.id ? manName(nw.id) : nw.name
        if (!who) continue
        const base = nw.kind === 'debut' ? (nw.starts ? 'newsDebutStart' : 'newsDebutBench') : nw.kind === 'clubDebut' ? (nw.starts ? 'newsClubStart' : 'newsClubBench')
          : nw.kind === 'milestone' ? 'newsMilestone' : nw.kind === 'oldClub' ? 'newsOldClub' : nw.kind === 'return' ? 'newsReturn' : 'newsAbsent'
        say(base, 'minor', nw.side, { player: who, n: nw.n, why_k: nw.why ? `sim.out${nw.why === 'injured' ? 'Injured' : 'Banned'}1` : undefined })
        said++
      }
      // the referee
      const rv = (result as SimResult & { referee?: { name: string; hot?: string } }).referee
      if (rv) {
        say('preRef', 'minor', null, { ref: rv.name })
        const hk = rv.hot ? HOT_WORD[rv.hot] : undefined
        if (hk) say('refKnown', 'minor', null, { ref: rv.name, what_k: hk })
      } else if (c.referee) {
        say('preRef', 'minor', null, { ref: c.referee.name })
        const tr = c.referee.traits[0]
        if (tr) say('refKnown', 'minor', null, { ref: c.referee.name, what_k: `sim.ref${tr.charAt(0).toUpperCase()}${tr.slice(1)}1` })
      }
      // the weather and the ground
      if (c.weather && c.weather !== 'Dry') say(`wx${c.weather}`, 'minor', null)
      if (c.surface === 'artificial') say('surfArtificial', 'minor', null)
    }

    /** the co-commentator: up to two short lines on what each side is doing and whether it works, from the spell since the
     *  last word (win) or the match (tot); a pointer for the manager when his side is losing a part of the game */
    const analyse = (_n: number, w: [Tally, Tally] = win) => {
      const cands: [string, 0 | 1, Record<string, string | number | undefined>][] = []
      const mg = result.managed
      for (const sd of [0, 1] as const) {
        const t = w[sd], u = w[other(sd)]
        if (t.kicks >= 4 && t.car <= t.kicks * 4) cands.push(['anaKicking', sd, { k: t.kicks, c: t.car }])
        else if (t.car >= 20 && t.kicks <= 2) cands.push(['anaHands', sd, { k: t.kicks, c: t.car }])
        if (t.m >= 40 && t.wide >= 0.6 * t.m) cands.push(['anaWide', sd, { pct: Math.round(100 * t.wide / t.m) }])
        else if (t.m >= 40 && t.wide <= 0.3 * t.m) cands.push(['anaMiddle', sd, { pct: Math.round(100 * (t.m - t.wide) / t.m) }])
        if (t.car >= 12 && t.gl >= 0.65 * t.car) cands.push(['anaCollide', sd, { pct: Math.round(100 * t.gl / t.car) }])
        else if (t.car >= 12 && t.gl <= 0.35 * t.car) cands.push(['anaStopped', sd, { pct: Math.round(100 * t.gl / t.car) }])
        if (t.tw >= 3) cands.push(['anaJackal', sd, { n: t.tw }])
        if (u.tw >= 3 && mg === sd) cands.push(['tipBreakdown', sd, {}])
        if (t.scrumBad >= 2) { cands.push(['anaScrumBad', sd, { n: t.scrumBad }]); if (mg === sd) cands.push(['tipScrum', sd, {}]) }
        if (t.pens >= 4 && t.pensRuck >= 3) { cands.push(['anaPensRuck', sd, { n: t.pensRuck, m: t.pens }]); if (mg === sd) cands.push(['tipPens', sd, {}]) }
        else if (t.pens >= 4 && t.pensOff >= 2) cands.push(['anaPensOffside', sd, { n: t.pensOff, m: t.pens }])
        if (t.live >= 240 && t.inOpp >= 0.65 * (t.live + u.live)) cands.push(['anaInTheirHalf', sd, { pct: Math.round(100 * t.inOpp / (t.live + u.live)) }])
      }
      // (a pointer first, then the rest in turn, two at most)
      cands.sort((a, b) => Number(b[0].startsWith('tip')) - Number(a[0].startsWith('tip')))
      const pick = cands.length ? [cands[anaN % cands.length], ...cands.filter((_, i) => i !== anaN % cands.length)] : []
      for (const [base, sd, ps] of pick.slice(0, 2)) say(base, 'minor', sd, ps)
      anaN++
    }

    /** the duel of opposite numbers (10 against 10, 9 against 9, 7 against 7): the pair with the clearest gap, by the record's counts */
    const duel = (ft: boolean) => {
      const by: Record<number, [string?, string?]> = {}
      for (const [id, m] of Object.entries(context.men ?? {})) if ([7, 9, 10].includes(m.shirt)) (by[m.shirt] ??= [])[m.side] = id
      const score = (id: string) => { const v = stat.get(id), d = today.get(id); return (d?.tries ?? 0) * 5 + (d?.breaks ?? 0) * 3 + (v?.to ?? 0) * 3 + (v?.car ?? 0) * 0.5 + (v?.tk ?? 0) * 0.3 }
      let best: { a: string; b: string; shirt: number; gap: number } | null = null
      for (const sh of [10, 9, 7]) {
        const [h, a] = by[sh] ?? []
        if (!h || !a || offIds.has(h) || offIds.has(a) || !nm(h) || !nm(a)) continue
        const gap = score(h) - score(a)
        if (Math.abs(gap) >= 4 && (!best || Math.abs(gap) > best.gap)) best = gap > 0 ? { a: h, b: a, shirt: sh, gap: Math.abs(gap) } : { a, b: h, shirt: sh, gap: Math.abs(gap) }
      }
      if (!best) return
      const sa = stat.get(best.a), sb = stat.get(best.b), da = today.get(best.a), db = today.get(best.b)
      const what: [string, number, number][] = [['Tries', da?.tries ?? 0, db?.tries ?? 0], ['Breaks', da?.breaks ?? 0, db?.breaks ?? 0], ['Turnovers', sa?.to ?? 0, sb?.to ?? 0], ['Carries', sa?.car ?? 0, sb?.car ?? 0], ['Tackles', sa?.tk ?? 0, sb?.tk ?? 0]]
      // (the stat with the biggest weighted gap, two or more apart: a try counts five carries, a tackle a little over half one)
      const W: Record<string, number> = { Tries: 5, Breaks: 3, Turnovers: 3, Carries: 1, Tackles: 0.6 }
      const top = what.filter(x => x[1] - x[2] >= 2).sort((x, y) => (y[1] - y[2]) * W[y[0]] - (x[1] - x[2]) * W[x[0]])[0]
      if (!top) return
      const [w, a, b] = top
      say(ft ? 'duelFull' : 'duelHalf', 'minor', context.men![best.a].side, { player: nm(best.a), oppPlayer: nm(best.b), shirt: best.shirt, a, b, what_k: `sim.duel${w}1` })
    }
    /** after the whistle: the table or the tie, the bonus points, the stat that tells the story, the manager's day, what is next */
    const postMatch = () => {
      const [hs, as] = p.score, c = context
      const trs: [number, number] = [0, 0]
      for (let i = 0; i <= n; i++) if (plays[i].kind === 'try' || plays[i].kind === 'penaltyTry') trs[plays[i].side]++
      const winS: 0 | 1 | null = hs > as ? 0 : as > hs ? 1 : null
      if (c.bonusPoints && c.standings && c.clubIds && c.table) {
        const add = (sd: 0 | 1) => { const us = p.score[sd], them = p.score[other(sd)]; return (us > them ? 4 : us === them ? 2 : 0) + (trs[sd] >= 4 ? 1 : 0) + (us < them && them - us <= 7 ? 1 : 0) }
        const rows = c.standings.map(r => ({ ...r }))
        for (const sd of [0, 1] as const) {
          const r = rows.find(x => x.id === c.clubIds![sd]); if (!r) continue
          r.pts += add(sd); r.p++; if (winS === sd) r.w++; r.pd += p.score[sd] - p.score[other(sd)]; r.tf += trs[sd]; r.pf += p.score[sd]
        }
        rows.sort((a, b) => b.pts - a.pts || b.w - a.w || b.pd - a.pd || b.tf - a.tf || b.pf - a.pf)
        const order = (result.managed != null ? [result.managed] : [0, 1]) as (0 | 1)[]
        for (const sd of order) {
          const now = rows.findIndex(r => r.id === c.clubIds![sd]) + 1, was = c.table[sd]
          const pos_k = ordKey(now)
          if (!pos_k || now <= 0) continue
          say(now < was ? 'postUp' : now > was ? 'postDown' : 'postStay', 'minor', sd, { pos_k, pts: rows[now - 1].pts })
          if (trs[sd] >= 4) say('postBonusTry', 'minor', sd)
          if (winS === other(sd) && p.score[other(sd)] - p.score[sd] <= 7) say('postBonusLose', 'minor', sd)
        }
      } else if (c.cup && c.stage && winS !== null) say(c.stage === 'F' ? 'postCupWon' : 'postCupThrough', 'normal', winS, { cup: c.cup, loser: T[other(winS)] })
      // the stat that tells the story: the winner's clearest edge
      if (winS !== null) {
        const a = tot[winS], b = tot[other(winS)]
        const edges: [string, number, number, number][] = [['Breaks', a.breaks, b.breaks, a.breaks - b.breaks], ['Turnovers', a.tw, b.tw, a.tw - b.tw], ['Pens', a.pens, b.pens, b.pens - a.pens]]
        const e = edges.filter(x => x[3] >= 3).sort((x, y) => y[3] - x[3])[0]
        if (e) say('postStat', 'minor', winS, { what_k: `sim.edge${e[0]}1`, a: e[1], b: e[2], loser: T[other(winS)] })
      }
      // the duels of the day (SimResult.duels): the busiest tackler on the field, the jackal, the man the referee kept seeing
      const du = (result as SimResult & { duels?: { jackal: { who: string; n: number }[]; tackler: { who: string; n: number }[]; culprit: { who: string; n: number }[] } }).duels
      if (du && NAMED_SUMMARY && NAMED_WHISTLE_MORE) {
        const top = (xs: { who: string; n: number }[]) => { const [a, b] = xs; return !a?.who ? b : !b?.who ? a : a.n === b.n ? undefined : a.n > b.n ? a : b }
        const tk = top(du.tackler), jk = top(du.jackal), cu = top(du.culprit)
        if (tk?.who && tk.n >= 12 && nm(tk.who)) say('postTackler', 'minor', sideOf.get(tk.who) ?? null, { player: nm(tk.who), n: tk.n })
        if (jk?.who && jk.n >= 2 && nm(jk.who)) say('postJackal', 'minor', sideOf.get(jk.who) ?? null, { player: nm(jk.who), n: jk.n })
        // (the man the referee kept seeing, named only when the record has him in a play: a tackle, a carry)
        const inPlays = (id: string) => plays.some(q => q.who === id || q.vs?.includes(id) || q.with?.includes(id))
        if (cu?.who && cu.n >= 3 && nm(cu.who) && inPlays(cu.who)) say('postCulprit', 'minor', sideOf.get(cu.who) ?? null, { player: nm(cu.who), n: cu.n })
      }
      // the manager's day, by what came of his own calls
      if (result.managed != null && mgrGood + mgrBad > 0) say(mgrBad === 0 ? 'postMgrGood' : mgrGood === 0 ? 'postMgrBad' : 'postMgrMixed', 'minor', result.managed, { good: mgrGood, bad: mgrBad })
      // what is next
      const sd = (result.managed ?? 0) as 0 | 1, nx = c.next?.[sd]
      if (nx) say('postNext', 'minor', sd, { opp: nx.opp, week: nx.week, where_k: nx.home ? 'sim.whereHome1' : 'sim.whereAway1' })
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

    // ---- the manager's decisions: a tactics change where it takes effect
    const dp = decOf(p)
    if (dp?.tactics) { const w = tacticsWords(dp.tactics); if (w) say('tacChange', 'normal', dp.tactics.side, { what_k: w }) }
    // the other coach reads the game (Play.coach): said so the manager can read it too
    const cch = (p as Play & { coach?: { side: 0 | 1; mode: string } }).coach
    if (cch && COACH_BASE[cch.mode]) say(COACH_BASE[cch.mode], 'normal', cch.side)

    switch (p.kind) {
      case 'kickoff': {
        if (prev?.kind === 'halfTime') halfStart = p.clock !== undefined ? 2400 : p.t - p.live - p.dead
        const base = !prev ? 'koStart' : prev.kind === 'halfTime' ? 'koSecond' : 'koAfterScore'
        // THE OCCASION, before a ball is kicked: a block of short lines while the teams run out (feed() puts them before the kick-off)
        if (!prev) { preBlock = true; preMatch(); preBlock = false }
        say(base, 'normal', s, { player: nm(p.who) })
        // the half-time talk, in one line as the second half starts (the pre-match one before the first)
        const tk = dp?.talk
        if (tk && (tk.pre ? !prev : prev?.kind === 'halfTime')) {
          say(tk.pre ? 'talkPre' : 'talkHt', 'normal', tk.side, { tone_k: `sim.tone${tk.tone.charAt(0).toUpperCase()}${tk.tone.slice(1)}1` })
          if (!tk.pre) talkWatch = { side: tk.side, at: [p.score[0], p.score[1]] }
        }
        say('tickFlight', 'minor', s, { zone_k: zoneKey(s, p.x) })
        const kopt = (p as Play & { option?: string }).option
        if (kopt === 'short') say('koShort', 'minor', s)
        else if (kopt === 'long') say('koLong', 'minor', s)
        // the wind, as each half starts (SimResult.conditions: the end it blows to in the first half)
        const wnd = (result as SimResult & { conditions?: { wind: { strength: number; toward: 0 | 1 } } }).conditions?.wind
        if (wnd && wnd.strength >= 0.5 && (!prev || prev.kind === 'halfTime')) {
          const behind: 0 | 1 = wnd.toward === 1 ? 0 : 1, now = prev ? other(behind) : behind
          say(prev ? 'windSecond' : 'windFirst', 'minor', now)
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
          // (a word for the run only when there is a run: ten metres or more)
          if (from - to < 10) return
          const k = Math.min(2, Math.max(1, Math.round((from - to) / 15)))
          say(base, 'minor', s, extra)
          if (k > 1) say('tickRunOn', 'minor', s, { player: extra.player })
        }
        // the defender he beat (a missed tackle), named once harmonycheck reads `beat`
        const beaten = () => { if (p.beat?.length) say('tickBeaten', 'minor', s, { player, oppPlayer: NAMED_BEAT ? nm(p.beat[0]) : undefined }) }
        if (p.result !== 'interception' && p.result !== 'interceptionHauled' && p.result !== 'clean') beaten()
        if (p.result === 'interception') { say('interceptRun', 'key', s, { player }); crossings(); runOn('tickRunOn', { player }) }
        else if (p.result === 'interceptionHauled') { crossings(); say('interceptHauled', 'key', s, { player, oppPlayer, zone_k: zoneKey(s, p.x) }) }
        else if (p.result === 'clean') { say('breakClean', 'key', s, { player, player2 }); beaten(); crossings(); runOn('tickRunOn', { player }) }
        else if (p.result === 'heldShort') { crossings(); say('tickChase', 'minor', s, { player, oppPlayer }); say('breakLastGasp', 'key', s, { player, oppPlayer, d: Math.max(1, Math.round(toLine(s, p.x))) }) }
        else {
          const d = toLine(s, p.x)
          if (d <= 5) say('breakLastGasp', 'key', s, { player, oppPlayer, d: Math.max(1, Math.round(d)) })
          else { crossings(); if (from - to >= 10) say('tickRunOn', 'minor', s, { player }); say('breakHauled', 'key', s, { player, player2, oppPlayer, m: Math.round(p.gain ?? 0) }) }
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
        // THE REFEREE (GAMEPLAY's RefereeView): the same offence again and again, and the captain warned
        const ref = (result as SimResult & { referee?: { name: string; hot?: string } }).referee
        if (p.cause) {
          const key = `${o}|${p.cause}`, c = (penCause.get(key) ?? 0) + 1
          penCause.set(key, c)
          if (c === 3) say(ref?.hot && HOT_OF[p.cause] === ref.hot ? 'refHotRepeat' : 'penRepeat', 'minor', o, { n: c, cause_k, ref: ref?.name })
        }
        if ((p as Play & { warning?: boolean }).warning) say(ref?.name ? 'refWarning' : 'refWarningAnon', 'normal', o, { ref: ref?.name })
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
        // a second yellow for the same man is a red (Law 9; Play.result 'secondYellow')
        const second = p.result === 'secondYellow'
        say(second ? 'flashRedSecond' : 'flashRed', 'key', s, { player: nm(p.who) })
        say(second ? 'redSecond' : 'red', 'normal', s, { player: nm(p.who), men: onField(s) })
        break
      }
      case 'injury': { say('injured', 'normal', s, { player: nm(p.who) }); if (p.who) offIds.add(p.who); break }
      case 'substitution': {
        const why_k = p.result !== 'made' && p.cause ? REFUSED_WHY[p.cause] : undefined
        say(p.result !== 'made' ? (why_k ? 'subRefusedWhy' : 'subRefused') : p.cause === 'injury' ? 'subInjury' : 'subMade', 'normal', s, { player: nm(p.who), player2: nm(p.with?.[0]), why_k })
        // the manager's own pick to cover an injury (the record marks it: callBy 'manager')
        if (p.result === 'made' && p.cause === 'injury' && (p as Play & { callBy?: string }).callBy === 'manager') say('subCover', 'minor', s, { player: nm(p.who), player2: nm(p.with?.[0]) })
        // the manager's own change (no cause: the game's bench writes 'tactical', a forced one 'injury'): why it reads sensible
        if (p.result === 'made' && !p.cause && p.who && p.with?.[0]) {
          const v = stat.get(p.who), started = !cameOn.has(p.who)
          if (bins.some(b => b.side === s)) say('subWhyBin', 'minor', s, { player: nm(p.who), player2: nm(p.with[0]) })
          else if (v && v.pens >= 2) say('subWhyPens', 'minor', s, { player: nm(p.who), count: v.pens })
          else if (v && started && clock >= 2700 && v.tk >= 1 && v.car >= 1 && v.tk + v.car >= 10) say('subWhyLegs', 'minor', s, { player: nm(p.who), tk: v.tk, car: v.car })
          else if (clock >= 3000) say('subWhyLate', 'minor', s, { player2: nm(p.with[0]), mins: Math.max(1, Math.round((4800 - clock) / 60)) })
          subWatch.push({ side: s, on: p.with[0], clock })
        }
        if (p.result === 'made' && p.with?.[0]) cameOn.add(p.with[0])
        if (p.result === 'made') { if (p.who) offIds.add(p.who); if (p.with?.[0]) watchFirst.set(p.with[0], { base: 'subFirst', side: s }) }
        break
      }
      case 'try': {
        const player = nm(p.who)
        const { base, d: tryD } = tryHow(plays, p)
        say('flashTry', 'key', s, { player })
        say(base, 'normal', s, { player, player2: nm(p.with?.[0]), d: tryD })
        say('scoreLine', 'normal', null, score)
        if (p.who) {
          const c = (tryCount.get(p.who) ?? 0) + 1
          tryCount.set(p.who, c)
          if (c >= 2 && player && nthKey(c)) say('tryAgain', 'minor', s, { player, nth_k: nthKey(c) })
        }
        tries[s]++
        if (context.bonusPoints && tries[s] === 4) say('bonusTry', 'minor', s)
        const tk = base === 'tryMaul' ? 'Maul' : base === 'tryWide' ? 'Wide' : base === 'tryBreak' ? 'Break' : base === 'tryClose' || base === 'tryPickGo' ? 'Close' : base === 'tryInterception' ? 'Interception' : ''
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
        // (the ground goes quiet for the kick, before it is struck)
        if ((context.attendance ?? 0) >= 5000 && context.venue) say('crowdHush', 'minor', s, { venue: context.venue })
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
        // the attacking scrum's option near the line (Play.option): the shove, the No. 8 pick, a back-row move
        const sopt = (p as Play & { option?: string }).option
        if (sopt === 'shove') say('scShove', 'minor', s)
        else if (sopt === 'eightPick') say('scEight', 'minor', s)
        else if (sopt === 'backRowMove') say('scBackRow', 'minor', s)
        if (p.result === 'pushover') say('scrumPushover', 'normal', s)
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
        // the call (Play.option): where the throw went
        const lopt = (p as Play & { option?: string }).option
        if (p.result === 'won' && lopt && ['front', 'middle', 'tail'].includes(lopt)) say(`loOpt${lopt.charAt(0).toUpperCase()}${lopt.slice(1)}`, 'minor', s)
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
        // what decided it: the score that put the winner ahead for good
        if (ft && p.score[0] !== p.score[1]) {
          const win: 0 | 1 = p.score[0] > p.score[1] ? 0 : 1
          let at = -1, prevAhead = false
          for (let i = 0; i <= n; i++) { const q = plays[i], ahead = q.score[win] > q.score[other(win)]; if (ahead && !prevAhead) at = i; prevAhead = ahead }
          const q = at >= 0 ? plays[at] : undefined
          if (q) {
            const first = !plays.slice(0, at).some(x => x.score[0] + x.score[1] > 0)
            const kick = q.kind === 'penaltyGoal' || q.kind === 'dropGoal' || q.kind === 'conversion'
            const min = Math.floor((q.clock ?? q.t) / 60) + 1, who = nm(q.who)
            if (first) say('decidedFront', 'normal', null, { winner: T[win], min })
            else if (who && NAMED_SUMMARY) say(kick ? 'decidedKick' : 'decidedTry', 'normal', win, { player: who, winner: T[win], min })
          }
        }
        // the story of the match so far: the ball and where it was played, and the man who stood out by the record's counts
        const ps = possession(plays, n), tot = ps[0] + ps[1]
        let inOpp: [number, number] = [0, 0], live = 0
        for (let i = 0; i <= n; i++) { const q = plays[i]; if (q.live <= 0) continue; live += q.live; if (q.x > 50) inOpp[0] += q.live; else if (q.x < 50) inOpp[1] += q.live }
        if (tot > 0 && live > 0) {
          const b: 0 | 1 = ps[0] >= ps[1] ? 0 : 1
          say('halfBall', 'minor', b, { pp: Math.round(100 * ps[b] / tot), tp: Math.round(100 * inOpp[b] / live) })
        }
        const motm = (result as SimResult & { motm?: string }).motm
        if (!NAMED_SUMMARY) { /* (no names at the whistle) */ }
        else if (ft && motm && nm(motm)) {
          say('motm', 'normal', sideOf.get(motm) ?? null, { player: nm(motm) })
          const v = stat.get(motm), d = today.get(motm)
          if (NAMED_WHISTLE_MORE && v && (v.car + v.tk >= 5 || (d?.tries ?? 0) > 0)) say('motmNums', 'minor', sideOf.get(motm) ?? null, { player: nm(motm), car: v.car, tk: v.tk, tries: d?.tries || undefined })
        }
        else {
          let best = '', bestV = 0
          for (const [id, v] of stat) { const tr = tryCount.get(id) ?? 0, val = tr * 12 + v.to * 5 + v.car + v.m / 8 + v.tk * 0.6; if (val > bestV && nm(id) && sideOf.has(id)) { bestV = val; best = id } }
          const v = best ? stat.get(best)! : undefined, tr = tryCount.get(best) ?? 0
          if (v && bestV >= 12) {
            const side = sideOf.get(best)!, player = nm(best)
            if (tr >= 2) say('standTries', 'minor', side, { player, count: tr })
            else if (v.to >= 2) say('standSteals', 'minor', side, { player, count: v.to })
            // (a standout only on numbers that stand out: ten tackles, or carries that made forty metres)
            else if (v.tk >= 10 && v.tk >= v.car * 1.5) say('standTackles', 'minor', side, { player, count: v.tk })
            else if (v.car >= 5 && v.m >= 40) say('standCarries', 'minor', side, { player, count: v.car, m: Math.round(v.m) })
          }
        }
        // the battle of the opposites, by shirt, with a verdict when one is clearly ahead
        if (NAMED_SUMMARY && NAMED_WHISTLE_MORE && context.men) duel(ft)
        // the debutant, at the break: how it is going, by the record's counts
        if (!ft && NAMED_SUMMARY && NAMED_WHISTLE_MORE) for (const nw of context.news ?? []) {
          if (nw.kind !== 'debut' || !nw.id || offIds.has(nw.id)) continue
          const v = stat.get(nw.id)
          if (v && v.car + v.tk >= 3 && nm(nw.id)) say('debutHalf', 'minor', nw.side, { player: nm(nw.id), car: v.car, tk: v.tk })
        }
        if (!ft) { analyse(n); anaAt = clock; win = [tally(), tally()] }
        if (ft) postMatch()
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
      // the manager's call, asked and answered (or his standing order), or the captain's when he made none
      const dc = decOf(before)?.callBy ? decOf(before)! : decOf(p)?.callBy ? decOf(p)! : null
      if (dc?.callBy) {
        const kickable = toLine(s, before.x) <= K.GOAL_RANGE
        if (dc.callBy === 'captain') say(`capCall${ch}`, 'normal', s, { m })
        else say(ch === 'Posts' ? 'mgrPosts' : kickable ? `mgrTurn${ch}` : `mgr${ch}`, 'normal', s, { m })
        callWatch = { side: s, ch, who_k: dc.callBy === 'captain' ? 'sim.whoCaptain1' : 'sim.whoBench1', n, clock, seen: false }
        if (ch === 'Posts') { say(p.good ? 'callPostsGood' : 'callPostsMiss', 'normal', s, { who_k: callWatch.who_k }); if (dc.callBy !== 'captain') { if (p.good) mgrGood++; else mgrBad++ } callWatch = null }
      } else if (m <= 45) {
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

    // ---- THE MATCH IN NUMBERS: each side's tally, over the match and since the co-commentator last spoke
    for (const T2 of [tot, win]) {
      const t = T2[s]
      if (p.kind === 'kick' && !['penaltyToTouch'].includes(p.result) && !p.kick?.startsWith('restart')) t.kicks++
      if (p.kind === 'carry' && ['gainLine', 'held', 'drivenBack', 'overTheLine'].includes(p.result)) {
        t.car++; if (p.result === 'gainLine' || p.result === 'overTheLine') t.gl++
        const g = Math.max(0, p.gain ?? 0); t.m += g; if (p.y < 20 || p.y > 50) t.wide += g
      }
      if (p.kind === 'lineBreak') { t.breaks++; const g = Math.max(0, p.gain ?? 0); t.m += g; if (p.y < 20 || p.y > 50) t.wide += g }
      if (p.kind === 'ruck' && p.result === 'turnover') T2[o].tw++
      if (p.kind === 'penalty') {
        const c = T2[o]; c.pens++
        if (prev?.kind === 'ruck') c.pensRuck++
        else if (prev?.kind === 'scrum') { c.pensScrum++; c.scrumBad++ }
        else if (p.cause && /offside/i.test(p.cause)) c.pensOff++
      }
      if (p.kind === 'scrum' && p.result === 'againstTheHead') t.scrumBad++
      if (p.kind === 'lineout' && p.result === 'stolen') t.loLost++
      if (p.live > 0) { const b = p.ball; T2[b].live += p.live; if ((b === 0 && p.x > 50) || (b === 1 && p.x < 50)) T2[b].inOpp += p.live }
    }
    // ---- the men today: tries, points, kicks at goal, breaks
    if (p.kind === 'try' && p.who) { const v = td(p.who); v.tries++; v.pts += 5 }
    if ((p.kind === 'conversion' || p.kind === 'penaltyGoal' || p.kind === 'dropGoal') && p.who) {
      const v = td(p.who)
      if (p.kind !== 'dropGoal') { v.kAtt++; if (p.good) v.kMade++ }
      if (p.good) v.pts += p.kind === 'conversion' ? 2 : 3
    }
    if (p.kind === 'lineBreak' && p.who) td(p.who).breaks++

    // ---- THE WIND where it bites (Play.wind, at half strength or more)
    const pw = (p as Play & { wind?: 'with' | 'into' }).wind
    if (pw) {
      if (p.kind === 'kick' && pw === 'with' && (p.gain ?? 0) >= 35) say('windKickWith', 'minor', s)
      else if (p.kind === 'kick' && pw === 'into' && (p.gain ?? 0) > 0 && (p.gain ?? 0) <= 25) say('windKickInto', 'minor', s)
      else if (p.kind === 'penaltyGoal' || p.kind === 'conversion') {
        const far = toPosts(s, p.x, p.y) >= 35
        if (p.good && pw === 'with' && far) say('windGoalWith', 'minor', s)
        else if (p.good && pw === 'into') say('windGoalInto', 'minor', s)
        else if (!p.good && pw === 'into') say('windGoalMiss', 'minor', s)
      }
    }

    // ---- PLAYER STORYLINES (overnight run): the scorer's season and career, the kicker's day against his season
    const man = p.who ? context.men?.[p.who] : undefined
    if (p.kind === 'try' && p.who && man && nm(p.who)) {
      const v = td(p.who), player = nm(p.who)
      const season = man.tries + v.tries, career = man.careerTries + v.tries
      if (career > 0 && career % 25 === 0) say('careerTry', 'minor', s, { player, n: career })
      else if (man.tries === 0 && v.tries === 1 && man.apps >= 5) say('droughtEnds', 'minor', s, { player, n: man.apps + 1 })
      else if (man.tries >= 4) say('seasonTries', 'minor', s, { player, n: season })
      if (oldBoys.has(p.who) && v.tries === 1) say('oldClubScores', 'minor', s, { player })
    }
    if (p.who && man && p.good && (p.kind === 'try' || p.kind === 'conversion' || p.kind === 'penaltyGoal' || p.kind === 'dropGoal')) {
      const v = td(p.who), before = man.careerPoints + v.pts - (p.kind === 'try' ? 5 : p.kind === 'conversion' ? 2 : 3), after = man.careerPoints + v.pts
      const mark = [500, 1000, 1500, 2000].find(x => before < x && after >= x)
      if (mark && nm(p.who)) say('careerPoints', 'minor', s, { player: nm(p.who), n: fmtN(mark) })
    }
    if (p.who && man && (p.kind === 'conversion' || p.kind === 'penaltyGoal')) {
      const v = td(p.who), key = `${p.who}|${inSecond ? 2 : 1}`
      if (v.kAtt >= 3 && !kickSaid.has(key) && (man.kickAtt ?? 0) >= 5 && nm(p.who)) {
        kickSaid.add(key)
        say('kickForm', 'minor', s, { player: nm(p.who), made: v.kMade, att: v.kAtt, pct: Math.round(100 * (man.kickMade ?? 0) / man.kickAtt!) })
      }
    }
    // ---- THE CROWD, on real events only, as big as the crowd that is there
    if (context.attendance) {
      // (a try that matters to the crowd: in a close game, or late)
      if (p.kind === 'try' && (Math.abs(p.score[0] - p.score[1]) <= 7 || clock >= 3600)) say(s === 0 ? (crowdBig ? 'crowdHomeRoar' : 'crowdHomeCheer') : 'crowdAway', 'minor', s)
      if (!sieged && p.kind === 'ruck' && p.result === 'recycled' && s === 0 && (p.phase ?? 0) >= 6 && toLine(0, p.x) <= 22 && clock >= 4200 && p.score[0] <= p.score[1] && p.score[1] - p.score[0] <= 7) {
        sieged = true; say('crowdSiege', 'minor', 0)
      }
    }

    // ---- THE CO-COMMENTATOR at natural breaks: after a score, at the stoppages near 20 and 60 minutes
    const scored = p.kind === 'conversion' || p.kind === 'penaltyGoal' || p.kind === 'dropGoal'
    const drinksNow = (p.kind === 'scrum' || p.kind === 'lineout' || p.kind === 'penalty') && ((drinks === 0 && clock >= 1200) || (drinks === 1 && clock >= 3600))
    if ((scored || drinksNow) && clock - anaAt >= 420) {
      if (drinksNow) drinks++
      analyse(n)
      anaAt = clock; win = [tally(), tally()]
    }

    // ---- did the manager's decision pay off? (within ten minutes of clock, said once, tied back to the call)
    if (callWatch && n > callWatch.n) {
      const w = callWatch, wp = { who_k: w.who_k }
      if (clock - w.clock > DECIDE) callWatch = null
      else if ((p.kind === 'try' || p.kind === 'penaltyTry') && p.side === w.side) { say('callPaysTry', 'normal', w.side, wp); if (w.who_k === 'sim.whoBench1') mgrGood++; callWatch = null }
      else if (w.ch === 'Corner' && p.kind === 'lineout' && !w.seen) { w.seen = true; if (p.result === 'stolen' || p.side !== w.side) { say('callCornerLost', 'normal', w.side, wp); if (w.who_k === 'sim.whoBench1') mgrBad++; callWatch = null } }
      else if (w.ch === 'Scrum' && p.kind === 'scrum' && !w.seen) { w.seen = true; if (p.result === 'againstTheHead') { say('callScrumLost', 'normal', w.side, wp); if (w.who_k === 'sim.whoBench1') mgrBad++; callWatch = null } }
      else if (p.ball !== w.side && p.kind !== 'penalty' && p.kind !== 'lineout' && p.kind !== 'scrum') callWatch = null
    }
    for (let k = subWatch.length - 1; k >= 0; k--) {
      const w = subWatch[k], mins = Math.max(1, Math.round((clock - w.clock) / 60)), player = nm(w.on)
      if (clock - w.clock > DECIDE) { subWatch.splice(k, 1); continue }
      let base = ''
      if ((p.kind === 'try') && p.who === w.on) base = 'subTry'
      else if (((p.kind === 'ruck' && p.result === 'turnover') || (p.kind === 'carry' && p.result === 'intercepted')) && p.vs?.[0] === w.on) base = 'subSteal'
      else if (p.kind === 'penalty' && p.offender === w.on) base = 'subPen'
      else if (p.kind === 'try' && p.side !== w.side) {
        // (his man scores: the carry or break that scored went past him)
        let q = n - 1
        while (q >= 0 && !['carry', 'lineBreak'].includes(plays[q].kind)) q--
        if (q === n - 1 && plays[q].side === p.side && plays[q].vs?.includes(w.on)) base = 'subMiss'
      }
      if (base && player) { say(base, 'normal', w.side, { player, mins }); if (base === 'subTry' || base === 'subSteal') mgrGood++; else mgrBad++; subWatch.splice(k, 1) }
    }
    // the half-time talk, if the start of the half shows it: seven points or more clear in its first ten minutes
    if (talkWatch && clock >= 3000) {
      const w = talkWatch, a = p.score[w.side] - w.at[w.side], b = p.score[other(w.side)] - w.at[other(w.side)]
      if (a >= 7 && a - b >= 7) { say('talkWorks', 'normal', w.side, { pts: a, opts: b }); mgrGood++ }
      talkWatch = null
    }
    if (p.who) sideOf.set(p.who, s)
    for (const id of p.vs ?? []) sideOf.set(id, o)

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
  SOURCE.set(out, { plays, T, nm })
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

const ONE: Record<string, string> = { tries: 'try', penalties: 'penalty', carries: 'carry', men: 'man', losses: 'loss' }

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
/** lines the manager must see whatever the speed: his calls, changes, talks and what came of them, and the
 *  half-time and full-time blocks (placed after the flashes, before every other line) */
const SHOWN = /^sim\.(mgr|capCall|call[A-Z]|tacChange|talk|sub(Why|Try|Steal|Pen|Miss|Cover|RefusedWhy|Refused)|decided|motm|stand[A-Z]|halfBall|halfTime|fullTime|tries\d|winBy|draw|redSecond|post[A-Z]|duel[A-Z]|coach[A-Z]|refWarning)/

/** seconds each line of the pre-match block is up, before the kick-off */
export const PRE_LINE = 1.8

/** a slot faster than this is fast forward (life speed on the pitch reads about 1.1 in its schedule) */
export const FAST = 1.5

export function feed(lines: Line[], slots: SlotLike[], opts: FeedOpts = {}): Shown[] {
  const maxPerSec = opts.maxPerSec ?? 3, clipGap = opts.clipGap ?? 0.6
  const ms = slots.some(x => x.start > 2000)
  const sl = slots.map(x => ({ n: x.n, start: ms ? x.start / 1000 : x.start, dur: (ms ? (x.dur ?? 0) / 1000 : x.dur ?? 0), speed: x.speed ?? 1 }))
  const byN = new Map<number, number>()
  sl.forEach((x, i) => byN.set(x.n, i))
  const slotAt = (t: number) => {
    let lo = 0, hi = sl.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (sl[mid].start <= t) lo = mid; else hi = mid - 1 }
    return lo
  }
  // (the speed of the slot showing at time t)
  const gapAt = (t: number) => ((sl[slotAt(t)]?.speed ?? 1) > FAST ? 1 / maxPerSec : clipGap)
  const src = SOURCE.get(lines)
  const words = new FeedWords(src)
  // the lines to place, in the record's order (`ord`); in fast forward a run of plain open play is one line
  type In = { l: Line; idx: number; ord: number }
  let input: In[] = lines.map((l, idx) => ({ l, idx, ord: idx }))
  // the pre-match block goes up before the first play, while the teams run out: 1.8 s a line
  const pre = input.filter(x => x.l.pre)
  input = input.filter(x => !x.l.pre)
  if (src) input = withRuns(input, src.plays, sl, byN, words)
  // each line's window, and the spot in it it would like (the lines of one play spread through its slot)
  const perPlay = new Map<number, number>()
  for (const x of input) perPlay.set(x.l.n, (perPlay.get(x.l.n) ?? 0) + 1)
  const seen = new Map<number, number>()
  const cand = input.map(({ l, idx, ord }) => {
    const i = byN.get(l.n)
    if (i === undefined) return null
    const a = sl[i], nx = sl[i + 1]
    // a run line: from its first play's start, up to the start of its last play
    // (or a little into the play after it, where the line before leaves no room sooner: it is then one play behind, no more)
    if (l.run) { const j = byN.get(l.run[1]) ?? i; return { l, idx, ord, lo: a.start, hi: Math.max(a.start + 0.05, sl[j].start + sl[j].dur + Math.min(sl[j + 1]?.dur ?? 0, 0.3)), want: a.start } }
    // (in fast forward, inside its own play; at life speed up to 0.8 s into the next: never more than a play behind the picture)
    // (the manager's decisions and the half-time and full-time blocks may run up to 0.8 s into the next play even in fast forward)
    // (the last play, full time, keeps the screen for its whole block: the result, the story, what is next)
    const lo = a.start, hi = a.speed > FAST && nx && !SHOWN.test(l.key) ? Math.max(a.start + a.dur, a.start + 0.05) : nx ? nx.start + Math.min(nx.dur, 0.8) : a.start + Math.max(a.dur, 4, 0.8 * (perPlay.get(l.n) ?? 0))
    const k = seen.get(l.n) ?? 0, m = perPlay.get(l.n)!
    seen.set(l.n, k + 1)
    const want = a.start + (a.dur * k) / m
    return { l, idx, ord, lo, hi, want }
  })
  // the lines placed so far, in time order
  type Flash = Line['flash']
  const placed: { t: number; flash: Flash; hold: number }[] = []
  const firstAt = (t: number) => { let lo = 0, hi = placed.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (placed[mid].t < t) lo = mid + 1; else hi = mid } return lo }
  /** the quiet a flash keeps after it: two seconds for a score or a card, one for a key moment's headline; and one before it */
  // (in fast forward a key moment's headline gets half a second, the run after it its own line)
  const quiet = (f: Flash, at: number) => (f === 'key' ? (gapAt(at) < clipGap ? 0.5 : 1) : 2)
  const free = (t: number, flash: Flash, hold: number) => {
    for (let i = firstAt(t - 4.01); i < placed.length && placed[i].t <= t + 4.01; i++) {
      const q = placed[i]
      // (a line just before a flash may be up for less: the flash takes over, and the play before it still gets its word)
      const g = q.flash && !flash && t < q.t ? Math.min(0.35, gapAt(q.t), gapAt(t)) : Math.min(gapAt(q.t), gapAt(t))
      if (Math.abs(q.t - t) < g - 1e-9) return false
      // a flash line keeps the screen for its hold before the next flash
      if (flash && q.flash && (t >= q.t ? t - q.t < q.hold : q.t - t < hold)) return false
      // and nothing new comes up just after a flash, so it can be read
      if (q.flash && t > q.t && t - q.t < quiet(q.flash, q.t)) return false
      if (flash && t < q.t && q.t - t < 1) return false
    }
    return true
  }
  const put = (t: number, flash: Flash, hold: number) => placed.splice(firstAt(t), 0, { t, flash, hold })
  // flashes first; then each play's best line (so every play gets a word when there is room); then the rest
  type C = NonNullable<typeof cand[number]>
  const best = new Map<number, number>()
  for (const c of cand) if (c) { const b = best.get(c.l.n); if (b === undefined || cand[b]!.l.priority < c.l.priority) best.set(c.l.n, cand.indexOf(c)) }
  // (flashes, then what the manager did and the story at the whistle, then each play's best line, then the rest)
  const tier = (c: C, k: number) => (c.l.flash ? 0 : SHOWN.test(c.l.key) ? 0.5 : best.get(c.l.n) === k ? 1 : 2)
  // (a run line, standing for several plays, is placed with the lines that must be shown)
  const rank = (c: C) => (c.l.run ? 3 : c.l.priority)
  const order = cand.map((c, k) => ({ c, k })).filter(x => x.c).sort((a, b) => tier(a.c!, a.k) - tier(b.c!, b.k) || rank(b.c!) - rank(a.c!) || a.c!.ord - b.c!.ord)
  let keep: { c: C; t: number }[] = []
  // (a play's lines after its flash in the record come after it on screen too: "TRY!" before how it was scored)
  const flashAt = new Map<number, { t: number; ord: number; q: number }>()
  for (const { c } of order) {
    if (!c) continue
    const fa = flashAt.get(c.l.n)
    if (!c.l.flash && fa && c.ord > fa.ord) { c.lo = Math.max(c.lo, fa.t + fa.q); c.want = Math.max(c.want, c.lo); if (c.lo > c.hi) continue }
    const h = c.l.hold
    let t: number | null = null
    const step = 0.05
    for (let d = 0; d <= c.hi - c.lo + step; d += step) {
      for (const x of [c.want + d, c.want - d]) if (x >= c.lo && x <= c.hi && free(x, c.l.flash, h)) { t = x; break }
      if (t !== null) break
    }
    if (t === null && c.l.flash) t = Math.max(c.lo, Math.min(c.hi, c.want))
    if (t === null) continue
    put(t, c.l.flash, h)
    keep.push({ c, t })
    if (c.l.flash && !flashAt.has(c.l.n)) flashAt.set(c.l.n, { t, ord: c.ord, q: quiet(c.l.flash, t) })
  }
  // the ticker lines in the order of the record, their times in order: both windows run in order, so each
  // line stays inside its own (a flash keeps the time it was given)
  const tick = keep.filter(k => !k.c.l.flash)
  const times = tick.map(k => k.t).sort((a, b) => a - b)
  tick.sort((a, b) => a.c.ord - b.c.ord).forEach((k, i) => { k.t = times[i] })
  keep.sort((a, b) => a.t - b.t || a.c.ord - b.c.ord)
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
  // at clip pace a line is not left up long: a short true word about what the pitch shows comes after two seconds
  if (src) keep = withFill(keep, src, sl, slotAt, words) as typeof keep
  const t0 = sl[0]?.start ?? 0
  const before = pre.map((x, i) => ({ c: { l: x.l, idx: x.idx, ord: x.ord, lo: 0, hi: 0, want: 0 }, t: t0 - PRE_LINE * (pre.length - i) }))
  keep = [...before, ...keep] as typeof keep
  // a line stays up until the next one comes: a ticker line for up to 3 s, a sentence up to 5 s, a flash up to 6 s
  return keep.map((k, i) => {
    const next = keep[i + 1]
    const hold = !next ? k.c.l.hold : Math.max(k.c.l.hold, Math.min(k.c.l.flash ? 6 : k.c.l.reg === 'tick' ? 3 : 5, next.t - k.t))
    return { line: k.c.l, at: k.t, hold, i: k.c.idx }
  })
}

type Slot2 = { n: number; start: number; dur: number; speed: number }

/** the words feed() writes itself (run lines, quiet-moment words): each wording used in turn, none twice in twelve */
class FeedWords {
  used = new Map<string, number>()
  recent: string[] = []
  lastBase = ''
  constructor(readonly src: { plays: Play[]; T: [string, string]; nm: (id: string | undefined) => string } | undefined) {}
  /** a man's name, without his shirt number (he has been named with it in the lines just before) */
  name(id: string | undefined) { return (this.src?.nm(id) ?? '').replace(/ \(\d+\)$/, '') }
  line(base: string, n: number, side: 0 | 1 | null, params: Record<string, string | number | undefined>, extra: Partial<Line> = {}): Line | null {
    const p: Record<string, string | number> = {}
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p[k] = v
    const list = SIM_EN[base]
    const ok = list.map((_, i) => i).filter(i => (list[i].match(/\{(\w+)\}/g) ?? []).every(x => p[x.slice(1, -1)] !== undefined))
    if (!ok.length) return null
    const sig = (i: number) => fill(list[i], p)
    const u = (i: number) => this.used.get(`${base}${i}`) ?? 0
    ok.sort((a, b) => u(a) - u(b) || mix(n * 131 + a * 7 + strHash(base)) - mix(n * 131 + b * 7 + strHash(base)))
    // (not said in its last six; failing that, not the one just said)
    const i = ok.find(x => !this.recent.slice(-6).includes(sig(x)) && sig(x).length <= 70) ?? ok.find(x => !this.recent.slice(-2).includes(sig(x)) && sig(x).length <= 70)
    if (i === undefined) return null
    this.used.set(`${base}${i}`, u(i) + 1)
    this.recent.push(sig(i)); if (this.recent.length > 6) this.recent.shift()
    this.lastBase = base
    const P = this.src!.plays
    return { n, t: P[n].clock ?? P[n].t, key: `sim.${base}${i + 1}`, params: p, level: 'minor', side, priority: 2, flash: null, hold: 1.2, reg: 'tick', ...extra }
  }
}

/** a scoring possession's first play (each play of a try build-up keeps its own line) */
function possessionStart(P: Play[], k: number): number {
  const s = P[k].side
  let j = k
  while (j > 0) {
    const q = P[j - 1]
    if (q.ball !== s || ['conversion', 'penaltyGoal', 'dropGoal', 'halfTime', 'try', 'penaltyTry'].includes(q.kind)) break
    j--
    if (['lineout', 'scrum', 'tap', 'catch'].includes(P[j].kind) || (P[j].kind === 'ruck' && P[j].result === 'turnover') || (P[j].kind === 'carry' && P[j].result === 'intercepted')) break
  }
  return j
}

/** a run of plain open play in fast forward, at least this long on screen, is said in one line */
const RUN_DUR = 0.9

/**
 * FAST FORWARD IN RUNS (coordinator, round 7): fast forward passes four to six plays a second, more than can
 * be read one by one. A stretch of plain open play (carries, rucks recycled, offloads, nothing that stops play,
 * scores or turns the ball over) is cut into runs of about a second on screen, and each run is said in one true
 * line about the run: the phases, the ground made, the line crossed, where it ended. The plays that matter
 * keep their own lines; so does every play of a try build-up.
 */
function withRuns<X extends { l: Line; idx: number; ord: number }>(input: X[], P: Play[], sl: Slot2[], byN: Map<number, number>, words: FeedWords): X[] {
  const build = new Set<number>()
  for (const p of P) if (p.kind === 'try') for (let k = possessionStart(P, p.n); k <= p.n; k++) build.add(k)
  const byPlay = new Map<number, X[]>()
  for (const x of input) { const a = byPlay.get(x.l.n); if (a) a.push(x); else byPlay.set(x.l.n, [x]) }
  const plain = (n: number) => {
    const p = P[n], i = byN.get(n)
    // (only where plays come faster than they can be read one by one: under 0.6 s on screen each)
    if (!p || i === undefined || sl[i].speed <= FAST || sl[i].dur >= 0.6 || build.has(n)) return false
    if (p.kind === 'ruck') { if (p.result !== 'recycled') return false }
    else if (p.kind === 'carry') { if (!['gainLine', 'held', 'drivenBack'].includes(p.result)) return false }
    else if (p.kind === 'catch') { if (p.result !== 'caught') return false }
    else if (p.kind !== 'offload') return false
    return !(byPlay.get(n) ?? []).some(x => x.l.flash || x.l.priority >= 3)
  }
  const runs: [number, number][] = []
  for (let i = 0; i < sl.length;) {
    const n0 = sl[i].n
    if (!plain(n0)) { i++; continue }
    // the stretch: consecutive plays, one side with the ball
    let j = i
    while (j + 1 < sl.length && sl[j + 1].n === sl[j].n + 1 && plain(sl[j + 1].n) && P[sl[j + 1].n].side === P[n0].side) j++
    let a = i, dur = 0
    const mine: [number, number][] = []
    for (let k = i; k <= j; k++) {
      dur += sl[k].dur
      if (dur >= RUN_DUR && k > a && k - a < 10) { mine.push([sl[a].n, sl[k].n]); a = k + 1; dur = 0 }
      else if (k - a >= 9) { mine.push([sl[a].n, sl[k].n]); a = k + 1; dur = 0 }
    }
    if (a <= j) {
      // (what is left: its own run when it is long enough to read, else the end of the run before)
      if (j > a && (dur >= RUN_DUR / 2 || !mine.length)) mine.push([sl[a].n, sl[j].n])
      else if (mine.length) mine[mine.length - 1][1] = sl[j].n
    }
    runs.push(...mine)
    i = j + 1
  }
  if (!runs.length) return input
  const drop = new Set<number>()
  const add: X[] = []
  for (const [a, b] of runs) {
    const l = runLine(P, a, b, words)
    if (!l) continue
    for (let n = a; n <= b; n++) drop.add(n)
    const at = input.findIndex(x => x.l.n >= a)
    const ord = at < 0 ? input.length + a : input[at].ord - 0.5
    add.push({ l, idx: -1, ord } as X)
  }
  return [...input.filter(x => !drop.has(x.l.n)), ...add].sort((x, y) => x.ord - y.ord)
}

/** the line for plays a..b, one side with the ball: what the record says the run did */
function runLine(P: Play[], a: number, b: number, words: FeedWords): Line | null {
  const T = words.src!.T
  const p0 = P[a], s = p0.side, pb = P[b], o: 0 | 1 = s === 0 ? 1 : 0
  const start = a > 0 ? P[a - 1] : p0
  const from = toLine(s, start.x), to = toLine(s, pb.x), m = Math.round(from - to)
  const rucks = P.slice(a, b + 1).filter(q => q.kind === 'ruck')
  const count = rucks.length
  const quick = count >= 2 && rucks.every(q => q.speed === 'quick')
  const wide = Math.abs(pb.y - start.y) >= 20 && (pb.y < 15 || pb.y > 55)
  const first = p0.kind === 'carry' ? words.name(p0.who) : ''
  const params = { team: T[s], opp: T[o], zone_k: zoneKey(s, pb.x), count: count >= 2 ? count : undefined, m: m >= 1 ? m : undefined, back: m <= -1 ? -m : undefined, player: first || undefined }
  const bases: string[] = []
  if (from > 22 && to <= 22) bases.push('runTwentyTwo')
  if (from > 50 && to <= 50) bases.push('runHalf')
  if (m >= 8) bases.push('runGain')
  if (m <= -4) bases.push('runBack')
  if (m <= 1 && m > -4 && count >= 2) bases.push('runNoGain')
  if (wide) bases.push('runWide')
  if (quick) bases.push('runQuick')
  if (first && count >= 2) bases.push('runStart')
  if (count >= 2) bases.push('runPhases')
  bases.push('runShort')
  // (the first that fits, unless the last run line was said the same way)
  const pick = bases.find(x => x !== words.lastBase) ?? bases[0]
  for (const base of [pick, ...bases.filter(x => x !== pick)]) {
    const l = words.line(base, a, s, params, { run: [a, b] })
    if (l) return l
  }
  return null
}

/**
 * QUIET MOMENTS (coordinator, round 7): at clip pace no line is left up much over two seconds while the
 * ball is in play. Where the next line is further off, a short true word about the play on screen goes up:
 * the ball at the back of the ruck, the defence setting, the jumpers getting ready, the count of phases,
 * the clock and the score in a tight finish. Never straight after a flash, never just before one.
 */
function withFill<K extends { c: { l: Line; idx: number; ord: number }; t: number }>(keep: K[], src: { plays: Play[]; T: [string, string] }, sl: Slot2[], slotAt: (t: number) => number, words: FeedWords): K[] {
  const P = src.plays
  const adds: K[] = []
  let lastClock = -Infinity, alt = 0
  for (let i = 0; i + 1 < keep.length; i++) {
    const x = keep[i], y = keep[i + 1]
    if (x.c.l.flash) continue
    const end = y.t - (y.c.l.flash === 'key' ? 0.6 : y.c.l.flash ? 1.05 : 0.4)
    let lastT = x.t, lastN = x.c.l.n
    while (y.t - lastT > 2.4) {
      // (two seconds on, or the moment the pitch comes back to clip pace with the ball in play, if later)
      // (sooner, from 1.2 s, where the next line is a flash that needs its moment)
      let t = Math.max(lastT + 1.2, Math.min(lastT + 2.0, end))
      while (t <= end) { const q = sl[slotAt(t)], k = P[q?.n]?.kind; if (q && ((P[q.n]?.live ?? 0) > 0 || k === 'conversion' || k === 'penaltyGoal')) break; t += 0.05 }
      if (t > end) break
      const s0 = sl[slotAt(t)]
      const n = s0.n, p = P[n]
      if (!p || n < lastN || n > y.c.l.n) break
      // (the kicker lines it up only before the kick: the next line is its flash)
      if ((p.kind === 'conversion' || p.kind === 'penaltyGoal') && !(y.c.l.n === n && y.c.l.flash)) break
      const l = fillLine(P, n, words, src.T, alt++, () => { if ((p.clock ?? p.t) - lastClock < 120) return false; lastClock = p.clock ?? p.t; return true })
      if (!l) break
      adds.push({ c: { l, idx: -1, ord: x.c.ord + 0.001 * (adds.length + 1) }, t } as K)
      lastT = t; lastN = n
    }
  }
  if (!adds.length) return keep
  return [...keep, ...adds].sort((a, b) => a.t - b.t || a.c.ord - b.c.ord)
}

function fillLine(P: Play[], n: number, words: FeedWords, T: [string, string], alt: number, clockOk: () => boolean): Line | null {
  const p = P[n], s = p.side, o: 0 | 1 = s === 0 ? 1 : 0
  const base = { team: T[s], opp: T[o], zone_k: zoneKey(s, p.x) }
  const clock = p.clock ?? p.t
  // a tight finish: the clock and the score (in the second half, ten minutes or less to go, a score or less in it)
  const gap = Math.abs(p.score[0] - p.score[1])
  if (clock >= 4200 && clock < 4800 && gap <= 7 && clockOk()) {
    const l = words.line('fillClock', n, null, { home: T[0], away: T[1], hs: p.score[0], as: p.score[1], left: Math.max(1, Math.round((4800 - clock) / 60)), gap: gap || undefined })
    if (l) return l
  }
  const tries: string[] = []
  if (p.kind === 'ruck' && p.result === 'recycled') { if ((p.phase ?? 0) >= 3) tries.push('fillPhase'); tries.push('fillRuck', 'fillDefence') }
  else if ((p.kind === 'carry' && ['gainLine', 'held', 'drivenBack'].includes(p.result)) || p.kind === 'offload') tries.push('fillCarry')
  else if (p.kind === 'carry' && p.result === 'overTheLine') tries.push('fillOver')
  else if ((p.kind === 'carry' && p.result === 'knockedOn') || p.kind === 'knockOn') tries.push('fillLoose')
  else if (p.kind === 'lineBreak') tries.push('fillBreak')
  else if (p.kind === 'kick' && p.result === 'inPlay') tries.push('fillKick')
  else if (p.kind === 'lineout') tries.push('fillLineout')
  else if (p.kind === 'scrum') tries.push('fillScrum')
  else if (p.kind === 'maul') tries.push('fillMaul')
  else if (p.kind === 'conversion' || p.kind === 'penaltyGoal') tries.push('fillGoal')
  if (!tries.length) return null
  const order = [...tries.slice(alt % tries.length), ...tries.slice(0, alt % tries.length)]
  for (const b of order) {
    const l = words.line(b, n, s, { ...base, phase: (p.phase ?? 0) >= 3 ? p.phase : undefined, player: words.name(p.who), oppPlayer: words.name(p.vs?.[0]) }, { priority: -2 })
    if (l) return l
  }
  return null
}

/** a line in English (the name the pitch uses) */
export const text = (line: Line): string => render(line)

/** a line in English */
export function render(line: Line): string {
  // (English: one of a thing, not "1 metres")
  const w0 = fill(EN_FLAT[line.key] ?? line.key, line.params)
  const whole = line.after && CRY.test(w0) ? w0.replace(CRY, m => (m.startsWith('.') ? '.' : '')).replace(/^./, c => c.toUpperCase()) : w0
  const halves = line.part ? halvesOf(whole) : null
  const s = (halves ? halves[line.part! - 1] : whole).replace(/\b1 (metres|minutes|points|tackles|visits|times|lineouts|turnovers|phases|tries|penalties|carries|men|calls|decisions|kicks|breaks|wins|defeats|losses|offences|put-ins|rounds|weeks)\b/g,
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
