// ---- THE ATTRIBUTE LADDER (1.8.0) ----
//
// From the owner's research round (Football Manager's match engine videos
// and FM Arena's testing): FM's engine has for years rewarded pace and
// acceleration so far above everything else that players treat it as an
// exploit - "Acceleration up to 16 wins matches". optionsprobe asks the same
// question of every tactics option; this asks it of the attributes.
//
// Every man in the manager's 23 gets +2 in ONE attribute, and the side plays
// the same 120 fixtures with the same dice (common random numbers: only the
// attribute differs), the way the Instant Result plays them. The table says
// what each attribute is worth in points a match. Two checks:
//
//   NOTHING RUNS AWAY: the most valuable attribute is worth no more than
//     twice the third, and no more than 4 points a match on its own. A pace
//     meta would show as one row far above the rest.
//   THE CORE OF THE GAME COUNTS: tackling, handling and the set-piece skills
//     are each worth something. An attribute worth nothing is printed, not
//     failed: some are read by other systems (leadership by the captaincy,
//     aggression by the cards), and the table is there for anyone tuning.
//
// Run: npx vite-node scripts/ladderprobe.ts   (slow: a couple of thousand matches)
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Attrs, Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const pool: { g: GameState; fx: Fixture }[] = []
for (const seed of [3, 11, 29, 47, 83, 101, 131, 157, 181, 211, 239, 263, 281, 307, 331, 353, 379, 401, 421, 443, 463, 487, 503, 521]) {
  for (const club of ['northampton', 'bath', 'exeter', 'sale', 'leicester']) {
    const g = newGame(club, 'Ladder', seed)
    pool.push({ g, fx: g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))! })
  }
}

function play(k: keyof Attrs | null, by = 2): number {
  let margin = 0
  pool.forEach(({ g, fx }, i) => {
    const h = structuredClone(g)
    const me = h.userClubId
    h.clubs[me].tactic.penaltyCall = 'posts'
    if (k) for (const id of h.clubs[me].players) { const p = h.players[id]; if (p) p.a[k] = Math.max(1, Math.min(20, p.a[k] + by)) }
    const f = h.fixtures.find(x => x.id === fx.id)!
    const ctx = beginMatch(h, f, mulberry32(9000 + i * 17), true, me)
    ctx.assistantSubs = true
    playHalf(h, ctx); playHalf(h, ctx)
    const mine = ctx.home.teamId === me ? ctx.home : ctx.away
    const theirs = mine === ctx.home ? ctx.away : ctx.home
    margin += mine.score - theirs.score
  })
  return margin / pool.length
}

const base = play(null)
console.log(`standard squad over ${pool.length} matches: margin ${base.toFixed(2)}\n`)
const KEYS: (keyof Attrs)[] = ['pac', 'agi', 'sta', 'str', 'tac', 'han', 'pas', 'kic', 'goa', 'scr', 'lin', 'ruc', 'vis', 'dec', 'pos', 'agg', 'wor', 'lea']
const rows = KEYS.map(k => ({ k, d: play(k) - base })).sort((a, b) => b.d - a.d)
for (const r of rows) console.log(`  +2 ${r.k.padEnd(4)} ${r.d >= 0 ? '+' : ''}${r.d.toFixed(2)} points a match ${'#'.repeat(Math.max(0, Math.round(r.d * 4)))}`)
console.log()

const [first, , third] = rows
ok(first.d <= 4, `no attribute is a meta on its own (+2 ${first.k} is worth ${first.d.toFixed(2)} points a match)`)
ok(first.d <= 2 * Math.max(0.25, third.d), `nothing runs away from the rest (${first.k} ${first.d.toFixed(2)} against third-placed ${third.k} ${third.d.toFixed(2)})`)
// the core, at +4: a +2 on the three men in a front row is a small signal
// over 120 matches (scrummaging read +0.36 on one run and -0.10 on the next),
// so the question "does it count" is asked where the answer is out of the noise
const core: (keyof Attrs)[] = ['tac', 'han', 'scr', 'lin', 'ruc']
const coreD = core.map(k => ({ k, d: play(k, 4) - base }))
console.log(`  at +4: ${coreD.map(r => `${r.k} ${r.d >= 0 ? '+' : ''}${r.d.toFixed(2)}`).join(', ')}`)
const dead = coreD.filter(r => r.d <= 0.2).map(r => r.k)
ok(dead.length === 0, `the core of the game counts: tackling, handling, scrum, lineout and rucking each move the margin at +4${dead.length ? ` (not: ${dead.join(', ')})` : ''}`)
const flat = rows.filter(r => Math.abs(r.d) <= 0.05).map(r => r.k)
if (flat.length) console.log(`\n  worth nothing on the scoreboard here: ${flat.join(', ')} (read elsewhere, or a gap worth a look)`)

console.log(fails ? `\nLADDER PROBE FAILED (${fails})` : '\nLADDER PROBE PASSED: no attribute runs the game')
process.exit(fails ? 1 : 0)
