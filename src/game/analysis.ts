// Squad analysis: star players, team values, assistant advice.

import type { GameState, Pos } from './model'
import { XV_SLOTS } from './model'
import { effAt } from './attributes'

/** Every club needs a skipper: pick the best leader if the armband is free. */
export function ensureCaptains(state: GameState) {
  for (const club of Object.values(state.clubs)) {
    const cap = club.captain != null ? state.players[club.captain] : null
    if (cap && cap.clubId === club.id && !cap.onLoan) continue
    const best = club.players
      .map(id => state.players[id])
      .filter(p => p && !p.onLoan)
      .sort((a, b) => (b!.a.lea * 2 + b!.age + b!.ca / 10) - (a!.a.lea * 2 + a!.age + a!.ca / 10))[0]
    club.captain = best ? best.id : null
  }
}

/** FM-style star designations: the club's top players (CA-led, cap 3). */
export function starPlayerIds(state: GameState, clubId: string): Set<number> {
  const club = state.clubs[clubId]
  if (!club) return new Set()
  const ps = club.players.map(id => state.players[id]).filter(Boolean)
    .sort((a, b) => b.ca - a.ca)
  const out = new Set<number>()
  for (const p of ps.slice(0, 3)) {
    if (p.ca >= 80 || (out.size === 0 && p.ca >= 74)) out.add(p.id)
  }
  return out
}

/** Total market value of a club's squad. */
export function squadValue(state: GameState, clubId: string): number {
  const club = state.clubs[clubId]
  if (!club) return 0
  return club.players.reduce((s, id) => s + (state.players[id]?.value ?? 0), 0)
}

/** The assistant's read on the squad's weakest starting position. */
export function assistantAdvice(state: GameState): string {
  if (state.staff.assistant === 0) {
    return 'Hire an assistant coach (Training screen) for selection advice.'
  }
  const club = state.clubs[state.userClubId]
  const lineup = club.tactic.lineup
  // fixture congestion: flag a knackered XV before it costs you
  const tired = lineup.slice(0, 15)
    .map(id => id != null ? state.players[id] : null)
    .filter(p => p && p.cond < 65)
  if (tired.length >= 4) {
    return `Assistant: ${tired.length} of the starting XV are running on empty (<65% fit). Rotate this week — tired legs concede late tries and pick up injuries.`
  }
  let worst: { label: string; eff: number; pos: Pos } | null = null
  for (let i = 0; i < 15; i++) {
    const id = lineup[i]
    const p = id != null ? state.players[id] : null
    const slot = XV_SLOTS[i]
    const eff = p ? effAt(p, slot.pos) * (0.75 + 0.25 * (p.cond / 100)) : 0
    if (!worst || eff < worst.eff) worst = { label: `${slot.shirt}. ${p?.name ?? 'EMPTY'}`, eff, pos: slot.pos }
  }
  if (!worst) return 'The XV looks set.'
  // is there a better option in reserve?
  const better = club.players
    .map(id => state.players[id])
    .filter(p => p && !p.injury && p.bans === 0 && !p.natSquad && !lineup.slice(0, 15).includes(p.id))
    .filter(p => effAt(p!, worst!.pos) * (0.75 + 0.25 * (p!.cond / 100)) > worst!.eff * 1.05)
    .sort((a, b) => effAt(b!, worst!.pos) - effAt(a!, worst!.pos))[0]
  if (better) {
    return `Assistant: our weak link is ${worst.label} — ${better.name} looks the stronger option at ${worst.pos} right now.`
  }
  return `Assistant: ${worst.label} is our thinnest position, but nothing better is available in the squad.`
}
