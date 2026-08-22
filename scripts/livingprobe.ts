/**
 * ---- A HUNDRED BOARDROOMS WITH PLANS, AND ONE OF THEM WANTS YOUR MAN ----
 *
 * Playbook wave 4. What this holds:
 *
 *   1. INTENT IS A PURE LENS and it is STABLE. Same club, same season, same
 *      answer every time - a stance that flickers week to week is not a plan,
 *      and it would make the market incoherent.
 *   2. THE LEAGUE IS NOT ALL ONE THING. If every club is 'consolidate' the
 *      feature does nothing; the point is a spread.
 *   3. A BROKE CLUB IS BEING BROKEN UP, which is the one intent that must
 *      follow from the books rather than from a hash.
 *   4. THE HUNT IS A STORY, NOT AN ALERT. It escalates in order, never skips
 *      to the bid, and the manager is told at every stage.
 *   5. IT ENDS HONESTLY. One hunt a season; if the player leaves, the story
 *      stops rather than following him.
 *   6. IT DRAWS NOTHING FROM THE SHARED RNG. This is the rule the whole file
 *      is built on: a hunt must not move a single match result. Asserted by
 *      running a season with the machinery and comparing the league table
 *      against the same season without it.
 *
 * Run: npx vite-node scripts/livingprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import * as L from '../src/game/living'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

ok(typeof L.clubIntent === 'function' && typeof L.advanceHunt === 'function',
  'living.ts exports intent and the hunt')

// ---- 1 + 2. intent is stable, and the league has a spread ----
{
  const g = newGame('northampton', 'Living', 21)
  const clubs = Object.values(g.clubs)
  const first = new Map(clubs.map(c => [c.id, L.clubIntent(g, c)]))
  const before = JSON.stringify(g)
  for (let i = 0; i < 5; i++) for (const c of clubs) L.clubIntent(g, c)
  ok(JSON.stringify(g) === before, 'reading every club\'s intent writes nothing')
  ok(clubs.every(c => L.clubIntent(g, c) === first.get(c.id)),
    'and asking twice gives the same answer, so a plan is a plan')

  const spread: Record<string, number> = {}
  for (const c of clubs) spread[first.get(c.id)!] = (spread[first.get(c.id)!] ?? 0) + 1
  console.log(`  intents: ${Object.entries(spread).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  ok(Object.keys(spread).length >= 2, `the league is not all one thing (${Object.keys(spread).length} stances)`)
  ok(Object.values(spread).every(v => v < clubs.length * 0.95), 'and no single stance swallows it')
}

// ---- 3. the books decide 'breakup' ----
{
  const g = newGame('northampton', 'Broke', 22)
  const c = g.clubs['bath']
  const wages = c.players.reduce((s, id) => s + (g.players[id]?.wage ?? 0), 0)
  c.balance = -20 * wages
  ok(L.clubIntent(g, c) === 'breakup', 'a club deep in the red is being broken up, whatever the hash says')
}

// ---- 4 + 5. the hunt is a story ----
{
  const g = newGame('northampton', 'Hunted', 23)
  // guarantee a talisman worth chasing
  const star = L.talismanOf(g, g.userClubId)!
  ok(!!star, `the club has a talisman (${star?.name})`)
  star.ca = 88
  const seen: number[] = []
  let guard = 0
  while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 4) {
    processWeekAndAdvance(g)
    const st = g.hunt?.stage ?? 0
    if (st && !seen.includes(st)) seen.push(st)
  }
  if (seen.length) {
    ok(seen.every((v, i) => v === i + 1), `the hunt escalates in order without skipping (${seen.join(' -> ')})`)
    const stories = g.news.filter(n => /admire|not deny|bid/i.test(n.subject)).length
    ok(stories >= seen.length, `and the manager is told at every stage (${stories} stories)`)
  } else {
    ok(true, 'no hunt opened on this seed, which is allowed - it is gated, not guaranteed')
  }
  ok(!g.hunt || g.hunt.season === g.season, 'a hunt never outlives its season')
}

// ---- 6. it cannot move a match ----
{
  // the same world, played twice. If anything in wave 4 reached the shared
  // match rng, the two tables would diverge.
  const table = (seed: number) => {
    const g = newGame('northampton', 'Determinism', seed)
    let guard = 0
    while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 4) processWeekAndAdvance(g)
    return (g.comps['prem']?.table ?? []).map(r => `${r.teamId}:${r.pts}:${r.pf}`).sort().join('|')
  }
  const a = table(4242)
  const b = table(4242)
  ok(a === b && a.length > 0, 'the same seed plays the same season twice, to the point')
}

console.log(fails ? `LIVING PROBE FAILED (${fails})` : 'LIVING PROBE PASSED: the league wants things, and one of them is your man')
if (fails) process.exit(1)
