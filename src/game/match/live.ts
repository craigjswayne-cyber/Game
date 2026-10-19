// The live match context and the event and clock helpers every phase uses.
// Split out of matchEngine.ts, which re-exports the public parts.
import type { Fixture, GameState, MatchEvent, Tactic, Weather } from '../model'
import type { TalkRead } from '../teamtalk'
import { tIn } from '../i18n'
import type { Rng } from '../rng'
import type { Launch } from '../moves'
import type { Rematch } from '../rematch'
import { LEVER_DIALS, type CausalEvidence } from '../evidence'
import type { Surface } from '../conditions'
import type { EvCause, SideCtx } from './side'

/** Live match context. The match is simulated tick by tick (4 minutes per
 *  tick, 20 ticks) so tactics changes and substitutions genuinely change
 *  what happens next, at any point in the game. */
export interface LiveCtx {
  fx: Fixture
  /** the salt of the styles' turnover hash (styleSalt), set on first use */
  stySalt?: number
  /** how far the manager's opponent is set for each of his calls (1.8.2,
   *  armsrace.ts), taken at kick-off; absent in a match he is not in */
  callAdapt?: Record<string, number>
  /** what the manager's opponent remembers of the last meeting (1.8.4,
   *  rematch.ts), taken at kick-off with the tape; absent otherwise */
  rematch?: Rematch
  home: SideCtx
  away: SideCtx
  rng: Rng
  /** THE COMMENTARY'S OWN DICE (1.8.0). Anything drawn only because somebody
   *  is watching (which atmosphere line, whether a missed kick gets a line)
   *  draws from here, never from rng. The match is ONE engine whether it is
   *  watched or not, as Football Manager's is: the detail level decides what
   *  is written down, never what happens. Drawing commentary from rng made
   *  every watched match a different match from the same fixture played
   *  silently (scripts/detailprobe.ts: 0 of 120 alike before this). */
  crng: Rng
  /** THE LAST TWELVE LINES SAID (1.9.0): said() and the try line keep out of
   *  them, so a bank of ten does not repeat itself inside a quarter. Words
   *  only, never read by the simulation. */
  recent?: string[]
  /** EVERY KICK AT GOAL, in the order of the commentary (1.8.0): [the index
   *  of the line it belongs to, 0 home / 1 away, 1 made / 0 missed]. The
   *  engine runs a tick ahead of the ticker, so the live stats count only
   *  the kicks whose line has been shown; reading the side's totals put a
   *  kick on the screen before the ticker had taken it. */
  kickLog?: [number, 0 | 1, 0 | 1][]
  /** the seed of the kicks-from-hand dice (kicksFromHand), drawn once from
   *  rng at kick-off so every match has its own */
  kickSeed?: number
  /** the partnerships this match has already been counted into (state.chem,
   *  at kick-off). A rebuild of the units reads them one game short, so it
   *  sees the familiarity the kick-off units were built from and does not
   *  hand a side a chemistry step for having made a substitution. */
  chemToday?: Set<string>
  detail: boolean
  weather: Weather
  /** the pitch it is played on (conditions.ts): absent on a match begun by
   *  an older build, read as hybrid */
  surface?: Surface
  derby: boolean
  goalPenalty: number
  hfa: number
  events: MatchEvent[]
  lastMin: number
  isUser: boolean
  /** the team the user is coaching in this match (club or national side) */
  userSideId: string | null
  /** THE ASSISTANT HAS THE BENCH (1.8.0): set by the instant result, where the
   *  manager has handed the match over. The user's side then makes its
   *  replacements the way every AI side does (aiAutoSubs), instead of none -
   *  measured before this: 0.8 replacements a match, all of them injuries,
   *  against the opposition's 6.5, so tired starters played the full eighty
   *  and the bench split and the replacement briefs did nothing. */
  assistantSubs?: boolean
  /** next tick to simulate, 0..20 */
  tick: number
  /** 0 = pre-KO, 1 = HT reached, 2 = 60' break reached, 3 = full-time */
  seg: 0 | 1 | 2 | 3
  /** set at HT / 60' until the user resumes play */
  awaiting: 'HT' | 'BRK' | null
  /** A whistle the clock has reached but which has NOT been blown, because a
   *  kickable penalty awarded before it is still in the manager's hands
   *  (owner, twice: "half time whistle went, but i was still able to kick a
   *  goal"). Nothing is narrated, the interval does not open and the match is
   *  not finalised until the call is answered - see stepTick and
   *  resolveDecision. */
  heldWhistle?: 'HT' | 'FT' | null
  /**
   * ---- WHERE THE GAME IS BEING PLAYED, 0 TO 100 (owner, v1.8.0) ----
   *
   * 0 is the home try line, 100 is the away one, 50 is halfway. Until now
   * this engine had no field position at all: a scoring chance came purely
   * from the ratio of the two sides' unit strengths, and `terr` tilted that
   * ratio by the kicking game without ever saying WHERE anybody was.
   *
   * That was a defensible abstraction and it cost two things. A manager's
   * boot bought him an invisible edge rather than a visible position, and
   * there was nothing for a zonal tactic to refer to - "in your own 22" has
   * no meaning in an engine with no 22.
   *
   * So the boot now moves a line, and the line decides whose afternoon it is.
   */
  field: number
  motmId: number | null
  talkUsed: boolean
  subsUsed: number
  /** The last tactical substitution, kept only until play resumes, so a wrong
   *  tap can be taken back at the same stoppage it was made (16B, user: "i
   *  made a substitution but selected the wrong player, i couldnt undo it").
   *  Records whether that change spent a brief or blew the cover charge, so
   *  the undo can give back exactly what the change took. */
  lastSub?: { outId: number; inId: number; blewCover: boolean; briefed: boolean } | null
  /** THE MANAGER CHOOSES WHO COVERS AN INJURY (1.9.1): set at kick-off of a
   *  match he is watching. Absent on a match begun by an older build, which
   *  replays the way it was played, with the assistant's pick. */
  manualInj?: boolean
  /** His men who are down and waiting for him to send somebody on, oldest
   *  first: which side, who, the index of the injury's line and its minute.
   *  The match does not go on until coverInjury has answered each one; a
   *  caller that steps on regardless gets the assistant's pick (stepTick). */
  injWait?: { home: boolean; hurtId: number; at: number; min: number }[]
  preTalk: string | null
  /** how each man took the pre-match and the half-time talk (teamtalk.ts),
   *  for the screens: absent until a talk is given */
  preReads?: TalkRead[]
  htReads?: TalkRead[]
  htTone?: string
  /** a touchline call waiting on the user (kickable penalty etc) */
  decision: { kind: 'penalty'; min: number; fld?: number } | null
  /** Index of the whistle line for the period that has just ended, while a
   *  touchline call awarded BEFORE it is still unanswered. The kick belongs
   *  in front of that line, not behind it - see resolveDecision. Null
   *  whenever the clock is running. */
  whistleAt?: number | null
  /** the referee has ordered uncontested scrums: at kick-off for a lineup
   *  that cannot cover the front row, or mid-match when the last trained
   *  loosehead, hooker or tighthead goes off. Read before ordering them twice. */
  uncontested?: boolean
  /** a penalty just kicked to touch: whose throw the lineout is (commentary) */
  touchThrow?: { teamId: string; min: number } | null
  /** the levelling factors a sin-bin ordered, kept so the scrum can be
   *  contested again when the binned front-rower returns. Absent for a
   *  shortage that cannot mend itself (kick-off, injury, red card). */
  uncontestedUndo?: { home: number; away: number } | null
  /** momentum, -1 (away camped in our half) .. +1 (home dominant) */
  momo: number
  /** live bad blood between the clubs (reason string) - derby-lite heat */
  grudge?: string | null
  /** per-tick home possession share, for the last-10-minutes graphic */
  momoHist?: number[]
  /** THE CALLED MOVE THAT MADE THIS TRY (1.8.1, moves.ts), set by simTick
   *  just before scoreTry and cleared straight after: scoreTry names the move
   *  in the try line instead of the pool's line, after the pool's draw has
   *  been taken, so the dice are the same either way. */
  moveTry?: { id: string; launch: Launch; maker: number | null } | null
  /** WHAT THE POINTS ABOUT TO GO ON THE BOARD ARE PUT DOWN TO (1.8.3,
   *  EvCount.pts): set just before a scoring call and cleared after it, as
   *  moveTry is. Read only by the counters. */
  evWhy?: EvCause | null
  /** the margin (home minus away) at the end of each tick, for the lead
   *  changes the evidence keeps (evidence.ts) */
  marginHist?: number[]
  /** THE HALF-TIME READ, KEPT (1.8.4, evidence.ts halfFollow): the evidence
   *  as it stood at the break, and the manager's four touchline dials there
   *  and as the second half kicked off, so full time can say whether what
   *  was hurting eased and whether he moved the dial that answers it. Read
   *  at the whistle, never drawn; a resumed match replays to the same. */
  htEv?: CausalEvidence
  htDials?: number[]
  shDials?: number[]
  /** the same four dials as the ball was first kicked (1.8.5), so full time
   *  can tell a plan carried into the match and changed at the break from
   *  one dropped before it (matchfindings planCarried) */
  koDials?: number[]
  /** a hot afternoon (1.8.16): legs go sooner and the referee calls water
   *  breaks at the quarters. Set at kick-off from the conditions, no draw. */
  hot?: boolean
}

