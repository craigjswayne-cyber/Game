/**
 * ---- WHERE THE GROUNDS ACTUALLY ARE (F27) ----
 *
 * Every match in this game used to be played in the same place. Not literally -
 * the fixture knew whose ground it was, and the crowd was counted - but nothing
 * about WHERE the ground is ever reached the pitch. A URC side flew from Belfast
 * to Pretoria, climbed thirteen hundred metres, and played exactly the match it
 * would have played at home in the rain. Super Rugby sent Fijian sides to Dunedin
 * and Perth sides across a continent, and it cost them nothing.
 *
 * So this is the geography: real coordinates, real altitudes, city-level
 * precision, which is all a distance band needs. Nothing here is a claim about
 * anybody - it is where the towns are.
 *
 * Altitude is the number that carries the most weight, and it is why Ellis Park
 * and Loftus are listed to the metre while everywhere else is rounded: sea level
 * is sea level, and the interesting cases are the two grounds on the highveld.
 */

export type Climate = 'temperate' | 'mediterranean' | 'subtropical' | 'tropical'

export interface Venue {
  lat: number
  lon: number
  /** metres above sea level */
  alt: number
}

/** City -> where it is. Keyed on the city string the club data already carries. */
export const VENUES: Record<string, Venue> = {
  // ---- Australia
  Brisbane: { lat: -27.5, lon: 153.0, alt: 27 },
  Canberra: { lat: -35.3, lon: 149.1, alt: 577 },
  Perth: { lat: -32.0, lon: 115.9, alt: 15 },
  Sydney: { lat: -33.9, lon: 151.2, alt: 19 },
  // ---- England
  Bath: { lat: 51.4, lon: -2.4, alt: 20 },
  Bedford: { lat: 52.1, lon: -0.5, alt: 30 },
  Birmingham: { lat: 52.5, lon: -1.9, alt: 140 },
  Bristol: { lat: 51.5, lon: -2.6, alt: 11 },
  Cambridge: { lat: 52.2, lon: 0.1, alt: 12 },
  Chinnor: { lat: 51.7, lon: -0.9, alt: 100 },
  Cinderford: { lat: 51.8, lon: -2.5, alt: 150 },
  Coventry: { lat: 52.4, lon: -1.5, alt: 80 },
  Darlington: { lat: 54.5, lon: -1.6, alt: 40 },
  Doncaster: { lat: 53.5, lon: -1.1, alt: 15 },
  Esher: { lat: 51.4, lon: -0.4, alt: 15 },
  Exeter: { lat: 50.7, lon: -3.5, alt: 14 },
  Gloucester: { lat: 51.9, lon: -2.2, alt: 15 },
  Leeds: { lat: 53.8, lon: -1.5, alt: 60 },
  Leicester: { lat: 52.6, lon: -1.1, alt: 60 },
  London: { lat: 51.5, lon: -0.1, alt: 11 },
  Manchester: { lat: 53.5, lon: -2.2, alt: 40 },
  'Newcastle upon Tyne': { lat: 55.0, lon: -1.6, alt: 40 },
  Northampton: { lat: 52.2, lon: -0.9, alt: 68 },
  Nottingham: { lat: 53.0, lon: -1.1, alt: 40 },
  Penzance: { lat: 50.1, lon: -5.5, alt: 20 },
  Plymouth: { lat: 50.4, lon: -4.1, alt: 20 },
  Reading: { lat: 51.5, lon: -1.0, alt: 40 },
  Richmond: { lat: 51.5, lon: -0.3, alt: 10 },
  Sale: { lat: 53.4, lon: -2.3, alt: 30 },
  Salford: { lat: 53.5, lon: -2.3, alt: 35 },
  Wirral: { lat: 53.4, lon: -3.1, alt: 20 },
  // ---- Fiji
  Suva: { lat: -18.1, lon: 178.4, alt: 6 },
  // ---- France
  Agen: { lat: 44.2, lon: 0.6, alt: 50 },
  'Aix-en-Provence': { lat: 43.5, lon: 5.4, alt: 173 },
  Bayonne: { lat: 43.5, lon: -1.5, alt: 6 },
  Biarritz: { lat: 43.5, lon: -1.6, alt: 20 },
  Bordeaux: { lat: 44.8, lon: -0.6, alt: 8 },
  'Brive-la-Gaillarde': { lat: 45.2, lon: 1.5, alt: 120 },
  Béziers: { lat: 43.3, lon: 3.2, alt: 20 },
  Carcassonne: { lat: 43.2, lon: 2.4, alt: 110 },
  Castres: { lat: 43.6, lon: 2.2, alt: 172 },
  'Clermont-Ferrand': { lat: 45.8, lon: 3.1, alt: 411 },
  Colomiers: { lat: 43.6, lon: 1.3, alt: 150 },
  Dax: { lat: 43.7, lon: -1.1, alt: 10 },
  Grenoble: { lat: 45.2, lon: 5.7, alt: 214 },
  'La Rochelle': { lat: 46.2, lon: -1.2, alt: 8 },
  Lyon: { lat: 45.8, lon: 4.8, alt: 170 },
  'Mont-de-Marsan': { lat: 43.9, lon: -0.5, alt: 30 },
  Montauban: { lat: 44.0, lon: 1.4, alt: 90 },
  Montpellier: { lat: 43.6, lon: 3.9, alt: 27 },
  Nanterre: { lat: 48.9, lon: 2.2, alt: 35 },
  Nevers: { lat: 47.0, lon: 3.2, alt: 180 },
  Oyonnax: { lat: 46.3, lon: 5.7, alt: 540 },
  Paris: { lat: 48.9, lon: 2.4, alt: 35 },
  Pau: { lat: 43.3, lon: -0.4, alt: 200 },
  Perpignan: { lat: 42.7, lon: 2.9, alt: 42 },
  Toulon: { lat: 43.1, lon: 5.9, alt: 10 },
  Toulouse: { lat: 43.6, lon: 1.4, alt: 146 },
  Valence: { lat: 44.9, lon: 4.9, alt: 126 },
  Vannes: { lat: 47.7, lon: -2.8, alt: 20 },
  // ---- Ireland
  Belfast: { lat: 54.6, lon: -5.9, alt: 15 },
  Dublin: { lat: 53.3, lon: -6.3, alt: 20 },
  Galway: { lat: 53.3, lon: -9.1, alt: 8 },
  Limerick: { lat: 52.7, lon: -8.6, alt: 12 },
  // ---- Italy
  Parma: { lat: 44.8, lon: 10.3, alt: 57 },
  Treviso: { lat: 45.7, lon: 12.2, alt: 15 },
  // ---- Japan
  Fuchu: { lat: 35.7, lon: 139.5, alt: 50 },
  Funabashi: { lat: 35.7, lon: 140.0, alt: 5 },
  Iwata: { lat: 34.7, lon: 137.9, alt: 20 },
  Kobe: { lat: 34.7, lon: 135.2, alt: 10 },
  Kumagaya: { lat: 36.1, lon: 139.4, alt: 30 },
  Sagamihara: { lat: 35.6, lon: 139.4, alt: 90 },
  Setagaya: { lat: 35.6, lon: 139.7, alt: 40 },
  Suzuka: { lat: 34.9, lon: 136.6, alt: 30 },
  Toyota: { lat: 35.1, lon: 137.2, alt: 50 },
  Urayasu: { lat: 35.7, lon: 140.0, alt: 3 },
  Yokohama: { lat: 35.4, lon: 139.6, alt: 10 },
  // ---- New Zealand
  Auckland: { lat: -36.9, lon: 174.8, alt: 25 },
  Christchurch: { lat: -43.5, lon: 172.6, alt: 20 },
  Dunedin: { lat: -45.9, lon: 170.5, alt: 5 },
  Hamilton: { lat: -37.8, lon: 175.3, alt: 40 },
  Wellington: { lat: -41.3, lon: 174.8, alt: 15 },
  // ---- South Africa. The highveld is the whole point of this table.
  'Cape Town': { lat: -33.9, lon: 18.4, alt: 25 },
  Durban: { lat: -29.9, lon: 31.0, alt: 10 },
  Johannesburg: { lat: -26.2, lon: 28.0, alt: 1753 },
  Pretoria: { lat: -25.7, lon: 28.2, alt: 1339 },
  // ---- Scotland
  Edinburgh: { lat: 56.0, lon: -3.2, alt: 47 },
  Glasgow: { lat: 55.9, lon: -4.3, alt: 40 },
  // ---- Wales
  Cardiff: { lat: 51.5, lon: -3.2, alt: 10 },
  Llanelli: { lat: 51.7, lon: -4.2, alt: 10 },
  Newport: { lat: 51.6, lon: -3.0, alt: 10 },
  Swansea: { lat: 51.6, lon: -3.9, alt: 10 },
}

