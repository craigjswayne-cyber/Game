import type { Pos } from '../data/types'
import { mulberry32 } from './rng'
import { t, tIn } from './i18n'

export type { Pos }

// ---- Attributes (classic 1-20 management-sim scale) ----
export interface Attrs {
  tac: number // tackling
  str: number // strength
  scr: number // scrummaging
  lin: number // lineout
  ruc: number // rucking / breakdown
  han: number // handling
  pas: number // passing
  kic: number // kicking from hand
  goa: number // goal kicking
  pac: number // pace
  sta: number // stamina
  agi: number // agility
  vis: number // vision / creativity
  dec: number // decisions
  pos: number // positioning
  agg: number // aggression
  lea: number // leadership
  wor: number // work rate
}

export const ATTR_KEYS = [
  'tac', 'str', 'scr', 'lin', 'ruc', 'han', 'pas', 'kic', 'goa',
  'pac', 'sta', 'agi', 'vis', 'dec', 'pos', 'agg', 'lea', 'wor',
] as const

export const ATTR_NAMES: Record<keyof Attrs, string> = {
  tac: 'Tackling', str: 'Strength', scr: 'Scrummaging', lin: 'Lineout',
  ruc: 'Rucking', han: 'Handling', pas: 'Passing', kic: 'Kicking',
  goa: 'Goal Kicking', pac: 'Pace', sta: 'Stamina', agi: 'Agility',
  vis: 'Vision', dec: 'Decisions', pos: 'Positioning', agg: 'Aggression',
  lea: 'Leadership', wor: 'Work Rate',
}

export interface SeasonStats {
  apps: number
  starts: number
  tries: number
  points: number
  cons: number
  pens: number
  drops: number
  yc: number
  rc: number
  ratingSum: number // sum of match ratings (avg = ratingSum/apps)
  motm: number
  /** cumulative minutes this season - the load that wears bodies out */
  mins: number
  /**
   * THE AWARD WINDOW ONLY: ratings and appearances since the last monthly award,
   * zeroed the moment one is handed out (season.ts, at AWARD_EVERY).
   *
   * Player of the Month used to be decided on `form`, which is a rolling average
   * carrying weight from long before the window - a man who was superb in
   * September and merely decent in October could still outrank the man who was
   * actually best in October. These two numbers are what the month is worth, and
   * nothing else. They live in stats so the season rollover clears them for free.
   */
  mSum: number
  mApps: number
}

export const emptyStats = (): SeasonStats => ({
  apps: 0, starts: 0, tries: 0, points: 0, cons: 0, pens: 0, drops: 0,
  yc: 0, rc: 0, ratingSum: 0, motm: 0, mins: 0, mSum: 0, mApps: 0,
})

/** 1,300+ minutes (~17 full games) is the red zone: tired bodies break. */
export const inRedZone = (p: { stats: { mins: number } }) => p.stats.mins >= 1300

/** Partnership chemistry: lineup slot pairs whose familiarity matters -
 *  LH-HK, HK-TH, the lock pairing, the halfbacks, the centres. */
export const CHEM_SLOTS: [number, number][] = [[0, 1], [1, 2], [3, 4], [8, 9], [11, 12]]
export const chemKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)
export const chemTier = (g: number) =>
  t(g >= 50 ? 'common.chemTelepathic' : g >= 25 ? 'common.chemEstablished'
    : g >= 10 ? 'common.chemSettled' : g >= 5 ? 'common.chemSettlingIn' : 'common.chemBrandNew')

/** Appearances this player made for a club he has since left - 0 if he is
 *  still there. Fuels the old-boy storyline when the fixture list brings
 *  him back to a former home. */
export function oldBoyApps(p: Player, clubId: string): number {
  if (p.clubId === clubId) return 0
  let apps = p.exClub === clubId ? (p.exApps ?? 0) : 0
  for (const r of p.career) if (r.clubId === clubId) apps += r.apps
  return apps
}

/** Consecutive competitive games without defeat this season, newest backwards.
 *  A loss ends it; a draw extends it; friendlies are wind, not weather - they
 *  neither extend nor break the run. Feeds The Scalp (16C): a long unbeaten
 *  season paints a target on the shirt. */
export function unbeatenRun(state: GameState, clubId: string): number {
  let run = 0
  const mine = state.fixtures
    .filter(f => f.played && f.compId !== 'fr' && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => a.week - b.week)
  for (let i = mine.length - 1; i >= 0; i--) {
    const f = mine[i]
    const us = f.homeId === clubId ? f.homeScore : f.awayScore
    const them = f.homeId === clubId ? f.awayScore : f.homeScore
    if (us < them) break
    run++
  }
  return run
}

/** The Home hub's form pips: the last n played fixtures in WEEK order, oldest
 *  first. Reported live with two screenshots: the fixture list showed a loss
 *  away at Sale inside the last five, the hub said W W W W W. The hub was
 *  slicing the last five played fixtures in ARRAY order, and the fixtures
 *  array is not week order: cup rounds and arranged friendlies are appended
 *  to the end as they are drawn, so once a knockout round is played the slice
 *  reads the array tail and a by-date result falls out. The dash panel one
 *  card below learned this exact lesson (see its comment); the pips never
 *  got the sort. */
export function formGuide(state: GameState, clubId: string, n = 5): ('W' | 'L' | 'D')[] {
  return state.fixtures
    .filter(f => f.played && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => a.week - b.week)
    .slice(-n)
    .map(f => {
      const us = f.homeId === clubId ? f.homeScore : f.awayScore
      const them = f.homeId === clubId ? f.awayScore : f.homeScore
      return us > them ? 'W' : us < them ? 'L' : 'D'
    })
}

/** The grounds big enough to host a European final: every one of them 60,000
 *  seats or more, and every one of them has actually staged top-flight rugby.
 *  Both European finals share the venue on the same weekend, as in life. */
export const EURO_FINAL_VENUES: FinalVenue[] = [
  { name: 'Greater Twickenham', city: 'London', capacity: 82000 },
  { name: 'Grand Stade de Paris', city: 'Paris', capacity: 80698 },
  { name: 'Cardiff National Stadium', city: 'Cardiff', capacity: 74500 },
  { name: 'Marseille Stadium', city: 'Marseille', capacity: 67394 },
  { name: 'Edinburgh Stadium', city: 'Edinburgh', capacity: 67144 },
  { name: 'Crocker Park', city: 'Dublin', capacity: 82300 },
  { name: 'English Football Stadium', city: 'London', capacity: 90000 },
]

/** Where a competition's final is played, or null for finals that stay at the
 *  higher seed's ground (UPC, Championship, the southern leagues - which is
 *  how those competitions actually do it).
 *
 *  The Premier Division final is ALWAYS Twickenham and the Elite 14 final is always
 *  the Stade de France. The European finals rotate: a deterministic pick from
 *  the save's seed and the season, so the announcement, the fixture and any
 *  reload all agree without storing anything - and never the same city two
 *  seasons running. NO shared rng is drawn: venue choice must not move a
 *  match stream. */
export function finalVenue(state: GameState, compId: string): FinalVenue | null {
  if (compId === 'prem') return EURO_FINAL_VENUES[0]
  if (compId === 'top14') return EURO_FINAL_VENUES[1]
  if (compId !== 'cc' && compId !== 'chc') return null
  const idx = (season: number) =>
    Math.floor(mulberry32(Math.abs(state.seed) * 7919 + season * 104729)() * EURO_FINAL_VENUES.length)
  let i = idx(state.season)
  if (state.season > 0 && i === idx(state.season - 1)) i = (i + 1) % EURO_FINAL_VENUES.length
  return EURO_FINAL_VENUES[i]
}

/** Signature traits and what they do, for player pages and scouting. */
export const TRAIT_INFO: Record<string, string> = {
  'The Step': 'Feet like a dancer - defenders grasp at air. Scores more tries.',
  'Offload King': 'Keeps the ball alive through contact. Sharpens the whole attack.',
  'Siege Gun': 'A boot from another postcode - dangerous from anywhere kickable.',
  'Metronome': 'Never misses the ones he should make. Raises the kicking floor.',
  'Jackal': 'First over every tackle. More breakdown menace.',
  'Enforcer': 'Brings the dark arts - muscle at scrum and ruck, and refs know his name.',
  'Big-Game Player': 'Grows three inches in knockouts and derbies.',
  'Hot Head': 'One flashpoint from a card, every single week.',
}

/** One-page season review captured at rollover, shown early next season. */
export interface SeasonReview {
  season: number
  clubName: string
  league: { name: string; pos: number; predicted?: number; w: number; d: number; l: number }
  overall: { w: number; d: number; l: number; m: number; bestWin?: string }
  cups: { comp: string; result: string }[]
  topPoints?: { name: string; val: number }
  topTries?: { name: string; val: number }
  bestAvg?: { name: string; val: number }
  tryOfSeason?: { name: string; min: number; opp: string }
  balanceDelta: number
  confidence: number
  trophies: string[]
  /** where the career's Dream stood when this season closed. Optional: seasons
   *  reviewed before dreams existed have none, and a save may have no dream. */
  dream?: {
    /** English, as it was written; the keys below are what a screen renders. */
    title: string
    titleK?: string
    titleV?: Record<string, string | number>
    note: string
    noteK?: string
    noteV?: Record<string, string | number>
    at: number
    goal: number
    done: boolean
    moved: number | null
  }
}

/** Live grudge between two clubs, if any. */
export const grudgeBetween = (state: GameState, x: string, y: string) =>
  state.grudges?.find(g => ((g.a === x && g.b === y) || (g.a === y && g.b === x)) && g.until >= state.season) ?? null

/** Why two clubs are not speaking, in the reader's language - or in the English
 *  it was recorded in, on a save written before grudges carried a key. */
export const grudgeReason = (g: { reason: string; rk?: string; rv?: Record<string, string | number> }): string =>
  (g.rk ? t(g.rk, g.rv) : g.reason)

/** Record (or refresh) bad blood between two clubs; news if the user is in it.
 *
 *  The reason arrives as a key and its values rather than as a sentence,
 *  because it is quoted in three places a reader sees - the club's rifts card,
 *  the fixture line on the home screen, and the kick-off commentary - and a
 *  sentence recorded in English is English in all three, for the two seasons
 *  the grudge lasts. */
