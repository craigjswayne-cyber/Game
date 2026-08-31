/**
 * ---- THE COACH NAMES HIS OWN SQUAD ----
 *
 * Owner, v1.1.17: "It should also be more of a statement with the game stopping
 * and asking the international coach to select his squad for any upcoming games
 * 2 weeks out. It needs to be more obvious... dont auto pick the squad, it
 * should be the coaches job to pick them. Showing who is available with
 * recommended/in form at top."
 *
 * Every nation's squad was assembled by the engine, the user's included, and
 * the country desk was handed a finished list to fiddle with. That is the wrong
 * way round for the one job the international game is FOR.
 *
 * Four claims, and the fourth is the one that keeps this safe:
 *   1. his camp opens BLANK, and everybody else's does not;
 *   2. the week is HELD until he has named a legal squad;
 *   3. the hold clears by naming one, in a bounded number of calls;
 *   4. and a Test is never played with an empty squad, whatever he does -
 *      the assistant fills a short sheet at kick-off, because a hold with a
 *      way round it still has to leave the game playable.
 *
 * Run: npx vite-node scripts/squadname.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { natCallUp, natEligible, natSquadHold, natWindow, NAT_SQUAD_FLOOR } from '../src/game/country'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** A career with the England job, walked to the first open camp. */
function toCamp(seed: number): GameState {
  const g = newGame('northampton', 'Squad Name', seed)
  g.natTeam = 'ENG'
  g.natConfidence = 60
  g.natRecord = { m: 0, w: 0, d: 0, l: 0 }
  for (let i = 0; i < 60 && !natWindow(g); i++) processWeekAndAdvance(g)
  return g
}

console.log('\n--- 1. his camp opens blank; the rest of the world picks as it always did\n')
{
  const g = toCamp(71)
  ok(!!natWindow(g), `a camp is open (wk${g.week})`)
  ok((g.natSquads['ENG'] ?? []).length === 0,
    `and his own sheet is blank (${(g.natSquads['ENG'] ?? []).length} named)`)

  // THE REST OF THE WORLD IS NOT HIS JOB. Thirty federations naming squads is
  // world simulation; if this stopped too, every other nation would field
  // nobody and the Test calendar would be a fiction.
  const others = Object.entries(g.natSquads).filter(([nat]) => nat !== 'ENG' && nat !== 'LIO')
  const named = others.filter(([, ids]) => (ids ?? []).length > 0)
  ok(others.length > 0 && named.length === others.length,
    `every other nation in camp still names its own (${named.length}/${others.length})`)
}

console.log('\n--- 2. the week is held until he names one\n')
{
  const g = toCamp(72)
  const held = natSquadHold(g)
  ok(held != null, `the week is held (${held?.n ?? 0} still to name)`)
  ok(held?.n === NAT_SQUAD_FLOOR, `and it asks for a legal squad (${held?.n} of ${NAT_SQUAD_FLOOR})`)

  // A HOLD THAT CANNOT BE CLEARED IS A BRICKED SAVE, which is the lesson the
  // press hold cost. There has to be a pool to name from.
  const pool = natEligible(g)
  ok(pool.length >= NAT_SQUAD_FLOOR,
    `and there are men to name (${pool.length} callable, floor ${NAT_SQUAD_FLOOR})`)
}

console.log('\n--- 3. naming clears it, and the desk recommends in a sane order\n')
{
  const g = toCamp(73)
  // the same order the desk sorts by: ability, lifted by form
  const recommend = (p: { ca: number; form: number }) => p.ca + (p.form - 5) * 2.2
  const ranked = [...natEligible(g)].sort((a, b) => recommend(b) - recommend(a))
  ok(ranked.length > 0, `the desk has a ranked pool (${ranked.length})`)
  // form moves men, but never turns the list into a form table: the top of the
  // pool is still made of good players
  const top = ranked.slice(0, NAT_SQUAD_FLOOR)
  const meanTop = top.reduce((s, p) => s + p.ca, 0) / top.length
  const meanAll = ranked.reduce((s, p) => s + p.ca, 0) / ranked.length
  ok(meanTop > meanAll, `and the men it recommends are the better ones (${meanTop.toFixed(1)} v ${meanAll.toFixed(1)} overall)`)

  let calls = 0
  for (const p of ranked) {
    if (!natSquadHold(g)) break
    natCallUp(g, p.id)
    calls++
    if (calls > 60) break
  }
  ok(natSquadHold(g) == null, `naming a squad clears the hold (${calls} call-ups)`)
  ok(calls <= NAT_SQUAD_FLOOR, `in no more calls than the floor asks for (${calls})`)
}

console.log('\n--- 4. and a Test is never played with an empty squad\n')
{
  // THE WAY ROUND THE HOLD. An old save loaded mid-window, a nation too thin,
  // a coach appointed after the camp opened - the hold cannot cover those, so
  // the assistant fills a short sheet when kick-off arrives.
  const g = toCamp(74)
  ok((g.natSquads['ENG'] ?? []).length === 0, 'the coach names nobody at all')
  let guard = 0
  while (guard++ < 40) {
    const test = g.fixtures.some(f => !f.played && f.week === g.week &&
      (f.homeId === 'ENG' || f.awayId === 'ENG'))
    processWeekAndAdvance(g)
    if (test) break
  }
  const played = g.fixtures.filter(f => f.played && (f.homeId === 'ENG' || f.awayId === 'ENG'))
  ok(played.length > 0, `a Test was played (${played.length})`)
  ok((g.natSquads['ENG'] ?? []).length >= NAT_SQUAD_FLOOR || !natWindow(g),
    `and it was not played with an empty squad (${(g.natSquads['ENG'] ?? []).length} named)`)
  ok(g.news.some(n => n.k === 'news.natFilled'),
    'and the assistant said he had done it, rather than doing it quietly')
}

console.log(fails === 0
  ? '\nSQUAD NAME PASSED: the squad is his to name, and the game stops until he does'
  : `\nSQUAD NAME FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
