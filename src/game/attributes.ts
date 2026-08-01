import type { Pos, RawPlayer } from '../data/types'
import type { Attrs, Player } from './model'
import { emptyStats } from './model'
import { clamp, gauss, hashString, mulberry32 } from './rng'

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

/** Player transfer value in £, CM-style. */
export function playerValue(ca: number, age: number, pa: number): number {
  const base = Math.pow(ca / 100, 3.1) * 9_000_000
  let ageF = 1
  if (age <= 21) ageF = 1.25 + (pa - ca) / 120
  else if (age <= 24) ageF = 1.3
  else if (age <= 27) ageF = 1.15
  else if (age <= 29) ageF = 0.95
  else if (age <= 31) ageF = 0.65
  else if (age <= 33) ageF = 0.35
  else ageF = 0.15
  return Math.max(10_000, Math.round((base * ageF) / 10_000) * 10_000)
}

/** Weekly wage expectation in £. */
export function playerWage(ca: number, age: number): number {
  const base = Math.pow(ca / 100, 2.6) * 16_000
  const f = age >= 33 ? 0.8 : 1
  return Math.max(400, Math.round((base * f) / 50) * 50)
}

let idCounter = 1
export function resetIds(start: number) { idCounter = start }
export function nextPid() { return idCounter++ }

export function buildPlayer(raw: RawPlayer, clubId: string | null, seed: number, seasonNow: number): Player {
  const a = deriveAttrs(raw, seed)
  const rng = mulberry32(seed ^ (hashString(raw.name) + 7))
  const ca = raw.q
  const paBoost = raw.age <= 20 ? 12 + Math.floor(rng() * 14)
    : raw.age <= 23 ? 6 + Math.floor(rng() * 10)
    : raw.age <= 26 ? 1 + Math.floor(rng() * 5)
    : 0
  const pa = clamp(ca + paBoost, ca, 99)
  return {
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
    value: playerValue(ca, raw.age, pa),
    stats: emptyStats(),
    career: [],
    transferListed: false,
  }
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
