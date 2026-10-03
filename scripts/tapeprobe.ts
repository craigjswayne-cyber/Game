// tapeprobe: the arms race's tape against the ways a manager can call his
// strikes (1.8.3 D2, from the audit's experiment harness).
//
// One world, one season per calling pattern, the same fixtures each time.
// The tape, the wear and the side's familiarity are all kept by tallyCalls
// as each of the manager's matches kicks off, so the patterns are run by
// filing his fixtures in order rather than playing the world's season; one
// pattern is also played through the real season (processWeekAndAdvance) and
// must read the same to the digit, which keeps the shortcut honest. Before
// every match the probe reads what each called strike is worth on the
// ticks it runs in against the world's sharpest analyst coach (moves.ts
// moveEdge, with the adapt armsrace.ts adaptOf gives that coach), with the
// drilling held at 85, the fit and the matchup at +0.2, so the number moves
// only with the tape, the wear and the side's familiarity. Matches 4 to 15
// are averaged: the tape is full by then and the season's wear is building.
//
// What must hold:
//   - alternating two strikes match by match is no better than a 50/50 mix of
//     the same two in every match (within ALT_TOL): the coach reads the
//     whole tape, not just the call he saw last
//   - spamming one strike is the worst of the patterns
//   - variety across three strikes is at least as good as alternating two
//   - a strike shelved for seven matches gets most of its wear back
//
// Run: npx vite-node scripts/tapeprobe.ts

import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { adaptOf, tallyCalls } from '../src/game/armsrace'
import { playbookOf } from '../src/game/playbook'
import { archetypeOf } from '../src/game/oppcoach'
import { moveEdge } from '../src/game/moves'
import type { GameState } from '../src/game/model'

type Calls = { main?: string; alt?: string; mix?: number }
const L = 'mv_loop', S = 'mv_switch', C = 'mv_crash'
const FROM = 4, TO = 15
/** how much better than the 50/50 mix alternation may read and still pass:
 *  0.1 points of try chance, under a seventh of the 0.75 by which it led
 *  in the audit */
const ALT_TOL = 0.001
/** the share of its wear a strike shelved for seven matches must get back */
const SHELVE_BACK = 0.5

const base = newGame('leicester', 'Tape', 909)
const others = Object.values(base.clubs).filter(c => c.id !== base.userClubId && c.philosophy)
const analyst = others.filter(c => archetypeOf(c.id, c.rep) === 'analyst').sort((a, b) => b.rep - a.rep)[0]
if (!analyst) { console.log('FAIL: no analyst coach in the world'); process.exit(1) }

/** the strikes' worth on their own ticks, before match i, for match i's calls */
function worth(g: GameState, c: Calls): { gain: number; adapt: number } {
  const me = g.clubs[g.userClubId]
  const pb = playbookOf(me)
  const list: [string, number][] = c.main && c.alt ? [[c.main, (c.mix ?? 67) / 100], [c.alt, 1 - (c.mix ?? 67) / 100]] : c.main ? [[c.main, 1]] : []
  let gain = 0, adapt = 0
  for (const [id, w] of list) {
    const a = adaptOf(g, analyst.id, id)
    const save = pb.drilled[id]
    pb.drilled[id] = 85
    gain += w * moveEdge(g, me, id, 0.2, 0.2, a).gain
    pb.drilled[id] = save
    adapt += w * a
  }
  return { gain, adapt }
}

/** the manager's fixtures in the order he plays them */
const mine = base.fixtures
  .filter(f => (f.homeId === base.userClubId || f.awayId === base.userClubId) && base.clubs[f.homeId] && base.clubs[f.awayId])
  .sort((a, b) => a.week - b.week || a.id - b.id)

/** a season of one calling pattern: per match, its worth, and the wear on
 *  each watched strike as the match begins. `real` plays the world's season;
 *  otherwise each fixture is filed on the tape as its match would begin. */
