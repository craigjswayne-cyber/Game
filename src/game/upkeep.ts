/**
 * ---- THE THINGS THAT HAPPEN TO A RUGBY CLUB THAT ARE NOT RUGBY ----
 *
 * Owner, v1.1.12: "running the club should be challenging financial - money
 * comes and goes, external to rugby - stadium repairs, weather damage, new
 * pitches, failed events, successful events always find humour in this - but
 * make balancing the money a bit of a challenge and it impacts the board. keep
 * them positive."
 *
 * The club's books were entirely a function of rugby: gate, central money,
 * sponsors, wages, upkeep. Every one of them is predictable and none of them
 * ever surprised anybody, so "balancing the money" was arithmetic rather than
 * management - you knew in week 3 what week 40 would look like.
 *
 * A real club's year is not like that. A storm takes half the tarpaulin off the
 * South Stand. The sportsman's dinner sells out and the auction goes mad. The
 * beer festival is rained on for three days. Somebody drives a forklift through
 * the hospitality suite. None of it is rugby and all of it is the job.
 *
 * THE RULES THIS FOLLOWS
 *
 *   Scaled, never flat. Every figure is priced in WEEKS OF UPKEEP, so the same
 *   event is proportionate at Esher and at Toulouse - a flat £200k is a shrug
 *   at one and the end of the world at the other.
 *
 *   Roughly balanced, slightly negative. Buildings cost more than fetes make.
 *   The point is to make the year uneven, not to bankrupt anybody: econprobe
 *   holds the club solvent by playing, and this must not change that.
 *
 *   The board notices, and stays positive. A windfall is a small pat on the
 *   back, a disaster a small frown - the owner's "keep them positive" is why
 *   the good side of the ledger moves them slightly more than the bad.
 *
 *   Deterministic. One roll a week from the world's own rng, so a probe can
 *   walk a season and get the same season twice.
 */
import type { GameState } from './model'
import { clamp, type Rng } from './rng'
import { seasonStart, BASE_YEAR, fmtMoney, groundLevel, operatingCost } from './model'
import { tIn } from './i18n'

/**
 * How often the club's non-rugby year says something. Often enough to be part
 * of the year, rare enough that an inbox is not an accountant's.
 *
 * IT CLIMBS WITH THE GROUND (owner, v1.6.9). A bigger place has more of
 * everything that can go wrong and more of everything worth hiring it out
 * for, so a stadium hears from the maintenance department about half again as
 * often as a village ground does. The rate is the only thing size changes
 * here; what an event COSTS is already proportionate, because every figure in
 * the table is priced in weeks of that club's own upkeep.
 */
const CHANCE_BASE = 0.165
const chanceFor = (s: GameState) => CHANCE_BASE * (1 + stage(s) * 0.055)

interface Event {
  /** the story's key; `${k}Subj` is its subject, as everywhere else */
  k: string
  /** cost (negative) or windfall (positive), in WEEKS OF UPKEEP */
  weeks: number
  /** what it does to the boardroom, in confidence points */
  board: number
  /** only offered when this is true of the club */
  when?: (state: GameState) => boolean
  /** WEAR AND TEAR, rather than weather or an accident. These are the stories
   *  a ground tells you when nobody has spent anything on it for a while, so
   *  they are weighted up by club.wear and reset by a new stand. */
  wear?: boolean
}

/** Which of the six grounds this is, for the gates below. */
const stage = (s: GameState) => groundLevel(s.clubs[s.userClubId]?.capacity ?? 0)
/** A story that only makes sense once the ground is big enough to have the
 *  thing that breaks: a village club has no concourse to light. */
const fromStage = (n: number) => (s: GameState) => stage(s) >= n

/**
 * HOW WORN THE GROUND IS, 0 to 1.
 *
 * club.wear counts the weeks since the builders were last here and is reset
 * when a stand opens (season.ts). Five seasons of spending nothing on the
 * place takes it to the top of the range, where the wear stories are three
 * times as likely to come up as they are the week the paint dries.
 */
const WEAR_FULL = 240
const wearOf = (s: GameState) =>
  Math.min(1, (s.clubs[s.userClubId]?.wear ?? 0) / WEAR_FULL)

/** A ground with a roof over most of it has more to lose to a gale. */
const bigGround = (state: GameState) => (state.clubs[state.userClubId]?.capacity ?? 0) >= 12_000

