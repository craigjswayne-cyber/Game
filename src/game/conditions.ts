// ---- THE DAY: WEATHER, THE GROUND UNDERFOOT AND WHAT THE WHISTLE IS DOING (1.8.2 depth) ----
//
// THE WEATHER. Every match has conditions, one of dry, damp, wet (rain, or
// snow in the depths of a northern winter) and windy, read off the fixture:
// where it is played (geo.ts: how far from the equator, which hemisphere) and
// when (the week, as a phase of that ground's year), and a hash of the world,
// the season and the fixture for which of the likely skies it gets. No draw on
// the shared rng: the match still takes the one draw the old weather roll
// took, so every later dice is where it was, and the forecast on the Match
// Day screen is the day itself, not a guess at it.
//
// What each does is on the levers the engine already had:
//   the units      wet takes a tenth off attack and adds to the breakdown
//                  (forward weather), damp a third of that; wind takes a
//                  little off the kicking unit (matchEngine weatherUnits)
//   goal kicking   a harder kick at goal in wind, rain, snow and a little in the damp
//   handling       a wet ball is turned over more, and most by the handling
//                  styles (styles.ts WET_TURN, WET_HANDLE); the direct and
//                  kicking games and the choke tackle suit it (WET_TRY)
//   the kick       wind cuts what a kicking game's territory is worth (WIND_TERR)
//
// THE GROUND. A club's pitch is grass, hybrid (grass stitched with fibre) or
// artificial. The artificial grounds are the ones on the public record; every
// other ground's surface is a hash of the club, more hybrids at the top of the
// game. An artificial pitch is harder underfoot, so contact costs a little
// more there (injuryF); it also drains, so a wet day handles a little less
// badly on it (wetness).
//
// THE WHISTLE. The referee's four opinions (matchEngine REF_PANEL) are what
// the conditions card reads out before the match; at half time the assistant
// reads what has actually happened against them (halfTimeHints).
import type { Club, Fixture, GameState, Weather } from './model'
import { SEASON_WEEKS } from './model'
import { venueOf, climateOf, warmth } from './geo'
import { hashString, mulberry32 } from './rng'
import { ATK_CONTACT, DEF_HITS, DEF_OWN, type SideStyle, type StyleWx } from './styles'

export type Surface = 'grass' | 'hybrid' | 'artificial'
export const SURFACES: Surface[] = ['grass', 'hybrid', 'artificial']

/** Grounds with an artificial pitch, on the public record (the women's side
 *  of a club plays at the same ground). Gloucester's Kingsholm joined the
 *  list at the owner's word (1.8.2). */
const ARTIFICIAL = new Set(['saracens', 'newcastle', 'cardiff', 'glasgow', 'edinburgh', 'racing92', 'gloucester'])
/** the top of the game, where most grounds are hybrid */
const TOP_TIER = new Set(['prem', 'top14', 'urc', 'srp', 'jl1', 'w:pwr', 'w:e1', 'w:pac', 'w:celt'])

/** A club's pitch. */
export function clubSurface(club: Pick<Club, 'id' | 'leagueId'>): Surface {
  const id = club.id.replace(/^w:/, '')
  if (ARTIFICIAL.has(id)) return 'artificial'
  const u = (hashString(`${id}|surface`) >>> 0) / 4294967296
  if (TOP_TIER.has(club.leagueId)) return u < 0.62 ? 'hybrid' : 'grass'
  return u < 0.14 ? 'artificial' : u < 0.32 ? 'hybrid' : 'grass'
}

/** The pitch a fixture is played on: the home club's, and a showpiece
 *  ground's (and a Test ground's) is hybrid. */
export function surfaceOf(state: GameState, fx: Pick<Fixture, 'homeId' | 'venue'>): Surface {
  if (fx.venue) return 'hybrid'
  const c = state.clubs[fx.homeId]
  return c ? clubSurface(c) : 'hybrid'
}

/**
 * The conditions for a fixture. `winter` runs 0 at the height of that
 * ground's summer to 1 in the depth of its winter (the southern hemisphere's
 * year is the other way round); the climate band scales how wet it is.
 *
 * Calibrated against the old seasonal roll (about a quarter of matches in
 * rain or snow, one in eight in wind): a damp day costs a third of what a wet
 * one does, so the wet share came down as the damp one went in, and the
 * world's attack gives up to the weather about what it did before.
 */