/** The manager's four touchline dials, in LEVER_DIALS order: his club's
 *  match only (a Test side has no club board). */
export function userDials(state: GameState, ctx: LiveCtx): number[] | undefined {
  if (!ctx.userSideId || ctx.userSideId !== state.userClubId) return undefined
  const tac = state.clubs[ctx.userSideId]?.tactic
  return tac ? LEVER_DIALS.map(k => tac[k]) : undefined
}

/**
 * THE KICK YOU SEE IS THE KICK YOU ASKED FOR (1.7.3). When the commentary's
 * pick lands on one of this side's own kicks, it is shown as the side's style
 * of kick: a touch-finder for territory, a high ball won for the contest, a
 * grubber or a cross-kick for attack. It re-labels the draw already made and
 * never makes one, so no match changes by a single point.
 */
const OWN_KICKS = new Set(['comm.flav7', 'comm.flav10', 'comm.flav17'])
export function styledKick(key: string, style: Tactic['kickStyle']): string {
  if (!style || style === 'balanced' || !OWN_KICKS.has(key)) return key
  if (style === 'territory') return 'comm.flav7'
  if (style === 'contest') return 'comm.flav20'
  return key === 'comm.flav17' ? key : 'comm.flav10'
}

/**
 * WHAT A LINE DEPICTS, where a line depicts something the pitch can draw.
 *
 * The mock-up used to work this out by running regular expressions over the
 * commentary itself. That tied a picture to a wording in one language, and it
 * was wrong even in that one: comm.doesPace has an opposition coach promising
 * to "slow every scrum reset", which drew a scrum, and comm.benchFiveThree,
 * comm.doesMiddle and comm.patternWidth all contain the word "wide", which
 * rolled the kick-miss camera over a tactical note.
 *
 * Only lines that SHOW the thing are listed. A coach talking about scrums is
 * not a scrum.
 */
