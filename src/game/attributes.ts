import type { Pos, RawPlayer } from '../data/types'
import type { Attrs, Personality, Player } from './model'
import { emptyStats } from './model'
import { clamp, gauss, hashString, mulberry32, wpick, type Rng } from './rng'

/** Assign a character type, nudged by leadership and aggression. */
export function assignPersonality(rng: Rng, a: Attrs): Personality {
  const opts: Personality[] = ['Professional', 'Loyal', 'Ambitious', 'Mercenary', 'Temperamental', 'Leader']
  const w = [30, 18, 18, 9, 8 + (a.agg >= 15 ? 10 : 0), 8 + (a.lea >= 14 ? 14 : 0)]
  return wpick(rng, opts, w)
}

// Positional attribute templates: importance weight 0..1 of each attribute
// for the position. Derived attribute = base from quality scaled by weight,
// plus noise, so a 90-rated prop has monster scrummaging but modest passing.

type T = Partial<Record<keyof Attrs, number>>

const BASE: Record<keyof Attrs, number> = {
  tac: 0.55, str: 0.55, scr: 0.2, lin: 0.2, ruc: 0.5, han: 0.55, pas: 0.5,
  kic: 0.25, goa: 0.1, pac: 0.5, sta: 0.6, agi: 0.5, vis: 0.45, dec: 0.55,
  pos: 0.55, agg: 0.55, lea: 0.4, wor: 0.6,
}

const TEMPLATES: Record<Pos, T> = {
  LP: { scr: 1, str: 1, ruc: 0.85, tac: 0.8, agg: 0.85, pac: 0.15, agi: 0.2, vis: 0.2, kic: 0.02, goa: 0, han: 0.4, pas: 0.3, lin: 0.35 },
  HK: { scr: 0.9, lin: 1, str: 0.95, ruc: 0.85, tac: 0.85, agg: 0.85, pac: 0.25, han: 0.5, pas: 0.35, kic: 0.02, goa: 0, vis: 0.3 },
  TP: { scr: 1, str: 1, ruc: 0.8, tac: 0.8, agg: 0.85, pac: 0.12, agi: 0.18, vis: 0.2, kic: 0.02, goa: 0, han: 0.35, pas: 0.28, lin: 0.35 },
  LK: { lin: 1, str: 0.95, scr: 0.8, ruc: 0.85, tac: 0.85, agg: 0.8, pac: 0.25, han: 0.5, pas: 0.35, kic: 0.03, goa: 0, vis: 0.3, lea: 0.6 },
  FL: { tac: 1, ruc: 1, str: 0.85, agg: 0.9, wor: 1, pac: 0.55, han: 0.6, pas: 0.45, lin: 0.6, scr: 0.5, kic: 0.05, goa: 0, vis: 0.4 },
  N8: { str: 0.95, ruc: 0.95, tac: 0.9, han: 0.75, pac: 0.6, agg: 0.9, lin: 0.6, scr: 0.5, pas: 0.5, kic: 0.08, goa: 0, vis: 0.5 },
  SH: { pas: 1, vis: 0.9, dec: 0.9, kic: 0.75, agi: 0.85, pac: 0.7, han: 0.85, tac: 0.5, str: 0.3, ruc: 0.35, scr: 0.05, lin: 0.05, goa: 0.15 },
  FH: { kic: 1, vis: 1, dec: 1, pas: 0.95, han: 0.85, goa: 0.6, agi: 0.7, pac: 0.6, tac: 0.45, str: 0.3, ruc: 0.25, scr: 0.02, lin: 0.02 },
  CE: { han: 0.85, tac: 0.85, str: 0.75, pac: 0.8, agi: 0.75, vis: 0.7, pas: 0.75, dec: 0.75, kic: 0.4, goa: 0.1, ruc: 0.55, scr: 0.03, lin: 0.05 },
  WG: { pac: 1, agi: 0.95, han: 0.8, tac: 0.55, pos: 0.7, str: 0.55, vis: 0.5, pas: 0.5, kic: 0.35, goa: 0.05, ruc: 0.4, scr: 0.02, lin: 0.05 },
  FB: { pos: 1, kic: 0.85, han: 0.85, pac: 0.85, agi: 0.8, tac: 0.7, dec: 0.8, vis: 0.7, pas: 0.65, goa: 0.3, str: 0.5, ruc: 0.35, scr: 0.02, lin: 0.03 },
}