export function matchConditions(state: GameState, fx: Pick<Fixture, 'id' | 'week' | 'homeId' | 'venue'>): Weather {
  const home = state.clubs[fx.homeId]
  const v = fx.venue ? venueOf(fx.venue.city, undefined) : venueOf(home?.city, home?.country ?? fx.homeId)
  const lat = v?.lat ?? 50
  const phase = (fx.week - 1) / Math.max(1, SEASON_WEEKS - 1)
  const north = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI) // 0 at the season's ends, 1 mid-season
  const winter = lat >= 0 ? north : 1 - north
  const climate = v ? climateOf(v) : 'temperate'
  const c = climate === 'temperate' ? 1.1 : climate === 'tropical' ? 1.05 : 0.8
  const pSnow = climate === 'temperate' && Math.abs(lat) >= 45 && winter > 0.8 ? 0.04 : 0
  const pRain = c * (0.07 + 0.22 * winter)
  const pDamp = c * (0.12 + 0.08 * winter)
  const pWind = 0.1 + 0.05 * winter + (Math.abs(lat) >= 40 ? 0.02 : 0)
  const u = mulberry32(((state.seed ^ Math.imul(fx.id | 0, 0x2C1B3C6D) ^ Math.imul(state.season | 0, 0x297A2D39)) >>> 0) || 1)()
  if (u < pSnow) return 'Snow'
  if (u < pSnow + pRain) return 'Rain'
  if (u < pSnow + pRain + pDamp) return 'Damp'
  if (u < pSnow + pRain + pDamp + pWind) return 'Wind'
  return 'Dry'
}

/**
 * A HOT AFTERNOON (1.8.16, owner's coverage list item 31). A dry day early or
 * late in the season, and anywhere warm: legs go sooner and the referee stops
 * the game for water at the quarters. Off the venue's warmth for the week and
 * a hash of the fixture, so it is the fixture's day and never a draw. In
 * England it is a September or May thing, and not every September Saturday.
 */
export function hotDay(state: GameState, fx: Pick<Fixture, 'id' | 'week' | 'homeId' | 'venue'>, weather: Weather): boolean {
  if (weather !== 'Dry') return false
  const home = state.clubs[fx.homeId]
  const v = fx.venue ? venueOf(fx.venue.city, undefined) : venueOf(home?.city, home?.country ?? fx.homeId)
  if (!v) return false
  const w = warmth(v, fx.week, SEASON_WEEKS)
  const u = mulberry32(((state.seed ^ Math.imul(fx.id | 0, 0x3C6EF372) ^ Math.imul(state.season | 0, 0x407)) >>> 0) || 1)()
  return w >= 0.45 && u < (w - 0.4) * 4
}

/** the home edge on an artificial pitch against a side from grass (matchEngine) */
export const ART_HOME = 1.03

/** How wet the ball is, 0 dry to 1.2 snow; an artificial pitch drains, so a
 *  wet day on one handles like a damper one. */
export function wetness(w: Weather | null | undefined, surface?: Surface): number {
  const base = w === 'Snow' ? 1.2 : w === 'Rain' ? 1 : w === 'Damp' ? 0.5 : 0
  return surface === 'artificial' ? base * 0.7 : base
}

/** The day as the styles read it. */
export const styleWx = (w: Weather | null | undefined, surface?: Surface): StyleWx =>
  ({ wet: wetness(w, surface), windy: w === 'Wind' })

/** the harder kick at goal each sky makes */
export function goalPenaltyOf(w: Weather | null | undefined): number {
  return w === 'Snow' ? 0.1 : w === 'Rain' || w === 'Wind' ? 0.09 : w === 'Damp' ? 0.035 : 0
}

// ---------------------------------------------------------------- injuries

/** what the surface does to the knocks: artificial is harder underfoot */
export const SURF_INJ: Record<Surface, number> = { grass: 0.97, hybrid: 1.0, artificial: 1.1 }
/** The world's mean of the raw factor below over every AI fixture of a season
 *  in three worlds (scripts/depthprobe.ts measures it), so the world's count
 *  of injuries stays where it was: the styles and the ground shift who is
 *  hurt, not how many. */
export const INJ_NORM = 1.015

/**
 * A side's share of the match's injury roll: its own carrying, the other
 * side's tackling, its own tackling, and the ground. A multiplier on the
 * per-tick chance (0.036) that somebody on this side goes down; exactly 1 for
 * a side with no style (a Test side) on a hybrid pitch.
 */
export function injuryF(own: SideStyle | undefined, opp: SideStyle | undefined, surface: Surface): number {
  const s = SURF_INJ[surface]
  if (!own || !opp) return s
  return ATK_CONTACT[own.atk] * DEF_HITS[opp.def] * DEF_OWN[own.def] * s / INJ_NORM
}

// ---------------------------------------------------------------- the words

