import type { GameState } from './model'
import { SEASON_WEEKS } from './model'
import { climateOf, distanceKm, tzShift, venueOf, warmth, type Venue } from './geo'

/**
 * ---- THE ROAD, THE THIN AIR AND THE HEAT (F27) ----
 *
 * Home advantage in this engine was one number, 1.06, and it meant everything at
 * once: the crowd, the changing room you know, the fact the other lot got on a
 * bus. That is fine for a league where every away trip is two hours up the M1. It
 * is nonsense for a world with Belfast in the same competition as Pretoria.
 *
 * So the single number becomes a number that varies by WHERE, and the crucial
 * discipline is that it varies WITHOUT MOVING THE AVERAGE. If travel were simply
 * added on top, every away side in the world would be worse off than before, home
 * wins would climb straight out of their calibrated 55 to 56 per cent band, and
 * the whole simulation would have been retuned by accident. This has been the
 * failure mode six times now.
 *
 * The fix is redistribution, not addition. Each fixture gets a raw hardship score
 * from distance, body-clock shift, altitude gap and climate gap. The score is then
 * CENTRED on the world's own average before it touches anything, so a trip that is
 * harder than average makes the home side stronger and a trip that is easier than
 * average makes it weaker, and the two cancel across a season. A local derby is
 * now slightly LESS of a home advantage than it used to be, which is correct and
 * is the part that keeps the books balanced.
 */

/** The world's mean raw hardship, measured rather than guessed.
 *
 *  scripts/venueprobe.ts walks every fixture of a full season in every
 *  competition and reports the mean. If the fixture list changes shape - a new
 *  league, a competition that crosses hemispheres where none did before - the
 *  probe fails and this constant is what gets corrected. Do not tune it to make
 *  a match feel right; it exists to hold the average still. */
export const RAW_MEAN = 0.1235

/** How far the home edge is allowed to swing either side of its old flat value.
 *  0.05 puts a highveld trip near 11 per cent and a local derby near 5.5. */
const SPREAD = 0.05

export interface VenueEffect {
  /** as the crow flies, kilometres */
  km: number
  /** hours of body-clock shift */
  tz: number
  /** metres above sea level at the ground */
  alt: number
  /** metres the visitors have climbed relative to their own home */
  altGap: number
  /** how far the venue's warmth is from what the visitors are used to, 0 to 1 */
  heatGap: number
  /** the multiplier on home advantage. Mean 1.0 across the world by construction. */
  edge: number
  /** the raw, uncentred hardship, for the probe that keeps the mean honest */
  raw: number
  /** one line for the briefing, or null when there is nothing worth saying */
  note: string | null
}

const NEUTRAL: VenueEffect = {
  km: 0, tz: 0, alt: 0, altGap: 0, heatGap: 0, edge: 1, raw: RAW_MEAN, note: null,
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0
}

/** Where a team plays, whether it is a club or a nation.
 *
 *  Nations are not in state.clubs, so a Test match resolves to nothing and comes
 *  back neutral. That is deliberate: a touring international side is a different
 *  problem from a league fixture, the engine already gives Tests their own smaller
 *  home edge, and inventing a home ground for a country would be inventing data. */
function venueFor(state: GameState, teamId: string): Venue | null {
  const c = state.clubs?.[teamId]
  if (!c) return null
  return venueOf(c.city, c.country)
}

/**
 * What this ground does to the side that has travelled to it.
 *
 * Returns a neutral effect for anything it cannot place, so a damaged save or a
 * Test match behaves exactly as it did before this existed.
 */
export function venueEffect(state: GameState, homeId: string, awayId: string, week: number): VenueEffect {
  const h = venueFor(state, homeId)
  const a = venueFor(state, awayId)
  if (!h || !a) return NEUTRAL

  const km = distanceKm(a, h)
  const tz = tzShift(a, h)
  // Distance and jetlag are separate hardships: Perth to Sydney is a long way in
  // the same body clock, London to Johannesburg is nearly the same distance with
  // almost no clock change, and a trip to Tokyo is both.
  const far = clamp01(km / 12000)
  const jet = clamp01(tz / 10)
  const travel = far * 0.6 + jet * 0.4

  // Altitude is a GAP, not a height. A Bulls side is not troubled by Loftus.
  const altGap = h.alt - a.alt
  const thin = clamp01(altGap / 1500)

  // Climate cuts both ways: a South African side in a Scottish February is as far
  // from home as a Scottish side in a Durban August. The visitor pays either way.
  const heatGap = Math.abs(warmth(h, week, SEASON_WEEKS) - warmth(a, week, SEASON_WEEKS))
  const heat = clamp01(heatGap * 1.4)

  const raw = travel * 0.5 + thin * 0.32 + heat * 0.18
  const edge = 1 + (raw - RAW_MEAN) * SPREAD

  return { km, tz, alt: h.alt, altGap, heatGap, edge, raw, note: noteFor(km, tz, altGap, heatGap, h) }
}

/** The line the analyst reads out, or nothing.
 *
 *  Deterministic on the numbers, never on the match rng: the same trip has to
 *  produce the same warning every time, or the briefing is noise. Ordered by what
 *  a coach would actually lead with. */
function noteFor(km: number, tz: number, altGap: number, heatGap: number, h: Venue): string | null {
  if (altGap >= 1000) {
    return `Altitude. The ground sits ${Math.round(h.alt)}m up and the air is thin, so legs go earlier than the clock says. Expect the last quarter to hurt.`
  }
  if (altGap >= 500) {
    return `A noticeable climb to ${Math.round(h.alt)}m. Not the highveld, but enough that the forwards will feel the second half.`
  }
  if (km >= 8000) {
    return `${km.toLocaleString()}km and ${tz} hours of clock change. Long-haul rugby: the squad will not be fresh, whatever the medical room says.`
  }
  if (km >= 3000) {
    return `A genuine trek at ${km.toLocaleString()}km${tz >= 3 ? ` and ${tz} hours of time difference` : ''}. Travel legs are a factor here.`
  }
  if (heatGap >= 0.45) {
    const hot = climateOf(h) === 'tropical' || climateOf(h) === 'subtropical'
    return hot
      ? 'Heat and humidity nobody in this squad trains in. Hydration and tempo control, or it gets away from us late on.'
      : 'Cold, and colder than this lot are built for. Keep the ball off the deck and make them handle it.'
  }
  if (km >= 1200) {
    return `${km.toLocaleString()}km on the road. Not far enough to blame, far enough to notice.`
  }
  return null
}

/** A short badge for the fixture list and the club screen: "1,753m" or "9,200km". */
export function venueBadge(e: VenueEffect): string | null {
  if (e.altGap >= 500) return `${e.alt.toLocaleString()}m`
  if (e.km >= 3000) return `${e.km.toLocaleString()}km`
  return null
}