export function deriveAttrs(raw: RawPlayer, seed: number): Attrs {
  const rng = mulberry32(seed ^ hashString(raw.name))
  const t = TEMPLATES[raw.pos]
  const out = {} as Attrs
  for (const k of Object.keys(BASE) as (keyof Attrs)[]) {
    const w = t[k] !== undefined ? t[k]! : BASE[k]
    // quality 50->ca. 8 base, 100-> 20 at full weight
    const core = (raw.q / 100) * 20
    const val = core * (0.45 + 0.55 * w) + gauss(rng) * 1.6
    out[k] = clamp(Math.round(val), 1, 20)
  }
  if (raw.gk) out.goa = clamp(Math.round((raw.q / 100) * 20 - 1 + gauss(rng)), 12, 20)
  else if (raw.pos === 'FH') out.goa = clamp(out.goa, 6, 17)
  // leadership grows with age
  out.lea = clamp(out.lea + Math.floor((raw.age - 24) / 3), 1, 20)
  return out
}

/**
 * ---- THE VALUATION ENGINE (25D) ----
 *
 * User: "at the moment the value of a player is too linked to age rather than
 * talent." He was right, twice over. The old curve was one universal cliff -
 * every position fell off the same ledge at 30 - and it was the ONLY thing
 * multiplying the talent core, so a fading 23-year-old outpriced a world-class
 * 30-year-old ten out of ten times.
 *
 * Talent still carries the base (the CA power curve is untouched). What
 * changed is everything around it:
 *
 *   POSITION AGE CURVES. A tighthead or a fly-half is technique and decision
 *   making, which take a decade to build and hold to 31-32; a winger is
 *   fast-twitch and the market knows it fades from 28; everyone else sits
 *   between. Three curves instead of one cliff.
 *
 *   FORM MOMENTUM. A man averaging 8s is worth up to a quarter more than his
 *   rating says, a man in a hole up to 15% less. Value now MOVES between
 *   summers, which is what makes selling high a skill.
 *
 *   CONTRACT FACTOR. A deal in its final year is a discount everybody can
 *   read; three years of security prices at a premium. Passed by the caller
 *   because only the caller knows the season.
 *
 * MEAN-NEUTRAL BY MEASUREMENT: the curves were tuned until the fresh-world
 * mean squad value sat within 2% of the old formula's (scripts/round25d.ts
 * holds the fee-by-era bands; econprobe holds solvency), so the ECONOMY is
 * unchanged - what moved is who the money says is worth having.
 */
const LATE_PEAK = new Set<string>(['LP', 'TP', 'HK', 'FH'])   // technique holds
const EARLY_FADE = new Set<string>(['WG', 'FB'])              // speed does not

/**
 * THE LATE BLOOMER (25D, from the FM blueprint the user loves: "the random
 * kinda who become high value and legends"). About one player in twelve keeps
 * developing past the age everyone else plateaus - the fast lane runs to 25
 * instead of 23 and growth stays alive to 29 instead of 27 (rollover's
 * agePlayers reads this).
 *
 * A pure function of (world seed, player id), never stored: every save, every
 * screen and every future system that asks gets the same answer with no
 * migration, and there is nothing in the save file for a curious eye to find.
 * Hidden on purpose - FM's magic is that you find out the way a scout does,
 * by watching a 27-year-old refuse to stop improving.
 */
export function isLateBloomer(seed: number, id: number): boolean {
  return mulberry32((seed ^ Math.imul(id, 0x9E3779B1)) >>> 0)() < 0.085
}

function positionAgeF(pos: string | undefined, age: number, pa: number, ca: number): number {
  const youth = (pa - ca) / 120 // the promise premium, as before
  if (LATE_PEAK.has(pos ?? '')) {
    if (age <= 21) return 1.2 + youth
    if (age <= 24) return 1.25
    if (age <= 28) return 1.2
    if (age <= 31) return 1.05
    if (age <= 33) return 0.6
    return 0.3
  }
  if (EARLY_FADE.has(pos ?? '')) {
    if (age <= 21) return 1.3 + youth
    if (age <= 24) return 1.3
    if (age <= 27) return 1.1
    if (age <= 29) return 0.8
    if (age <= 31) return 0.5
    if (age <= 33) return 0.28
    return 0.12
  }
  // the middle of the field, and the fallback when no position is passed
  if (age <= 21) return 1.25 + youth
  if (age <= 24) return 1.3
  if (age <= 27) return 1.15
  if (age <= 29) return 0.95
  if (age <= 31) return 0.68
  if (age <= 33) return 0.38
  return 0.16
}

/** Player transfer value in £. pos/form/yearsLeft are optional so the eight
 *  call sites could adopt them one meaning at a time; omitted, each factor is
 *  exactly neutral and the price is the old talent-times-age figure. */
