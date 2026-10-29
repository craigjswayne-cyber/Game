// The shapes of a save: the player, the club, the fixture, the story, the
// game state itself. Types only, so any module can import them without
// pulling in code (model.ts re-exports all of it).
import type { Pos } from '../../data/types'
import type { Vars } from '../i18n'
import type { LiveStamp } from '../resume'

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

export interface SeasonStats {
  apps: number
  /** A League (academy) appearances, kept apart from the senior count (AWARD-01). */
  acadApps?: number
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

/** One season of a man's club career (Player.career), or, in careerOld, every
 *  season at one club older than the table keeps; season is then the latest. */
export type CareerRow = { season: number; clubId: string; apps: number; tries: number; points: number }

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

export type Weather = 'Dry' | 'Damp' | 'Rain' | 'Wind' | 'Snow'

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
  /** the ceiling has been through ageing.ts softCeilings (1.8.14) */
  paN?: 1
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
  career: CareerRow[]
  /** The seasons career no longer lists, summed per club (1.8.3). career keeps
   *  the newest CAREER_ROWS seasons for the table on his page; a row folded
   *  out of it lands here, so every total and every club tally still counts
   *  it (careerRows). Absent until a career outgrows the table; a row cut
   *  before 1.8.3 is gone and nothing can bring it back. */
  careerOld?: CareerRow[]
  transferListed: boolean
  /** Put up for sale in his AI club's summer clear-out (rivalbids.ts
   *  aiSummerMarket): taken back off the list when the window shuts. */
  clearOut?: boolean
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
  /** Isles XV tours made - the honour of a career.
   *
   *  THE FIELD KEEPS ITS OLD NAME ON PURPOSE. It is written into every save
   *  ever made, and renaming it would mean a migration that buys nothing: no
   *  player ever sees the word. What they see is the display name, and that is
   *  now the British & Irish Isles XV (owner, 7 Sep: "we shouldn't say Lions").
   */
  lions?: number
  /** World Championships won while in the squad - the other honour of a career */
  wcWins?: number
  /** pre-2025 former club (same league), for old-boy stories from day one */
  exClub?: string | null
  /** appearances made at that former club before 2025 */
  exApps?: number
  /** TRAINING'S OWED CHANGE (1.8.0, ageing.ts trainPoint): the part of a
   *  trained point not yet paid for by a point elsewhere, in rating units.
   *  Carried so the books balance exactly over a season. */
  tdebt?: number
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
  /** POTENTIAL THAT MOVES (1.8.2, devproject.ts): the ceiling he started
   *  with, written the first time a season review moves it, so the drift is
   *  bounded either side of it. Absent means it has never moved. */
  pa0?: number
  /** HIS DEVELOPMENT TIMELINE (1.8.2, devproject.ts seasonReview): one row a
   *  season while he is the manager's, [season, rating at its end, moment
   *  flags (devproject TL)], the last twelve. Absent for everybody else. */
  tl?: [number, number, number][]
  /** starts made LAST season, stashed before the summer stats wipe so the
   *  development roll can ask how much rugby the year actually held (25D:
   *  a 20-year-old parked on the bench stops growing) */
  lastStarts?: number
  /** weeks of match rust remaining after an injury - playable, but a
   *  rushed return carries a much higher re-injury risk */
  rust?: number
  /** last match rating and the week it was earned - fuels Team of the Week */
  lastR?: number
  /** The last ten match ratings, oldest first (v1.2.7). One form pill and one
   *  last rating could not answer "is he declining or did he have a bad week";
   *  ten in a row can. Appended where lastR is written; capped at ten. */
  ratings?: number[]
  /** Every injury he has had in this career, oldest first (v1.2.7): the
   *  season and week it happened, the complaint's key and the weeks it cost.
   *  A fragile man and an unlucky one look identical with only the current
   *  injury stored. Capped at twenty entries. */
  injLog?: { s: number; w: number; dk: string; weeks: number }[]
  lastWk?: number
  talkWk?: number // retired v1.1.4 with talkToPlayer (chats.ts uses lastChatWk); kept so old saves load
  /** week his agent demanded improved terms (0/undefined = content) */
  wantsDeal?: number
  /** the season he last signed a renewal with the user's club (1.6.3). One
   *  new deal a season: re-signing him at his own demand was free and gave a
   *  point of morale every time, so a whole squad could be pumped to 10 in
   *  one week (scripts/qa/exploit.ts: 96 of 96 accepted). */
  renewedSeason?: number
  /** week a formal transfer request landed (17A): the game-time ledger's
   *  escalation when a key or rotation man is badly short-changed. 0 or
   *  absent means no request. Cleared when the team sheets make it right,
   *  and moot when he is sold. */
  wantsOut?: number
  /** ABSOLUTE week the manager answered that request, either way.
   *
   *  The request used to be a notice rather than a question: it landed on the
   *  desk, and the only replies the game understood were selling him or
   *  playing him. Owner: "when someone makes a transfer request the user
   *  should have the ability to accept or reject this - causing a morale
   *  impact on camp/the player."
   *
   *  So an answer is recorded here. It stops the ledger asking again the
   *  following week, and it is what lets a refusal wear off: a man told no,
   *  who is still being left out months later, asks again. Cleared with
   *  wantsOut whenever the minutes make it right. */
  reqAns?: number
  /** A request that cannot be withdrawn (handshake.ts): the id of the club he
   *  handed it in at after a broken promise of a start. Lapses when he leaves. */
  reqLock?: string
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
  /** Playing through a knock (knock.ts): an injury near its end that the
   *  manager chose to send him out on. Available, short of a full tank, and
   *  every match he plays is a roll on it flaring up. Never a head injury. */
  knock?: {
    dk: string; desc: string
    /** the week the physio had him down as fit */
    until: number
    /** the original lay-off, which sizes a flare-up */
    weeks: number
    /** weeks early he was sent out: the flare-up risk reads it */
    early: number
    /** his minutes when last looked at: more since means he played on it */
    mins: number
  }
  /** A medical joker (joker.ts): the id of the injured man he was signed to
   *  cover. His wage is outside the salary cap while this is set, and he
   *  leaves when that man is fit, leaves the club, or the season ends. */
  joker?: number
  /** has announced this is his final season: retires at the rollover.
   *  Set at the midwinter announcement for every player aged 37+ */
  retiring?: boolean
  /** playing his farewell season: testimonial granted, retires in summer */
  farewell?: boolean
  /** World Player of the Year awards won */
  poty?: number
  /** in the academy squad - hidden from first-team auto-selection until promoted */
  acad?: boolean
  /** The season he joined an academy, as an intake scholar (1.8.1). The summer
   *  decision reads it: a first-year is signed or released at the end of his
   *  first season. Absent on anybody who arrived before it was stamped. */
  acadJoined?: number
  /** Sent down from the first team by hand (v1.1.18). An academy flag for
   *  selection purposes ONLY: he still counts against the salary cap (cap.ts
   *  - otherwise demotion is a cap dodge) and the season-end academy sweep
   *  leaves him alone (rollover.ts - otherwise a demoted 29-year-old is
   *  released for nothing as an over-age "youth"). */
  demoted?: boolean
  /** came through THIS club's academy and was promoted to the seniors. Set once
   *  at promotion and never cleared, because it is a fact about where he learned
   *  the game, not about where he plays now (dream.ts reads it). */
  homegrown?: boolean
  /** the club whose academy he graduated from, and the season (records.ts
   *  proteges): homegrown alone is set for every club's graduates, so "the men
   *  you made" needs to know whose they were. Absent on graduates from before
   *  1.8.2 until save.ts reads them in from his first career row. */
  gradClub?: string
  gradS?: number
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
  /** Signed by the manager out of the free-agent pool: the season that deal
   *  runs to. Until then a club bids for him only if its income could have
   *  carried him when he was free (ai.ts freeDeal). Cleared when he moves. */
  freeUntil?: number
  /** The rating he arrived on loan with. Read by the loan-to-buy option: a
   *  parent club that lent out a boy will sell him, unless the months at your
   *  place turned him into somebody they want back. Without this the "if things
   *  go well" half of the option has nothing to measure against. */
  loanCa?: number
  /** parent club when this player is on loan AT the user's club */
  loanFrom?: string | null
  /** absolute week (season * SEASON_WEEKS + week) a loan-in ends early;
   *  absent = the end of the season, as every loan was before v1.2.8 */
  loanUntil?: number
  /** the share of his wage the borrowing club pays (0.25 .. 1); absent = the
   *  half every pre-v1.2.8 loan was struck at */
  loanShare?: number
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
  /**
   * ---- MATERNITY LEAVE ----
   *
   * Owner, 6 Sep 2026, asking for it and fencing it in the same breath: "for
   * maternity this isnt something for everyone - make sure this is only on
   * fictional players."
   *
   * That fence is the important half. 1,255 of the women in this game are real,
   * living people, off the owner's own squad sheets and the competition team
   * pages. Giving one of them a pregnancy the game invented would be inventing a
   * private life event about a real individual and putting her name on it. That
   * is not the game's to invent, whatever the simulation gains.
   *
   * So the gate is `!p.real`, and it is checked at the one place leave is
   * granted rather than trusted to whoever edits this next. Generated players
   * are nobody, which is exactly what makes them the right ones to model a real
   * career interruption on.
   *
   * THIS NOTE USED TO SAY "every NAMED player in this game is a real, living
   * person - 1,339 of them", and that sentence was the bug. 841 of the women are
   * invented, the French second tier and the whole English Championship, because
   * no reachable source carries those squads. newgame.ts stamped `p.real = true`
   * on everyone who came out of a data file, so the gate saw 2,096 real women and
   * could choose none of them: leave fell only on the generated academy and squad
   * fill, never on a league squad player. Ten women's seasons ran 126 leaves
   * before and 187 after. The data says which is which now (RawPlayer.gen), the
   * engine reads it, and scripts/genprobe.ts holds the counts so the claim cannot
   * drift back.
   *
   * `until` is an absolute game-week like Injury.until. `from` is kept so the
   * rollover knows a season was missed and can push the contract out rather
   * than running it down while she is not playing.
   */
  maternity?: { until: number; from: number }
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
  /** weeks since the builders were last on this ground, capped. Drives how
   *  likely the wear-and-tear stories are in upkeep.ts, and a new stand
   *  resets it: concrete that has just been poured does not leak. */
  wear?: number
  /** how much bigger this club's support has grown than the day it opened,
   *  1 at kick-off and earned a season at a time by filling the ground
   *  (rollover.ts). Multiplies capacity0 inside demandCeiling. */
  following?: number
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
  /** the season's opening transfer budget, snapshotted at kick-off and at
   *  every rollover: the base a board injection is priced on (grants.ts), so
   *  the store row's figure holds all season and spending cannot devalue it */
  budgetAtOpen?: number
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
  /** the coin that named the coach - see StaffPerson.g */
  coachGender?: import('../gender').Gender
  /** the head coach's standing instruction (F23) - an id from philosophy.ts.
   *  Absent on the club you manage: your dials are yours. */
  philosophy?: string
  /** how many head coaches this club has been through, so the next man's ideas
   *  are drawn afresh rather than inherited */
  coachGen?: number
  /** THE PLAN FOR YOU (1.8.0, E9, oppcoach.ts setUpForUser): set the week
   *  this club plays the manager, when it respects him, and undone the week
   *  after. `base` is the club's own dials to put back, `ph` the philosophy
   *  they belong to (a new coach in the meantime keeps his own), `r` how much
   *  respect, `unit` the weakness it goes after. Absent on most weeks and on
   *  every save written before it. */
  vsUser?: { ph: string; base: Pick<Tactic, 'style' | 'tempo' | 'kicking' | 'aggression' | 'defLine' | 'defWidth' | 'kickStyle' | 'ruckContest'>; r: number; unit?: string }
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
  /** ---- THE ZONAL GAME PLAN (v1.8.0) ----
   *  What this side does in its own 22, the middle third and the opposition
   *  22, by the plan ids in tactics.ts. Absent means the neutral plan in
   *  every zone, which is exactly the engine as it was before field position
   *  existed - so an old save plays identically until somebody chooses. */
  zones?: { own22?: string; middle?: string; opp22?: string }
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
  /** KICKING STYLE (1.7.3): what kind of kick, where the slider above says how
   *  many. Absent is 'balanced', and balanced is exactly the engine as it was. */
  kickStyle?: 'territory' | 'contest' | 'attack' | 'balanced'
  /** THE BREAKDOWN (1.7.3), both 0..100, absent reading as 50 (no effect).
   *  ruckCommit: how many you commit to your own ruck - few keeps men in the
   *  line to attack with, many keeps the ball. ruckContest: how hard you go
   *  after theirs - fan out and hold the line, or counter-ruck and jackal. */
  ruckCommit?: number
  ruckContest?: number
  /** Standing instruction on a kickable penalty. 'ask' keeps the touchline
   *  prompt; anything else answers it for you, which matters on a phone. */
  penaltyCall?: 'ask' | 'posts' | 'corner' | 'tap'

