// The Scouting Agency: monthly world rankings - the game's biggest names
// and the wonderkids coming for their thrones.

import type { GameState, Player } from './model'
import { natRankOrder } from './natrank'
import { nationByCode } from './nations'

/** Current world top 20 seniors by ability (the argument-settling list). */
export function agencySeniors(state: GameState): Player[] {
  return Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.age >= 22)
    .sort((a, b) => b.ca - a.ca || b.value - a.value)
    .slice(0, 20)
}

/** Current world top 20 wonderkids (21 and under) by ceiling. */
export function agencyKids(state: GameState): Player[] {
  return Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.age <= 21)
    .sort((a, b) => b.pa - a.pa || b.ca - a.ca)
    .slice(0, 20)
}

/** Monthly snapshot: remember last month's order and each man's best-ever rank. */
export function updateAgency(state: GameState) {
  const seniors = agencySeniors(state).map(p => p.id)
  const kids = agencyKids(state).map(p => p.id)
  state.agency ??= { seniors: [], kids: [], best: {} }
  for (const [list] of [[seniors], [kids]] as [number[]][]) {
    list.forEach((pid, i) => {
      const b = state.agency!.best[pid]
      state.agency!.best[pid] = b == null ? i + 1 : Math.min(b, i + 1)
    })
  }
  state.agency.seniors = seniors
  state.agency.kids = kids

  // the Test rankings publish on the same cycle - with a headline when the
  // nation you coach breaks new ground
  const order = natRankOrder(state)
  const prev = state.natRankPrev ?? []
  if (state.natTeam) {
    const now = order.indexOf(state.natTeam) + 1
    const was = prev.length ? prev.indexOf(state.natTeam) + 1 : now
    const name = nationByCode(state.natTeam)?.name ?? state.natTeam
    if (now === 1 && was > 1) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
        subject: `🥇 ${name} are the number one side in the world`,
        body: `The new world rankings are out and ${name} sit on top of the game. Every side you face from here brings their best - the target on your back is now official.`,
      })
    } else if (now <= 3 && was > 3) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
        subject: `📈 ${name} break into the world's top three`,
        body: `The rankings have ${name} at ${now} in the world, the highest of your tenure so far. The pundits have started saying the quiet part out loud: this side can win the whole thing.`,
      })
    }
  }
  state.natRankPrev = order
}