/** Fallback by country, for a club whose city is not in the table.
 *
 *  A club with no venue would otherwise silently score zero on everything, which
 *  reads as "no travel at all" - the least honest possible answer for a ground
 *  nobody has placed. The country centroid is wrong by a few hundred kilometres
 *  and right by ten thousand, which is the scale that matters here. */
export const COUNTRY_CENTRES: Record<string, Venue> = {
  ENG: { lat: 52.5, lon: -1.5, alt: 60 },
  WAL: { lat: 52.1, lon: -3.6, alt: 100 },
  SCO: { lat: 56.5, lon: -4.2, alt: 100 },
  IRE: { lat: 53.3, lon: -7.8, alt: 60 },
  FRA: { lat: 46.6, lon: 2.4, alt: 200 },
  ITA: { lat: 43.5, lon: 12.0, alt: 300 },
  RSA: { lat: -29.0, lon: 25.0, alt: 1200 },
  NZL: { lat: -41.0, lon: 173.0, alt: 60 },
  AUS: { lat: -25.0, lon: 134.0, alt: 300 },
  FIJ: { lat: -17.8, lon: 178.0, alt: 30 },
  JPN: { lat: 36.0, lon: 138.0, alt: 300 },
}

/** Where a club plays, by city if it is known and by country if it is not. */
export function venueOf(city: string | undefined, country: string | undefined): Venue | null {
  if (city && VENUES[city]) return VENUES[city]
  if (country && COUNTRY_CENTRES[country]) return COUNTRY_CENTRES[country]
  return null
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: Venue, b: Venue): number {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))))
}