  // ---- the set-piece playbook (F2) ----------------------------------------
  /** the lineout and scrum routines you are drilling and calling */
  lineoutCall?: string
  scrumCall?: string

  // ---- the attacking moves (1.8.1, moves.ts) --------------------------------
  /** The strike move run off our lineout and off our scrum, and the shape we
   *  play in open phases. Absent is no call: exactly the engine before moves
   *  existed. Drilled in the same Playbook as the set-piece routines. */
  moveLineout?: string
  moveScrum?: string
  moveShape?: string
  /** THE PLAYBOOK (1.8.2, armsrace.ts), the manager's only: the primary and
   *  the secondary strike off first-phase ball, the primary's share of the
   *  ball both can run off (50-90, two in three unset), and the red-zone
   *  play for the opposition 22. moveShape above is the base shape. An old
   *  save's lineout and scrum calls become the primary and the secondary
   *  (save migration), and moveLineout/moveScrum are then left unset. */
  moveMain?: string
  moveAlt?: string
  moveMix?: number
  moveRed?: string
  /** THE PENALTY SLOT (round 6): the tap penalty play the side runs when it
   *  takes a quick tap. Whether it taps is penaltyCall's (above). An old
   *  save's tap play in the red-zone slot moves here (save migration). */
  movePen?: string