/** Is the first team at home this week? The events department checks before
 *  booking anything that chews the pitch up: upkeep rolls at the top of the
 *  week and the fixture is at the end of it, so a concert landing here would
 *  always sit within five days of the kick-off (owner, v1.1.18: "no concerts
 *  happen 5 days before a home game"). Away weeks and byes take the booking. */
const homeMatchWeek = (state: GameState) =>
  state.fixtures.some(f => !f.played && f.week === state.week && f.homeId === state.userClubId)

/** The month a week falls in, 0 = January, off the same calendar weekDate
 *  prints (season opens 16 August). Stories that name a season of the year
 *  are gated on it (owner, v1.2.8: "summer earner but its in November?"). */
const monthOf = (s: GameState): number =>
  new Date(seasonStart(s.season) + (s.week - 1) * 7 * 86400000).getUTCMonth()
const inMonths = (...months: number[]) => (s: GameState) => months.includes(monthOf(s))
/** the story says "the summer's big earner": it can only land as the summer ends */
const lateSummer = inMonths(7, 8)
/** wind, rain and mud belong to the winter half */
const winter = inMonths(9, 10, 11, 0, 1, 2)
/** "more mud than grass since November": the relay is a new-year story */
const newYear = inMonths(0, 1, 2)
/** a grotto is a December story */
const december = inMonths(11)
/** "a slightly different colour until March": an autumn concert */
const autumn = inMonths(8, 9, 10)

const EVENTS: Event[] = [
  // ---- the buildings, which are always losing ----
  { k: 'news.upStorm', weeks: -6, board: -1.5, when: winter },
  { k: 'news.upRoof', weeks: -8, board: -2, when: bigGround },
  { k: 'news.upPipe', weeks: -3, board: -1 },
  { k: 'news.upFloodlights', weeks: -5, board: -1.5 },
  { k: 'news.upPitch', weeks: -9, board: -1, when: newYear },
  { k: 'news.upForklift', weeks: -4, board: -1.5 },
  { k: 'news.upBadger', weeks: -2, board: -0.5 },
  // ---- WEAR AND TEAR (owner, v1.6.9) ----
  //
  // "replacing seats from sun damage, toilets broken, bar issues, unexpected
  // high electricity bill - general wear and tear". The table above is
  // weather and accidents: things that HAPPEN to a ground. These are what a
  // ground does on its own if you leave it alone, so they are the ones that
  // get likelier the longer it is since anybody built anything, and they are
  // gated by stage so a village club is never sent a stadium's bill.
  { k: 'news.upSeats', weeks: -5, board: -1, wear: true, when: fromStage(2) },
  { k: 'news.upToilets', weeks: -3, board: -1, wear: true, when: fromStage(1) },
  { k: 'news.upCellar', weeks: -3, board: -0.5, wear: true, when: fromStage(1) },
  { k: 'news.upPower', weeks: -7, board: -1.5, wear: true, when: fromStage(3) },
  { k: 'news.upSurvey', weeks: -4, board: -1, wear: true },
  // ---- AND A BIG GROUND IS A BIG ASSET ----
  //
  // The five stories above are five new ways to lose money, dropped into a
  // table whose whole design note is "roughly balanced, slightly negative".
  // Without these it is heavily negative and the ladder above it becomes
  // unfundable - measured at econprobe, a Northampton that could no longer
  // pay for its own estate. These are what a stadium actually does when it
  // is not being played in, and they are gated the same way the losses are,
  // so the upside arrives with the same concrete that brought the bills.
  { k: 'news.upConference', weeks: 5, board: 1.5, when: fromStage(2) },
  { k: 'news.upTours', weeks: 4, board: 1, when: fromStage(3) },
  { k: 'news.upNaming', weeks: 8, board: 2.5, when: fromStage(4) },
  // ---- the events department, which is a gamble ----
  { k: 'news.upDinner', weeks: 9, board: 2 },
  { k: 'news.upBeerFest', weeks: -4, board: -1, when: lateSummer },
  { k: 'news.upWedding', weeks: 5, board: 1.5 },
  { k: 'news.upConcert', weeks: 13, board: 2.5, when: s => bigGround(s) && !homeMatchWeek(s) && autumn(s) },
  { k: 'news.upFunRun', weeks: 3, board: 1 },
  { k: 'news.upSantaGrotto', weeks: -2, board: -0.5, when: december },
  { k: 'news.upFilmCrew', weeks: 7, board: 1.5 },
  // A SMALL GROUND HAS ITS OWN WAY OF MAKING MONEY, and it needs one: the two
  // biggest earners here are gated on a big ground, so without this the whole
  // table would be meaningfully harsher on the clubs least able to take it -
  // measured at seventeen weeks of upkeep a season at Esher against eight at
  // Northampton, which is exactly backwards.
  { k: 'news.upClubhouse', weeks: 8, board: 2, when: s => !bigGround(s) },
]