export function addGrudge(state: GameState, a: string, b: string, rk: string, rv?: Record<string, string | number>, seasons = 2) {
  if (!state.clubs[a] || !state.clubs[b] || a === b) return
  const reason = tIn('en', rk, rv)
  state.grudges ??= []
  const ex = state.grudges.find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a))
  if (ex) { ex.reason = reason; ex.rk = rk; ex.rv = rv; ex.until = Math.max(ex.until, state.season + seasons); return }
  state.grudges.push({ a, b, reason, rk, rv, until: state.season + seasons })
  if (a === state.userClubId || b === state.userClubId) {
    const opp = a === state.userClubId ? b : a
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `🔥 Bad blood with ${state.clubs[opp].short}`,
      body: `There is genuine needle between the clubs now - ${reason}. The next meeting will be spicy: expect cards, a hostile crowd and a match where the form book means nothing.`,
      k: 'news.badBlood', v: { short: state.clubs[opp].short, reason_k: rk, ...(rv ?? {}) },
    })
  }
}

export interface Injury {
  /** The complaint as it was recorded, in English, always - and not display
   *  text. It is quoted in five places a reader sees, and injuryDesc() prefers
   *  `dk` when the save has one. Kept because a save written before injuries
   *  carried a key still has to name the injury. */
  desc: string
  /** The complaint's key. See injuryDesc(). */
  dk?: string
  /** week the player returns */
  until: number
  /** total weeks out (severity), used to size the rusty spell afterwards */
  weeks?: number
  /**
   * The manager has been to the Medical Centre since this happened.
   *
   * User: "red dot notification for injury should clear once ive clicked it and
   * viewed the page. it shouldn't stay there." The rail badge counted injured
   * players, which makes it a STATUS rather than a NOTIFICATION: a ten-week
   * ligament means a red dot for ten weeks and nothing the manager does clears
   * it, so the dot stops meaning anything and he stops looking.
   *
   * The flag lives on the injury rather than on the player, which is what makes
   * it honest without any bookkeeping: a fresh injury is a fresh object, so it
   * arrives unseen even for a man who has been hurt twice this season, and
   * nothing has to remember to reset it. Absent means unseen, which is the safe
   * default for every save written before this existed.
   */
  seen?: boolean
}

export type Personality =
  | 'Professional' | 'Loyal' | 'Ambitious' | 'Mercenary' | 'Temperamental' | 'Leader'

export type Weather = 'Dry' | 'Rain' | 'Wind' | 'Snow'

export interface Player {
  id: number
  name: string
  pos: Pos
  alt: Pos[]
  age: number
  nat: string
  clubId: string | null // null = free agent
  a: Attrs
  ca: number // current ability 1-100
  pa: number // potential ability 1-100 (hidden)
  q0: number // original data quality (for reference)
  intl: boolean
  gk: boolean
  // dynamic state
  form: number      // 1-10 rolling
  morale: number    // 1-10
  cond: number      // 0-100 fitness/condition
  sharp: number     // 0-100 match sharpness
  injury: Injury | null
  bans: number      // matches suspended
  natSquad: boolean // currently called up
  // contract
  wage: number      // weekly £
  contractEnds: number // season index when contract expires (end of)
  value: number
  // career
  stats: SeasonStats
  career: { season: number; clubId: string; apps: number; tries: number; points: number }[]
  transferListed: boolean
  youth?: boolean
  /** character type - drives contracts, morale and media reactions */
  pers: Personality
  /** What he has been told about his place in the squad (F18). Unset falls back
   *  to his standing in the squad, so old saves need no migration. */
  status?: 'key' | 'rotation' | 'squad' | 'prospect' | 'fringe'
  /** signature trait - a defining edge (or flaw) in his game */
  trait?: string | null
  /** estimated career before the game world began (2025-26) */
  hist?: { apps: number; tries: number; points: number }
  /** Test caps, pre-2025 estimate plus every international played here */
  caps?: number
  /** Northern Lions tours made - the honour of a career */
  lions?: number
  /** World Championships won while in the squad - the other honour of a career */
  wcWins?: number
  /** pre-2025 former club (same league), for old-boy stories from day one */
  exClub?: string | null
  /** appearances made at that former club before 2025 */
  exApps?: number
  /** the user's scouting knowledge of this player, 0-100 */
  sc: number
  /** away on a season loan */
  onLoan?: boolean
  /** where a loaned-out man is spending the season - a real lower-tier club,
   *  picked at loan time, so the postcards can say where he is (round 25) */
  loanClub?: string
  /** absolute week (season * SEASON_WEEKS + week) the loan began, so a recall
   *  can price itself on the rugby he actually played rather than the button */
  loanSince?: number
  /** ability at the start of the season, for development arrows */
  ca0?: number
  /** starts made LAST season, stashed before the summer stats wipe so the
   *  development roll can ask how much rugby the year actually held (25D:
   *  a 20-year-old parked on the bench stops growing) */
  lastStarts?: number
  /** weeks of match rust remaining after an injury - playable, but a
   *  rushed return carries a much higher re-injury risk */
  rust?: number
  /** last match rating and the week it was earned - fuels Team of the Week */
  lastR?: number
  lastWk?: number
  talkWk?: number // absolute week (season*100+week) of the manager's last word with him
  /** week his agent demanded improved terms (0/undefined = content) */
  wantsDeal?: number
  /** week a formal transfer request landed (17A): the game-time ledger's
   *  escalation when a key or rotation man is badly short-changed. 0 or
   *  absent means no request. Cleared when the team sheets make it right,
   *  and moot when he is sold. */
  wantsOut?: number
  /** absolute week (season * SEASON_WEEKS + week) of the manager's last
   *  office chat with him (20D) - one conversation per man per week, or
   *  praise stops meaning anything */
  lastChatWk?: number
  /** the current injury has already had its specialist consult */
  specialist?: boolean
  /** waiting on his first competitive appearance - 'signing' for a new
   *  arrival, 'academy' for a graduate's first senior rugby ever.
   *  Cleared the moment it comes, memorable or not */
  debutPending?: 'signing' | 'academy' | null
  /** has announced this is his final season: retires at the rollover.
   *  Set at the midwinter announcement for every player aged 37+ */
  retiring?: boolean
  /** playing his farewell season: testimonial granted, retires in summer */
  farewell?: boolean
  /** World Player of the Year awards won */
  poty?: number
  /** in the academy squad - hidden from first-team auto-selection until promoted */
  acad?: boolean
  /** came through THIS club's academy and was promoted to the seniors. Set once
   *  at promotion and never cleared, because it is a fact about where he learned
   *  the game, not about where he plays now (dream.ts reads it). */
  homegrown?: boolean
  /** club matches this season this man was actually AVAILABLE for - not away
   *  with his country, suspended, injured, on loan, or unsigned. Tracked
   *  forward by settleGameTime; the game-time ledger bills the manager a
   *  share of THIS, never of the whole season (user: "i shouldn't be
   *  punished if he is unavailable"). Reset with the season's stats. */
  avail?: number
  /** absolute week (season * SEASON_WEEKS + week) this man joined his current
   *  club, stamped by the transfer executor. The buy-back gate reads it: a
   *  club that just paid a fee rarely sells (user: "i shouldn't really be
   *  able to buy them back within 6 months"). Absent on moves from before
   *  the stamp existed. */
  joinedAt?: number
  /** parent club when this player is on loan AT the user's club */
  loanFrom?: string | null
  /**
   * Written by hand in the squad data, rather than produced by the name
   * generator. Set once at world creation and never changed.
   *
   * The audit used to work this out by matching names against the data files,
   * which is wrong in both directions: the generator retries a colliding name
   * only ten times and then uses it anyway, so a made-up player could be
   * counted as real, and the count wobbled at clubs nobody had touched. Two
   * rounds of squad-accuracy work were measured against that.
   */
  real?: boolean
}

export interface Club {
  id: string
  name: string
  short: string
  city: string
  country: string
  stadium: string
  /** the ground's traditional name, kept the first time naming rights change
   *  the gates so successive sponsors replace each other rather than stack
   *  ("Franklin's Gardens", under whatever is currently bolted above it) */
  stadiumBase?: string
  capacity: number
  /** the real, opening capacity of the ground - the anchor for demandCeiling,
   *  so a ground that has been extended cannot justify extending again */
  capacity0?: number
  colors: [string, string]
  rep: number
  /** Which of the fictional bosses is in charge (game/boss.ts). Absent means the
   *  first one: identity is a pure function of the club id and this number, so
   *  every save ever written already has a named manager at every club. */
  bossSalt?: number
  leagueId: string
  budget: number
  balance: number
  players: number[] // player ids
  // user/AI tactics
  tactic: Tactic
  // finance
  wageBudget: number
  boardConfidence: number // 0-100
  /** consecutive summers finishing over the salary cap (F6) */
  capBreaches?: number
  /** season index up to and including which no signings are allowed (F6) */
  capEmbargoUntil?: number
  /** club captain - a real leader on the pitch steadies the whole side */
  captain?: number | null
  /** vice-captain: leads at reduced effect when the skipper is missing */
  vice?: number | null
  /** The leadership group (F11): who has taken responsibility for what. One
   *  portfolio each, and a portfolio concentrates the skipper's influence on
   *  that area rather than adding to it. */
  leaders?: { pack?: number | null; defence?: number | null; attack?: number | null; culture?: number | null }
  /** the record book: 100+ app servants, written in at retirement */
  legends?: { name: string; apps: number; tries: number; pts: number }[]
  /** marquee designations - their wages sit outside the cap (max 2) */
  marquee?: number[]
  /** In administration: the season the points penalty applies to, and how many
   *  points it is. Cleared once that season has been played (insolvency.ts). */
  admin?: { season: number; penalty: number }
  /** the AI head coach's name (yours shows the manager name) */
  coach?: string
  /** the head coach's standing instruction (F23) - an id from philosophy.ts.
   *  Absent on the club you manage: your dials are yours. */
  philosophy?: string
  /** how many head coaches this club has been through, so the next man's ideas
   *  are drawn afresh rather than inherited */
  coachGen?: number
  /** set-piece routines: how well drilled, and how well known */
  playbook?: Playbook
  /** bricks and mortar: levels 0-5 per facility, set from the club's standing */
  facilities?: Partial<Record<FacilityId, number>>
}