/** Rough hours of clock change between two venues.
 *
 *  Longitude over fifteen degrees per hour. Not the political timezone - nobody
 *  is booking flights here - but the body-clock shift, which is what a squad
 *  actually feels, and which is what the number is used for. */
export function tzShift(a: Venue, b: Venue): number {
  return Math.round(Math.abs(b.lon - a.lon) / 15)
}

/** The climate band a venue sits in, from where it is rather than a hand-written
 *  field per city: fewer numbers to enter is fewer numbers to get wrong. */
export function climateOf(v: Venue): Climate {
  const lat = Math.abs(v.lat)
  if (lat < 23.5) return 'tropical'
  if (lat < 31) return 'subtropical'
  if (lat < 45) return 'mediterranean'
  return 'temperate'
}

/**
 * How warm it is at a venue in a given week of the season, 0 (bitter) to 1 (hot).
 *
 * The season runs from late summer through winter and out the other side, so week
 * is a phase rather than a date. The southern hemisphere gets the same phase with
 * the sign flipped, which is the whole reason this cannot be a single global
 * weather roll: while Leicester is frozen in February, Durban is not.
 */
export function warmth(v: Venue, week: number, seasonWeeks: number): number {
  const phase = (week - 1) / Math.max(1, seasonWeeks - 1)      // 0..1 across the season
  // a northern season starts warm, troughs mid-winter, ends warm again
  const north = 0.5 + 0.5 * Math.cos(phase * 2 * Math.PI)
  const seasonal = v.lat >= 0 ? north : 1 - north
  // and the baseline: the closer to the equator, the less the calendar matters
  const tropicality = Math.max(0, 1 - Math.abs(v.lat) / 55)
  return Math.max(0, Math.min(1, tropicality * 0.55 + seasonal * 0.45))
}
