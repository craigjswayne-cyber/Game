// Probe: the loan market has gravity - nobody big falls two divisions.
//
// User, at Esher in National League One: "ive been able to loan some huge
// players... it feels unrealistic that they would take such a step down. I
// think the odd few may for game time but realistically it would be more
// championship players on loan."
//
// The mechanism: loanTargets' only parentage test was reputation (parent.rep
// >= user.rep + 4). At a rep-38 third-tier club EVERY club in the world
// passes, and the top-12-by-potential sort then hands Esher the biggest
// wonderkids on Premiership and Top 14 benches. Three claims:
//
//   1. A player steps down at most ONE tier freely. Two tiers is the odd few:
//      21 or under, and only behind a deterministic per-player gate.
//   2. The third-tier market still works - it is stocked from the division
//      above, not emptied.
//   3. A top-flight club's market is untouched by the rule.
import { newGame } from '../src/game/newgame'
import { loanTargets } from '../src/game/loans'
import { mulberry32 } from '../src/game/rng'
// namespace lookup with a local fallback: leagueTier does not exist on the
// old code, and a missing named import would kill the run at load time - the
// fallback lets the old loanTargets show its 11-wonderkid list red per assert
import * as M from '../src/game/model'
const leagueTier = (M as { leagueTier?: (id?: string | null) => number }).leagueTier ??
  ((id?: string | null) => ({ prem: 1, top14: 1, urc: 1, srp: 1, jl1: 1, champ: 2, prod2: 2, natl1: 3 } as Record<string, number>)[id ?? ''] ?? 2)

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---- Esher: the screenshot club ----
const g = newGame('esher', 'LoanStep', 61)
const user = g.clubs[g.userClubId]
ok(leagueTier(user.leagueId) === 3, `Esher sit in tier 3 (${user.leagueId})`)
const targets = loanTargets(g)
ok(targets.length > 0, `the market still works at the bottom (${targets.length} names on the list)`)

const dropOf = (pid: number) => {
  const parent = g.clubs[g.players[pid].clubId!]
  return leagueTier(user.leagueId) - leagueTier(parent.leagueId)
}
const bigDrops = targets.filter(t => dropOf(t.id) >= 2)
const oneStep = targets.filter(t => dropOf(t.id) === 1)
ok(bigDrops.every(t => t.age <= 21),
  `nobody over 21 falls two divisions (${bigDrops.length} big-club ${bigDrops.length === 1 ? 'kid' : 'kids'} on the list, all game-time moves)`)
ok(bigDrops.every(t => mulberry32(g.seed + t.id * 13 + g.season * 31)() < 0.25),
  'and each of them passed the odd-few gate, not walked around it')
ok(bigDrops.length <= 2,
  `"the odd few" is a count: at most two big-drop names at a time (${bigDrops.length})`)
ok(oneStep.length >= Math.max(1, targets.length - 2),
  `the list is stocked from the division above (${oneStep.length} Championship names of ${targets.length})`)

// ---- a top-flight club: the rule must not touch tier-1 borrowing ----
const h = newGame('northampton', 'LoanStep', 61)
const hTargets = loanTargets(h)
ok(hTargets.length > 0, `a Premiership club still has a market (${hTargets.length} names)`)
ok(hTargets.every(t => leagueTier(h.clubs[h.userClubId].leagueId) - leagueTier(h.clubs[t.clubId!].leagueId) <= 1),
  'and no name on it fell two divisions to get there')

console.log(fails ? `\nLOAN STEP PROBE FAILED (${fails})` : '\nLOAN STEP PROBE PASSED: the loan market has gravity')
process.exit(fails ? 1 : 0)
