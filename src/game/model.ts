import type { Pos } from '../data/types'

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
}

export const emptyStats = (): SeasonStats => ({
  apps: 0, starts: 0, tries: 0, points: 0, cons: 0, pens: 0, drops: 0,
  yc: 0, rc: 0, ratingSum: 0, motm: 0, mins: 0,
})

/** 1,300+ minutes (~17 full games) is the red zone: tired bodies break. */
export const inRedZone = (p: { stats: { mins: number } }) => p.stats.mins >= 1300

/** Partnership chemistry: lineup slot pairs whose familiarity matters -
 *  LH-HK, HK-TH, the lock pairing, the halfbacks, the centres. */
export const CHEM_SLOTS: [number, number][] = [[0, 1], [1, 2], [3, 4], [8, 9], [11, 12]]
export const chemKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)
export const chemTier = (g: number) =>
  g >= 50 ? 'telepathic' : g >= 25 ? 'established' : g >= 10 ? 'settled' : g >= 5 ? 'settling in' : 'brand new'

/** Appearances this player made for a club he has since left - 0 if he is
 *  still there. Fuels the old-boy storyline when the fixture list brings
 *  him back to a former home. */
export function oldBoyApps(p: Player, clubId: string): number {
  if (p.clubId === clubId) return 0
  let apps = p.exClub === clubId ? (p.exApps ?? 0) : 0
  for (const r of p.career) if (r.clubId === clubId) apps += r.apps
  return apps
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
  balanceDelta: number
  confidence: number
  trophies: string[]
}

/** Live grudge between two clubs, if any. */
export const grudgeBetween = (state: GameState, x: string, y: string) =>
  state.grudges?.find(g => ((g.a === x && g.b === y) || (g.a === y && g.b === x)) && g.until >= state.season) ?? null

/** Record (or refresh) bad blood between two clubs; news if the user is in it. */
export function addGrudge(state: GameState, a: string, b: string, reason: string, seasons = 2) {
  if (!state.clubs[a] || !state.clubs[b] || a === b) return
  state.grudges ??= []
  const ex = state.grudges.find(g => (g.a === a && g.b === b) || (g.a === b && g.b === a))
  if (ex) { ex.reason = reason; ex.until = Math.max(ex.until, state.season + seasons); return }
  state.grudges.push({ a, b, reason, until: state.season + seasons })
  if (a === state.userClubId || b === state.userClubId) {
    const opp = a === state.userClubId ? b : a
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
      subject: `🔥 Bad blood with ${state.clubs[opp].short}`,
      body: `There is genuine needle between the clubs now - ${reason}. The next meeting will be spicy: expect cards, a hostile crowd and a match where the form book means nothing.`,
    })
  }
}

export interface Injury {
  desc: string
  /** week the player returns */
  until: number
  /** total weeks out (severity), used to size the rusty spell afterwards */
  weeks?: number
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
  /** signature trait - a defining edge (or flaw) in his game */
  trait?: string | null
  /** estimated career before the game world began (2025-26) */
  hist?: { apps: number; tries: number; points: number }
  /** Test caps, pre-2025 estimate plus every international played here */
  caps?: number
  /** pre-2025 former club (same league), for old-boy stories from day one */
  exClub?: string | null
  /** appearances made at that former club before 2025 */
  exApps?: number
  /** the user's scouting knowledge of this player, 0-100 */
  sc: number
  /** away on a season loan */
  onLoan?: boolean
  /** ability at the start of the season, for development arrows */
  ca0?: number
  /** weeks of match rust remaining after an injury - playable, but a
   *  rushed return carries a much higher re-injury risk */
  rust?: number
  /** last match rating and the week it was earned - fuels Team of the Week */
  lastR?: number
  lastWk?: number
  talkWk?: number // absolute week (season*100+week) of the manager's last word with him
  /** week his agent demanded improved terms (0/undefined = content) */
  wantsDeal?: number
  /** the current injury has already had its specialist consult */
  specialist?: boolean
  /** in the academy squad - hidden from first-team auto-selection until promoted */
  acad?: boolean
  /** parent club when this player is on loan AT the user's club */
  loanFrom?: string | null
}

export interface Club {
  id: string
  name: string
  short: string
  city: string
  country: string
  stadium: string
  capacity: number
  colors: [string, string]
  rep: number
  leagueId: string
  budget: number
  balance: number
  players: number[] // player ids
  // user/AI tactics
  tactic: Tactic
  // finance
  wageBudget: number
  boardConfidence: number // 0-100
  /** club captain - a real leader on the pitch steadies the whole side */
  captain?: number | null
  /** vice-captain: leads at reduced effect when the skipper is missing */
  vice?: number | null
  /** the record book: 100+ app servants, written in at retirement */
  legends?: { name: string; apps: number; tries: number; pts: number }[]
  /** marquee designations - their wages sit outside the cap (max 2) */
  marquee?: number[]
  /** the AI head coach's name (yours shows the manager name) */
  coach?: string
}