export const DEPICTS: Record<string, NonNullable<MatchEvent['fx']>> = {
  'comm.flav4': 'SCRUM',            // monster scrum, penalty advantage
  'comm.flav12': 'SCRUM',           // choke tackle, scrum to the other side
  'comm.flav21': 'SCRUM',           // the scrum inches forward
  'comm.flavWet1': 'SCRUM',         // trudging to another scrum in the rain
  'comm.maulHeldUp': 'MAUL',        // driven over and held up (1.9.1: the drop-out, not a scrum)
  'comm.uncontested': 'SCRUM',      // the referee orders uncontested scrums
  'comm.uncontestedNow': 'SCRUM',   // the last trained front-rower goes off
  'comm.uncontestedShort': 'SCRUM', // Law 3.20: a second man leaves with him
  'comm.uncontestedNoRep': 'SCRUM', // Law 3: the injured front-rower cannot be replaced
  'comm.uncontestedBin': 'SCRUM',   // Law 3: a second man sits the ten minutes out with him
  'comm.contestedAgain': 'SCRUM',   // the binned front-rower returns
  'comm.frontRowReturns': 'SCRUM',  // Law 3.35: a replaced front-rower comes back
  'comm.frontRowBinCover': 'SCRUM', // Law 3: the bench front-rower on for a binned one
  'comm.frontRowRedCover': 'SCRUM', // Law 3: the bench front-rower on for a sent-off one
  'comm.flav9': 'LINEOUT',          // steals the lineout against the throw
  'comm.flav13': 'LINEOUT',         // a 50:22 and the lineout that follows
  'comm.flav18': 'LINEOUT',         // a quick lineout taken
  'comm.flavDerby5': 'LINEOUT',     // words exchanged at the lineout
  'comm.flav6': 'MAUL',             // rolling maul eats twenty metres
  'comm.flavGrass1': 'MAUL',        // the back of a collapsing maul
  'comm.maulToCorner': 'MAUL',      // the maul assembles five metres out
  'comm.maulRepelledPenalty': 'MAUL',
  'comm.tryMaulRumbles': 'MAUL',    // and the ones that end in a try
  'comm.try4': 'MAUL',
  'comm.tryWet5': 'MAUL',
  'comm.penWide': 'MISS',           // the kick that misses
  'comm.penWideNamed': 'MISS',
  'comm.conWide': 'MISS',
  'comm.dropMiss1': 'MISS',         // and the drop goal that misses
  'comm.dropMiss2': 'MISS',
  'comm.dropMiss3': 'MISS',
  'comm.dropMiss4': 'MISS',
  'comm.dropMiss5': 'MISS',
  'comm.dropMiss6': 'MISS',         // off the upright (1.8.16)
  'comm.penPost1': 'MISS',
  'comm.penPost2': 'MISS',
  'comm.conPost': 'MISS',
  'comm.fk_lineoutNumbers': 'LINEOUT',
  'comm.notStraight1': 'LINEOUT',
  'comm.notStraight2': 'LINEOUT',
  'comm.notStraightCold': 'LINEOUT',
  'comm.fk_scrumEarly': 'SCRUM',
  'comm.fk_scrumFeed': 'SCRUM',
  'comm.fifty22_1': 'LINEOUT',
  'comm.fifty22_2': 'LINEOUT',
  'comm.fifty22_3': 'LINEOUT',
  'comm.tmoFoul_high': 'TMO',
  'comm.tmoFoul_secondary': 'TMO',
  'comm.tmoFoul_neckRoll': 'TMO',
  'comm.tmoFoul_cleanout': 'TMO',
  'comm.tmoFoul_ballOnGround': 'TMO',
  'comm.reverse_screen': 'TMO',
  'comm.tmoReview5': 'TMO',
  'comm.tmoReview6': 'TMO',
  'comm.tmoReview7': 'TMO',
  'comm.tmoNoTry5': 'NOTRY',
  'comm.tmoNoTry6': 'NOTRY',
  'comm.tmoNoTry7': 'NOTRY',
  'comm.lineout3': 'LINEOUT',       // the jumper lifted, the throw taken
  'comm.lineout7': 'LINEOUT',
  'comm.scrum2': 'SCRUM',           // the scrum that goes forward
  'comm.scrum6': 'SCRUM',
  'comm.tmoReview1': 'TMO',         // the referee goes upstairs (scoreTry)
  'comm.tmoReview2': 'TMO',
  'comm.tmoReview3': 'TMO',
  'comm.tmoReview4': 'TMO',
  'comm.tmoNoTry1': 'NOTRY',        // and the TMO says no
  'comm.tmoNoTry2': 'NOTRY',
  'comm.tmoNoTry3': 'NOTRY',
  'comm.tmoNoTry4': 'NOTRY',
  'comm.tmoReviewFwd1': 'TMO',      // a forward pass in the build-up (scoreTry)
  'comm.tmoReviewFwd2': 'TMO',
  'comm.tmoNoTryFwd1': 'NOTRY',
  'comm.tmoNoTryFwd2': 'NOTRY',
  'comm.tmoFwdScrum1': 'SCRUM',     // and the scrum the defenders get for it
  'comm.tmoFwdScrum2': 'SCRUM',
}