export const wxKey = (w: Weather) => `matchday.wx${w}`
export const surfKey = (s: Surface) => `matchday.surf_${s}`

/** One line for the conditions card: what the sky will do to the rugby. */
export function wxEffectKey(w: Weather): string {
  return `matchday.wxFx${w}`
}

/** What the referee's opinions are, for anything that wants them without the
 *  whole engine: the fields the card and the half-time read use. */
export interface RefRead { name: string; scrum: number; breakdown: number; patience: number; flow: number }

/** What the assistant says at half time, off what has happened so far: at
 *  most two lines, each an i18n key and its values, the most pressing first.
 *  Pure reads of the match; nothing drawn. `mine` and `theirs` carry the few
 *  numbers it reads.
 *
 *  WHAT IS WORKING AND WHAT IS HURTING (1.8.3) come in as `evidence`
 *  (evidence.ts htEvidence: at most one of each, with its number), and
 *  since 1.8.4 each keeps a place of the two, working first: the reads here
 *  fill what is left. They replaced the scrum ratio and the count of ball
 *  won back that this used to work out for itself; and where a read here is
 *  about the same thing as the hurting line (the penalty count, the ball
 *  lost, the set piece), only the weightier is said, under its label. */
export interface HalfSide {
  consPens: number
  turnLost: number
  turnWon: number
  score: number
}
export interface HalfLine {
  k: string
  v?: Record<string, string | number>
  tag?: 'work' | 'hurt'
  /** the evidence cause behind a working or hurting line (evidence.ts
   *  WhyCause), for the dial that answers it */
  cause?: string
}
export function halfTimeHints(ref: RefRead, weather: Weather | null | undefined, mine: HalfSide, theirs: HalfSide, uncontested: boolean,
  evidence: (HalfLine & { w: number; about?: 'pens' | 'ball' | 'set' })[] = []): HalfLine[] {
  const out: (HalfLine & { w: number; about?: string })[] = []
  // the whistle at the breakdown
  if (mine.consPens >= ref.patience - 1) out.push({ w: 5, k: 'matchday.htPensBin', v: { n: mine.consPens, ref: ref.name }, about: 'pens' })
  else if (ref.breakdown <= 0.95 && mine.consPens >= 3) out.push({ w: 4, k: 'matchday.htRefTight', v: { ref: ref.name }, about: 'pens' })
  else if (ref.breakdown >= 1.05 && theirs.turnWon < mine.turnWon) out.push({ w: 2, k: 'matchday.htRefLoose', v: { ref: ref.name } })
  // the weather in our hands
  const wet = wetness(weather)
  if (wet > 0 && mine.turnLost >= 3) out.push({ w: 4.5, k: 'matchday.htWetHands', about: 'ball' })
  else if (wet >= 1 && mine.turnLost >= 1) out.push({ w: 2.5, k: 'matchday.htWetTight', about: 'ball' })
  if (weather === 'Wind') out.push({ w: 2, k: 'matchday.htWind' })
  // the set piece
  if (uncontested) out.push({ w: 3, k: 'matchday.htUncontested', about: 'set' })
  // WHAT THE FIRST FORTY WAS MADE OF, BOTH SIDES OF IT (1.8.4). A working
  // and a hurting line each keep a place when the evidence has one, rather
  // than being outweighed by the reads here: the manager is owed what to
  // keep and what to change. A read about the same thing as the hurting
  // line, and weightier, speaks in its place under its label (the bin is
  // nearer than the count). The reads fill whatever place is left.
  const tagged: (HalfLine & { w: number; about?: string })[] = []
  for (const e of [...evidence].sort((a, b) => (a.tag === 'work' ? 0 : 1) - (b.tag === 'work' ? 0 : 1))) {
    const same = e.tag === 'hurt' && e.about ? out.findIndex(o => o.about === e.about) : -1
    const read = same >= 0 ? out.splice(same, 1)[0] : null
    tagged.push(read && read.w > e.w ? { ...read, tag: e.tag, cause: e.cause } : e)
  }
  const rest = out.sort((a, b) => b.w - a.w).slice(0, Math.max(0, 2 - tagged.length))
  const rank = (l: HalfLine) => (l.tag === 'work' ? 0 : l.tag === 'hurt' ? 1 : 2)
  return [...tagged.slice(0, 2), ...rest].sort((a, b) => rank(a) - rank(b) || b.w - a.w)
    .map(({ k, v, tag, cause }) => ({ k, ...(v ? { v } : {}), ...(tag ? { tag } : {}), ...(cause ? { cause } : {}) }))
}

/** one line for the card on how the ground plays */
export const surfaceNote = (s: Surface): string => `matchday.surfFx_${s}`
