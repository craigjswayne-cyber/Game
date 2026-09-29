// The Scouting Agency: monthly world rankings - the game's biggest names
// and the wonderkids coming for their thrones.

import type { GameState, Player } from './model'
import { natRankOrder } from './natrank'
import { nationNameIn, nationVars } from './nations'
import { hashString, mulberry32 } from './rng'

/**
 * THE AGENCY'S OPINION, NOT THE TRUTH (1.8.1).
 *
 * Both lists sorted on the true ratings, which the rest of the game keeps
 * behind the scouting fog: the wonderkid list in particular was a free,
 * exact ranking of the hidden ceiling of every teenager in the world, better
 * than any report the manager could pay for. An agency is a scouting firm
 * like any other. It reads current ability closely (a senior plays in public
 * every week) and a teenager's ceiling loosely, and its judgement of a man is
 * fixed for the season so the arrows move with the rugby rather than with a
 * reroll. Deterministic, and it draws on nothing shared.
 */
export function agencyView(state: GameState, p: Player, kind: 'ca' | 'pa'): number {
  const r = mulberry32(hashString(`agency|${kind}|${p.id}|${state.season}`))()
  return (kind === 'ca' ? p.ca : p.pa) + (r * 2 - 1) * (kind === 'ca' ? 2 : 5)
}

/** Current world top 20 seniors by ability (the argument-settling list). */
export function agencySeniors(state: GameState): Player[] {
  return Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.age >= 22)
    .map(p => ({ p, v: agencyView(state, p, 'ca') }))
    .sort((a, b) => b.v - a.v || b.p.value - a.p.value)
    .slice(0, 20)
    .map(x => x.p)
}

/**
 * A teenager the agency could have seen: one who has played senior rugby
 * somewhere, this season, in his career here or before it, or for his country.
 *
 * ONLY THE PUBLIC ONES (1.8.2). The list ranked every under-21 in the world,
 * so the best-hidden academy prodigy was on it the day the game began: a free
 * shortcut past the scouting the owner wants to be the only way in ("it
 * shouldn't be easy to see the best youngsters"). A firm that ranks from the
 * stands can rank only the men who have been on the pitch; the boy nobody has
 * watched yet is the club's own scouts' job to find (scout.ts).
 */
export function agencyCanSee(p: Player): boolean {
  return (p.stats?.apps ?? 0) > 0 || (p.caps ?? 0) > 0 || (p.hist?.apps ?? 0) > 0 ||
    (p.career ?? []).some(r => r.apps > 0)
}

/** Current world top 20 wonderkids (21 and under) by ceiling, of those the
 *  agency has seen play senior rugby. */
export function agencyKids(state: GameState): Player[] {
  return Object.values(state.players)
    .filter(p => p.clubId && state.clubs[p.clubId] && p.age <= 21 && agencyCanSee(p))
    .map(p => ({ p, v: agencyView(state, p, 'pa') }))
    .sort((a, b) => b.v - a.v || b.p.ca - a.p.ca)
    .slice(0, 20)
    .map(x => x.p)
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
  // the moment of publication: every arrow on the Agency screen is measured
  // from here, and the screen names this week so the comparison is legible
  state.agency.at = { season: state.season, week: state.week }

  // the Test rankings publish on the same cycle - with a headline when the
  // nation you coach breaks new ground
  const order = natRankOrder(state)
  const prev = state.natRankPrev ?? []
  if (state.natTeam) {
    const now = order.indexOf(state.natTeam) + 1
    const was = prev.length ? prev.indexOf(state.natTeam) + 1 : now
    const name = nationNameIn('en', state.natTeam)
    if (now === 1 && was > 1) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
        subject: `${name} are the number one side in the world`,
        body: `The new world rankings are out and ${name} sit on top of the game. Every side you face from here brings their best - the target on your back is now official.`,
        k: 'news.rankTop', v: nationVars(state.natTeam),
      })
    } else if (now <= 3 && was > 3) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'intl', read: false,
        subject: `${name} break into the world's top three`,
        body: `The rankings have ${name} at ${now} in the world, the highest of your tenure so far. The pundits have started saying the quiet part out loud: this side can win the whole thing.`,
        k: 'news.rankThree', v: { ...nationVars(state.natTeam), pos: now },
      })
    }
  }
  state.natRankPrev = order
}