function season(plan: (i: number) => Calls, n: number, real = false) {
  const g = structuredClone(base)
  const me = g.clubs[g.userClubId]
  const rows: { fx: number; gain: number; adapt: number; used: Record<string, number> }[] = []
  let i = 0, guard = 0
  while (i < n && guard++ < 80) {
    const fx = real ? userFixtureThisWeek(g) : mine[i]
    if (!real && !fx) break
    if (fx) {
      const c = plan(i)
      me.tactic.moveMain = c.main; me.tactic.moveAlt = c.alt; me.tactic.moveMix = c.mix
      const pb = playbookOf(me)
      rows.push({ fx: fx.id, ...worth(g, c), used: { [L]: pb.used[L] ?? 0, [S]: pb.used[S] ?? 0, [C]: pb.used[C] ?? 0 } })
      i++
      if (!real) tallyCalls(g, fx)
    }
    if (real) processWeekAndAdvance(g)
  }
  return rows
}

const t0 = Date.now()
const patterns: [string, (i: number) => Calls][] = [
  ['spam one strike', () => ({ main: L })],
  ['alternate two, match by match', i => ({ main: i % 2 ? S : L })],
  ['mix two 50/50 every match', () => ({ main: L, alt: S, mix: 50 })],
  ['mix two 67/33 every match', () => ({ main: L, alt: S, mix: 67 })],
  ['rotate three, match by match', i => ({ main: [L, S, C][i % 3] })],
  ['rotate three pairs at 50/50', i => [{ main: L, alt: S, mix: 50 }, { main: S, alt: C, mix: 50 }, { main: C, alt: L, mix: 50 }][i % 3]],
]
const res: Record<string, { gain: number; adapt: number }> = {}
console.log(`analyst coach: ${analyst.id} (rep ${analyst.rep}); matches ${FROM} to ${TO}`)
console.log('pattern                            gain on its ticks   adapt')
for (const [name, plan] of patterns) {
  const rows = season(plan, TO + 1).slice(FROM, TO + 1)
  const gain = rows.reduce((s, r) => s + r.gain, 0) / rows.length
  const adapt = rows.reduce((s, r) => s + r.adapt, 0) / rows.length
  res[name] = { gain, adapt }
  console.log(`  ${name.padEnd(33)} ${((gain >= 0 ? '+' : '') + (gain * 100).toFixed(2) + '%').padStart(8)}        ${adapt.toFixed(3)}`)
}

// the shortcut against the real season, for one pattern
const alt = (i: number): Calls => ({ main: i % 2 ? S : L })
const fast = season(alt, TO + 1), slow = season(alt, TO + 1, true)
const same = fast.length === slow.length && fast.every((r, k) => r.fx === slow[k].fx && r.gain === slow[k].gain && r.used[L] === slow[k].used[L] && r.used[S] === slow[k].used[S])
console.log(`the real season reads ${same ? 'the same' : 'DIFFERENTLY'} over ${slow.length} matches`)

// shelving: ten matches of the loop, seven of the switch, then the loop again
const sh = season(i => ({ main: i < 10 || i >= 17 ? L : S }), 18)
const worn = sh[10].used[L], back = sh[17].used[L]
const regained = worn > 0 ? 1 - back / worn : 0
console.log(`shelving: the loop's wear ${worn.toFixed(2)} after ten matches, ${back.toFixed(2)} after seven on the shelf (${(regained * 100).toFixed(0)}% back)`)

let ok = true
const fail = (m: string) => { ok = false; console.log('FAIL: ' + m) }
if (!same) fail('filing the fixtures does not read as the real season does')
const g = (k: string) => res[k].gain
if (g('alternate two, match by match') > g('mix two 50/50 every match') + ALT_TOL) fail('alternating two strikes beats a 50/50 mix of them')
for (const [k] of patterns) if (k !== 'spam one strike' && g('spam one strike') >= g(k)) fail(`spamming one strike is no worse than: ${k}`)
if (g('rotate three, match by match') < g('alternate two, match by match')) fail('three strikes in rotation are worse than two')
if (regained < SHELVE_BACK) fail(`a shelved strike gets only ${(regained * 100).toFixed(0)}% of its wear back`)
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`)
console.log(ok ? 'TAPEPROBE PASSED' : 'TAPEPROBE FAILED')
if (!ok) process.exit(1)
