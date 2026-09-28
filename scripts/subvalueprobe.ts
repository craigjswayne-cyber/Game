// Probe: the bench matters (1.8.0, owner: "Subs should be important").
//
// The same match to the 56th minute, then three branches for the manager's
// side: no changes, four, or eight, each replacement coming on for the most
// tired starter in his position. The margin over the last quarter is read in
// each. Before 1.8.0 changes LOST points (four about level, eight -0.4; an
// older audit had eight at -2.5), because a spent starter kept 78% of his
// strength and that beat a fresh but lesser replacement. From the 56th
// minute an empty tank now keeps 60% (matchEngine LATE_FLOOR).
//
// Held: four changes and eight both beat none by half a point or more, and
// eight does not beat four by more than a point and a half (emptying the
// bench every week is not the answer, choosing it is).
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick, playSegment, resolveDecision, autoSelect, availablePlayers, rosterOf, makeSubstitution } from '../src/game/matchEngine'
import type { LiveCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'
const g = newGame('leicester', 'T', 20260907)
const clubs = Object.values(g.clubs).filter(c => c.leagueId === g.clubs.leicester.leagueId).sort((a, b) => b.rep - a.rep)
g.week = 20
for (const c of Object.values(g.clubs)) { c.tactic.lineup = autoSelect(g, availablePlayers(g, rosterOf(g, c.id))) }
const N = Number(process.argv[2] ?? 1200)
const res: Record<string, { m: number; n: number }> = { none: { m: 0, n: 0 }, four: { m: 0, n: 0 }, eight: { m: 0, n: 0 } }
for (let i = 0; i < N; i++) {
  // rotate the user through the league's clubs and opponents
  const us = clubs[i % clubs.length], them = clubs[(i * 7 + 3) % clubs.length]
  if (us.id === them.id) continue
  g.userClubId = us.id
  for (const c of Object.values(g.clubs)) c.tactic.userPicked = c.id === us.id
  for (const mode of ['none', 'four', 'eight'] as const) {
    for (const id of [us.id, them.id]) for (const pid of g.clubs[id].players) { const p = g.players[pid]; if (p) { p.injury = undefined; p.cond = 100; p.bans = 0 } }
    const home = i % 2 === 0
    const fx = { id: g.nextId++, compId: 'prem', round: 0, week: 20, homeId: home ? us.id : them.id, awayId: home ? them.id : us.id, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 } as Fixture
    const ctx: LiveCtx = beginMatch(g, fx, mulberry32((777 + i) >>> 0), false)
    while (ctx.tick < 14) { stepTick(g, ctx); if (ctx.decision) resolveDecision(g, ctx, 'posts') }
    const mine = ctx.home.teamId === us.id ? ctx.home : ctx.away, opp = mine === ctx.home ? ctx.away : ctx.home
    const m0 = mine.score - opp.score
    const k = mode === 'none' ? 0 : mode === 'four' ? 4 : 8
    for (let b = 15, done = 0; b < 23 && done < k; b++) {
      const inId = mine.lineup[b]; if (inId == null) continue
      const pos = g.players[inId]?.pos
      const cands = mine.lineup.slice(0, 15).filter((x): x is number => x != null && mine.onPitch.has(x))
      const same = cands.filter(x => g.players[x]?.pos === pos).sort((a, b2) => (mine.energy.get(a) ?? 70) - (mine.energy.get(b2) ?? 70))
      const outId = same[0]
      if (outId == null) continue
      if (!/will come on|come on/i.test(makeSubstitution(g, ctx, outId, inId))) continue
      done++
    }
    for (let guard = 0; guard < 6 && ctx.tick < 20; guard++) playSegment(g, ctx)
    res[mode].m += (mine.score - opp.score) - m0; res[mode].n++
  }
}
for (const [k, v] of Object.entries(res)) console.log(`${k}: margin from minute 56 ${(v.m / v.n).toFixed(2)} (${v.n})`)

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const mean = (k: string) => res[k].m / Math.max(1, res[k].n)
ok(mean('four') >= mean('none') + 0.5, `four fresh men late on are worth it (${(mean('four') - mean('none')).toFixed(2)} points over none)`)
ok(mean('eight') >= mean('none') + 0.5, `and so is the whole bench (${(mean('eight') - mean('none')).toFixed(2)})`)
ok(mean('eight') - mean('four') <= 1.5, `but emptying it is not a meta over choosing (${(mean('eight') - mean('four')).toFixed(2)} more than four)`)
console.log(fails ? `SUB VALUE PROBE FAILED (${fails})` : 'SUB VALUE PROBE PASSED: fresh legs win the last quarter, and the bench is a choice')
process.exit(fails ? 1 : 0)