export interface Tactic {
  style: number      // 0 forwards-oriented .. 100 expansive
  tempo: number      // 0 slow .. 100 fast
  kicking: number    // 0 keep in hand .. 100 kick heavy
  aggression: number // 0 clean .. 100 physical
  lineup: (number | null)[] // 23 slots: player ids, index 0-14 XV, 15-22 bench
  /** positional role per XV slot (role ids from roles.ts), sparse */
  roles?: (string | null)[]
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
}

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
}

export type TrainingFocus = 'balanced' | 'scrum' | 'lineout' | 'attack' | 'defence' | 'fitness' | 'kicking'

export interface MatchEvent {
  min: number
  type: 'TRY' | 'CON' | 'PEN' | 'DG' | 'YC' | 'RC' | 'INJ' | 'SUB' | 'HT' | 'FT' | 'KO' | 'BRK'
  teamId: string
  playerId?: number
  playerName?: string
  text: string
  homeScore: number
  awayScore: number
}

export interface NewsItem {
  id: number
  week: number
  season: number
  type: 'result' | 'transfer' | 'injury' | 'intl' | 'board' | 'award' | 'contract' | 'general' | 'youth' | 'gossip'
  subject: string
  body: string
  read: boolean
  /** optional linked entity */
  playerId?: number
  fixtureId?: number
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
}

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
}

/** Club infrastructure, levels 0-3 - bricks and mortar that outlast any squad. */
export type FacilityId = 'gym' | 'kicking' | 'paddock' | 'briefing' | 'academy'
export const FACILITY_INFO: Record<FacilityId, { name: string; icon: string; desc: string; base: number }> = {
  gym: { name: 'Strength & Conditioning Gym', icon: '🏋️', desc: 'Players recover extra condition every week.', base: 350_000 },
  kicking: { name: 'Kicking Enclosure', icon: '🥅', desc: 'Sharper goal-kicking in every match.', base: 300_000 },
  paddock: { name: 'Training Paddock', icon: '🌱', desc: 'Attribute training bites more often.', base: 400_000 },
  briefing: { name: 'Tactical Briefing Room', icon: '📽️', desc: 'Match preparation lands harder.', base: 380_000 },
  academy: { name: 'Centre of Excellence', icon: '🎓', desc: 'Better academy intakes, more wonderkids.', base: 500_000 },
}
export const facilityCost = (info: { base: number }, level: number) => info.base * (level + 1)

export interface StaffLevels {
  assistant: number // 0-3: training gains
  physio: number    // 0-3: injury length & recovery
  scout: number     // 0-3: knowledge gathering speed
  attack: number    // 0-3: attack coach - sharper strike play on matchday
  defence: number   // 0-3: defence coach - tighter line speed and shape
  scrumCoach: number // 0-3: set-piece coach - scrum & lineout platform
  kicking: number   // 0-3: kicking coach - territory game and goal kicking
  academyCoach: number // 0-3: academy coach - develops the second squad
}

export const STAFF_INFO: Record<keyof StaffLevels, { name: string; desc: string; wage: number }> = {
  assistant: { name: 'Assistant Coach', desc: 'Sharper sessions - bigger training gains, faster youth growth.', wage: 4000 },
  physio: { name: 'Head Physio', desc: 'Shorter injury layoffs and quicker recovery between matches.', wage: 3000 },
  scout: { name: 'Chief Scout', desc: 'Faster, wider scouting knowledge across the leagues.', wage: 2500 },
  attack: { name: 'Attack Coach', desc: 'Strike moves and shape - a sharper attack every matchday, bigger attacking training gains.', wage: 3500 },
  defence: { name: 'Defence Coach', desc: 'Line speed and system - a meaner defence every matchday, bigger defensive training gains.', wage: 3500 },
  scrumCoach: { name: 'Set-Piece Coach', desc: 'Scrum and lineout platform - the tight five win you matchday penalties.', wage: 3000 },
  kicking: { name: 'Kicking Coach', desc: 'Territory and the tee - better tactical kicking and goal kicking under pressure.', wage: 2500 },
  academyCoach: { name: 'Academy Coach', desc: 'Runs the second squad - academy prospects develop faster under a proper mentor.', wage: 2500 },
}

