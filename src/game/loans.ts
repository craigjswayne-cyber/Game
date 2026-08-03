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
  if (user.players.length >= 40) return 'Your squad is full.'
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
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `Loan signing: ${p.name} arrives from ${parent.short}`,
    body: `${p.name} (${p.age}, ${p.pos}) joins on loan until the end of the season. ${parent.short} cover half his wage — they want him playing, so play him.`,
    playerId: p.id,
  })
  // keep the parent's lineup coherent
  parent.tactic.lineup = autoSelect(state, parent.players.map(id => state.players[id]).filter(Boolean))
  return `${p.name} joins on loan for the season.`
}