/**
 * A commentary line, filed as a key and its values.
 *
 * This is the one to use. pushEvent below takes finished English and is what
 * every line used to be; scripts/commprobe.ts counts what is left of it and
 * the count may only fall, because a line called as English is English in a
 * French match for ever, including in saves written before the fix.
 *
 * The English is still computed and still stored, because the engine reads its
 * own commentary back - see MatchEvent.text. It is stored, not shown.
 */
/**
 * TEN MINUTES FROM THE CARD YOU SAW. pushEvent never lets the clock run
 * backwards, so a card shown on a tick whose earlier lines were stamped a
 * minute on (a conversion is `min + 1`) reads a minute later than the tick it
 * happened on - and the ten minutes were counted from the tick. The man came
 * back after ten real minutes and nine on the screen, and scored at 71' off a
 * card shown at 62' (auditprobe, seed 999, surfaced when the TMO moved the
 * stream). Counted from the minute the card is shown, the bin is ten minutes
 * on the ticker, which is the only clock anyone watching has. No draw.
 */
export function binUntil(ctx: LiveCtx, min: number): number {
  // the clock runs watched or not (clockTo), so the bin reads it either way
  return Math.max(min, ctx.lastMin) + 10
}

export function pushLine(
  state: GameState, ctx: LiveCtx, min: number, type: MatchEvent['type'], side: SideCtx | null,
  k: string, v?: Record<string, string | number>, playerId?: number,
) {
  // silent, the line is not written, but its minute still moves the clock,
  // so a silent match keeps the same time as a watched one
  if (!ctx.detail) { clockTo(ctx, min, type); return }
  pushEvent(state, ctx, min, type, side, tIn('en', k, v), playerId, k, v, DEPICTS[k])
}

