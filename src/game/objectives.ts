// The board's secondary season objectives - FM-style side quests with
// real consequences at the end-of-season review.

import type { GameState } from './model'
import { isDerby } from './rivalries'

export interface ObjectiveDef {
  id: string
  text: (state: GameState) => string
  /** evaluated at rollover, before season structures are wiped */
  met: (state: GameState) => boolean
  applies: (state: GameState) => boolean
}

export const OBJECTIVE_DEFS: ObjectiveDef[] = [
  {
    id: 'youth',
    text: () => 'Blood the academy: give 6+ starts to players aged 21 or under',
    met: s => {
      const starts = s.clubs[s.userClubId].players
        .map(id => s.players[id])
        .filter(p => p && p.age <= 21)
        .reduce((sum, p) => sum + p!.stats.starts, 0)
      return starts >= 6
    },
    applies: () => true,
  },
  {
    id: 'derby',
    text: () => 'Win a derby: the fans demand local bragging rights',
    met: s => s.fixtures.some(f => {
      if (!f.played || !isDerby(f.homeId, f.awayId)) return false
      const us = f.homeId === s.userClubId ? f.homeScore : f.awayId === s.userClubId ? f.awayScore : -1
      if (us < 0) return false
      const them = f.homeId === s.userClubId ? f.awayScore : f.homeScore
      return us > them
    }),
    applies: s => s.fixtures.some(f =>
      (f.homeId === s.userClubId || f.awayId === s.userClubId) && isDerby(f.homeId, f.awayId)),
  },
  {
    id: 'cup',
    text: () => 'Reach the Champions Cup knockouts',
    met: s => s.fixtures.some(f => f.compId === 'cc' && !!f.stage &&
      (f.homeId === s.userClubId || f.awayId === s.userClubId)),
    applies: s => (s.comps['cc']?.teamIds ?? []).includes(s.userClubId),
  },
  {
    id: 'books',
    text: () => 'Balance the books: finish the season in the black',
    met: s => s.clubs[s.userClubId].balance >= 0,
    applies: () => true,
  },
]

/** Pick this season's secondary objectives for the user's club. */
export function pickObjectives(state: GameState): string[] {
  const out: string[] = ['youth']
  const derby = OBJECTIVE_DEFS.find(o => o.id === 'derby')!
  const cup = OBJECTIVE_DEFS.find(o => o.id === 'cup')!
  if (cup.applies(state)) out.push('cup')
  else if (derby.applies(state)) out.push('derby')
  else out.push('books')
  return out
}

export function objectiveById(id: string): ObjectiveDef | undefined {
  return OBJECTIVE_DEFS.find(o => o.id === id)
}