export interface Tactic {
  style: number      // 0 forwards-oriented .. 100 expansive
  tempo: number      // 0 slow .. 100 fast
  kicking: number    // 0 keep in hand .. 100 kick heavy
  aggression: number // 0 clean .. 100 physical

  // ---- the without-ball system (18D, FM26's split shapes) ------------------
  /** defensive line speed: 0 passive drift .. 100 all-out blitz. Absent or 50
   *  is exactly the old engine - the dial only exists once you move it. */
  defLine?: number
  /** defensive width: 0 narrow around the ruck .. 100 spread to the touchlines.
   *  A matchup dial: spreading blunts an expansive attack and narrowness
   *  blunts a forward assault - set it wrong and it pays the other way. */
  defWidth?: number
  lineup: (number | null)[] // 23 slots: player ids, index 0-14 XV, 15-22 bench
  /** positional role per XV slot (role ids from roles.ts), sparse */
  roles?: (string | null)[]

  // ---- the kicking game (F3) ----------------------------------------------
  /** Designated goal kickers, in order. The engine used to hand the tee to
   *  whoever had the best goal-kicking attribute on the pitch, which is not a
   *  decision and means a slump is never yours to answer. Empty falls back to
   *  that automatic pick. */
  kickers?: (number | null)[]
  /** How you get out of your own 22. */
  exit?: 'box' | 'long' | 'counter' | 'fifty22'
  /** Standing instruction on a kickable penalty. 'ask' keeps the touchline
   *  prompt; anything else answers it for you, which matters on a phone. */
  penaltyCall?: 'ask' | 'posts' | 'corner' | 'tap'

  // ---- the set-piece playbook (F2) ----------------------------------------
  /** the lineout and scrum routines you are drilling and calling */
  lineoutCall?: string
  scrumCall?: string

  // ---- the bench economy (F4) ---------------------------------------------
  /** How the eight replacements are split between forwards and backs. Unset
   *  lets the club's tactical conviction decide, which is how AI sides end up
   *  with benches that match how they play. */
  bench?: '5-3' | '6-2' | '4-4'
  /** What each replacement is told as he pulls his shirt on, by bench seat
   *  (0-7, aligned to the current split's seats). Sparse. */
  briefs?: (string | null)[]

  /**
   * The manager picked this sheet himself.
   *
   * Reported from live play: "I'm not sure if you make changes to the match day
   * 23 it's actually putting those players on the pitch", and "there's players I
   * can sub in and out that weren't selected". Both were lineupFor's stale-sheet
   * tidy-up: it fired whenever any of the fifteen was not a natural for his shirt
   * and a better natural existed anywhere in the squad, and it did not fix that
   * shirt - it replaced the whole twenty-three with the automatic pick and wrote
   * that over the manager's sheet.
   *
   * With this flag set, the engine leaves the sheet alone. A side the game chose
   * it may choose again; a side the manager chose is his. Playing a man out of
   * position is a tactic, and the answer to a specialist left out is to say so on
   * the Selection screen, not to overrule the team sheet on the way to the pitch.
   */
  userPicked?: boolean
}

/** How well drilled each routine is, and how often the opposition have seen it.
 *  Lives on the club rather than the tactic because it is the product of months
 *  of training, not a thing you flip on a Friday. */
export interface Playbook {
  /** routine id -> 0-100 drilled quality */
  drilled: Record<string, number>
  /** routine id -> times called this season, which is how analysts learn you */
  used: Record<string, number>
}

export type CompType = 'league' | 'cup' | 'intl'

export interface Fixture {
  id: number
  compId: string
  round: number // round index within comp
  week: number
  homeId: string // club id or nation code (intl)
  awayId: string
  played: boolean
  homeScore: number
  awayScore: number
  homeTries: number
  awayTries: number
  events?: MatchEvent[] // only kept for user matches
  att?: number
  stage?: string // 'QF' | 'SF' | 'F' | 'BAR' etc for knockouts
  tableApplied?: boolean
  motm?: number
  weather?: Weather
  derby?: boolean
  /** this friendly is a testimonial for the named player - his day */
  testimonial?: number
  /** a showpiece final is played at a neutral ground, not the higher seed's
   *  place: set at creation by finalVenue(), it overrides the stadium line,
   *  the gate and home advantage */
  venue?: FinalVenue
}

/** A neutral showpiece ground for a final. */
export interface FinalVenue { name: string; city: string; capacity: number }

export interface TableRow {
  teamId: string
  p: number; w: number; d: number; l: number
  pf: number; pa: number
  tf: number; ta: number // tries for/against
  bp: number // bonus points
  pts: number
}

export interface Competition {
  id: string
  name: string
  short: string
  type: CompType
  teamIds: string[]
  table: TableRow[]
  rounds: number
  playoffTeams: number // 0 = none
  weeksByRound: number[] // week for each round
  koWeeks: number[]      // weeks for knockout stages after pools/regular season
  champion?: string
  isNational?: boolean
  pools?: string[][]
  /** tournament seedings in order (1st seed first), fixed at the draw */
  seeds?: string[]
}

export type TrainingFocus = 'balanced' | 'scrum' | 'lineout' | 'attack' | 'defence' | 'fitness' | 'kicking'

/** Where the manager came from (18B, from the FM26 assessment: the story
 *  begins before the first whistle). Each origin front-loads a different
 *  advantage; none of them survives a bad season.
 *    player - a former international: the room believes from day one and the
 *      name opens doors, but the badges are not there yet
 *    coach  - the coaching route (the default, and what every save made
 *      before origins existed is migrated to): the department runs one extra
 *      personal training plan
 *    local  - the local hero at the FIRST club: the board and the terraces
 *      start warm; walk somewhere else and the warmth stays behind */
export type MgrOrigin = 'player' | 'coach' | 'local'

export interface MatchEvent {
  min: number
  type: 'TRY' | 'CON' | 'PEN' | 'DG' | 'YC' | 'RC' | 'INJ' | 'SUB' | 'HT' | 'FT' | 'KO' | 'BRK'
  teamId: string
  playerId?: number
  playerName?: string
  /** The line as it was CALLED, in English, always - and not display text.
   *
   *  Same rule as NewsItem.body, and for the same reason: the engine reads its
   *  own commentary back. The pitch mock-up decides whether to draw a scrum, a
   *  lineout or a maul by looking at the last line's wording, and a save keeps
   *  its events for as long as the career lasts. Translating this in place
   *  would break the reader on a save written by an older build, which is the
   *  one failure a player can neither see coming nor undo.
   *
   *  So the line travels twice: this English, for the engine, and `k` plus `v`
   *  for the reader. Screens render eventText(), never this. */
  text: string
  /** The commentary key, and the values that go in its holes. Absent on events
   *  from a save written before the commentary was keyed, which is exactly why
   *  eventText() falls back to `text` rather than to the key's name. */
  k?: string
  v?: Record<string, string | number>
  /** WHAT THE LINE DEPICTS, for the pitch mock-up to draw.
   *
   *  The mock-up used to decide this by running regular expressions over the
   *  commentary - /scrum/i, /maul/i, /\bwide\b/ - which worked only in English
   *  and was wrong even there: a coach saying he will "slow every scrum reset"
   *  drew a scrum, and a bench note about "the wide channels" rolled the
   *  kick-miss camera. This says it instead of inferring it.
   *
   *  Absent on saves written before this, which is why MatchDay still falls
   *  back to the old patterns when it is missing. */
  fx?: 'SCRUM' | 'LINEOUT' | 'MAUL' | 'MISS'
  homeScore: number
  awayScore: number
}

/** A commentary line in the reader's language, or the English it was called in
 *  if this event predates the key. */
export const eventText = (e: MatchEvent): string => (e.k ? t(e.k, e.v) : e.text)

export interface NewsItem {
  id: number
  week: number
  season: number
  type: 'result' | 'transfer' | 'injury' | 'intl' | 'board' | 'award' | 'contract' | 'general' | 'youth' | 'gossip'
  /** The story as it was FILED, in English, always.
   *
   *  These two are not display strings and must not be translated in place. The
   *  engine reads its own post back and matches on this prose - season.ts pulls a
   *  fee out of a transfer body with a regular expression, the call-up story is
   *  found by its exact subject and appended to, media and insolvency look for
   *  phrases - so a French save would quietly stop doing those things. They are
   *  also what every save written before this field existed contains.
   *
   *  What the READER sees is `k`/`v` below, when the story has them. */
  subject: string
  body: string
  /** The same story as a translation key, so the inbox follows the reader.
   *
   *  Storing prose froze a career into whatever language it was begun in: switch
   *  to French and the news stayed English forever, which is not "paperwork keeps
   *  its language" but "half the game is untranslated" (owner, 24 Aug, looking at
   *  a French inbox full of English). A key plus its variables is the same story
   *  in any language, rendered at the moment it is read.
   *
   *  `k` is the body's key; the subject's is `k + 'Subj'` by convention. Absent on
   *  stories filed before this existed, and on the handful the engine assembles
   *  from other stories - newsBody() falls back to the English for those. */
  k?: string
  v?: Record<string, string | number>
  read: boolean
  /** optional linked entity */
  playerId?: number
  /** multi-name stories: every listed player is tappable in the feed */
  playerIds?: number[]
  fixtureId?: number
  /** Filed away by the manager. The story stays in state - the Wire, the season
   *  review and the history all read this list - it simply stops appearing in the
   *  inbox reader. */
  cleared?: boolean
  /** The absolute day (days.absDay) the manager actually read it. The recall
   *  window counts from HERE, not from when the story was written: an old
   *  unread story used to expire the instant the queue marked it read, so the
   *  mail icon served it straight into the void. Absent on stories read before
   *  this field existed - inInbox falls back to the written day for those. */
  readAt?: number
  /** Everything the scouting department writes home - postcards, briefs,
   *  the final report, the recruitment meeting - carries this tag so the
   *  Transfer Centre can gather it into one Scout Reports pile (user: "where
   *  do those reports go? They should appear in news and a section called
   *  scout reports"). */
  tag?: 'scout'
  /** The league position a board memo quoted, stamped at write time. The table
   *  a later reader derives is not the table the memo read (a new season's
   *  table is empty, a settling week has moved on), so the claim the probe
   *  holds the memo to is recorded next to the prose it appears in. */
  quotedPos?: number
}