function pushEvent(
  state: GameState, ctx: LiveCtx, min: number, type: MatchEvent['type'], side: SideCtx | null,
  text: string, playerId?: number, k?: string, v?: Record<string, string | number>,
  fx?: MatchEvent['fx'],
) {
  min = clockTo(ctx, min, type)
  // only the writing down is for the watcher
  if (!ctx.detail) return
  ctx.events.push({
    min, type, teamId: side?.teamId ?? '', fld: Math.round(ctx.field ?? 50),
    playerId, playerName: playerId != null ? state.players[playerId]?.name : undefined,
    text, k, v, fx, homeScore: ctx.home.score, awayScore: ctx.away.score,
  })
}

/** A minute that passed with nothing said: a words-only line that the
 *  watched match may or may not write still moves the clock, in both, so
 *  the two read the same minute (evidenceprobe, 1.9.2: a missed penalty
 *  said in the 79th minute left the silent replay at 78). */
export function clockOnly(ctx: LiveCtx, min: number): void { clockTo(ctx, min, 'SUB') }

/** THE CLOCK RUNS WATCHED OR NOT (1.8.0): a line's minute moves the match
 *  clock in a silent match too, so a sin bin and the match sheet read the
 *  same minute either way. Returns the minute the line is stamped with. */
function clockTo(ctx: LiveCtx, min: number, type: MatchEvent['type']): number {
  if (type !== 'HT' && type !== 'FT') {
    // NOTHING HAPPENS AFTER THE WHISTLE (owner: "ive noticed a few times a
    // penalty kick comes after the half-time whistle has blown... this should
    // never happen should be everything within the time").
    //
    // Measured before the fix: 52 first-half lines in 360 matches were stamped
    // 41', and the clock ran backwards 53 times. Two causes, one shape. A tick
    // is four minutes and draws its minute as `tick * 4 + rng(0..3) + 1`, so
    // the last tick of a half can land exactly on the whistle - and the lines
    // that FOLLOW a score (the conversion, the celebration, the maul held up)
    // are deliberately stamped `min + 1` so they read a beat later than the
    // try. On the last tick of a half that beat is past the whistle: 41' in a
    // half that ends at 40, 81' in a match that ends at 80.
    //
    // The half's own end is the ceiling. Clamping here rather than at each of
    // the forty call sites is the point - a new line cannot reintroduce it.
    const whistle = ctx.seg === 0 ? 40 : 80
    min = Math.min(Math.max(min, ctx.lastMin), whistle)
    ctx.lastMin = min
  }
  return min
}
