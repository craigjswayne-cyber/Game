// The calendar: absolute weeks and the two stamp bases, the season and
// ledger lengths, World Championship years, and every printed date.
import { t } from '../i18n'

/** World Championship years: 2027, 2031, ... (in-game season index) */
export function isWorldCupSeason(season: number): boolean {
  return (BASE_YEAR + season) % 4 === 3
}

/** The women's World Championship runs two years off the men's: 2025 was the
 *  last one, so 2029, 2033 and 2037 are the next (1.6.4). Computed from the
 *  real year like the men's, so a change of BASE_YEAR moves the season it
 *  falls in and never the year. */
function isWomensWorldCupSeason(season: number): boolean {
  return (BASE_YEAR + season) % 4 === 1
}

/** Whether this career's world plays its World Championship this season. */
export function worldCupSeasonFor(state: { season: number; gender?: string }): boolean {
  return state.gender === 'w' ? isWomensWorldCupSeason(state.season) : isWorldCupSeason(state.season)
}

/**
 * ---- THE BASIS FOR AN ABSOLUTE WEEK ----
 *
 * Anything in a save that says "this happened in week N of the career" - a loan
 * return, the day a player joined, a disciplinary incident, a chat allowance -
 * stores `season * BASIS + week`. For most of this game's life that basis WAS
 * SEASON_WEEKS, which meant the season length could never change: bumping it
 * would silently move every stamp already written into every career in progress,
 * and a player mid-loan would find his return date had slid by a season.
 *
 * That bill came due when the owner asked for a five-week tour (7 Sep: "the tour
 * should be over 5 weeks... one midweek game, one weekend game"), which needs
 * three more weeks than the season had.
 *
 * SO IT IS A NAMED CONSTANT, AND IT EQUALS THE SEASON LENGTH. It has to. The
 * first version of this used 100 - comfortably above any season, no migration
 * needed for the next change - and that was wrong in a way five probes found
 * within the hour: the whole point of an absolute week is that subtracting two
 * of them gives a number of WEEKS. With a basis of 100 and a 48-week season,
 * the gap from season 0 week 48 to season 1 week 1 came out as 53 instead of 1,
 * so every duration that crossed an August - a loan running into the next
 * season, a contract clock, how long a manager had been at a club - inflated by
 * 52. Board patience, insolvency and the awards all read those numbers.
 *
 * What this buys is not freedom from migration. It is one place to change, and
 * one migration in save.ts that knows what the basis USED to be, instead of the
 * multiplier being spelled out in seventy-one expressions across nineteen
 * files where changing it means finding every one.
 */
export const WEEK_BASIS = 48
export const absWeek = (season: number, week: number) => season * WEEK_BASIS + week

/**
 * ---- THE OTHER STAMP: season * 100 + week (1.6.3) ----
 *
 * Cooldowns, scouting briefs, building work, staff courses, vows and the
 * courting clock all stamp `season * 100 + week`. That is fine for "is it the
 * same week" and "is it later", and wrong for "how many weeks": a brief
 * commissioned at week 30 for 39 weeks was stamped done at 69, which the next
 * season reaches at week 2 (101 > 69) - so the scout came home after 20 weeks
 * (scripts/qa/basis100.ts). A build ordered at week 44 for ten weeks opened
 * after six for the same reason, and the "I am going nowhere" vow could never
 * be broken across a summer because 101 - 45 is 56, not 4.
 *
 * Rewriting every stamp onto the 48 basis would mean migrating nine fields in
 * every save for a cosmetic gain, so the stamps stay as they are and the
 * ARITHMETIC is done in real weeks: add a duration with addWeeks100, measure
 * one with weeksBetween100. Equality and ordering on raw stamps are still
 * correct and untouched.
 */
export const stamp100 = (state: { season: number; week: number }) => state.season * 100 + state.week
const real100 = (v: number) => Math.floor(v / 100) * WEEK_BASIS + (((v % 100) + 100) % 100)
export const weeksBetween100 = (later: number, earlier: number) => real100(later) - real100(earlier)
export const addWeeks100 = (v: number, weeks: number) => {
  const r = real100(v) + weeks
  return Math.floor((r - 1) / WEEK_BASIS) * 100 + (((r - 1) % WEEK_BASIS) + 1)
}

/**
 * How many weeks a season runs.
 *
 * 45 until v1.5.1, when the tour needed weeks 44 to 48. Nothing domestic moved:
 * the club finals still end at week 43, and the three new weeks are the summer
 * the tour party spends abroad - which is where a real tour is, after the
 * domestic season rather than across it.
 */
export const SEASON_WEEKS = 48

/**
 * How many weeks of the season a club's books actually run for.
 *
 * The season grew to 48 to hold a five-week tour, and the club economy noticed
 * immediately: three more weeks of wages, staff salaries and upkeep, with no
 * club fixture to earn against, because those weeks are an international tour.
 * scripts/aiecon.ts measured the median club's yearly gain falling from £0.85M
 * to £0.30M - not a rounding difference, a third of the game's economy.
 *
 * The three new weeks are therefore CLOSE SEASON for the ledger. Nothing is
 * earned and nothing is spent, which keeps every club's financial year exactly
 * the length it was tuned for, and is a fair description of what those weeks
 * are: the domestic game is over, the tour party has gone, and the rest are on
 * holiday. Extending the season should not have quietly cost every club in the
 * world a third of its income, and it does not.
 */