/**
 * One roll of the club's non-rugby year.
 *
 * Called from the weekly settle. Returns the amount moved, for the probe -
 * nothing else reads it, because the club's books and the inbox are the real
 * outputs.
 */
export function upkeepWeek(state: GameState, rng: Rng): number {
  if (state.unemployed) return 0
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  // THE GROUND AGES WHETHER OR NOT ANYTHING HAPPENS TO IT, and it ages before
  // the pre-season guard below, so a summer counts like any other week.
  // season.ts puts it back to nothing when a new stand opens.
  club.wear = Math.min(WEAR_FULL, (club.wear ?? 0) + 1)
  // pre-season is the manager's own week: the fixture list has not started and
  // an inbox full of guttering before a ball is kicked reads as noise
  if (state.week < 3) return 0
  if (rng() >= chanceFor(state)) return 0

  /**
   * A WEIGHTED DRAW, not a flat one - one rng call either way, so the stream
   * costs exactly what it always did.
   *
   * Every story weighs 1 except the wear ones, which weigh between 1 and 3
   * depending on how long it is since anybody poured any concrete here. A
   * ground that has just had a stand built gets the same year it always got;
   * one nobody has spent a penny on for five seasons starts hearing about its
   * seats, its toilets and its electricity bill instead of its beer festival.
   */
  const pool = EVENTS.filter(e => !e.when || e.when(state))
  const wf = 1 + wearOf(state) * 2
  let total = 0
  for (const e of pool) total += e.wear ? wf : 1
  let pick = rng() * total
  let ev: Event | undefined
  for (const e of pool) {
    pick -= e.wear ? wf : 1
    if (pick < 0) { ev = e; break }
  }
  if (!ev) return 0

  // priced in the club's own weeks, with a little spread so the same event is
  // not the same number twice
  const unit = Math.max(4_000, operatingCost(state))
  const spread = 0.8 + rng() * 0.45
  let amount = Math.round(ev.weeks * unit * spread / 1_000) * 1_000
  // YOU CANNOT SPEND WHAT YOU HAVE NOT GOT, AND NOR CAN A CLUB.
  //
  // Weeks of upkeep is the right unit for proportion and the wrong one for
  // affordability: measured over sixty seasons at Esher, whose whole balance is
  // £57k, a bad year of buildings came to -£619k. That is not a challenge, it
  // is administration by weather. And it is not what a real club does either -
  // when the roof survey comes back and there is no money, the roof gets
  // patched and the survey gets filed, which is why every lower-league ground
  // in the country has a stand held together by paint.
  //
  // So a bill is capped at a share of what is actually in the bank, with a
  // floor of one week's upkeep so a skint club still feels something. A rich
  // club gets the full repair and the full bill; a poor one gets the patch.
  if (amount < 0) {
    const affordable = Math.max(unit, Math.round(Math.max(0, club.balance) * 0.35))
    amount = -Math.min(-amount, affordable)
  }
  club.balance += amount

  // A WINDFALL IS THE CLUB'S, NOT THE MANAGER'S. It lands in the balance and
  // stays there: turning every summer fete into transfer money would make the
  // treasury slider pointless and the market silly. Moving it across is the
  // manager's decision, on the Finances page, like every other pound.
  // THE BOARD DOES NOT BLAME YOU FOR THE WEATHER (owner: "it impacts the
  // board. keep them positive"). A burst pipe is not a coaching decision and
  // the directors know it, so a bad month costs half of what a good one earns;
  // autopilotprobe also had a view, having watched the full-weight version
  // push a sleepwalking minnow's board to the edge of the crisis range that
  // probe exists to keep it out of. Good news moves them properly, because
  // somebody in the commercial department did that on purpose.
  club.boardConfidence = clamp(club.boardConfidence + (ev.board < 0 ? ev.board * 0.5 : ev.board), 0, 100)

  const v = { club: club.name, stadium: club.stadium, amount: fmtMoney(Math.abs(amount)) }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', `${ev.k}Subj`, v),
    body: tIn('en', ev.k, v),
    k: ev.k, v,
  })
  return amount
}