export interface PressOption {
  label: string
  /** morale delta applied to the player concerned */
  morale: number
  /** board confidence delta */
  board: number
  /** player becomes unsettled -> may attract AI bids */
  unsettle?: boolean
  /** printed reaction */
  reaction: string
  /** choosing this option makes the player a promise - and he remembers */
  pledge?: Pledge['kind']
  /** a public loyalty vow: recorded, and it follows you if you walk it back */
  vow?: boolean
  /** lodge a disciplinary appeal for the named player's ban - the verdict
   *  lands immediately (deterministic, no shared rng) */
  appeal?: boolean
  /** union confidence delta - the national-coach window question, where what
   *  you tell the country's press moves the federation, not the club board */
  natConf?: number
  /** a discipline incident response: how the manager handles the man
   *  (authority.ts decides whether it lands or blows up in his face) */
  disc?: 'fine' | 'word' | 'ignore'
  /** the pre-season decision: one special week, three philosophies */
  camp?: 'heat' | 'home' | 'tour'
  /** agreeing to a loan actually sends him. Saying yes and then leaving the
   *  manager to go and find the Transfers screen is how a lad ended up asking
   *  the same question a week after his boss agreed to it. */
  loan?: boolean
  /** the summer sponsorship decision (25C): choosing an option SIGNS the deal
   *  there and then, via commercial.offersFor - which is deterministic on
   *  (seed, season, slot), so the offer named on the button is the offer
   *  signed. kind 'keep' stays with the department's stopgap. */
  deal?: { slot: string; kind: 'long' | 'short' | 'clause' | 'keep' }
  /** the season-expectations decision (25C, FM Mobile style): choosing sets
   *  state.stance for the year, which scales how hard the boardroom needle
   *  swings on every result - see boardReaction. */
  stance?: 'safe' | 'board' | 'high'
  /** money the board releases the moment this option is chosen (the aim-high
   *  war chest). Computed when the question is built so the label can print
   *  the exact figure; applied once in answerPress. */
  fund?: number
}

/** A subject a player can raise behind the office door. The office keeps a
 *  memo of who asked what and when, so the same man does not knock again
 *  about the same thing seven days after you answered him. */
export type OfficeTopic = 'plans' | 'loan' | 'deal'

/** A promise made to a player in the office. The squad keeps the receipts:
 *  at the due week it is settled as kept or broken, with consequences. */
export interface Pledge {
  playerId: number
  kind: 'plans' | 'minutes' | 'deal'
  week: number
  season: number
  /** week the promise falls due for settling */
  due: number
  /** the player's apps when the promise was made */
  baseApps: number
}

export interface PressItem {
  id: number
  week: number
  season: number
  outlet: string
  question: string
  playerId?: number
  options: PressOption[]
  answered: boolean
  answerLabel?: string
  reaction?: string
  /** set on office conversations: what he came in to talk about */
  topic?: OfficeTopic
  /** set on discipline conversations: the incident this one resolves */
  incidentId?: number
}

export interface TransferOffer {
  id: number
  playerId: number
  fromClubId: string // bidding club
  toClubId: string   // owning club
  fee: number
  week: number
  /** offer directed at user needs response */
  forUser: boolean
  status: 'pending' | 'accepted' | 'rejected'
  /** He has already been asked for more once.
   *
   *  Haggling raises the fee 18% on a 55% roll and leaves the bid pending, so an
   *  unlimited counter is a money printer: keep demanding until the dice land.
   *  One round of haggling per offer, then you answer it. */
  countered?: boolean
  /** How many times a rival has topped this bid (18C). A war runs three
   *  raises at most, then whoever holds the ball has to hear an answer. */
  raises?: number
}

/** Club infrastructure, levels 0-5 - bricks and mortar that outlast any squad. */
export type FacilityId = 'gym' | 'kicking' | 'paddock' | 'briefing' | 'academy' | 'pitch' | 'recovery' | 'shop' | 'hospitality'
export const MAX_FACILITY = 5
export const FACILITY_INFO: Record<FacilityId, { name: string; icon: string; desc: string; base: number }> = {
  pitch: { name: 'facilities.pitch', icon: '🏉', desc: 'facilities.pitchDesc', base: 260_000 },
  gym: { name: 'facilities.gym', icon: '🏋️', desc: 'facilities.gymDesc', base: 350_000 },
  recovery: { name: 'facilities.recovery', icon: '🧊', desc: 'facilities.recoveryDesc', base: 420_000 },
  paddock: { name: 'facilities.paddock', icon: '🌱', desc: 'facilities.paddockDesc', base: 400_000 },
  kicking: { name: 'facilities.kicking', icon: '🥅', desc: 'facilities.kickingDesc', base: 300_000 },
  briefing: { name: 'facilities.briefing', icon: '📽️', desc: 'facilities.briefingDesc', base: 380_000 },
  academy: { name: 'facilities.academy', icon: '🎓', desc: 'facilities.academyDesc', base: 500_000 },
  shop: { name: 'facilities.shop', icon: '🛍️', desc: 'facilities.shopDesc', base: 240_000 },
  // F31: ground development past the turnstile. Capacity expansion already
  // exists (requestExpansion) and adds SEATS; this adds what each seat is
  // worth. Boxes, a members' lounge, a decent kitchen: the same crowd spends
  // more. Built as a facility rather than a new system because the estate
  // already handles levels, costs, board requests and weekly upkeep, and a
  // second parallel mechanism for buildings would be the same thing twice.
  hospitality: { name: 'Hospitality & Boxes', icon: '🥂', desc: 'Corporate boxes and lounges: every home crowd is worth more at the gate.', base: 460_000 },
}
export const facilityCost = (info: { base: number }, level: number) => info.base * (level + 1)

/** The level the user's club holds. Facilities live on the club, so taking a
 *  new job means inheriting that club's buildings, not carrying your own. */
export function facLevel(state: GameState, fid: FacilityId): number {
  return state.clubs[state.userClubId]?.facilities?.[fid] ?? 0
}

/**
 * How many people this club could put in a ground for a good game, concrete
 * aside. Reputation and standing, not seats.
 *
 * Attendance used to be a pure fraction of capacity, which meant a club that
 * filled its ground qualified to expand it, and then filled the bigger one
 * too, for ever: a 20-season soak grew Northampton's 15,249 to 64,149 across
 * thirteen new stands. A catchment does not grow because you laid more
 * concrete. Once capacity passes this figure the ground stops selling out,
 * which is what ends the spiral.
 */
export function demandCeiling(club: Club): number {
  // Anchored to the club's own opening capacity, not derived from reputation.
  // Two attempts at a rep curve both failed on real data, because how big a
  // ground is relative to its following is a fact about the club, not about
  // its league: Valence Romans hold 15,000 and draw a few thousand, while
  // Franklin's Gardens sells out at 15,249. Any curve that let Valence keep
  // its gate made Welford Road expandable to 60,000.
  //
  // So: the real ground is the floor, and a successful club can grow its
  // following by a further 15% to 40%, deeper for a bigger name. Every club
  // starts below its own ceiling, which means season one is untouched by this
  // and only growth is policed.
  const base = club.capacity0 ?? club.capacity
  return Math.round(base * (1.15 + Math.max(0, club.rep - 55) / 145))
}

/** Every facility level the club holds, 0 to 45 across the nine buildings. */
export function estateSum(club: Club | undefined): number {
  if (!club?.facilities) return 0
  return (Object.keys(FACILITY_INFO) as FacilityId[]).reduce((s, fid) => s + (club.facilities?.[fid] ?? 0), 0)
}

/**
 * What it costs to open the doors each week, whether or not there is a match:
 * the ground itself, and every building on the estate with staff inside it.
 *
 * This exists because a 20-season soak ended with the manager's club on £179M
 * against an AI median of £15M, and a maxed estate (38 of 40) that had cost
 * nothing to keep. Upgrades have to be a commitment, not a ratchet.
 */
/** What a seat costs to heat, mow, steward and insure for a week. ONE number,
 *  read by the user's ledger here and by every AI club's in aiecon.ts - they
 *  were 1.1 and 3.1 for a while, which made the manager's ground a third the
 *  price of everybody else's. */
export const UPKEEP_PER_SEAT = 3.1

export function operatingCost(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  // Hospitality (F31) carries a second bill on top of the flat per-level cost,
  // and it has to, because it earns a PERCENTAGE OF THE GATE and the gate is
  // large next to £1,400 a week. At £1,400 a level a maxed block returned four
  // times its upkeep in every world, which is not a decision, it is a printer.
  // Boxes need chefs, hosts and cleaners whether or not there is a match, so a
  // second charge is honest as well as necessary.
  //
  // £2,800 is MEASURED, not estimated. The first figure was £4,500, derived by
  // hand from "one home game every three weeks", and scripts/econprobe walked
  // four real seasons and showed what that actually did: +£20k a week on the gate
  // against +£23k of upkeep, so a manager who built boxes was slightly worse off
  // than one who did not. A building nobody should build is not a decision
  // either. At £2,800 it returns about 1.4x its upkeep at Northampton's crowd.
  //
  // It scales with the gate, so it is worth more at a big ground than a small
  // one. That is correct rather than a flaw - boxes at a 40,000 stadium really
  // are better business - but it does mean the ratio is nearer 3x for a giant,
  // and anybody raising the 4% should re-read that sentence first.
  const boxes = (club.facilities?.hospitality ?? 0) * 2_800
  // THE SAME GROUND COSTS THE SAME TO RUN, whoever owns it. This charged the
  // user 1.1 a seat a week while aiecon charges every other club in the world
  // 3.1 (UPKEEP_PER_SEAT) - so a 25,000-seat ground cost the manager £27.5k a
  // week and his rivals £77.5k, about £2.25M a season of free money that no
  // decision earned. Measured at Sale, the user held 4.6x the median AI balance
  // by season three without doing anything.
  //
  // The audit that found this also proposed indexing the user's RECEIPTS by
  // moneyIndex, the way aiWeek indexes every AI club's. That was tried and
  // reverted: measured over five seasons it made the divergence worse rather
  // than better, because indexing rewards a high-reputation club (Sale went
  // from 15.8M to 29.8M and cleared the richest AI club in the division) while
  // the seat cost falls hardest on a big ground (Leicester went the other way).
  // The two do not cancel; they redistribute. The seat price is an incoherence
  // and is fixed here. The indexing is a design question about whether a
  // manager's income should track wage inflation, and it needs deciding rather
  // than patching.
  return Math.round(club.capacity * UPKEEP_PER_SEAT + estateSum(club) * 1_400 + boxes)
}