export const LEDGER_WEEKS = 45

/** The last week a promise can be judged in: the week before the ledger
 *  closes, when the domestic season's last games are played. */
export const LAST_PLEDGE_WEEK = LEDGER_WEEKS - 1

/** When a promise made this week falls due, `span` weeks on.
 *
 *  THE CLOSE SEASON IS NOT A DEADLINE (1.9.1). This was
 *  Math.min(week + span, 44) at both call sites, so a promise made in the
 *  summer window (weeks 46 to 48: a signing told he is in your plans) fell due
 *  in a week already gone and was settled as broken the very next Saturday,
 *  with no match played. Late in the season it gave a promise one week to be
 *  kept. Now a promise with fewer than three playing weeks left falls due past
 *  the end of the season, and rollover carries it into the new one
 *  (carryPledges). */
export function pledgeDue(week: number, span: number): number {
  if (week + span <= LAST_PLEDGE_WEEK) return week + span
  if (week <= LAST_PLEDGE_WEEK - 3) return LAST_PLEDGE_WEEK
  return week + span
}

/** Month and weekday, short, in the language on screen.
 *
 *  A DATE IS NEVER STORED - every screen builds it from the season and week it
 *  already has - so a career started in English reads its own dates back in
 *  French the moment the language changes, and nothing in the save has to move.
 *  French keeps the same order as English (16 août 2025), which is why the
 *  format strings below need no translation of their own. */
export const monthName = (m: number): string => t(`date.mon${m}`)
export const dayAbbr = (d: number): string => t(`date.day${d}`)

/**
 * The Saturday a season opens on, in UTC milliseconds.
 *
 * Every date the game prints is this plus a number of weeks, and the whole
 * calendar rests on one promise made in days.ts: "week N's date IS its
 * Saturday". That promise used to be a coincidence. The anchor was
 * Date.UTC(year, 7, 16) flat, and 16 August is a Saturday in 2025 and in no
 * other year this decade - Sunday in 2026, Monday in 2027, Wednesday in 2028 -
 * so from season one onwards every weekday label was already sliding, and
 * dayprobe never caught it because it only ever read season zero.
 *
 * Moving BASE_YEAR to 2026 for v1.5 dragged that latent drift onto season zero,
 * where the probe finally saw it: "Monday reads as a Monday (Tue 11 Aug)".
 *
 * So the anchor is computed rather than assumed: mid-August, then back to the
 * Saturday on or before it. 2025 is unchanged, which is the point - a men's
 * career started before v1.5 keeps the exact dates it has always printed - and
 * every other season is now right instead of accidentally wrong.
 */
export function seasonStart(season: number): number {
  const mid = Date.UTC(BASE_YEAR + season, 7, 16)
  // getUTCDay: 0 Sun .. 6 Sat. Saturday needs no step back, Sunday one, and so on.
  const back = (new Date(mid).getUTCDay() + 1) % 7
  return mid - back * 86400000
}

export function weekDate(season: number, week: number): string {
  const d = new Date(seasonStart(season) + (week - 1) * 7 * 86400000)
  return `${d.getUTCDate()} ${monthName(d.getUTCMonth())} ${d.getUTCFullYear()}`
}

/** Which day this fixture kicks off: -1 Friday, 0 Saturday, +1 Sunday.
 *  Fixed per fixture, so previews, reports and recovery all agree. */
export const MIDWEEK_OFF = -3 // Wednesday, three days before the Saturday

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
export function fixtureDate(season: number, week: number, fxId: number, dayOff?: number): string {
  const start = seasonStart(season) // the season's opening Saturday
  const d = new Date(start + ((week - 1) * 7 + (dayOff ?? fixtureDayOff(fxId))) * 86400000)
  return `${dayAbbr(d.getUTCDay())} ${d.getUTCDate()} ${monthName(d.getUTCMonth())}`
}

/** One fixture's kick-off date, midweek rounds included: the one call every
 *  screen that dates a fixture makes, so the preview, the Home card and the
 *  report all print the same day (1.8.15). */
export function fxDate(season: number, fx: { week: number; id: number; midweek?: boolean }): string {
  return fixtureDate(season, fx.week, fx.id, fx.midweek ? MIDWEEK_OFF : undefined)
}

/**
 * The real-world year that season 0 starts in.
 *
 * 2025 until v1.5, when the owner asked for both games to run 26/27: "both
 * should run 26/27". The women's database is a 2026-27 squad list and the men's
 * competitions are dated from the same August, so one constant moves both.
 *
 * Everything year-shaped reads this rather than a literal, which matters most
 * for the two cycles that must keep landing on their REAL years: the World
 * Championship every fourth year and the Lions tour four years off it. Both are
 * computed from the absolute year rather than the season index, so moving the
 * base moves the season they fall in and leaves the year alone - the World
 * Championship is still 2027 and the Lions still 2029, they just arrive a season
 * sooner in a career. isWorldCupSeason and isLionsSeason are the proof.
 *
 * A career saved before v1.5 keeps its season NUMBER and gains a year on its
 * LABEL: a save that read 2025-26 now reads 2026-27. Nothing about the career
 * changes, and in closed testing that is the cheaper of the two wrongs - the
 * alternative is storing a base year per save so old careers keep old labels,
 * which is a field on every save for ever to spare 39 testers a one-off shift.
 */
export const BASE_YEAR = 2026

export function seasonLabel(season: number): string {
  const y = BASE_YEAR + season
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
}