  // ---- the attack and defence styles (1.8.2, styles.ts) ---------------------
  /** The side's overall game with the ball and without it, by style id. A
   *  style is a preset over the dials above plus a small effect of its own;
   *  absent (an old save) is read off the dials as the nearest style, and
   *  the save migration writes that in. AI clubs' come from their coach. */
  atkStyle?: 'direct' | 'pods' | 'width' | 'kick' | 'offload'
  /** Where the forwards stand in a pod game (styles.ts PodShape): 1-3-3-1,
   *  2-4-2 or one-out round the nine. Read only while atkStyle is 'pods';
   *  absent is the 1-3-3-1, the Pods style as it always was. */
  podShape?: '1331' | '242' | 'nine'
  defStyle?: 'drift' | 'blitz' | 'pendulum' | 'man' | 'choke'

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
  /** THE ARMS RACE (1.8.2, armsrace.ts), the manager's club only. reps: the
   *  matches each attacking call has been in the playbook for (the side's own
   *  familiarity with it); faced: the first-phase possessions each strike has
   *  been run on, fading match by match (what the opposition's analysts have
   *  on tape); tallied: the last fixture counted, so a replay counts once. */
  reps?: Record<string, number>
  faced?: Record<string, number>
  tallied?: string
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
  /** A knockout tie still level after extra time (1.8.16): settled on tries
   *  scored, then a place-kick competition. The score stays level, as it
   *  does in the real competition, so the winner is kept here (tieWinner). */
  decider?: { by: 'tries' | 'kicks'; winner: string; kicks?: [number, number] }
  /** points scored in extra time, home and away, when there was any */
  aet?: [number, number]
  tableApplied?: boolean
  motm?: number
  weather?: Weather
  derby?: boolean
  /** this friendly is a testimonial for the named player - his day */
  testimonial?: number
  /** A provincial game on a tour: it counts for the tourists' momentum and the
   *  players' minutes, but it is not a Test and never touches the series table. */
  tourMatch?: boolean
  /** Played on the Wednesday rather than the weekend. A touring party plays
   *  twice a week - a midweek side and a Test side - which is the one place in
   *  this game where a team legitimately appears twice in the same week. */
  midweek?: boolean
  /** A midweek friendly the assistant runs with a development side. The flag
   *  is what keeps it out of the manager's own Saturday: the settle plays it,
   *  the academy get the minutes, and it never becomes the match he coaches. */
  devSide?: boolean
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
  /** where the engine had the ball when the line was called, 0 at the home
   *  side's own line and 100 at the away side's (1.7.4): the pitch draws the
   *  play there instead of guessing it from momentum. Absent on events written
   *  by an older build. */
  fld?: number
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
  fx?: 'SCRUM' | 'LINEOUT' | 'MAUL' | 'MISS' | 'TMO' | 'NOTRY'
  homeScore: number
  awayScore: number
}

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
  /** The bid on the manager's desk this story is about (1.8.18), so the reader
   *  can offer the way to answer it while, and only while, it is still open.
   *  Absent on older saves and on every story that is not a bid. */
  offerId?: number
  /** Filed away by the manager. The story stays in state - the Wire, the season
   *  review and the history all read this list - it simply stops appearing in the
   *  inbox reader. */
  cleared?: boolean
  /** The day of the week (0 Monday .. 5 Saturday) the story belongs to, when
   *  it is not the day its type gives it (days.ts dayOfStory): the transfer
   *  window's countdown is posted on the day it counts down to (window.ts). */
  day?: number
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
  /** WHO FILED IT, when it was not the game's own neutral voice (1.8.7).
   *
   *  The owner agreed with Ruck, the UK rugby site, that it is the named source
   *  for the news about everybody else: other clubs' business, the rumour mill,
   *  signings around the league, and the law-change talk. Stories about the
   *  manager's OWN club keep the neutral voice they always had, and the SOCIAL
   *  clips stay SOCIAL. The byline is text, "RUCK.CO.UK" in the game's own type, and
   *  it is display-only: subject and body above are untouched, so nothing the
   *  engine reads back changes. Absent on every story filed before this field
   *  existed, and on every story that is not Ruck's, which reads as no byline. */
  src?: 'ruck'
}

export interface PressOption {
  /** the English label, kept because it is written onto answered items and
   *  those are saved. New items also carry lk/lv and the screen renders those. */
  label: string
  /** the label's key, and the variables it needs */
  lk?: string
  lv?: Vars
  /** the reaction's key, and the variables it needs */
  rk?: string
  rv?: Vars
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
  /** what that week costs or pays THIS club, quoted on the button and spent on
   *  resolution. Stored rather than recomputed so a transfer between asking and
   *  answering cannot change the price of a camp already agreed. Absent on the
   *  community week, which costs nothing, and on saves made before the figures
   *  were scaled to the club at all. */
  campMoney?: number
  /** agreeing to a loan actually sends him. Saying yes and then leaving the
   *  manager to go and find the Transfers screen is how a lad ended up asking
   *  the same question a week after his boss agreed to it. */
  loan?: boolean
  /** the summer sponsorship decision (25C): choosing an option SIGNS the deal
   *  there and then. `offer` is the offer the button named, stored when the
   *  question was built (1.8.1): offersFor is deterministic on the slot's
   *  reroll counter and the club's reputation as well as the season, and
   *  either can move between asking and answering. Old saves have no offer
   *  and fall back to asking offersFor again. kind 'keep' stays with the
   *  department's stopgap. */
  deal?: { slot: string; kind: 'long' | 'short' | 'clause' | 'keep'; offer?: import('../commercial').Offer }
  /** the summer academy decision (1.8.1, acadcall.ts): keep a first-year
   *  scholar on a development contract ('sign'), give a lad at the age gate
   *  his first professional contract ('promote'), or let him go ('release').
   *  `acadWage` is the weekly figure the button quoted, paid as quoted. */
  acad?: 'sign' | 'promote' | 'release' | 'loan'
  acadWage?: number
  /** a dressing-room decision (1.8.2, room.ts): stand by a selection or
   *  reverse it, renew a contract now or wait, rest a man or bring him back a
   *  week early, answer a starter who wants assurances after a signing in
   *  his position. room.ts carries it out; the numbers above stay at zero
   *  (the promise itself rides on `pledge`). */
  room?: 'stand' | 'reverse' | 'renew' | 'wait' | 'rest' | 'early' | 'promise' | 'refuse' | 'listen'
  /** the weekly wage the renew-now button quoted, paid as quoted */
  roomWage?: number
  /** the season-expectations decision (25C): choosing sets
   *  state.stance for the year, which scales how hard the boardroom needle
   *  swings on every result - see boardReaction. */
  stance?: 'safe' | 'board' | 'high'
  /** money the board releases the moment this option is chosen (the aim-high
   *  war chest). Computed when the question is built so the label can print
   *  the exact figure; applied once in answerPress. */
  fund?: number
  /** FAN MOOD delta (v1.2.2). The terraces hear what you say too: a manager
   *  who blames the referee is loved on the terraces and disliked upstairs,
   *  and until now only upstairs had a number. Same scale as board (a few
   *  tenths), applied as fanMood += fans * 5 in answerPress. */
  fans?: number
  /** PICK YOUR TEAM IN A PRESS CONFERENCE (v1.2.2). "He starts next week"
   *  is a promise the game keeps for you: the named player is moved into the
   *  starting XV there and then, displacing the weakest man in his position.
   *  Saying it and then quietly leaving him on the bench is exactly the kind
   *  of thing a squad remembers, so the game does not let you. */
  lock?: boolean
  /** TALK-BACK (1.7.3): which answer this is, in the office's own terms
   *  (talkback.FIT). Present, the outcome is settled by who the man is -
   *  good, mixed or bad fit - rather than by the fixed morale above. Absent on
   *  every item saved before 1.7.3, which keep answering as they always did. */
  tb?: string
  /** THE PRESS BAROMETER (1.8.0, pressmood.ts). Morale for the WHOLE squad,
   *  on the same scale as `morale` - the room hears how you talk about them
   *  as a group. A few tenths at most. */
  squad?: number
  /** how the answer moves the press's own sentiment, on its -100..100 scale */
  press?: number
  /** talking a winning run up: the press turn on the squad a win sooner */
  hype?: number
}