/**
 * The weekly commercial cheque: the reputation-driven sponsorship and broadcast
 * share, plus a central-distribution top-up for a club whose ground is smaller
 * than its name.
 *
 * The top-up exists because the wage bill scales with reputation while the gate
 * scales with the stadium, so a big name in a small ground was structurally
 * insolvent through nothing the manager did: Northampton (rep 86, 15,249 seats)
 * fell from +2.4M to -7.3M over four seasons while Leicester (rep 83, 25,849)
 * banked +17.2M. Paying everyone more would have been the wrong shape - it
 * would have handed Leicester money it did not need. So pay the gap and only
 * the gap, capped, because the expectation flattens at the top and an uncapped
 * slope made Toulouse six times richer than the league it plays in.
 *
 * A club whose ground fits its name gets exactly what it always got.
 */
export function weeklyCentral(club: Club): number {
  // F30 moved the reputation-driven sponsorship out of here and into three
  // signable deals (commercial.ts). What is left is the money that arrives
  // whether or not anybody wants their name on your shirt: the broadcast and
  // central-distribution share, plus the small-ground top-up documented below.
  // The two halves together still pay what this one line used to, so long as the
  // three slots are sold at market rate - which is what makes the split neutral
  // against a calibrated economy, and what scripts/dealprobe.ts checks.
  const commercial = 40_000
  const expectedSeats = Math.min(23_000, Math.max(0, club.rep - 45) * 620)
  const missingSeats = Math.max(0, expectedSeats - club.capacity)
  // 8.5 per missing seat: 30 a ticket, ~85% full, one home game every three weeks
  return Math.round(commercial + missingSeats * 8.5)
}

/**
 * What a club's infrastructure looks like before a manager touches it: sized
 * to its standing, varied per facility, deterministic per club. Ambitious
 * mid-table clubs have a good gym and no megastore; giants have both.
 */
export function initFacilities(club: Club, seed = 0): Partial<Record<FacilityId, number>> {
  const base = Math.max(0, Math.min(4, Math.round((club.rep - 50) / 10)))
  let h = (2166136261 ^ seed) >>> 0
  for (let i = 0; i < club.id.length; i++) h = Math.imul(h ^ club.id.charCodeAt(i), 16777619) >>> 0
  const out: Partial<Record<FacilityId, number>> = {}
  for (const fid of Object.keys(FACILITY_INFO) as FacilityId[]) {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13
    const r = (h >>> 0) % 100
    out[fid] = Math.max(0, Math.min(MAX_FACILITY, base + (r < 22 ? 1 : r < 52 ? -1 : 0)))
  }
  return out
}

/** A one-word verdict on the whole estate, for the infrastructure header. */
export function estateGrade(club: Club): { label: string; sum: number; max: number } {
  const ids = Object.keys(FACILITY_INFO) as FacilityId[]
  const sum = ids.reduce((s, f) => s + (club.facilities?.[f] ?? 0), 0)
  const max = ids.length * MAX_FACILITY
  const pct = sum / max
  return {
    // a KEY, so the screens t() it and the board's letters tIn('en', …) it
    label: pct >= 0.8 ? 'facilities.gradeWorldClass' : pct >= 0.62 ? 'facilities.gradeExcellent'
      : pct >= 0.44 ? 'facilities.gradeGood' : pct >= 0.26 ? 'facilities.gradeAdequate'
      : pct >= 0.12 ? 'facilities.gradeBasic' : 'facilities.gradeThreadbare',
    sum, max,
  }
}

/** One decision the manager made, and what it actually did. Shown on the
 *  manager's profile so every move has a visible consequence (8-batch
 *  feedback: "every manager move has positive/negative effects"). */
export interface Decision {
  /** absolute week (season*100+week) */
  abs: number
  season: number
  week: number
  /** The decision as it was RECORDED, in English, always - and not display
   *  text. Same rule as NewsItem.body: kept so a save written before decisions
   *  carried a key still reads, and so nothing that inspects the history has
   *  to know about keys. The profile screen renders decisionText(). */
  text: string
  /** The key and values a reader sees. See decisionText(). */
  k?: string
  v?: Record<string, string | number>
  /** true it went your way, false it cost you, undefined for a cost you chose */
  good?: boolean
}

/** A line of the manager's own history, in the reader's language - or in the
 *  English it was recorded in, on a save written before decisions carried a
 *  key. A career keeps forty of these and lives for years, so the fallback is
 *  not a stopgap. */
export const decisionText = (d: Decision): string => (d.k ? t(d.k, d.v) : d.text)

/** Record a decision and its consequence. Newest first, last 40 kept.
 *
 *  The decision arrives as a key and its values rather than as a sentence,
 *  because the profile screen reads this history back for as long as the
 *  career lasts - a sentence recorded in English is English there for ever. */
export function logDecision(state: GameState, k: string, v?: Record<string, string | number>, good?: boolean) {
  state.decisions = [
    { abs: state.season * 100 + state.week, season: state.season, week: state.week, text: tIn('en', k, v), k, v, good },
    ...(state.decisions ?? []),
  ].slice(0, 40)
}

/** The week's training focus before a match. */
export type MatchPrep = 'attack' | 'defence' | 'setpiece' | 'fitness' | 'recovery'

export interface StaffLevels {
  assistant: number // 0-3: training gains, and how sharp his eye is when he names your side
  physio: number    // 0-3: injury length & recovery
  scout: number     // 0-3: knowledge gathering speed
  attack: number    // 0-3: attack coach - sharper strike play on matchday
  defence: number   // 0-3: defence coach - tighter line speed and shape
  scrumCoach: number // 0-3: set-piece coach - scrum & lineout platform
  kicking: number   // 0-3: kicking coach - territory game and goal kicking
  academyCoach: number // 0-3: academy coach - develops the second squad
}

/** A named coach with a badge. The level in StaffLevels mirrors his tier. */
export interface StaffPerson {
  name: string
  nat: string
  age: number
  /** 1 Bronze, 2 Silver, 3 Gold */
  tier: number
  wage: number
  trait: string
  since: number
  /** enrolled on a coaching course: the result lands in absolute week `done` */
  course?: { done: number; toTier: number } | null
  passed?: number
  failed?: number
  /** absolute week he may sit the exam again after failing it */
  retakeAt?: number
}

/* name/desc are i18n keys (see docs/i18n.md): the table is built once and the
   language can change after it. Anything written into a save calls tIn('en', …)
   on them so a career's own paperwork stays English whatever the screen is. */
export const STAFF_INFO: Record<keyof StaffLevels, { name: string; desc: string; wage: number }> = {
  assistant: { name: 'staff.roleAssistant', desc: 'staff.roleAssistantDesc', wage: 4000 },
  physio: { name: 'staff.rolePhysio', desc: 'staff.rolePhysioDesc', wage: 3000 },
  scout: { name: 'staff.roleScout', desc: 'staff.roleScoutDesc', wage: 2500 },
  attack: { name: 'staff.roleAttack', desc: 'staff.roleAttackDesc', wage: 3500 },
  defence: { name: 'staff.roleDefence', desc: 'staff.roleDefenceDesc', wage: 3500 },
  scrumCoach: { name: 'staff.roleScrumCoach', desc: 'staff.roleScrumCoachDesc', wage: 3000 },
  kicking: { name: 'staff.roleKicking', desc: 'staff.roleKickingDesc', wage: 2500 },
  academyCoach: { name: 'staff.roleAcademyCoach', desc: 'staff.roleAcademyCoachDesc', wage: 2500 },
}

export interface ManagerStats {
  m: number; w: number; d: number; l: number
  /** clubId is optional for saves written before dreams existed - a dream that
   *  asks "with THIS club" treats a missing clubId as "counts", because the
   *  alternative is silently erasing a trophy the manager really won */
  trophies: { compId: string; season: number; clubId?: string }[]
  finishes: { season: number; leagueId: string; pos: number; clubId?: string }[]
  signings: number
  spent: number
  /** Manager of the Month awards won */
  moms?: number
}

