// Probe: a career always has something ahead of it.
//
// The Legacy screen was an obituary - career record, cabinet, season by season,
// Hall of Fame, every number already in the past. The marks it now counts towards
// were already in the engine and already saluted; nothing had ever mentioned them
// before they landed, so a 250th win arrived as a surprise rather than an arrival.
//
// The reason this is a probe and not a glance at the screen: the interesting cases
// are the two ends of a career, and neither is reachable by playing. A manager one
// week into his first job, and a manager past a thousand wins and twenty-five
// seasons, have to get four honest lines each. A screen that tells somebody still
// playing that there is nothing left would be worse than no screen at all, and it
// is exactly what a `marks.find(x => x > at)` returning undefined produces.
import { newGame } from '../src/game/newgame'
import { horizon, horizonPct } from '../src/game/legacy'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'Horizon Probe', 4242)

/** Put a career at an arbitrary stage without playing it. */
const at = (state: GameState, w: number, m: number, seasons: number, titles: number) => {
  state.mgr.w = w
  state.mgr.m = m
  state.mgr.l = Math.max(0, m - w)
  state.mgr.finishes = Array.from({ length: seasons }, (_, i) => ({
    season: i, leagueId: 'prem', pos: i < titles ? 1 : 5,
  }))
  return horizon(state)
}

// ---- week one --------------------------------------------------------------
{
  const h = at(g, 0, 0, 0, 0)
  console.log('\nday one:')
  for (const r of h) console.log(`  ${r.label.padEnd(30)} ${r.at}/${r.goal}  ${r.note}  ${horizonPct(r)}%`)
  ok(h.length === 4, `four lines on day one (${h.length})`)
  ok(h.every(r => r.goal > 0), 'no line divides by a zero goal')
  ok(h.every(r => horizonPct(r) === 0), 'and nothing reads as part-done before a ball is kicked')
  ok(h.some(r => /first league title/i.test(r.label)), 'a first title is one of them')
}

// ---- mid-career ------------------------------------------------------------
{
  const h = at(g, 180, 300, 7, 2)
  console.log('\nseven seasons in, 180 wins from 300, two titles:')
  for (const r of h) console.log(`  ${r.label.padEnd(30)} ${r.at}/${r.goal}  ${r.note}  ${horizonPct(r)}%`)
  ok(h.length === 4, 'still four lines')
  ok(h.every(r => r.at < r.goal), 'every target is genuinely ahead, never already passed')
  ok(h.every(r => horizonPct(r) > 0 && horizonPct(r) < 100), 'every bar is part full')
  ok(h.some(r => /250 career wins/.test(r.label)), 'the next win mark is the next one up, not the first in the list')
  ok(h.some(r => /3rd league title/.test(r.label)), 'and a third title is named as a third')
}

// ---- past every mark on the list -------------------------------------------
//
// THE CASE THAT BREAKS IT. WIN_MARKS tops out at 1000 and GAME_MARKS at 1000, so
// find() returns undefined for both and a naive version of this screen shows a
// twenty-five-season manager two lines, or an empty card, or NaN.
{
  const h = at(g, 1400, 2000, 26, 11)
  console.log('\ntwenty-six seasons, 1400 wins, eleven titles:')
  for (const r of h) console.log(`  ${r.label.padEnd(30)} ${r.at}/${r.goal}  ${r.note}  ${horizonPct(r)}%`)
  ok(h.length >= 2, `a career past every mark still has something ahead (${h.length} lines)`)
  ok(h.every(r => Number.isFinite(r.at) && Number.isFinite(r.goal)), 'no NaN in the numbers')
  ok(h.every(r => Number.isFinite(horizonPct(r))), 'and no NaN in the bars')
  ok(h.every(r => r.at < r.goal), 'nothing on the list is already done')
  ok(h.some(r => /12th league title/.test(r.label)), 'the next title is still named')
  ok(h.some(r => /30 seasons/.test(r.label)), 'and the next decade of doing it is the era mark above him')
}

// ---- the words are usable --------------------------------------------------
{
  const all = [at(g, 0, 0, 0, 0), at(g, 49, 99, 9, 0), at(g, 1400, 2000, 26, 11)].flat()
  ok(all.every(r => !r.label.includes('undefined') && !r.note.includes('undefined')),
    'no undefined in a label or a note')
  ok(all.every(r => !/NaN/.test(r.label + r.note)), 'no NaN in a label or a note')
  ok(all.every(r => !/—/.test(r.label + r.note)), 'no em dashes')
  // "1 seasons done" is the kind of thing that ships and then gets screenshotted
  ok(!all.some(r => /\b1 seasons\b/.test(r.note)), 'one season is a season, not seasons')
}

console.log(fails ? `\nHORIZON PROBE FAILED (${fails})` : '\nHORIZON PROBE PASSED: there is always something ahead')
process.exit(fails ? 1 : 0)
