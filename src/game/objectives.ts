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
  /**
   * Is met() a thing that has HAPPENED, or a condition that merely holds today?
   *
   * Reported live, from a new Bedford save: "one of the season objectives had
   * been completed without a game being played." Correct - the board's brief was
   * "finish the season in the black", the club opens with £240k in the bank, so
   * the screen ticked it green in week 1 before a ball was kicked.
   *
   * Three of the four are achievements: six starts given, a derby won, the
   * knockouts reached. Once true they are true forever, so a tick is honest the
   * moment it appears. Balancing the books is not - it is a standing condition
   * that can flip either way every week and only means anything at the final
   * whistle of the season. It is judged the same way at rollover; what changes is
   * that the screen no longer calls it done while there is a season left to lose
   * it in.
   */
  banked: boolean
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
    // cumulative starts: once six are given they cannot be taken back
    banked: true,
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
    // a derby won is a derby won
    banked: true,
  },
  {
    id: 'cup',
    text: () => 'Reach the Champions Cup knockouts',
    met: s => s.fixtures.some(f => f.compId === 'cc' && !!f.stage &&
      (f.homeId === s.userClubId || f.awayId === s.userClubId)),
    applies: s => (s.comps['cc']?.teamIds ?? []).includes(s.userClubId),
    // reaching the knockouts is a fact about the fixture list
    banked: true,
  },
  {
    id: 'books',
    text: () => 'Balance the books: finish the season in the black',
    met: s => s.clubs[s.userClubId].balance >= 0,
    applies: () => true,
    // THE ONLY ONE THAT IS NOT BANKED: in credit today says nothing about May.
    banked: false,
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