export interface GameState {
  seed: number
  saveName: string
  season: number // 0 = 2025-26
  week: number   // 1..46
  userClubId: string
  players: Record<number, Player>
  clubs: Record<string, Club>
  comps: Record<string, Competition>
  fixtures: Fixture[]
  news: NewsItem[]
  press: PressItem[]
  offers: TransferOffer[]
  nextId: number // shared id counter for players/news/fixtures/offers
  natSquads: Record<string, number[]> // nation -> player ids currently called up
  history: { season: number; compId: string; champion: string; topScorer?: string }[]
  unemployed: boolean
  processedWeek: boolean
  /** The news id the current week's bulletins start from.
   *
   *  processWeekAndAdvance files its stories under the week it just SETTLED and
   *  then moves the counter on, so "this week's news" cannot be found by matching
   *  state.week - and a season rollover resets the week to 1, which breaks the
   *  arithmetic entirely. The id watermark taken before the settlement is exact
   *  in both cases. See game/days.ts. */
  newsFrom?: number
  /** Which day of the current week the manager is standing on, 0 = Monday.
   *
   *  Presentation only: the engine still settles a whole week at a time. This is
   *  how far through the reveal Continue has walked. Optional so saves written
   *  before the day flow existed load on Monday. See game/days.ts. */
  day?: number
  managerName: string
  training: TrainingFocus
  /** this week's match preparation - a short-term matchday emphasis,
   *  distinct from long-term training (which grows attributes) */
  matchPrep?: MatchPrep
  shortlist: number[]
  staff: StaffLevels
  /** the men behind the levels: names, badges and courses in progress */
  staffPeople?: Partial<Record<keyof StaffLevels, StaffPerson>>
  /** bumped on every appointment so the candidate market refreshes */
  staffSalt?: number
  mgr: ManagerStats
  /** the three commercial slots and what is signed in them (F30). Absent on a
   *  save written before the department existed; seedDeals fills it. */
  deals?: Partial<Record<'shirt' | 'naming' | 'kit', import('./commercial').Deal>>
  /** what the dressing room makes of you, 0-100. Optional so old saves load. */
  mgrTrust?: number
  /** the manager's backstory, chosen at career creation (18B) */
  mgrOrigin?: MgrOrigin
  /** the scripted challenge this career started as - cleared when conquered */
  challenge?: string
  /**
   * THE DREAM: the ambition the manager named at career start (dream.ts).
   *
   * Three fields and no progress: every dream computes its own state from the
   * save, so there is nothing here that can fall out of step with the career it
   * describes. `clubId` is the club the dream was declared ABOUT, which is not
   * always where the manager works now - "take Esher into the top flight" stays
   * a promise about Esher after you leave. Optional: a save from before dreams
   * existed simply has none, and the Home screen shows the old horizons instead.
   */
  dream?: { id: string; clubId: string; season: number }
  /** open managerial vacancies at AI clubs */
  /**
   * `passed` is the manager saying he is not interested.
   *
   * The Job Centre badge used to count vacancies.length, which is world state
   * wearing a notification's clothes: a red dot that appears because somebody
   * somewhere got sacked, and that NOTHING the manager does can clear. Reported
   * live: "reject available jobs to clear notifications - you should be able to."
   * Turning it down is now a real answer, and the badge counts only the jobs he
   * has not answered, so a new one still gets his attention.
   */
  vacancies: { clubId: string; week: number; applied?: boolean; passed?: boolean }[]
  /** up to 3 young players given individual development attention */
  devFocus: number[]
  /** Personal training plans (18A): a handful of men on individual
   *  programmes, the assistant's level setting the handful (2 + level).
   *  Newest assignment wins a full book, same idiom as devFocus. A planned
   *  man trains his programme INSTEAD of the squad session that week, so a
   *  plan is a choice rather than a stack. */
  plans?: { id: number; plan: TrainingFocus }[]
  /** The office chat budget (20D): absolute week stamp and how many of the
   *  week's two manager-initiated conversations are spent. A manager who
   *  praises everybody praises nobody. */
  chatWk?: number
  chatsUsed?: number
  /** national side the manager also coaches (FM-style dual role) */
  natTeam?: string | null
  /** a country wants you - pending offer from a union */
  natOffer?: { nat: string; week: number } | null
  /** the board's secondary season objectives (evaluated at rollover) */
  objectives?: string[]
  /** pundits' preseason predicted finishing positions for the user's league */
  preds?: Record<string, number>
  /** weekly balance snapshots for the finances season chart */
  finHist?: { w: number; b: number }[]
  /** running press-conference tone: heavy praise breeds swagger, constant
   *  criticism breeds fragility. Decays weekly toward neutral. */
  pressTone?: number
  /** the board owes you one (objectives delivered) - spend it on a request */
  boardOwed?: boolean
  /** the season the ground was last extended - one stand a season */
  expandedSeason?: number
  /** the manager's decisions and what they did */
  decisions?: Decision[]
  /** the analyst's read on this week's opponent */
  analyst?: import('./analyst').AnalystRead | null
  /** how often following his read has paid off */
  analystRecord?: { right: number; wrong: number }
  /** the chief scout is away on a commissioned brief */
  commission?: import('./commission').Commission | null
  /** the report he filed when he got back */
  scoutFinds?: import('./commission').ScoutFind[] | null
  /** legacy: facilities now live on the club. Kept so old saves can be
   *  migrated into Club.facilities, then emptied. */
  facilities?: Partial<Record<FacilityId, number>>
  /** a facility upgrade under construction: the board funded it, the
   *  builders are in, and it opens at `done` (absolute week) */
  facilityBuild?: { id: FacilityId; done: number; level: number } | null
  /** absolute week (season*100+week) before which the board will not hear
   *  another facility request - denials cost you the room for a while */
  facilityAskCooldown?: number
  /** a trophy moment waiting to be celebrated full-screen */
  celebration?: { headline: string; sub: string; icon: string } | null
  /** senior pros paired with academy kids - wisdom rubs off. Capped by
   *  mentoring.mentorCap (four, five with a strong Centre of Excellence).
   *  pers0 is the kid's personality when the pairing was made, so graduation
   *  can tell "he BECAME his mentor" from "they always matched" - a
   *  Professional teaching a Professional is the second-best pairing in the
   *  game and must not end at birth. Absent on pairs made before it existed. */
  mentors?: { senior: number; kid: number; pers0?: Personality }[]
  /** banked objectives already celebrated in the news this season, so hitting
   *  one makes the inbox exactly once (user: "get achievements into the news").
   *  Reset with the objectives themselves at rollover. */
  objDone?: string[]
  /** How the manager pitched THIS season to the room and the board (user: "at
   *  the start of the season the manager should set the expectations for the
   *  club... if the manager is losing then pressure should build"). Set by the
   *  week-2 office decision, cleared each summer. 'high' makes every win worth
   *  more boardroom credit and every defeat cost noticeably more; 'safe' mutes
   *  both; unset or 'board' is exactly the old behaviour. */
  stance?: 'safe' | 'board' | 'high'
  /** the war chest taken by aiming high at the launch (user: "they get a bit
   *  more money but they best win or the board will be nervous about their
   *  budget"). Recorded so the rollover knows how much the promise was worth:
   *  finish no better than the pundits said and next season's budget gives it
   *  back with interest. Cleared with the stance each summer. */
  stanceFund?: number
  /** absolute week (season * SEASON_WEEKS + week) the LAW WATCH wind-up last
   *  aired. The freshness gate used to scan state.news for the last airing,
   *  and the news log is trimmed at 250 items - a busy month pushed the last
   *  airing out of the window and re-armed the story early; and it compared
   *  same-season only, so every rollover reset the clock. */
  lawWatchAt?: number
  /** the season the playoff-clinch announcement ran (user: "no announcement
   *  when you mathematically qualify"). A stamp, not a news-log scan. */
  playoffClinch?: number
  /** absolute week (season * SEASON_WEEKS + week) of the newest final the
   *  press room has already asked about, so a won trophy is toasted exactly
   *  once and a double weekend is toasted as a double. */
  silverwareAsk?: number
  /** absolute week the test-window exodus question last ran. It has no
   *  playerId, so the office memo never cooled it and a long window could
   *  ask twice in a fortnight with the same three buttons. */
  natAskAt?: number
  /** absolute week the national-coach window question last ran, so the room
   *  raises your Test squad once per window, not every Friday of it */
  natCoachAskAt?: number
  /** season*100+week each terrace-pulse subject last fired - a stamp, not a
   *  news scan, because the trimmed log forgets its own cooldown evidence */
  pulseAt?: Record<string, number>
  /** THE TENDENCY WINDOW (four pillars, pillar 2): the user's last five club
   *  matches' dial settings, oldest first. Written once per settled user club
   *  match, ring-buffered at five, and read by opposing analysts - a manager
   *  who plays the same way every week is a manager who can be planned for. */
  tendency?: { season: number; week: number; style: number; tempo: number; kicking: number; aggression: number; defLine: number; defWidth: number }[]
  /** THE DISCIPLINE LEDGER (pillar 1): open dressing-room incidents. An
   *  incident is flagged when it happens and moves through handled, festering
   *  or challenged depending on how - and by WHOM - it is dealt with. Pruned
   *  once resolved and older than a season, so the list cannot grow. */
  incidents?: { id: number; pid: number; kind: 'training' | 'rating'; state: 'flagged' | 'handled' | 'festering' | 'challenged'; season: number; week: number }[]
  /** season*100+week the senior players last called a meeting to question the
   *  manager's authority - a stamp, never a news scan */
  challengeAt?: number
  /** per-dial run length of consecutive user matches played at an extreme
   *  (pillar 2's repetition fatigue) - written at settle, read at kick-off */
  dialStreak?: Record<string, number>
  /** absolute week the availability counter last ticked (see settleGameTime),
   *  so a double-called settle cannot count one match twice */
  availWeek?: number
  /** THE ANNUAL (user: "there should be a forced page that says 'ready for a
   *  new season?'"). Stamped by the rollover with the season just finished;
   *  the UI routes Continue to the Annual page until its button clears it.
   *  Engine-only careers ignore it entirely. */
  annual?: { season: number }
  /** all-time single-season records per league (points / tries) */
  records?: Record<string, { pts: { name: string; val: number; season: number }; tries: { name: string; val: number; season: number } }>
  /** games played together by key partnerships (front row, locks, halfbacks,
   *  centres) - familiarity sharpens the relevant unit. Key: chemKey(a, b) */
  chem?: Record<string, number>
  /** dynamic bad blood between clubs: cup eliminations, poached stars,
   *  ill-tempered matches. Expires after `until` season. */
  /** `reason` is the English the grudge was recorded in and is what an old save
   *  carries; `rk`/`rv` are the key and values a reader sees. Same rule as the
   *  inbox: the stored English is not display text, and grudgeReason() prefers
   *  the key when the save has one. */
  grudges?: { a: string; b: string; reason: string; rk?: string; rv?: Record<string, string | number>; until: number }[]
  /** structured snapshot of the user's last completed season */
  review?: SeasonReview | null
  /** terrace mood at the user's club, 5-98 - swings with results, colours
   *  the matchday atmosphere and nudges home advantage */
  /** the weekly wage ceiling per division, measured from the league itself (F6) */
  caps?: Record<string, number>
  /** A cup round that has been drawn but not yet watched (F19).
   *
   *  The ties exist as fixtures the moment the previous round finishes - they
   *  have to, or the user's tie would be simmed before the MatchDay screen saw
   *  it. This is the same draw held back as a moment: every ball in the round,
   *  in the order it came out, waiting to be revealed one at a time. */
  draw?: {
    compId: string
    stage: string
    week: number
    season: number
    ties: { homeId: string; awayId: string }[]
    /** how many balls the manager has watched come out so far */
    revealed: number
  } | null
  fanMood?: number
  /** the game's Hall of Fame: careers immortalised at retirement */
  hof?: { name: string; pos: Pos; nat: string; apps: number; tries: number; points: number; season: number; club: string }[]
  /** league the scouting network is assigned to watch weekly */
  scoutFocus?: string | null
  /** How the manager watches each competition (F5), keyed by competition id:
   *  'full' every line of commentary, 'highlights' the moments only, 'instant'
   *  the assistant takes it. A phone career is 40 matches a season and not all
   *  of them deserve ninety taps. */
  viewPref?: Record<string, 'full' | 'highlights' | 'instant'>
  /** open promises made to players in the office, settled at their due week */
  pledges?: Pledge[]
  /** who has raised what behind the office door, and when. A conversation the
   *  manager has already had does not repeat itself the following week. */
  officeMemo?: { pid: number; topic: OfficeTopic; season: number; week: number }[]
  /** the user's next academy class, fixed at the week-30 preview so intake
   *  day delivers exactly what the coach foretold */
  intakeClass?: { name: string; pos: Pos; age: number; q: number; pa: number; gk: boolean; wonder: boolean }[] | null
  /** signed pre-contracts: out-of-contract players who move on a free at
   *  the end of the season - binding once agreed */
  preContracts?: { playerId: number; toClubId: string; week: number }[]
  /** a takeover in motion (the moneyMen storyline): rumour -> exclusivity ->
   *  completion or collapse */
  takeover?: { clubId: string; week: number; stage: number } | null
  /** the new owner's honeymoon at the user's club: until this week the
   *  boardroom reacts 1.4x to every result - impress him or feel it */
  newOwnerUntil?: number | null
  /** the derby ledger: the user's all-time record against each rival,
   *  keyed by opponent club id - bragging rights, kept forever */
  derbyBook?: Record<string, { w: number; d: number; l: number }>
  /** the manager's book: tenure record against every club opponent.
   *  run is the live streak: +N straight wins, -N straight defeats, 0 after a draw */
  vsBook?: Record<string, { w: number; d: number; l: number; run?: number }>
  /** the biggest home crowd of the era - stadium expansion's long game */
  gateRecord?: { att: number; oppId: string; season: number } | null
  /** the annals: every season review of the career, oldest first - the
   *  manager's chronicle, carried across clubs */
  annals?: SeasonReview[]
  /** injury-crisis alerts already raised: position group -> week fired,
   *  so the assistant nags once a month, not once a week */
  crisisAt?: Record<string, number>
  /** world rugby rankings: rating points per nation, exchanged Test by Test */
  natRank?: Record<string, number>
  /** the union's confidence in you as national coach, 0-100 - null when
   *  you do not hold a Test job. Below 28 at the annual review: sacked */
  natConfidence?: number | null
  /** your Test record for the current national tenure - only matches your
   *  hands were on. Cleared when you step down; a new union starts you at
   *  nought, the way the record books do. */
  natRecord?: { m: number; w: number; d: number; l: number } | null
  /** finished national tenures, oldest first - the profile's international
   *  record survives the job (user: "your international record still stays
   *  on your profile") */
  natHistory?: { nat: string; m: number; w: number; d: number; l: number }[]
  /** season index when the user took charge of the current club */
  tenureStart?: number
  /** club ids where the user has earned legend status - once, forever */
  legendOf?: string[]
  /** The manager's own age. A career has a length (career.ts): the clock is
   *  visible from week one, advances every summer, and ends the story at 70.
   *  Absent on saves written before it existed - mgrAge() defaults them. */
  mgrAge?: number
  /** Set once, when the career ends. The save keeps playing history but the
   *  manager does not: Continue refuses and the Legacy screen shows the
   *  verdict instead of the horizon. */
  retired?: { season: number; age: number; forced: boolean; grade: string; score: number }
  /** The record book of THIS MANAGER'S ERA (records.ts): marks he set and can
   *  be asked to beat. Named `era` rather than `records` because that name is
   *  already taken above by the per-league season records, and two things
   *  called records on one object is how somebody writes to the wrong one.
   *  Stored rather than computed because a season's fixtures are wiped every
   *  summer, so the biggest win of an era is not recoverable after the fact. */
  era?: {
    biggestWin?: { oppId: string; us: number; them: number; season: number }
    worstLoss?: { oppId: string; us: number; them: number; season: number }
    longestUnbeaten?: { n: number; season: number }
    recordSigning?: { playerId: number; fee: number; season: number }
  }
  /** The season's talisman hunt (living.ts): one rival circling one of your
   *  players, in stages, so losing him is the end of a story you watched
   *  rather than an alert that arrived. One per season; cleared when the
   *  season turns or the player leaves. */
  hunt?: { clubId: string; playerId: number; stage: 0 | 1 | 2 | 3; season: number }
  /** last published ranking order (nation codes), for movement arrows */
  natRankPrev?: string[]
  /** Scouting Agency monthly rankings: last month's order + best-ever ranks */
  agency?: {
    seniors: number[]; kids: number[]; best: Record<number, number>
    /** when this snapshot published. The tables render CURRENT standings every
     *  week while the snapshot only moves every four, so without a stamp the
     *  movement arrows are measured against a list the player never saw and the
     *  screen cannot say which two things it is comparing (user: "world
     *  rankings are out of sync"). */
    at?: { season: number; week: number }
  }
  /** shortlist players already alerted about this season */
  slAlerted?: number[]
  /** absolute week (season*100+week) the cotton-wool pick was last used */
  cottonWk?: number
  /** Last full time's two fixes, so the next one can mark the homework (C2). */
  fixHw?: { fxId: number; season: number; week: number; tags: string[] }
  /** the user's hand-picked Test 23 for the current window */
  natLineup?: { team: string; lineup: (number | null)[] } | null
  /** World Player of the Year roll of honour, oldest first - the sport's
   *  history book, one line per season */
  potyRoll?: { season: number; playerId: number; name: string; clubName: string }[]
  /** the season's most dramatic try by the user's club, judged live at each
   *  full-time whistle and honoured at the Annual */
  tryOfSeason?: { playerId: number; name: string; min: number; opp: string; text: string; drama: number; season: number } | null
  /** challenges conquered this career, badged forever on the profile */
  challengesDone?: string[]
  /** absolute week (season*100+week) a bigger club last courted the manager -
   *  the tap on the shoulder comes at most once every 12 weeks */
  courtedAt?: number
  /** the club doing the courting, so the press can name them */
  courtedBy?: string | null
  /** absolute week (season*100+week) of the last public loyalty vow -
   *  take another job inside 10 weeks and the quote travels with you */
  vowedAt?: number
  /** squad-depth standard this save has been topped up to - the one-shot
   *  migration that grew 33-man squads to 38 stamps this so it never reruns */
  squadDepth?: number
  /** the A League: the academy sides of the user's league, with their own
   *  fixtures and table. Kept outside state.comps deliberately - see academy.ts */
  academy?: import('./academy').AcadLeague
}