/** A subject a player can raise behind the office door. The office keeps a
 *  memo of who asked what and when, so the same man does not knock again
 *  about the same thing seven days after you answered him. */
export type OfficeTopic = 'plans' | 'loan' | 'deal' | 'dropped' | 'signing' | 'armband' | 'position' | 'mate'

/** A promise made to a player in the office. The squad keeps the receipts:
 *  at the due week it is settled as kept or broken, with consequences. */
export interface Pledge {
  playerId: number
  kind: 'plans' | 'minutes' | 'deal' | 'start'
  week: number
  season: number
  /** week the promise falls due for settling */
  due: number
  /** the player's apps when the promise was made */
  baseApps: number
  /** 'start' only (handshake.ts): his starts, and the club's competitive
   *  matches played, when the promise was made */
  baseStarts?: number
  baseGames?: number
}

export interface PressItem {
  id: number
  week: number
  season: number
  outlet: string
  /** the English question, kept for saves written before the press room had
   *  keys. Everything new carries qk/qv and the screen renders those. */
  question: string
  /** the question's key, and the variables it needs */
  qk?: string
  qv?: Vars
  playerId?: number
  options: PressOption[]
  answered: boolean
  answerLabel?: string
  /** the chosen answer's key and vars, so the coverage list reads back in the
   *  reader's language rather than the one the button was pressed in */
  alk?: string
  alv?: Vars
  reaction?: string
  rk?: string
  rv?: Vars
  /** set on office conversations: what he came in to talk about */
  topic?: OfficeTopic
  /** how he took the answer (talkback.ts), once it is given */
  fit?: 'good' | 'mixed' | 'bad'
  /** set on discipline conversations: the incident this one resolves */
  incidentId?: number
  /** what the answer did, recorded when it is given (pressmood.applyMoodAnswer)
   *  so the coverage card can say it in words: squad morale, the terraces,
   *  the press, the board, the man named, and whether the run was talked up.
   *  Absent on everything answered before 1.8.0. */
  fx?: { squad?: number; fans?: number; press?: number; board?: number; player?: number; hype?: boolean }
}

/** The press barometer (1.8.0, pressmood.ts): how the pack feel about the
 *  manager, read off his results and moved by his answers. */
export interface PressMood {
  /** -100 hostile .. +100 adoring; 0 is neutral */
  v: number
  /** the absolute week results have been read through */
  at: number
  /** the club it was measured at - a new job starts level */
  club: string
  /** the season it was last settled in - the summer halves it */
  s: number
  /** a long winning run: the press are trying to unsettle the squad */
  stir?: boolean
  /** times the manager has talked this run up (brings `stir` a win closer) */
  hype?: number
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
  /** 'agreed': accepted outside a window, completes when it opens (pendingDeals) */
  status: 'pending' | 'accepted' | 'rejected' | 'agreed'
  /** He has already been asked for more once.
   *
   *  Haggling (ai.ts counterIncomingOffer) raises the fee by
   *  clamp(1.26 - 0.16 x fee/value, 1.06, 1.22), capped at 1.4 x his value and
   *  the bidder's budget, on a 55% roll, and leaves the bid pending; otherwise
   *  the bidder walks, and a bid that cannot rise comes back as best and final.
   *  An unlimited counter would be a money printer (keep demanding until the
   *  dice land), so it is one round of haggling per offer, then you answer. */
  countered?: boolean
  /** The haggle worked: the bidder did come back with more (1.8.4 RC). A
   *  best-and-final reply leaves this unset. */
  raised?: boolean
  /** How many times a rival has topped this bid (18C). A war runs three
   *  raises at most, then whoever holds the ball has to hear an answer. */
  raises?: number
}

/** Club infrastructure, levels 0-5 - bricks and mortar that outlast any squad.
 *  `icon` is a glyphs.tsx name, not an emoji (owner, 27 Sep 2026). */
export type FacilityId = 'gym' | 'kicking' | 'paddock' | 'briefing' | 'academy' | 'pitch' | 'recovery' | 'shop' | 'hospitality'

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
  /** the coin from gender.ts staffGender, kept so the stories about this
   *  person can say "she filed her report". Absent on older saves: a man. */
  g?: import('../gender').Gender
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

export interface ManagerStats {
  m: number; w: number; d: number; l: number
  /** clubId is optional for saves written before dreams existed - a dream that
   *  asks "with THIS club" treats a missing clubId as "counts", because the
   *  alternative is silently erasing a trophy the manager really won */
  trophies: { compId: string; season: number; clubId?: string }[]
  finishes: { season: number; leagueId: string; pos: number; clubId?: string }[]
  /** wins weighted by the league they came in (v1.2.8): a win in the top
   *  flight is worth one, in the second tier less, in the third less again.
   *  Absent on a save from before, and read as plain wins until the first
   *  win after the update seeds it. */
  ww?: number
  signings: number
  spent: number
  /** Manager of the Month awards won */
  moms?: number
}

/** A transfer agreed outside the window (1.8.15, owner: "you should be able to
 *  buy players outside of transfer window... but they cant transfer until the
 *  window is open"). 'buy': the manager's signing, with the terms he agreed;
 *  'sell': an AI club's bid he accepted. */
export interface PendingDeal {
  id: number
  kind: 'buy' | 'sell'
  playerId: number
  /** the club at the other end: the seller for a buy, the buyer for a sale */
  clubId: string
  /** the manager's club when it was agreed: a deal does not follow him to a new job */
  myClubId: string
  fee: number
  wage?: number
  signOn?: number
  promise?: boolean
  marquee?: boolean
  offerId?: number
  season: number
  week: number
}