export interface ManagerStats {
  m: number; w: number; d: number; l: number
  trophies: { compId: string; season: number }[]
  finishes: { season: number; leagueId: string; pos: number }[]
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
  managerName: string
  training: TrainingFocus
  /** this week's match preparation - a short-term matchday emphasis,
   *  distinct from long-term training (which grows attributes) */
  matchPrep?: 'attack' | 'defence' | 'setpiece' | 'fitness' | 'recovery'
  shortlist: number[]
  staff: StaffLevels
  mgr: ManagerStats
  challenge?: string
  /** open managerial vacancies at AI clubs */
  vacancies: { clubId: string; week: number; applied?: boolean }[]
  /** up to 3 young players given individual development attention */
  devFocus: number[]
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
  /** facility levels 0-3 for the user's club */
  facilities?: Partial<Record<FacilityId, number>>
  /** a trophy moment waiting to be celebrated full-screen */
  celebration?: { headline: string; sub: string; icon: string } | null
  /** senior pros paired with academy kids - wisdom rubs off (max 3) */
  mentors?: { senior: number; kid: number }[]
  /** all-time single-season records per league (points / tries) */
  records?: Record<string, { pts: { name: string; val: number; season: number }; tries: { name: string; val: number; season: number } }>
  /** games played together by key partnerships (front row, locks, halfbacks,
   *  centres) - familiarity sharpens the relevant unit. Key: chemKey(a, b) */
  chem?: Record<string, number>
  /** dynamic bad blood between clubs: cup eliminations, poached stars,
   *  ill-tempered matches. Expires after `until` season. */
  grudges?: { a: string; b: string; reason: string; until: number }[]
  /** structured snapshot of the user's last completed season */
  review?: SeasonReview | null
  /** terrace mood at the user's club, 5-98 - swings with results, colours
   *  the matchday atmosphere and nudges home advantage */
  fanMood?: number
  /** the game's Hall of Fame: careers immortalised at retirement */
  hof?: { name: string; pos: Pos; nat: string; apps: number; tries: number; points: number; season: number; club: string }[]
  /** league the scouting network is assigned to watch weekly */
  scoutFocus?: string | null
  /** open promises made to players in the office, settled at their due week */
  pledges?: Pledge[]
  /** Scouting Agency monthly rankings: last month's order + best-ever ranks */
  agency?: { seniors: number[]; kids: number[]; best: Record<number, number> }
  /** shortlist players already alerted about this season */
  slAlerted?: number[]
  /** absolute week (season*100+week) the cotton-wool pick was last used */
  cottonWk?: number
  /** the user's hand-picked Test 23 for the current window */
  natLineup?: { team: string; lineup: (number | null)[] } | null
}

/** Managerial reputation earned from results and silverware, 30-95. */
export function mgrReputation(state: GameState): number {
  const m = state.mgr
  const winPct = m.m ? m.w / m.m : 0.4
  const seasons = m.finishes.length
  return Math.min(95, Math.round(34 + winPct * 46 + m.trophies.length * 7 + seasons * 1.5))
}

/** World Cup years: 2027, 2031, ... (in-game season index) */
export function isWorldCupSeason(season: number): boolean {
  return (2025 + season) % 4 === 3
}

export const SEASON_WEEKS = 45

/** Convert (season, week) to a display date. Season 0 week 1 = Sat 6 Sep 2025. */
export function weekDate(season: number, week: number): string {
  const start = Date.UTC(2025 + season, 7, 16) // season opens mid-August with pre-season
  const d = new Date(start + (week - 1) * 7 * 86400000)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Which day this fixture kicks off: -1 Friday, 0 Saturday, +1 Sunday.
 *  Fixed per fixture, so previews, reports and recovery all agree. */
export function fixtureDayOff(fxId: number): -1 | 0 | 1 {
  const h = (fxId * 2654435761) >>> 0
  return h % 3 === 0 ? -1 : h % 3 === 2 ? 1 : 0
}

/** 'Friday 5 Sep' - the real kick-off date for a fixture. */
export function fixtureDate(season: number, week: number, fxId: number): string {
  const start = Date.UTC(2025 + season, 7, 16) // season opens mid-August with pre-season
  const d = new Date(start + ((week - 1) * 7 + fixtureDayOff(fxId)) * 86400000)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`
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
export function boardObjective(rep: number): { text: string; pos: number } {
  if (rep >= 87) return { text: 'win the title', pos: 1 }
  if (rep >= 80) return { text: 'reach the playoffs', pos: 6 }
  if (rep >= 72) return { text: 'finish in the top half', pos: 7 }
  return { text: 'stay clear of the bottom two', pos: 12 }
}

export function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${sign}£${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}m`
  if (a >= 1_000) return `${sign}£${Math.round(a / 1000)}k`
  return `${sign}£${a}`
}