/** Managerial reputation earned from results and silverware, 30-95. */
/**
 * A name has to be made, not issued with the contract.
 *
 * This used to default an unplayed win rate to 0.4, so a manager who had never
 * taken a training session started on 34 + 18 = 52 out of 95: a mid-career
 * reputation before kick-off, and enough to be headhunted by two thirds of the
 * clubs in the game (user: "reputation if starting fresh should take time to
 * build"). Now nothing is assumed. An unknown starts at 22, and the win-rate
 * term fades IN as the sample grows, so one lucky afternoon does not make a
 * name and a bad month does not end one.
 *
 * Roughly: 22 cold, ~40 after a decent first season, ~50 after three, and the
 * seventies need trophies.
 */
export function mgrReputation(state: GameState): number {
  const m = state.mgr
  const games = m.m
  const winPct = games ? m.w / games : 0
  // how much the record counts for: half weight at 20 games, most of it by 60
  const proven = games / (games + 20)
  // a former international's name opens doors before a single result (18B) -
  // worth six points of standing, forever, which a bad record soon dwarfs
  const name = state.mgrOrigin === 'player' ? 6 : 0
  return Math.min(95, Math.round(
    22 + name + winPct * 46 * proven + m.trophies.length * 7 + m.finishes.length * 1.5,
  ))
}

/**
 * What the dressing room makes of you, 0 to 100.
 *
 * A squad does not hand its belief to a stranger (user: "players take time to
 * trust you fully, need to build confidence through good management"). Trust
 * starts low for an unknown, a little higher for someone with a record, and
 * moves on results and on whether your word turns out to be worth anything. It
 * is not decoration: it scales how much of a team talk the room actually takes
 * in, so the same speech is worth more in year three than on day one.
 */
export function squadTrust(state: GameState): number {
  // no clamp import here on purpose: model.ts is a leaf that rng.ts must be
  // able to stay out of, and Math.min/max says the same thing
  return Math.max(0, Math.min(100, state.mgrTrust ?? 30))
}

/** Trust as a multiplier on a dressing-room effect: 0.45 cold, 1.0 fully bought in. */
export function trustFactor(state: GameState): number {
  return 0.45 + squadTrust(state) / 100 * 0.55
}

export function trustWord(v: number): string {
  return t(v >= 85 ? 'profile.trustWall'
    : v >= 68 ? 'profile.trustWithYou'
    : v >= 50 ? 'profile.trustWarming'
    : v >= 32 ? 'profile.trustUndecided'
    : v >= 16 ? 'profile.trustUnconvinced'
    : 'profile.trustDisbelief')
}

/** World Championship years: 2027, 2031, ... (in-game season index) */
export function isWorldCupSeason(season: number): boolean {
  return (2025 + season) % 4 === 3
}

export const SEASON_WEEKS = 45

/** Leagues where the bottom club goes down. ONE list: the table's shading,
 *  the new-career media verdict and the pundits' predictions all read it, so
 *  no screen can threaten relegation in a league that has none. */
export const RELEGATES = ['prem', 'champ', 'top14']

/** The pyramid by tier: 1 the top flights, 2 the second divisions, 3 National
 *  League One. Loan gravity reads it - how far down a move is decides who
 *  would actually make it. */
export const LEAGUE_TIER: Record<string, number> = {
  prem: 1, top14: 1, urc: 1, srp: 1, jl1: 1,
  champ: 2, prod2: 2,
  natl1: 3,
}
export const leagueTier = (leagueId?: string | null): number => LEAGUE_TIER[leagueId ?? ''] ?? 2

/**
 * Possessive for a name that may already end in s.
 *
 * Found by reading the wire probe's sample output: "Crusaders's media team have
 * posted it", "Saracens's head coach has made him his number one target". Rugby
 * club names are overwhelmingly plural in form - Saracens, Harlequins, Crusaders,
 * Brumbies, Ospreys, Scarlets, Hurricanes, Falcons - so the naive apostrophe-s
 * hits a large fraction of the league and reads as a typo rather than as a style
 * choice. A plural takes the bare apostrophe.
 */
export const poss = (name: string) => name.endsWith('s') ? `${name}'` : `${name}'s`

