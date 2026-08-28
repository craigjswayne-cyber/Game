// Probe: the match stats sheet under the pitch (v1.1.9).
//
// The sheet is DERIVED - a function of possession the engine really recorded
// and the two packs' real scrum/lineout/defence numbers - rather than a
// ball-by-ball contest. That is a legitimate design and it is written down in
// matchEngine.ts, but it has one obligation the honest version of it must
// keep: every figure has to move for a reason a manager can point at.
//
// So this asserts the things that would make it decoration instead:
//   a heavier pack wins more of its own ball, and the beaten one loses more
//   a side without the ball makes more tackles
//   the numbers only ever go UP as a match runs (a live stat that fell would
//     read as a bug to anybody watching it tick)
//   the totals land where a real match lands them, not at ten or ten thousand
//
// Run: npx tsx scripts/statsprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, matchStats } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { LiveCtx } from '../src/game/matchEngine'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g = newGame('leicester', 'Stats Probe', 90210)
const fx = g.fixtures.find(f => f.week >= 4 && g.clubs[f.homeId] && g.clubs[f.awayId])!
const ctx = beginMatch(g, fx, mulberry32(4242), true)
playHalf(g, ctx)
playHalf(g, ctx)

// a shallow re-dress of a real ctx: matchStats reads only these, and cloning
// the whole thing is impossible (it carries the rng closure)
const dress = (over: Partial<LiveCtx> & { home?: unknown; away?: unknown }): LiveCtx =>
  ({ ...ctx, ...over }) as LiveCtx
const side = (s: LiveCtx['home'], over: Record<string, unknown>) =>
  ({ ...s, ...over, units: { ...s.units, ...(over.units as object ?? {}) } })

console.log('--- a played match produces a sheet\n')
const s = matchStats(ctx)
for (const k of ['possession', 'scrumsWon', 'scrumsLost', 'lineoutsWon', 'lineoutsLost', 'tackles'] as const) {
  console.log(`  ${k.padEnd(13)} ${s[k][0]} - ${s[k][1]}`)
}

ok(s.possession[0] + s.possession[1] === 100, `possession is a share of one ball (${s.possession[0]}/${s.possession[1]})`)
const scrums = s.scrumsWon[0] + s.scrumsLost[0] + s.scrumsWon[1] + s.scrumsLost[1]
const lines = s.lineoutsWon[0] + s.lineoutsLost[0] + s.lineoutsWon[1] + s.lineoutsLost[1]
const tackles = s.tackles[0] + s.tackles[1]
ok(scrums >= 6 && scrums <= 24, `a match holds a believable number of scrums (${scrums})`)
ok(lines >= 12 && lines <= 40, `and of lineouts (${lines})`)
ok(tackles >= 90 && tackles <= 340, `and of tackles (${tackles})`)
// an ordinary afternoon loses ball on both sides: a set piece is a contest
ok(s.scrumsLost[0] + s.lineoutsLost[0] > 0 && s.scrumsLost[1] + s.lineoutsLost[1] > 0,
  'both sides cough up some of their own ball in an evenly-matched match')

console.log('\n--- the numbers answer to the pack, not to nothing\n')
{
  // same match, one side's set piece made overwhelming: nothing else changes
  const h = matchStats(dress({
    home: side(ctx.home, { units: { scrum: 95, lineout: 95 } }),
    away: side(ctx.away, { units: { scrum: 45, lineout: 45 } }),
  }))
  const rate = (w: number, l: number) => (w + l ? w / (w + l) : 0)
  const hs = rate(h.scrumsWon[0], h.scrumsLost[0])
  const as = rate(h.scrumsWon[1], h.scrumsLost[1])
  ok(hs > as, `the heavier scrum wins a bigger share of its own ball (${Math.round(hs * 100)}% v ${Math.round(as * 100)}%)`)
  ok(rate(h.lineoutsWon[0], h.lineoutsLost[0]) > rate(s.lineoutsWon[0], s.lineoutsLost[0]),
    'and a better lineout improves on the same match with an ordinary one')
  // and the beaten pack is beaten, not wiped out: it still keeps most of its
  // own ball, because that is what a hammered pack does. (The dominant side
  // taking all seven of its own scrums in ONE match is not a bug - real packs
  // do it every weekend - so the guard is on the band, not on the integer.)
  ok(as >= 0.7 && as < hs, `the beaten pack still keeps most of its own ball (${Math.round(as * 100)}%)`)
}
{
  // the side without the ball does the tackling
  const l = matchStats(dress({
    home: side(ctx.home, { poss: 800 }),
    away: side(ctx.away, { poss: 200 }),
  }))
  ok(l.tackles[1] > l.tackles[0],
    `the side chasing the game makes more tackles (${l.tackles[1]} v ${l.tackles[0]})`)
  ok(l.possession[0] === 80, `and possession reads what the match recorded (${l.possession[0]}%)`)
}

console.log('\n--- live, it only ever climbs\n')
{
  // walk the clock the way the screen does and watch every figure
  const KEYS = ['scrumsWon', 'scrumsLost', 'lineoutsWon', 'lineoutsLost', 'tackles'] as const
  let prev = matchStats(dress({ lastMin: 0 }))
  let climbed = true
  let fellAt = ''
  for (let min = 0; min <= 80; min += 4) {
    const now = matchStats(dress({ lastMin: min }))
    for (const k of KEYS) {
      if (now[k][0] < prev[k][0] || now[k][1] < prev[k][1]) { climbed = false; fellAt ||= `${k} at ${min}'` }
    }
    prev = now
  }
  ok(climbed, `no figure ever falls as the match runs${climbed ? '' : ` (${fellAt})`}`)
  const atKO = matchStats(dress({ lastMin: 0 }))
  ok(KEYS.every(k => atKO[k][0] === 0 && atKO[k][1] === 0), 'and the sheet starts empty at kick-off')
}

console.log(fails ? `\nSTATS PROBE FAILED (${fails})` : '\nSTATS PROBE PASSED: the sheet answers to the match it came from')
if (fails) process.exit(1)