export function playerValue(
  ca: number, age: number, pa: number,
  pos?: string, form?: number, yearsLeft?: number,
): number {
  const base = Math.pow(ca / 100, 3.1) * 9_000_000
  const ageF = positionAgeF(pos, age, pa, ca)
  // form 6 is par; a 10 adds a quarter, a 1 shaves 15% - asymmetric because a
  // buying club pays for the story more readily than it discounts for one
  const formF = form == null ? 1 : 1 + Math.max(-0.15, Math.min(0.25, (form - 6) * 0.055))
  const contractF = yearsLeft == null ? 1
    : yearsLeft <= 0 ? 0.7 : yearsLeft === 1 ? 0.88 : yearsLeft === 2 ? 1 : 1.08
  return Math.max(10_000, Math.round((base * ageF * formF * contractF) / 10_000) * 10_000)
}

/** Weekly wage expectation in £. */
/**
 * ACADEMY MEN ARE ON DEVELOPMENT DEALS, not professional ones.
 *
 * This was the whole of a structural insolvency. Every player was priced by
 * ability alone, so a 27-strong academy of 17 to 19 year olds rated 44-57 was
 * costing Northampton £79k a week - £3.6m a year, an average of £2,915 each,
 * about 40% of a first-team squad wage for a teenager who has never played a
 * senior minute. Real academies run on a fraction of that.
 *
 * It mattered because the weekly ledger is charged to the USER'S CLUB ONLY
 * (season.ts, weeklyFinance): AI clubs have no upkeep, no staff bill and no wage
 * run, so nothing about the world flagged it. Measured for Northampton before
 * this: £416k a week in, £478k out, and the club drifted to -2.3M in four
 * seasons by simply playing its fixtures - which scripts/econprobe.ts exists to
 * forbid. Academy wages were £63k of the £62k gap.
 *
 * Bounded rather than proportional, because a development deal is a development
 * deal: a wonderkid is worth a little more than a squad filler and neither is on
 * first-team money. Graduation re-prices him to the professional figure
 * (rollover.ts), which is what signing a first senior contract means.
 */
const ACADEMY_MIN = 400
const ACADEMY_MAX = 900

/**
 * Put every academy man in the world on a development deal.
 *
 * A sweep rather than a flag threaded through construction, because academy
 * players are minted in five places (the opening squads, the youth intake, and
 * three regen paths) and a flag missed at any one of them would leave a pocket of
 * teenagers on first-team money that nothing would ever notice. Idempotent, so
 * calling it again costs nothing.
 */
export function repriceAcademies(players: { acad?: boolean; wage: number; ca: number; age: number }[]): number {
  let moved = 0
  for (const p of players) {
    if (!p.acad) continue
    const want = playerWage(p.ca, p.age, true)
    if (p.wage !== want) { p.wage = want; moved++ }
  }
  return moved
}

export function playerWage(ca: number, age: number, acad = false): number {
  const base = Math.pow(ca / 100, 2.6) * 16_000
  const f = age >= 33 ? 0.8 : 1
  const pro = Math.max(400, Math.round((base * f) / 50) * 50)
  if (!acad) return pro
  return Math.max(ACADEMY_MIN, Math.min(ACADEMY_MAX, Math.round(pro * 0.15 / 50) * 50))
}

let idCounter = 1
export function resetIds(start: number) { idCounter = start }
export function nextPid() { return idCounter++ }

/** Estimated pre-2025 career, deterministic per player: senior rugby from
 *  age 21, volume scaled by quality, tries by position, points by the boot. */
export function deriveHist(p: { id: number; age: number; pos: Player['pos']; a: Player['a']; gk?: boolean; ca: number }): { apps: number; tries: number; points: number } {
  const yrs = Math.max(0, p.age - 21)
  if (!yrs) return { apps: 0, tries: 0, points: 0 }
  const r = mulberry32(p.id * 2246822519 + 5)
  const perYr = 13 + Math.max(0, Math.round((p.ca - 55) / 3)) + Math.floor(r() * 7)
  const apps = Math.round(yrs * Math.min(perYr, 27))
  const tf: Record<string, number> = { WG: 0.42, FB: 0.28, CE: 0.24, FH: 0.1, SH: 0.14, N8: 0.18, FL: 0.16, HK: 0.14, LK: 0.07, LP: 0.04, TP: 0.04 }
  const tries = Math.round(apps * (tf[p.pos] ?? 0.1) * (0.6 + r() * 0.6))
  const points = tries * 5 + (p.gk ? Math.round(apps * (3.5 + r() * 4)) : 0)
  return { apps, tries, points }
}

/** Estimated Test caps before 2025: internationals only, built from age and
 *  class - a 30-year-old world-class man arrives with a real cap count. */
export function deriveCaps(p: { id: number; age: number; intl: boolean; ca: number }): number {
  if (!p.intl) return 0
  const yrs = Math.max(1, p.age - 22)
  const r = mulberry32(p.id * 374761393 + 11)
  const perYr = 3 + Math.max(0, Math.round((p.ca - 72) / 4)) + Math.floor(r() * 4)
  return Math.min(130, Math.round(yrs * perYr))
}