export interface GameState {
  seed: number
  /** Which game this career is in: the men's world or the women's.
   *
   *  A save holds ONE world and a world has one gender - see src/game/gender.ts
   *  for why that is a property of the save rather than a filter in the engine.
   *  Absent on every career started before v1.5, which is why nothing reads this
   *  field directly: genderOf(state) supplies 'm' for them. */
  gender?: import('../gender').Gender
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
  /** The last transfer-window notice posted to the manager's inbox, stamped
   *  (season * 100 + week) * 10 + day so each one posts once (window.ts). */
  windowNote?: number
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
  /** two coaches at the manager's club who have fallen out (staffrift.ts).
   *  Secret: only the news ever names it. Absent or null when they all get on. */
  staffRift?: import('../staffrift').StaffRift | null
  /** absWeek before which no new falling-out can start (staffrift.ts) */
  staffRiftNext?: number
  mgr: ManagerStats
  /** the commercial slots and what is signed in them (F30; the sleeve joined
   *  in 1.8.0). Absent on a save written before the department existed;
   *  seedDeals fills it. */
  deals?: Partial<Record<import('../commercial').SlotId, import('../commercial').Deal>>
  /** sponsor negotiations in progress this season, one per slot, and the
   *  sponsors who walked out of one (1.8.0, sponsortalks.ts). Optional: a save
   *  from before the negotiating table simply has no talks open. */
  talks?: import('../sponsortalks').TalksState
  /** this season's accounts and last season's, for the balance sheet (1.8.0,
   *  books.ts). Optional: an older save opens its books the first week it plays. */
  books?: import('../books').SeasonBooks
  booksPrev?: import('../books').SeasonBooks
  /** what the dressing room makes of you, 0-100. Optional so old saves load. */
  mgrTrust?: number
  /** the manager's backstory, chosen at career creation (18B) */
  mgrOrigin?: MgrOrigin
  /** How the press and the fans refer to you - chosen at career start and
   *  carried across every job, including a move to the other game. Absent on
   *  a save from before the choice existed, which reads as a man, exactly
   *  what every line in the game assumed until then. See i18n.ts `_w`. */
  mgrGender?: import('../gender').Gender
  /** the analyst's coin, drawn once per career: the strings about the
   *  analyst say "he" or "she" by it (i18n.ts `_w`). Absent on an older
   *  save until the migration draws it. */
  analystGender?: import('../gender').Gender
  /** A club has offered the job and is waiting on an answer (jobs.ts). One at
   *  a time, cleared by either answer, and it goes stale with its vacancy. */
  jobOffer?: { clubId: string; week: number } | null
  /**
   * EVERY CLUB THAT HAS SACKED YOU, AND THE ABSOLUTE WEEK IT DID IT.
   *
   * A board that has just paid a manager off does not interview him again
   * three weeks later, and the game let it happen: a vacancy at the club that
   * sacked you opened the following month and the Job Centre rolled it like
   * any other (user, 1.7.0: "if fired by a club - you should be instantly
   * dismissed if you apply for the job again within a 3 month period"). One
   * row per sacking, never pruned - the same club can sack the same man twice
   * in a career and jobs.ts reads the most recent (SACK_COOLOFF). A resignation
   * writes nothing here: leaving on your own terms is not being shown the door.
   */
  sackedBy?: { clubId: string; at: number }[]
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
  /** Dreams already realised (v1.1.5): a realised dream is written here at
   *  the season's end (or the moment a new one is named), the manager may
   *  then REFOCUS - name a new dream - and the honour is never erased by
   *  the new ambition. An unrealised dream is never reset by anything. */
  dreamsDone?: { id: string; clubId: string; season: number }[]
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
   *  plan is a choice rather than a stack.
   *  A DEVELOPMENT PLAN (1.8.2): an optional second programme (plan2) splits
   *  the week, seven parts the first to three the second, so it widens a
   *  man's work rather than adding to it; pts counts the points the
   *  programme has landed since it was set, for the Training screen. */
  plans?: { id: number; plan: TrainingFocus; plan2?: TrainingFocus; pts?: number }[]
  /** The office chat budget (20D): absolute week stamp and how many of the
   *  week's two manager-initiated conversations are spent. A manager who
   *  praises everybody praises nobody. */
  chatWk?: number
  chatsUsed?: number
  /** national side the manager also coaches (FM-style dual role) */
  /** Which multiplier this save's absolute-week stamps were written on. Absent
   *  or 45 means a save from before the season grew to 48 weeks, and save.ts
   *  rebases it once, on load, to WEEK_BASIS. */
  basis?: number
  /** 1 once the wage budget has been brought up to date (1.9.7). Absent means
   *  a save from before the budget moved with the wages, and save.ts gives the
   *  manager's club its headroom once, on load (grants.ts healWageRoom). */
  wageFix?: number
  /** What the club has booked into the empty summer weeks, keyed by
   *  "season:week" (week alone before 1.8.1). One event a week, because it is
   *  one ground. */
  closeBook?: Record<string, string>
  /** The season the board last put the insolvency warning in writing. Once a
   *  season, and read from here rather than searched for in the inbox. */
  insolvWarned?: number
  /** Which season each once-a-year talking point last fired in. */
  points?: Record<string, number>
  /** The week a rival coach briefed the press about your side. The next match
   *  is played against a team that has read it. */
  leaked?: number
  natTeam?: string | null
  /** The Isles XV tour job: which season it was offered in and what he said.
   *  Absent on every save made before v1.5, which is correct - nobody was ever
   *  offered it, because until now it was not a job you could be offered. */
  isles?: { season: number; answer: 'open' | 'yes' | 'no' }
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
  /** the press barometer (1.8.0). Absent on older saves, which read as
   *  neutral until the first weekly settle folds the season's results in. */
  pressMood?: PressMood
  /** the board owes you one (objectives delivered) - spend it on a request */
  boardOwed?: boolean
  /** the season the ground was last extended - one stand a season */
  expandedSeason?: number
  /** the manager's decisions and what they did */
  decisions?: Decision[]
  /** the analyst's read on this week's opponent */
  analyst?: import('../analyst').AnalystRead | null
  /** how often following his read has paid off */
  analystRecord?: { right: number; wrong: number }
  /** the Matchday game plan already applied to this fixture, and how many of
   *  its reads, so the button cannot stack the same nudges twice (1.8.1) */
  planApplied?: { fx: number; n: number }
  /** the tactical loop (#181): this week's chosen plan and the last few
   *  post-match findings, capped (oppreport.ts) */
  tacLoop?: import('../oppreport').TacLoop
  /** the chief scout is away on a commissioned brief */
  commission?: import('../commission').Commission | null
  /** the report he filed when he got back */
  scoutFinds?: import('../commission').ScoutFind[] | null
  /** every verdict the department has given, newest last, capped
   *  (scoutrecs.ts): the Scouting page's list and the news it owes */
  scoutRecs?: import('../scoutrecs').ScoutRec[]
  /** legacy: facilities now live on the club. Kept so old saves can be
   *  migrated into Club.facilities, then emptied. */
  facilities?: Partial<Record<FacilityId, number>>
  /** a facility upgrade under construction: the board funded it, the
   *  builders are in, and it opens at `done` (absolute week) */
  facilityBuild?: { id: FacilityId; done: number; level: number } | null
  /** a new stand under construction: the money has left the account, the
   *  builders are in, and the seats arrive at `done` (absolute week). Held
   *  apart from facilityBuild rather than folded into it because the ground
   *  is not a FacilityId - it has no levels and no FACILITY_INFO row - and
   *  every reader of facilityBuild would have had to learn that. The two
   *  share the one builders' slot instead (season.ts). */
  stadiumBuild?: { done: number; seats: number; cost: number } | null
  /** absolute week (season*100+week) before which the board will not hear
   *  another facility request - denials cost you the room for a while */
  facilityAskCooldown?: number
  /** ---- THE BOARDROOM DOOR (v1.8.3, boardroom.ts) ----
   *  absolute week the board's grant of MORE TIME runs to. While it stands
   *  the confidence sack check is suspended: a chairman who has publicly
   *  given a manager until Christmas does not sack him in November. */
  /** What the ground cost this week beyond the standing bill: the one repair
   *  or windfall upkeep.ts rolled, or 0 for a quiet week. Recorded so a probe
   *  can tell a gate from a boiler (season.ts, friendlyprobe). */
  lastUpkeep?: number
  boardGrace?: number
  /** season the manager last asked for a bigger staff budget - once a season,
   *  win or lose, the same rule the transfer-funds ask has always had */
  staffAskedSeason?: number
  /** extra weekly room the board has granted for the backroom, on top of
   *  whatever the club's own wage structure allows */
  staffRoom?: number
  /** facilities the board has agreed to pay for outright. The next build of
   *  one of these costs the club nothing - which is what separates the
   *  boardroom ask from the per-facility ask on the Infrastructure page. */
  boardGrant?: FacilityId[]
  /** cash released into the transfer allowance this season (treasury.ts,
   *  1.6.3): a club may release what it holds, once, so the allowance can
   *  never be pumped past the money behind it. Reset at the rollover. */
  releasedThisSeason?: number
  /** The next player id to mint (1.6.4). The counter used to live in a
   *  module variable and was rebuilt on load as the highest live id plus one,
   *  so an id freed by a retirement or a cull could in principle be handed
   *  to a new player after a reload while a record still pointed at the old
   *  one. Stamped by newGame and by every week settle; migrate restores it. */
  pidNext?: number
  /** Names that have left the world - retirements and the free-agent cull.
   *  A running game's name registry never gives a name back (nations.ts),
   *  and a reloaded save must not either: without this list a reload rebuilt
   *  the registry from the players left and a regen could take a retired
   *  man's name, which is how a reload changed the rollover
   *  (scripts/qa/determinism.ts, 1.6.5). The newest RETIRED_NAMES_KEPT of them,
   *  trimmed each summer (nations.ts, 1.8.3): about two summers' worth. */
  retiredNames?: string[]
  /** Every name the registry has handed to a generated player (nations.ts),
   *  so a reload rebuilds the same registry the running game had. */
  takenNames?: string[]
  /** The board's patience with being asked twice (v1.1.4). One entry per
   *  request door - 'capital' (facilities and the ground, which share their
   *  cooldown) and 'funds' - stamped at each denial. Coming back through a
   *  door the board just closed is a strike: the first draws a formal warning
   *  and HALVES boardConfidence; the second is the sack, that week, whatever
   *  the results say. Cleared when the manager takes a new job. */
  boardAsks?: Record<string, { deniedAt: number; strikes: number; warned?: boolean }>
  /** season the manager last asked the board for transfer funds - the ask is
   *  once a season win or lose (engine-owned since v1.1.4; it was an untyped
   *  flag the Finances screen kept on the save) */
  fundsAskedSeason?: number
  /** the manager's total match count (w+d+l) when Full Fitness last applied -
   *  the retreat refuses to book twice without a game played in between
   *  (v1.1.5; replaced the 3-a-season cap) */
  healAtGames?: number | null
  /** per-slot count of commercial deals ended early (v1.1.5): part of the
   *  offer hash, so each early exit deals three genuinely new offers - the
   *  gamble - while revisiting the screen still rerolls nothing */
  dealReroll?: Partial<Record<import('../commercial').SlotId, number>>
  /** per-slot season a deal was last ended early (1.8.0): one early exit a
   *  slot a season, so the gamble cannot be shopped round until it pays */
  dealEndedSeason?: Partial<Record<import('../commercial').SlotId, number>>
  /** a trophy moment waiting to be celebrated full-screen */
  /** THE FULL-SCREEN MOMENT. Promotion, a title, an unbeaten season, a
   *  challenge finished - the rarest things the game has to show, and every
   *  one of them was English whatever language the manager had chosen.
   *
   *  Same shape as everything else that is written once and read later: the
   *  English it was filed in stays (a save from before this still has to draw
   *  something), and `hk`/`sk` plus their values are what a screen renders. */
  celebration?: {
    headline: string
    sub: string
    /** a glyphs.tsx name ('trophy', 'promoted'...); a save from before the
     *  icon pass holds an emoji here, which draws nothing */
    icon: string
    hk?: string
    hv?: Record<string, string | number>
    sk?: string
    sv?: Record<string, string | number>
  } | null
  /** THE GAFFER'S LEDGER (v1.2.2). The quiet firsts of a career: the first
   *  win at a ground, the first derby win, ten unbeaten. Each is recorded
   *  once (the key is the dedupe), filed as a story when it happens, and
   *  shown on Legacy so the career reads as a run of firsts rather than a
   *  total. Nothing here has a number attached to how much it matters,
   *  because it does not - it is there to be noticed. */
  ledger?: { k: string; v: Record<string, string | number>; season: number; week: number }[]
  /** THE GRUDGE (v1.2.2). Whether this club sat above its nominated rival
   *  in the league table the last time it was checked, so overtaking them
   *  - and being overtaken - is a moment rather than a silent reordering.
   *  Undefined until the first check. */
  grudgeAbove?: boolean
  /** THE SACK, AS AN EVENT RATHER THAN A LETTER (v1.2.1).
   *
   *  Losing your job used to be one item in an inbox of eleven, between a
   *  fixture note and a sponsor's renewal - the single biggest thing that can
   *  happen to a career, filed like a laundry bill. Owner: "It should be clear
   *  if you are sacked. Like really obvious."
   *
   *  So a dismissal now sets this, and the app puts a breaking-news card over
   *  whatever screen you are on until you have stood up and said something.
   *  `k`/`v` are the board's own letter, so the bulletin and the inbox item
   *  cannot drift; `said` records which line you gave the cameras.
   *
   *  IT CHANGES NOTHING. There is no reputation, morale or job-market effect -
   *  the owner asked for exactly that ("shouldnt really have any impact on
   *  anything though"). It is there to be felt, not survived. */
  sacked?: {
    club: string
    k: string
    v: Record<string, string | number>
    /** null until he has faced the press; the key of the line he chose after */
    said: string | null
  } | null
  /** senior pros paired with academy kids - wisdom rubs off. Capped by
   *  mentoring.mentorCap (four, five with a strong Centre of Excellence).
   *  pers0 is the kid's personality when the pairing was made, so graduation
   *  can tell "he BECAME his mentor" from "they always matched" - a
   *  Professional teaching a Professional is the second-best pairing in the
   *  game and must not end at birth. Absent on pairs made before it existed.
   *  since/ca0/taught/grew (1.8.0) are the pairing's ledger, so the Team
   *  Report can show what the kid has actually taken from it: the week it
   *  began, his rating then, the coached points by attribute, and the rating
   *  points the pairing itself added (mentoring.mentorWeek). All absent on
   *  older saves, which read as "nothing recorded yet". */
  mentors?: { senior: number; kid: number; pers0?: Personality; since?: number; ca0?: number; taught?: Partial<Record<keyof Attrs, number>>; grew?: number }[]
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
  /** SEASON PRIORITIES (1.8.2, seasonplan.ts): the manager's ranking of the
   *  club's competitions and his rotation intent. Read by the assistant's
   *  team sheet and the board. Unset is exactly the old game. */
  seasonPlan?: import('../seasonplan').SeasonPlan
  /** the first season's checklist (firststeps.ts); absent on a career begun
   *  before it existed, which then never shows it */
  firstSteps?: import('../firststeps').FirstSteps
  /** ---- v1.1.0: what the owner paid for (grants.ts, monetise.ts) ----
   *  Nothing below is ever set by the game itself - scripts/grantprobe.ts
   *  holds that a fresh career carries none of it. */
  /** cap-exempt wage allowance bought this season, as a fraction of the
   *  league cap (an injection's board-underwritten wages). Stacks per
   *  purchase, expires at rollover with the cash fiction it came with. */
  wageBoost?: number
  /** The Owner's Charter: the wage law no longer applies to this save. Set
   *  once, never cleared - a stamped save, not a toggle (🖋 in Legacy). */
  uncapped?: boolean
  /** Manager's License chosen at career creation: a proven name from day
   *  one (mgrReputation pays the scale's ceiling; 🎓 in Legacy). */
  licensed?: boolean
  /** Difficulty, chosen at career creation and never after (v1.2.7). Absent
   *  on every save written before it existed, which reads as 'normal' - the
   *  game exactly as it was.
   *
   *  REMOVED, and kept here as a tombstone. Difficulty was three levers on the
   *  manager's own club - starting cash, board patience, injury rate - and the
   *  owner's verdict was that it "doesn't really work for this type of game".
   *  It is gone: no picker, no levers, no file. Careers saved while it existed
   *  still carry this key and nothing reads it, so every one of them now plays
   *  at what used to be 'normal' - which is the setting where all three levers
   *  were exactly 1, 0 and 1, so a normal save is unchanged and a hard one gets
   *  the game it would have had. */
  difficulty?: 'normal' | 'hard' | 'legend'
  /** The manager's own saved game plans (v1.2.7): up to three, each the four
   *  dials plus the defensive pair, set-piece calls, kicking order and exit,
   *  named by him. Presets are the game's; these are his. */
  gamePlans?: { name: string; values: Omit<Tactic, 'lineup'> }[]
  /** board injections taken this season, per tier: the well has a bottom
   *  (ten each on the three smaller tiers, the Sugar Daddy once - see
   *  INJECT_TIERS, which is the only place the numbers live) and this is
   *  where it is measured.
   *  'heal' (v1.1.4) rides in the same ledger for the same reason - the
   *  retreat can only be booked so often - and is wiped at rollover with
   *  the rest of it. */
  injections?: Partial<Record<'s' | 'm' | 'l' | 'xl' | 'heal', number>>
  /** The Estate (v1.1.4): every facility raised to its maximum, bought and
   *  applied to this save. A permanent stamp like the Charter's - facilities
   *  live on the club and are left behind with a job change, but the record
   *  of how the estate was built stays on the save.
   *
   *  SUPERSEDED BY estateClubs in v1.1.14 and kept only so an old save can be
   *  read (save.ts migrates it). It was a single save-wide boolean, which meant
   *  the moment you built the estate anywhere you could never build it again -
   *  the owner resigned, took a job with poor facilities, and found the product
   *  he had paid for greyed out with nothing he could do about it. */
  estateMaxed?: boolean
  /** THE CLUBS THIS CAREER HAS BUILT THE ESTATE AT (v1.1.14).
   *
   *  Owner: "it should ONLY apply to a club when in charge. when you move you
   *  have to purchase it again. if you go back to the same club though it
   *  should stay til the game finishes and the coach retires."
   *
   *  So it is a list, not a flag: the buildings belong to the ground they were
   *  built on, they are still there if you come back, and a new club is a new
   *  job of work. Cleared with the career, like everything else in a save. */
  estateClubs?: string[]
  /** The absolute week the club went overdrawn, or null while it is not
   *  (treasury.debtWeek). The board's patience is measured from here: a short
   *  overdraft to buy a player is a fair gamble, living in one is not. */
  debtSince?: number | null
  /** when the finance director last warned that the cash would run out (1.8.14) */
  cashWarnAt?: number
  /** The International Stage (v1.1.4): the call to the federations has been
   *  made at least once in this save. A RECORD, not a gate, since v1.1.13 -
   *  the door is closed by holding a national job, not by having held one, so
   *  a coach who steps down can pick again (grants.applyPinnacle). */
  pinnacleCalled?: boolean
  /** the week (absolute: season * SEASON_WEEKS + week) the federations answer
   *  the call: when it arrives, season.ts places a real natOffer through the
   *  normal machinery. Null/absent when no call is out. */
  natCall?: number | null
  /** the federation the buyer chose at the store (v1.1.5 picker) - the
   *  natCall answers with this nation's offer; absent on a pre-picker call,
   *  which falls back to the best qualified tier */
  natCallNat?: string | null
  /** THE PAID APPOINTMENT'S ONE REMAINING QUESTION (v1.1.12). The
   *  International Stage installs the job outright rather than offering it
   *  (owner: "paid for this but no job offer came... it shouldnt even be an
   *  offer just an announcement with a question of will you carry on at the
   *  club?"), so the only thing left to ask is the club one. Holds the
   *  nation code while that question stands; null once answered. Leaving it
   *  unanswered costs nothing - the club job is kept until it is resigned. */
  natKeepAsk?: string | null
  /** purchased cash landed this season, in pounds - the books objective
   *  reads organic funds only, so a bought pound can never finish it */
  injectedThisSeason?: number
  /** rewarded-favour ledgers (rewarded.ts): counts timestamped in absolute
   *  game-weeks so an instant-result marathon cannot farm them. The wrapper's
   *  bridge holds the per-real-day cap; this holds the per-save one. Cleared
   *  at rollover, since everything in it is weekly or seasonal, except the
   *  team night's stamp, whose four-week cap runs across the summer. */
  rewarded?: {
    /** physio favours used this game-week: [absWeek, count] */
    medical?: [number, number]
    /** agency files this game-week: [absWeek, count] */
    scout?: [number, number]
    /** player id -> the season his file was shared (once per season each) */
    scoutSeen?: Record<number, number>
    /** the absolute week the analyst's all-nighter is armed for */
    analyst?: number
    /** town collection this game-week: [absWeek, count] */
    town?: [number, number]
    /** collections this season (three, then the town has given enough) */
    townSeason?: number
    /** 1.8.2, the agent's inside word: words bought this game-week, [absWeek, count] */
    inside?: [number, number]
    /** player id -> the absolute week his current six-week spell of talk
     *  began, once the inside word has resolved it for that spell */
    insideSeen?: Record<number, number>
    /** 1.8.2, a second opinion: player id -> the season it was taken in */
    opinion?: Record<number, number>
    /** 1.8.2, tape room night: [absWeek, opponent id] of the match it is for */
    tape?: [number, string]
    /** 1.8.2, the sponsor's team night: [absWeek, press id of the split it
     *  softened]. The one entry that survives rollover (rollover.ts), because
     *  its cap is four game-weeks and a season boundary must not reset it. */
    teamNight?: [number, number]
  }
  /** absolute week (season * SEASON_WEEKS + week) the LAW WATCH wind-up last
   *  aired. The freshness gate used to scan state.news for the last airing,
   *  and the news log is trimmed at 250 items - a busy month pushed the last
   *  airing out of the window and re-armed the story early; and it compared
   *  same-season only, so every rollover reset the clock. */
  lawWatchAt?: number
  /** Week stamp of the last AROUND THE GROUNDS story. Absolute weeks, like
   *  lawWatchAt, because the news log is trimmed and a same-season scan
   *  re-arms every rollover. */
  groundsAt?: number
  /** Absolute week (absWeek) of the last calendar LAW WATCH story, the
   *  plausible proposals Ruck covers twice a season (gossip.ts lawTalk). A
   *  stamp rather than a news scan for the same reasons as lawWatchAt. Absent
   *  on saves from before 1.8.7, which simply reads as never aired. */
  lawTalkAt?: number
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
  incidents?: { id: number; pid: number; kind: 'training' | 'rating'; state: 'flagged' | 'handled' | 'festering' | 'challenged'; season: number; week: number
    /** answered with a fine, not a quiet word (a fine that lands is 'handled'
     *  too); read by the conduct row's hard calls (repute.ts) */
    fined?: true }[]
  /** season*100+week the senior players last called a meeting to question the
   *  manager's authority - a stamp, never a news scan */
  challengeAt?: number
  /** per-dial run length of consecutive user matches played at an extreme
   *  (pillar 2's repetition fatigue) - written at settle, read at kick-off */
  dialStreak?: Record<string, number>
  /** the user's club identity, smoothed over seasons (identity.ts). Absent on
   *  an older save, which is seeded from its current state on first read. */
  identity?: import('../identity').ClubIdentity | null
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
  /** the fastest try anybody has scored in a knockout tie (1.8.16): minute,
   *  scorer, side and season, for the record line in the news */
  koFastest?: { min: number; name: string; team: string; season: number }
  /** games played together by key partnerships (front row, locks, halfbacks,
   *  centres) - familiarity sharpens the relevant unit. Key: chemKey(a, b) */
  chem?: Record<string, number>
  /** the dressing room's friendships and rifts (bonds.ts), user club only */
  bonds?: import('../bonds').BondState
  /** the dressing room's decisions and the club's hidden culture (room.ts) */
  room?: import('../room').RoomState
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
  /** How far the terraces' campaign against the manager has got (terraces.ts):
   *  0 content, 1 grumbling, 2 banners and a hashtag, 3 a plane over the
   *  ground. Held so each stage files its story once rather than every week
   *  of a bad autumn, and so a mood that recovers can say so. */
  fanCampaign?: 0 | 1 | 2 | 3
  /** the game's Hall of Fame: careers immortalised at retirement */
  hof?: { name: string; pos: Pos; nat: string; apps: number; tries: number; points: number; season: number; club: string }[]
  /** league the scouting network is assigned to watch weekly */
  scoutFocus?: string | null
  /** How the manager watches each competition (F5), keyed by competition id:
   *  'full' every line of commentary, 'highlights' the moments only, 'instant'
   *  the assistant takes it. A phone career is 40 matches a season and not all
   *  of them deserve ninety taps. */
  viewPref?: Record<string, 'full' | 'highlights' | 'instant'>
  /** The manager's last few pre-match dressing rooms, oldest first: 'T' he
   *  spoke, 'N' he said nothing (teamtalk.ts silenceWeight). Saying nothing
   *  once costs nothing; making a habit of it drains the room. */
  preTalkLog?: string
  /** A match in progress, inside a save written while it was being played
   *  (game/resume.ts stampedSave, 1.8.2). The rest of the save is the state
   *  from before kick-off; opening it resumes the match rather than offering it
   *  again. Absent on every save written outside a live match. */
  liveRec?: LiveStamp
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
  /** `wage` is the weekly figure agreed at the table (the manager's own
   *  pre-contracts), paid from the day he arrives. Absent on the AI's and on
   *  saves from before 1.8.1. */
  preContracts?: { playerId: number; toClubId: string; week: number; wage?: number }[]
  /** Transfers agreed while the window was shut (1.8.15): they complete, in
   *  order, on the Monday the window opens, or fall through then (ai.ts
   *  settlePendingDeals). Nothing is paid until they complete. */
  pendingDeals?: PendingDeal[]
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
  /** the club's memory that acts (histbook.ts): emergent rivalries, the
   *  season story lines, legends and their records, former clubs. Created on
   *  first touch; absent on older saves until then. */
  hist?: import('../histbook').HistBook
  /** injury-crisis alerts already raised: position group -> week fired,
   *  so the assistant nags once a month, not once a week */
  crisisAt?: Record<string, number>
  /** the positions the assistant has already called thin at this club, for
   *  as long as each stays thin (depthwatch.ts): one message per spell */
  depthShort?: { club: string; pos: Pos[] }
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
  /** weeks in a row the board has sat at its floor (confidence 3 or under);
   *  a sacking on results needs three (season.ts) */
  boardFloorWeeks?: number
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
  /** AI clubs that agreed the same fee as the manager this season
   *  (rivalbids.ts, 1.8.5): the live one is settled when the week ends, the
   *  rest stop a man being contested twice in a season. Absent in older saves. */
  rivalBids?: import('../rivalbids').RivalBid[]
  /** The clubs whose boards backed them after finishing behind the manager,
   *  and the position each is buying (rivalbids.ts). One summer only. */
  rivalPush?: import('../rivalbids').RivalPush
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
  /** Last full time's two fixes, so the next one can mark the homework (C2).
   *  Set wherever a match is filed, watched or not (coachfix fileHomework). */
  fixHw?: { fxId: number; season: number; week: number; tags: string[]; test?: boolean; was?: string[] }
  /** the user's hand-picked Test 23 for the current window */
  natLineup?: { team: string; lineup: (number | null)[] } | null
  /** men the national coach sent home from camp this window. A recall gives
   *  back the sting of being dropped rather than a fresh +0.5 of pride, so
   *  call-up and drop cannot be cycled to grind another club's player's
   *  morale down (9.10). Absent in older saves, cleared with the window. */
  natSent?: number[]
  /** the federation's own list for the user's nation, snapshotted when the
   *  window opened: the yardstick for the two-jobs rule (9.10). Absent in
   *  older saves and between windows. */
  natFed?: { nat: string; ids: number[] }
  /** World Player of the Year roll of honour, oldest first - the sport's
   *  history book, one line per season */
  potyRoll?: { season: number; playerId: number; name: string; clubName: string }[]
  /** the season's most dramatic try by the user's club, judged live at each
   *  full-time whistle and honoured at the Annual */
  tryOfSeason?: { playerId: number; name: string; min: number; opp: string; text: string; drama: number; season: number
    /** the line's key and values as JSON ({ k, ...v }), for the award story's
     *  text_j: the English in `text` is the fallback for a save from before */
    tj?: string } | null
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
  /** 1 once migrate has run its one-shot legacy academy-wage repair (1.8.5);
   *  after that the rollover's repriceAcademies owns scholar wages, and a
   *  load never moves one mid-season (save.ts) */
  acadPriced?: number
  /** the A League: the academy sides of the user's league, with their own
   *  fixtures and table. Kept outside state.comps deliberately - see academy.ts */
  academy?: import('../academy').AcadLeague
  /** the manager's memory: decisions with a subject, read back later as
   *  stories (memory.ts). Absent on older saves; migrate gives an empty log. */
  memory?: import('../memory').MemoryLog
  /** the fraction cursor for stories filed without spending nextId
   *  (heldnews.ts): the base id it counts from and how many it has used */
  heldIds?: { b: number; n: number }
  /** the career arc (arcbook.ts): rival coaches, what the manager is known
   *  for, the story of each era. Created on first touch; absent on older saves. */
  arc?: import('../arcbook').CareerArc
  /** the one to three ambitions named at the start (ambitions.ts). The first
   *  is also `dream`. Absent on saves from before: the dream stands alone. */
  ambitions?: import('../arcbook').Ambition[]
}
