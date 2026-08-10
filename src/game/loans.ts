// The loan-in market: borrow tomorrow's stars from the big clubs' benches.

import type { GameState, Player } from './model'
import { autoSelect } from './matchEngine'
import { clamp } from './rng'

/** Young talent parked on big-club benches, available for a season's loan. */
export function loanTargets(state: GameState): Player[] {
  const user = state.clubs[state.userClubId]
  return Object.values(state.players)
    .filter(p => {
      if (!p.clubId || p.clubId === user.id || p.onLoan || p.loanFrom) return false
      const parent = state.clubs[p.clubId]
      if (!parent || parent.rep < user.rep + 4) return false
      if (p.age > 23 || p.ca < 60 || p.ca > 80) return false
      if (p.injury || p.natSquad) return false
      // he's behind the queue at home: not in the parent's best XV
      return !parent.tactic.lineup.slice(0, 15).includes(p.id)
    })
    .sort((a, b) => b.pa - a.pa)
    .slice(0, 12)
}

/** Bring him in until the end of the season. Parent pays half the wage. */
export function loanIn(state: GameState, playerId: number): string {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !p.clubId || p.clubId === user.id) return 'Unavailable.'
  const parent = state.clubs[p.clubId]
  if (!parent) return 'Unavailable.'
  // SENIORS, not the whole list, and a cap the world can actually live under
  // (audit 16D). Counting every id meant the 27 academy players pushed every
  // club past the old 40 the day the academy became a real squad - so this
  // line refused every loan the game has offered since, and the injury-crisis
  // letter was advertising players nobody could sign. A fresh world carries
  // 41 seniors; the AI summer cull tolerates 46, so 46 is the hoarding line.
  const seniors = user.players.filter(id => state.players[id] && !state.players[id].acad).length
  if (seniors >= 46) return 'Your senior squad is full.'
  if (!loanTargets(state).some(t => t.id === playerId)) return `${parent.short} won't loan him right now.`
  // sulky stars want a transfer, not a loan
  if (p.pers === 'Mercenary' && p.morale < 5) return `${p.name}'s agent wants a permanent move, not a loan.`
  parent.players = parent.players.filter(id => id !== p.id)
  parent.tactic.lineup = parent.tactic.lineup.map(id => (id === p.id ? null : id))
  user.players.push(p.id)
  p.loanFrom = parent.id
  p.clubId = user.id
  p.morale = clamp(p.morale + 1, 1, 10)
  p.sc = 100
  p.debutPending = 'signing'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `Loan signing: ${p.name} arrives from ${parent.short}`,
    body: `${p.name} (${p.age}, ${p.pos}) joins on loan until the end of the season. ${parent.short} cover half his wage - they want him playing, so play him.`,
    playerId: p.id,
  })
  // keep the parent's lineup coherent
  parent.tactic.lineup = autoSelect(state, parent.players.map(id => state.players[id]).filter(Boolean))
  return `${p.name} joins on loan for the season.`
}

/**
 * Send one of your own young players out for the season.
 *
 * This lived inline in PlayerScreen, which meant the engine had no entry point
 * for it - so the 20-season soak could never loan anyone out, the loan-watch
 * postcard never fired in any long run, and the release audit read "loan watch
 * 0" over twenty years for a feature that works fine. A behaviour with no
 * callable seam has no test.
 */
export function loanOut(state: GameState, playerId: number): { ok: boolean; msg: string } {
  const p = state.players[playerId]
  if (!p) return { ok: false, msg: 'No such player.' }
  if (p.clubId !== state.userClubId) return { ok: false, msg: 'He is not yours to send anywhere.' }
  if (p.onLoan) return { ok: false, msg: `${p.name} is already out on loan.` }
  if (p.loanFrom) return { ok: false, msg: `${p.name} is here on loan himself.` }
  if (p.age > 23) return { ok: false, msg: `${p.name} is past the age where a loan teaches him anything.` }
  const club = state.clubs[state.userClubId]
  if (club?.tactic.lineup.slice(0, 15).includes(p.id)) {
    return { ok: false, msg: `${p.name} is in your starting XV. Drop him first if you mean it.` }
  }
  p.onLoan = true
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: true,
    subject: `${p.name} heads out on loan`,
    body: `${p.name} joins a feeder club for the rest of the season. Regular first-team rugby should accelerate his development - expect him back sharper next summer.`,
    playerId: p.id,
  })
  return { ok: true, msg: `${p.name} will spend the season on loan. He returns next summer, better for it.` }
}
