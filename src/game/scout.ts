// Scouting knowledge: attributes of unscouted players show as ranges.
// Knowledge grows by shortlisting, playing against them, and via the
// chief scout. Your own squad is always fully known.

import type { Attrs, GameState, Player } from './model'
import { ATTR_KEYS } from './model'
import { clamp, hashString, mulberry32 } from './rng'

export function knowledge(state: GameState, p: Player): number {
  if (p.clubId === state.userClubId) return 100
  return clamp(p.sc ?? 20, 0, 100)
}

/** Uncertainty margin in attribute points at a knowledge level. */
export function margin(k: number): number {
  if (k >= 95) return 0
  if (k >= 75) return 1
  if (k >= 55) return 2
  if (k >= 35) return 3
  return 4
}

/** Deterministic skew so the displayed range doesn't centre on the truth. */
function skew(p: Player, idx: number, m: number): number {
  if (m === 0) return 0
  const r = mulberry32(hashString(`${p.id}:${idx}`))()
  return Math.round((r * 2 - 1) * (m / 2))
}

/** Visible [lo, hi] for one attribute. Exact when fully scouted. */
export function attrRange(state: GameState, p: Player, key: keyof Attrs): [number, number] {
  const k = knowledge(state, p)
  const m = margin(k)
  if (m === 0) return [p.a[key], p.a[key]]
  const idx = ATTR_KEYS.indexOf(key)
  const c = clamp(p.a[key] + skew(p, idx, m), 1, 20)
  return [clamp(c - m, 1, 20), clamp(c + m, 1, 20)]
}

/** Fuzzed overall ability for star displays. */
export function fuzzedCa(state: GameState, p: Player): number {
  const k = knowledge(state, p)
  const m = margin(k)
  if (m === 0) return p.ca
  return clamp(p.ca + skew(p, 99, m * 3), 30, 99)
}

export function bumpKnowledge(p: Player, amt: number) {
  p.sc = clamp((p.sc ?? 20) + amt, 0, 100)
}

/** Weekly knowledge gathering. */
export function weeklyScouting(state: GameState) {
  const scoutLvl = state.staff.scout
  const userLeague = state.clubs[state.userClubId].leagueId
  // shortlisted players: focused reports
  for (const id of state.shortlist) {
    const p = state.players[id]
    if (p) bumpKnowledge(p, 15 + scoutLvl * 6)
  }
  // background knowledge of your own league
  if (state.week % 2 === 0) {
    for (const p of Object.values(state.players)) {
      if (p.clubId && p.clubId !== state.userClubId && state.clubs[p.clubId]?.leagueId === userLeague) {
        bumpKnowledge(p, 1 + scoutLvl)
      }
    }
  }
}

/** Facing a team teaches you plenty about their matchday squad. */
export function scoutOpponent(state: GameState, clubId: string) {
  const club = state.clubs[clubId]
  if (!club) return
  for (const id of club.players) {
    const p = state.players[id]
    if (p) bumpKnowledge(p, 12)
  }
}

/** Initial knowledge levels at new-game time. */
export function seedKnowledge(state: GameState) {
  const userLeague = state.clubs[state.userClubId].leagueId
  for (const p of Object.values(state.players)) {
    if (p.clubId === state.userClubId) { p.sc = 100; continue }
    const sameLeague = p.clubId && state.clubs[p.clubId]?.leagueId === userLeague
    p.sc = clamp((sameLeague ? 45 : 18) + (p.intl ? 20 : 0) + (p.ca >= 88 ? 10 : 0), 0, 90)
  }
}
