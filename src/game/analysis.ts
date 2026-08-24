// Squad analysis: star players, team values, assistant advice.

import { t } from './i18n'
import type { GameState, Pos } from './model'
import { XV_SLOTS } from './model'
import { effAt } from './attributes'

/** Every club needs a skipper: pick the best leader if the armband is free.
 *  quiet suppresses the succession news - for newgame seeding and save
 *  migration, where a change is bookkeeping, not a story. */
export function ensureCaptains(state: GameState, quiet = false) {
  for (const club of Object.values(state.clubs)) {
    const rank = (a: { a: { lea: number }; age: number; ca: number }) => a.a.lea * 2 + a.age + a.ca / 10
    const cap = club.captain != null ? state.players[club.captain] : null
    if (!cap || cap.clubId !== club.id || cap.onLoan) {
      const prevId = club.captain
      const best = club.players
        .map(id => state.players[id])
        .filter(p => p && !p.onLoan)
        .sort((a, b) => rank(b!) - rank(a!))[0]
      club.captain = best ? best.id : null
      // the armband never just moves at the user's club - it passes
      if (!quiet && club.id === state.userClubId && best && prevId != null && prevId !== best.id) {
        const wasVice = club.vice === best.id
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
          subject: `🧢 The armband passes to ${best.name}`,
          body: `The captaincy fell vacant and the dressing room has looked to its senior man: ${best.name} (${best.age}, ${best.pos})${wasVice ? ', the vice-captain, steps up' : ' takes the armband'}. He is the natural choice on leadership and years of service. If you see it differently, hand it to someone else from the Tactics screen.`,
          k: 'news.armband',
          v: { player: best.name, age: best.age, pos: best.pos,
               how_k: wasVice ? 'news.armbandVice' : 'news.armbandTakes' },
          playerId: best.id,
        })
      }
    }
    const vice = club.vice != null ? state.players[club.vice] : null
    if (!vice || vice.clubId !== club.id || vice.onLoan || club.vice === club.captain) {
      const next = club.players
        .map(id => state.players[id])
        .filter(p => p && !p.onLoan && p.id !== club.captain)
        .sort((a, b) => rank(b!) - rank(a!))[0]
      club.vice = next ? next.id : null
    }
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
    return t('reply.noAssistant')
  }
  const club = state.clubs[state.userClubId]
  const lineup = club.tactic.lineup
  // fixture congestion: flag a knackered XV before it costs you
  const tired = lineup.slice(0, 15)
    .map(id => id != null ? state.players[id] : null)
    .filter(p => p && p.cond < 65)
  if (tired.length >= 4) {
    return t('reply.assistantTired', { n: tired.length })
  }
  let worst: { label: string; eff: number; pos: Pos } | null = null
  for (let i = 0; i < 15; i++) {
    const id = lineup[i]
    const p = id != null ? state.players[id] : null
    const slot = XV_SLOTS[i]
    const eff = p ? effAt(p, slot.pos) * (0.75 + 0.25 * (p.cond / 100)) : 0
    if (!worst || eff < worst.eff) worst = { label: `${slot.shirt}. ${p?.name ?? 'EMPTY'}`, eff, pos: slot.pos }
  }
  if (!worst) return t('reply.xvLooksSet')
  // is there a better option in reserve?
  const better = club.players
    .map(id => state.players[id])
    .filter(p => p && !p.injury && p.bans === 0 && !p.natSquad && !lineup.slice(0, 15).includes(p.id))
    .filter(p => effAt(p!, worst!.pos) * (0.75 + 0.25 * (p!.cond / 100)) > worst!.eff * 1.05)
    .sort((a, b) => effAt(b!, worst!.pos) - effAt(a!, worst!.pos))[0]
  if (better) {
    return t('reply.assistantWeakLink', { label: worst.label, better: better.name, pos_k: `pos.${worst.pos}` })
  }
  return t('reply.assistantThinnest', { label: worst.label })
}