/** Deterministic signature trait: roughly 40% of players carry one, decided
 *  by id and attribute profile so saves and fresh worlds always agree. */
export function deriveTrait(p: { id: number; pos: Player['pos']; a: Player['a'] }): string | null {
  if (p.id % 5 >= 2) return null
  const { a, pos } = p
  const back3 = pos === 'WG' || pos === 'FB' || pos === 'CE'
  const fwd = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8'].includes(pos)
  if (a.agg >= 16) return 'Hot Head'
  if (a.goa >= 16) return 'Metronome'
  if (a.goa >= 14 && a.kic >= 14) return 'Siege Gun'
  if (back3 && a.pac >= 15) return 'The Step'
  if (a.han >= 15 && ['CE', 'N8', 'FL', 'FB'].includes(pos)) return 'Offload King'
  if (a.ruc >= 15 && ['FL', 'N8', 'HK'].includes(pos)) return 'Jackal'
  if (fwd && a.str >= 15) return 'Enforcer'
  if (a.lea >= 14) return 'Big-Game Player'
  return null
}

export function buildPlayer(raw: RawPlayer, clubId: string | null, seed: number, seasonNow: number): Player {
  const a = deriveAttrs(raw, seed)
  const rng = mulberry32(seed ^ (hashString(raw.name) + 7))
  const ca = raw.q
  const paBoost = raw.age <= 20 ? 12 + Math.floor(rng() * 14)
    : raw.age <= 23 ? 6 + Math.floor(rng() * 10)
    : raw.age <= 26 ? 1 + Math.floor(rng() * 5)
    : 0
  const pa = clamp(ca + paBoost, ca, 99)
  const player: Player = {
    id: nextPid(),
    name: raw.name,
    pos: raw.pos,
    alt: raw.alt ?? [],
    age: raw.age,
    nat: raw.nat,
    clubId,
    a,
    ca,
    pa,
    q0: raw.q,
    intl: !!raw.intl,
    gk: !!raw.gk,
    form: 6,
    morale: 7,
    cond: 100,
    sharp: 70,
    injury: null,
    bans: 0,
    natSquad: false,
    wage: playerWage(ca, raw.age),
    contractEnds: seasonNow + 1 + Math.floor(rng() * 3), // 1-3 seasons left
    value: playerValue(ca, raw.age, pa, raw.pos),
    stats: emptyStats(),
    career: [],
    transferListed: false,
    pers: assignPersonality(rng, a),
    sc: 20,
    ca0: ca,
  }
  player.trait = deriveTrait(player)
  player.hist = deriveHist(player)
  player.caps = deriveCaps(player)
  return player
}

/** Effective ability of a player in a given position (penalty when out of position). */
export function effAt(p: Player, pos: Pos): number {
  if (p.pos === pos) return p.ca
  if (p.alt.includes(pos)) return p.ca * 0.92
  // family fallbacks
  const fam: Record<Pos, Pos[]> = {
    LP: ['TP', 'HK'], TP: ['LP', 'HK'], HK: ['LP'], LK: ['FL', 'N8'],
    FL: ['N8', 'LK'], N8: ['FL', 'LK'], SH: ['FH'], FH: ['CE', 'SH'],
    CE: ['FH', 'WG', 'FB'], WG: ['FB', 'CE'], FB: ['WG', 'FH'],
  }
  if (fam[pos]?.includes(p.pos)) return p.ca * 0.8
  return p.ca * 0.55
}

/**
 * ---- THE 1-100 RATING BEHIND A 1-20 ATTRIBUTE ----
 *
 * The engine works in twentieths, which is the classic management-sim scale and
 * is not changing: every unit calculation, role and comparison in the game is
 * built on it. But multiplying by five to show a 0-100 figure meant every number
 * on the attribute grid was a multiple of five - 20, 45, 60, never 37 or 86 - so
 * a page of eighteen attributes looked like a page of estimates (user: "on
 * attributes they need to be a bit more random not just 45 or 20 / need to be
 * like more specific. 37 or 86 etc").
 *
 * The finer rating is a stable property of the man, derived from his id and the
 * attribute, exactly as a fixture's kick-off day is derived from its id. It never
 * changes, it saves for free because the id is saved, and the engine bands it
 * back to the twentieth it already used - so this adds precision to what is
 * shown without moving a single mechanic. The offset spans -2 to +2 over five
 * hash buckets, so it is mean-zero by construction and a squad's average rating
 * is exactly five times its average attribute.
 */
export function fineAttr(playerId: number, idx: number, coarse: number): number {
  const h = (((playerId * 2654435761) ^ ((idx + 1) * 1013904223)) >>> 0) % 5
  return Math.max(1, Math.min(100, coarse * 5 + (h - 2)))
}
