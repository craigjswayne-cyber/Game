/**
 * ---- THE IN-GAME EDITOR (v1.1.0) ----
 *
 * Sold once behind EDITOR_SKU (monetise.ts), and honest about what it is: the
 * player's own world, rewritten by hand. Three rules keep it from being a
 * loose wire into the save:
 *
 *   EVERY WRITE CLAMPS. The same discipline savefuzz holds the loader to -
 *     an edited value is bounded into the range the engine was balanced for,
 *     never trusted raw. An impossible number becomes a legal one, not a
 *     crash three screens later.
 *
 *   EVERY WRITE STAMPS. The first edit sets state.edited, permanently: the
 *     save wears 🔧 in Legacy and the Annual from then on. Records and dreams
 *     still function - single-player, their meaning is the player's business -
 *     but the Hall of Fame stays honest with itself.
 *
 *   NO ENGINE BYPASS. Edited attributes simply ARE the attributes: nothing
 *     here touches the rng stream, fixtures, results or the AI's decisions in
 *     flight. The store action layer re-checks the receipt, so these
 *     functions never run for anybody who has not bought the tool.
 */
import { ATTR_KEYS, POS_ORDER, type Attrs, type GameState, type Pos } from './model'
import { clamp } from './rng'

const asInt = (n: unknown, lo: number, hi: number, fallback: number): number => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) ? clamp(v, lo, hi) : fallback
}

/** A name survives trimming or it never happened: renaming a club to nothing
 *  would break every screen that prints it. */
const asName = (s: unknown, fallback: string, max = 40): string => {
  const v = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  return v.length ? v : fallback
}

export interface PlayerEdit {
  name?: string
  age?: number
  pos?: Pos
  alt?: Pos[]
  ca?: number
  pa?: number
  attrs?: Partial<Attrs>
}

export function editPlayer(state: GameState, id: number, edit: PlayerEdit): boolean {
  const p = state.players[id]
  if (!p) return false
  if (edit.name !== undefined) p.name = asName(edit.name, p.name)
  if (edit.age !== undefined) p.age = asInt(edit.age, 16, 45, p.age)
  if (edit.pos !== undefined && POS_ORDER.includes(edit.pos)) p.pos = edit.pos
  if (edit.alt !== undefined) {
    p.alt = [...new Set(edit.alt)].filter(x => POS_ORDER.includes(x) && x !== p.pos).slice(0, 3)
  }
  if (edit.ca !== undefined) p.ca = asInt(edit.ca, 1, 100, p.ca)
  if (edit.pa !== undefined) p.pa = asInt(edit.pa, 1, 100, p.pa)
  // potential never trails the ability already shown - the scout screens
  // treat pa as a ceiling, and an edited floor above the ceiling is nonsense
  p.pa = Math.max(p.pa, p.ca)
  if (edit.attrs) {
    for (const k of ATTR_KEYS) {
      const v = edit.attrs[k]
      if (v !== undefined) p.a[k] = asInt(v, 1, 100, p.a[k])
    }
  }
  state.edited = true
  return true
}

export interface ClubEdit {
  name?: string
  short?: string
  stadium?: string
  /** [primary, secondary] as #rrggbb; a value that is not a hex colour is
   *  ignored rather than painted */
  colors?: string[]
  budget?: number
  balance?: number
}

export function editClub(state: GameState, id: string, edit: ClubEdit): boolean {
  const c = state.clubs[id]
  if (!c) return false
  if (edit.name !== undefined) c.name = asName(edit.name, c.name)
  if (edit.short !== undefined) c.short = asName(edit.short, c.short, 16)
  if (edit.stadium !== undefined) c.stadium = asName(edit.stadium, c.stadium)
  if (edit.colors) {
    const hex = edit.colors.filter(x => /^#[0-9a-fA-F]{6}$/.test(x))
    if (hex.length) c.colors = [hex[0], hex[1] ?? c.colors[1] ?? hex[0]]
  }
  // a budget is money to spend and stays at or above nothing; a balance is a
  // bank account and may honestly be under water
  if (edit.budget !== undefined) c.budget = asInt(edit.budget, 0, 999_999_999, c.budget)
  if (edit.balance !== undefined) c.balance = asInt(edit.balance, -999_999_999, 999_999_999, c.balance)
  state.edited = true
  return true
}