/** Convert (season, week) to a display date. Season 0 week 1 = Sat 6 Sep 2025. */
/** Close the current national tenure: the Test record moves to the profile's
 *  permanent history and the live fields clear. Called by BOTH doors out -
 *  stepping down and the union's annual-review sack - so neither can lose
 *  the ledger (user: "your international record still stays on your
 *  profile"). */
export function closeNatTenure(state: GameState) {
  if (state.natTeam && state.natRecord && state.natRecord.m > 0) {
    ;(state.natHistory ??= []).push({ nat: state.natTeam, ...state.natRecord })
  }
  state.natTeam = null
  state.natConfidence = null
  state.natRecord = null
}

/** Month and weekday, short, in the language on screen.
 *
 *  A DATE IS NEVER STORED - every screen builds it from the season and week it
 *  already has - so a career started in English reads its own dates back in
 *  French the moment the language changes, and nothing in the save has to move.
 *  French keeps the same order as English (16 août 2025), which is why the
 *  format strings below need no translation of their own. */
/** What the reader sees, in the reader's language.
 *
 *  Every screen that shows a story goes through these two and nothing reads
 *  `.subject` or `.body` directly any more. A story filed with a key renders it
 *  now, in whatever language the manager is reading in this minute; one without
 *  falls back to the English it was filed in, which is what a save from before
 *  this change - or a story the engine assembled by appending to another - has.
 *
 *  The fallback is not a stopgap to be removed later. Careers are on the device
 *  and live for years, and a save begun on the release that shipped this will
 *  still be opened in v2. */
export const newsBody = (n: NewsItem): string => (n.k ? t(n.k, n.v) : n.body)
export const newsSubject = (n: NewsItem): string => (n.k ? t(n.k + 'Subj', n.v) : n.subject)

/** What is wrong with him, in the reader's language - or in the English it was
 *  recorded in, on a save written before injuries carried a key. */
export const injuryDesc = (inj: { desc: string; dk?: string }): string => (inj.dk ? t(inj.dk) : inj.desc)

export const monthName = (m: number): string => t(`date.mon${m}`)
export const dayAbbr = (d: number): string => t(`date.day${d}`)

export function weekDate(season: number, week: number): string {
  const start = Date.UTC(2025 + season, 7, 16) // season opens mid-August with pre-season
  const d = new Date(start + (week - 1) * 7 * 86400000)
  return `${d.getUTCDate()} ${monthName(d.getUTCMonth())} ${d.getUTCFullYear()}`
}

/** Which day this fixture kicks off: -1 Friday, 0 Saturday, +1 Sunday.
 *  Fixed per fixture, so previews, reports and recovery all agree. */
export function fixtureDayOff(fxId: number): -1 | 0 | 1 {
  const h = (fxId * 2654435761) >>> 0
  return h % 3 === 0 ? -1 : h % 3 === 2 ? 1 : 0
}

/** 'Fri 5 Sep' - the real kick-off date for a fixture.
 *
 *  Three-letter days to match the three-letter months. The full words were being
 *  clipped to "Satur" in the fixtures list, which is worse than an abbreviation
 *  because it looks like a bug rather than a shorthand.
 *
 *  dayOff overrides the per-fixture hash for competitions that always play the
 *  same day - the A League is every Friday, the night before the first team. */
export function fixtureDate(season: number, week: number, fxId: number, dayOff?: -1 | 0 | 1): string {
  const start = Date.UTC(2025 + season, 7, 16) // season opens mid-August with pre-season
  const d = new Date(start + ((week - 1) * 7 + (dayOff ?? fixtureDayOff(fxId))) * 86400000)
  return `${dayAbbr(d.getUTCDay())} ${d.getUTCDate()} ${monthName(d.getUTCMonth())}`
}

export function seasonLabel(season: number): string {
  const y = 2025 + season
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
}

export const POS_ORDER: Pos[] = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB']

export const POS_NAMES: Record<Pos, string> = {
  LP: 'Loosehead Prop', HK: 'Hooker', TP: 'Tighthead Prop', LK: 'Lock',
  FL: 'Flanker', N8: 'Number 8', SH: 'Scrum-Half', FH: 'Fly-Half',
  CE: 'Centre', WG: 'Wing', FB: 'Full-Back',
}

/** XV slot -> required position (index 0..14 = shirts 1..15) */
export const XV_SLOTS: { shirt: number; pos: Pos; label: string }[] = [
  { shirt: 1, pos: 'LP', label: 'LP' },
  { shirt: 2, pos: 'HK', label: 'HK' },
  { shirt: 3, pos: 'TP', label: 'TP' },
  { shirt: 4, pos: 'LK', label: 'LK' },
  { shirt: 5, pos: 'LK', label: 'LK' },
  { shirt: 6, pos: 'FL', label: 'BF' },
  { shirt: 7, pos: 'FL', label: 'OF' },
  { shirt: 8, pos: 'N8', label: 'N8' },
  { shirt: 9, pos: 'SH', label: 'SH' },
  { shirt: 10, pos: 'FH', label: 'FH' },
  { shirt: 11, pos: 'WG', label: 'LW' },
  { shirt: 12, pos: 'CE', label: 'IC' },
  { shirt: 13, pos: 'CE', label: 'OC' },
  { shirt: 14, pos: 'WG', label: 'RW' },
  { shirt: 15, pos: 'FB', label: 'FB' },
]

/** Bench slots 16-23: cover requirements */
export const BENCH_SLOTS: { shirt: number; pos: Pos[] }[] = [
  { shirt: 16, pos: ['HK'] },
  { shirt: 17, pos: ['LP', 'TP'] },
  { shirt: 18, pos: ['TP', 'LP'] },
  { shirt: 19, pos: ['LK', 'FL'] },
  { shirt: 20, pos: ['FL', 'N8', 'LK'] },
  { shirt: 21, pos: ['SH'] },
  { shirt: 22, pos: ['FH', 'CE'] },
  { shirt: 23, pos: ['CE', 'WG', 'FB', 'FH'] },
]

/** The board's stated aim for the season, from club stature. */
/** `text` is an i18n key: screens t() it, the board's letters tIn('en', …) it. */
export function boardObjective(rep: number): { text: string; pos: number } {
  if (rep >= 87) return { text: 'objectives.boardTitle', pos: 1 }
  if (rep >= 80) return { text: 'objectives.boardPlayoffs', pos: 6 }
  if (rep >= 72) return { text: 'objectives.boardTopHalf', pos: 7 }
  return { text: 'objectives.boardSurvive', pos: 12 }
}

/**
 * How thin a boardroom's patience is, scaled by the club's own stature.
 *
 * Design review, wave 2: "board patience scales with stature - at a giant,
 * second place is a crisis, and an absent manager there is sacked by March;
 * at a minnow, survival buys years of goodwill." Before this every board
 * reacted to a swing the same way regardless of who they were, which is why
 * a title challenger sliding to 5th felt no different to the boardroom than
 * a relegation battler doing the same - both a comfortable mid-table finish
 * for one and a crisis for the other, on the SAME number.
 *
 * A straight line across the real club pool (rep 38..93, same anchors
 * archetypeWeights uses in oppcoach.ts, so "how sharp the opposition reads
 * you" and "how patient your own board is" move on the same real-world
 * scale): 0.55x at the weakest club in the game, 2.05x at the strongest.
 * Applied as a multiplier on the SWING, never on the floor or ceiling a
 * confidence value can reach - a giant's board still cannot be pushed past
 * 100, and a minnow's board still cannot be dragged below the sack line by
 * one bad afternoon it was always going to shrug off.
 */
export function boardPatience(rep: number): number {
  const t = Math.max(0, Math.min(1, (rep - 38) / (93 - 38)))
  return 0.55 + t * 1.50
}

/**
 * A WAGE, at a precision a manager can actually use.
 *
 * fmtMoney rounds to the nearest thousand, which is right for fees and balances
 * and wrong for wages: it printed £8,600 and £9,400 as the same "£9k", so two
 * players on visibly different money looked identical in a squad list, and a
 * camp asking £12,500 was quoted back as "£13k" by the row underneath. Reported
 * as "wages should be clearer on the players".
 *
 * One decimal below £100k is enough to separate anybody in this game, and it
 * stays within six characters, so no table column has to grow to carry it.
 */
export function fmtWage(v: number): string {
  if (!Number.isFinite(v)) return '-'
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a < 1_000) return `${sign}£${Math.round(a)}`
  if (a < 100_000) {
    const k = a / 1_000
    // one decimal, but never a pointless ".0"
    const t = k >= 99.95 ? '100' : k.toFixed(1).replace(/\.0$/, '')
    return `${sign}£${t}k`
  }
  return `${sign}£${Math.round(a / 1_000).toLocaleString()}k`
}

/**
 * The three-letter club code: NOR, BAT, SAR.
 *
 * One derivation, because there were two and they disagreed. The crest stripped
 * non-letters before taking three (`short.replace(/[^A-Za-z]/g, '')`), the pitch's
 * zone labels did not (`teamShort(...).slice(0, 3)`), so a club whose short name
 * carries a space or a full stop in its first three characters got one code on its
 * badge and a different one on the touchline. A code the player is meant to
 * recognise has to be the same code everywhere it appears.
 */
export function clubCode(short: string): string {
  return short.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'RUG'
}

export function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  const K = 1_000, M = 1_000_000, B = 1_000_000_000
  // Two things, both found by walking this ladder end to end in
  // scripts/extremes.ts after running a club up to fifty billion on purpose.
  //
  // One: there is a billions tier now. The scale stopped at millions, so a very
  // rich club read "£18015m" - seven digits crammed into a phone table cell.
  //
  // Two, and this one bites at ordinary money: the tier is chosen AFTER
  // rounding, not before. £999,600 used to round up inside the thousands tier
  // and print "£1000k" rather than "£1.0m", and the same edge printed "£1000m"
  // just under a billion. Any balance can sit on that edge.
  if (a >= B || Math.round(a / M) >= 1000) return `${sign}£${(a / B).toFixed(a >= 10 * B ? 0 : 1)}bn`
  if (a >= M || Math.round(a / K) >= 1000) return `${sign}£${(a / M).toFixed(a >= 10 * M ? 0 : 1)}m`
  if (a >= K) return `${sign}£${Math.round(a / K)}k`
  return `${sign}£${a}`
}
