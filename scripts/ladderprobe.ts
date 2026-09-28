// ---- THE ATTRIBUTE LADDER (1.8.0) ----
//
// From the owner's research round (Football Manager's match engine videos
// and FM Arena's testing): FM's engine has for years rewarded pace and
// acceleration so far above everything else that players treat it as an
// exploit. optionsprobe asks the same question of every tactics option; this
// asks it of the attributes.
//
// MEASURED EXACTLY, NOT SAMPLED. The first cut played 120 matches per
// attribute with the same dice, and the answer was noise: the dice stay
// aligned only until the first event differs, after which the two matches
// are strangers, so a row carried about +-2.5 points of luck (it rated +2
// work rate at -1.6 points a match). The engine's scoring chance is a pure
// function of each side's strength, so this reads what an attribute does to
// that strength directly:
//
//   STRENGTH   the attacking and defending figures every tick is decided by
//              (simTick: attack 0.55, breakdown 0.25, scrum 0.1, lineout 0.1;
//              defence 0.7, breakdown 0.3), their % change summed: a point of
//              attack and a point of defence are worth the same in the ratio
//   PENALTIES  the scrum edge on the penalty window (penWindow x scrumEdge)
//   KICKING    the kicking unit, which wins territory
//
// Every man in a Premiership 23 gets +2 in ONE attribute, across twenty
// clubs. Checks:
//
//   NOTHING RUNS AWAY: the most valuable attribute's strength is no more than
//     twice the third's. Before 1.8.0 tackling was the whole defence unit
//     and read 9.0% against handling's 3.6% in third, 2.5 times.
//   THE CORE COUNTS: tackling, handling, scrummaging, lineout and rucking
//     each move strength, penalties or kicking.
//   AN ATTRIBUTE IN THE RATING IS IN THE MATCH: every attribute the rating is
//     built from moves something here, or is named as read elsewhere.
//
// Run: npx vite-node scripts/ladderprobe.ts
import { newGame } from '../src/game/newgame'
import { teamUnits } from '../src/game/matchEngine'
import type { Attrs } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g = newGame('northampton', 'Ladder', 3)
const clubs = Object.values(g.clubs).filter(c => c.tactic?.lineup?.slice(0, 15).every(x => x != null)).slice(0, 20)

const strength = (u: ReturnType<typeof teamUnits>) => ({
  att: u.attack * 0.55 + u.breakdown * 0.25 + u.scrum * 0.1 + u.lineout * 0.1,
  def: u.defence * 0.7 + u.breakdown * 0.3,
  scrum: u.scrum, kicking: u.kicking,
})

const KEYS: (keyof Attrs)[] = ['pac', 'agi', 'sta', 'str', 'tac', 'han', 'pas', 'kic', 'goa', 'scr', 'lin', 'ruc', 'vis', 'dec', 'pos', 'agg', 'wor', 'lea']
const rows = KEYS.map(k => {
  let str = 0, pen = 0, kick = 0
  for (const c of clubs) {
    const ids = c.players
    const base = strength(teamUnits(g, c.tactic.lineup))
    const saved = ids.map(id => g.players[id]?.a[k])
    for (const id of ids) { const p = g.players[id]; if (p) p.a[k] = Math.min(20, p.a[k] + 2) }
    const up = strength(teamUnits(g, c.tactic.lineup))
    ids.forEach((id, i) => { const p = g.players[id]; if (p && saved[i] != null) p.a[k] = saved[i]! })
    str += (up.att / base.att - 1) + (up.def / base.def - 1)
    pen += 0.8 * (up.scrum / base.scrum - 1)
    kick += up.kicking / base.kicking - 1
  }
  const n = clubs.length
  return { k, str: (str / n) * 100, pen: (pen / n) * 100, kick: (kick / n) * 100 }
}).sort((a, b) => b.str - a.str)

console.log(`+2 in one attribute across ${clubs.length} clubs' 23s, % change:\n`)
console.log('         strength  penalties  kicking')
for (const r of rows) console.log(`  ${r.k.padEnd(5)} ${r.str.toFixed(2).padStart(8)} ${r.pen.toFixed(2).padStart(10)} ${r.kick.toFixed(2).padStart(8)}  ${'#'.repeat(Math.round(r.str * 2))}`)
console.log()

const [first, , third] = rows
ok(first.str <= 2 * third.str, `nothing runs away: ${first.k} ${first.str.toFixed(2)}% against third-placed ${third.k} ${third.str.toFixed(2)}%`)
const core: (keyof Attrs)[] = ['tac', 'han', 'scr', 'lin', 'ruc']
const dead = core.filter(k => { const r = rows.find(x => x.k === k)!; return r.str + r.pen + r.kick < 0.3 })
ok(dead.length === 0, `the core counts: tackling, handling, scrummaging, lineout and rucking each move the match${dead.length ? ` (not: ${dead.join(', ')})` : ''}`)
// read by other systems, by design: the tee (kickChance reads goal kicking),
// the legs (energy drain reads stamina), the captaincy (leadership) and the
// referee (aggression and cards)
const ELSEWHERE = new Set<keyof Attrs>(['goa', 'sta', 'lea', 'agg'])
const idle = rows.filter(r => r.str + r.pen + r.kick < 0.1 && !ELSEWHERE.has(r.k)).map(r => r.k)
ok(idle.length === 0, `every rated attribute is read in a match${idle.length ? ` (not: ${idle.join(', ')})` : ' (goal kicking, stamina, leadership and aggression through the tee, the legs, the captaincy and the referee)'}`)

console.log(fails ? `\nLADDER PROBE FAILED (${fails})` : '\nLADDER PROBE PASSED: no attribute runs the game')
process.exit(fails ? 1 : 0)
