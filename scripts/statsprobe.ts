// Probe: the match stats panel's set pieces and tackles (v1.1.9).
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
import { beginMatch, playHalf, matchStats, visitsTo22 } from '../src/game/matchEngine'
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
  // THE SIDE WITHOUT THE BALL DOES THE TACKLING. Tackles are counted from the
  // play since 1.8.0 (countTackles), so dressing up the possession of one
  // match cannot move them; this asks real matches instead. Not every one -
  // a side can dominate the ball and still be made to tackle all afternoon -
  // but most.
  let chasing = 0, n = 0
  for (let i = 0; i < 24; i++) {
    const gi = newGame('leicester', 'Stats Probe', 91000 + i)
    const fi = gi.fixtures.find(f => f.week >= 4 && gi.clubs[f.homeId] && gi.clubs[f.awayId])!
    const ci = beginMatch(gi, fi, mulberry32(5000 + i), true)
    playHalf(gi, ci); playHalf(gi, ci)
    const si = matchStats(ci)
    if (Math.abs(si.possession[0] - si.possession[1]) < 6) continue
    n++
    const less = si.possession[0] < si.possession[1] ? 0 : 1
    if (si.tackles[less] > si.tackles[1 - less]) chasing++
  }
  ok(n >= 10 && chasing / n >= 0.7, `the side with less of the ball makes more tackles in most matches (${chasing} of ${n})`)
}


console.log('\n--- live, it only ever climbs\n')
{
  // walk the clock the way the screen does and watch every figure
  // (tackles are counted by the engine since 1.8.0, not worked out from the
  // clock, so they are walked on a real match below instead)
  const KEYS = ['scrumsWon', 'scrumsLost', 'lineoutsWon', 'lineoutsLost'] as const
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

  // TACKLES ARE COUNTED (1.8.0, countTackles): none before a ball is played,
  // never fewer as the match runs, and the sheet's figure is the sum of every
  // man's own count
  const g2 = newGame('northampton', 'Stats', 4242)
  const fx2 = g2.fixtures.find(f => f.week === g2.week && (f.homeId === g2.userClubId || f.awayId === g2.userClubId))!
  const live = beginMatch(g2, fx2, mulberry32(4242), true)
  const t0 = matchStats(live).tackles
  playHalf(g2, live)
  const t1 = matchStats(live).tackles
  playHalf(g2, live)
  const t2 = matchStats(live).tackles
  ok(t0[0] === 0 && t0[1] === 0, `no tackles before kick-off (${t0.join('-')})`)
  ok(t1[0] <= t2[0] && t1[1] <= t2[1] && t1[0] > 0 && t1[1] > 0, `tackles only climb: ${t1.join('-')} at half-time, ${t2.join('-')} at full-time`)
  const sum = (m?: Map<number, number>) => [...(m ?? new Map()).values()].reduce((a, b) => a + b, 0)
  ok(sum(live.home.tackles) === t2[0] && sum(live.away.tackles) === t2[1], 'and the sheet is the sum of every player\'s own count')
}

console.log('\n--- kicks at goal: counted, and they add up\n')
{
  // every point that is not a try is a kick that went over: 2 for a
  // conversion, 3 for a penalty or a drop goal. So the made count is bounded
  // by the score, and the success rate lands where the kicking model is
  // calibrated (about 72% of tries converted, higher for penalties).
  let made = 0, taken = 0, bad = 0
  for (let i = 0; i < 24; i++) {
    const gi = newGame('leicester', 'Stats Probe', 93000 + i)
    const fi = gi.fixtures.find(f => f.week >= 4 && gi.clubs[f.homeId] && gi.clubs[f.awayId])!
    const ci = beginMatch(gi, fi, mulberry32(6000 + i), i % 2 === 0)
    playHalf(gi, ci); playHalf(gi, ci)
    const si = matchStats(ci)
    for (const [side, [m, t]] of [[ci.home, si.goalKicks[0]], [ci.away, si.goalKicks[1]]] as const) {
      made += m; taken += t
      // a penalty try is seven and has no conversion (1.8.16)
      const pt = side.penTries ?? 0
      const kickPts = side.score - 5 * side.tries - 2 * pt
      if (m > t || kickPts < 2 * m || kickPts > 3 * m || t < side.tries - pt) bad++
    }
  }
  ok(bad === 0, `every side's kicks made fit its score, and every try got its conversion attempt (${bad} that did not)`)
  const rate = made / taken
  ok(rate >= 0.6 && rate <= 0.85, `kicks at goal go over ${Math.round(rate * 100)}% of the time (${made} of ${taken})`)
}

console.log('\n--- a try is a visit to the 22 (1.8.1)\n')
{
  // THE STORE SCREENSHOT: a try on the live stats beside 0 visits to the 22,
  // so points per visit read 0.0 next to a score. scoreTry moves the ball
  // back for the restart before the try line is written, so a try from a long
  // break was stamped outside the 22. Walked a line at a time, the way the
  // ticker reveals them: at no point may a side that has scored a try read 0
  // visits or 0 points from them, nor more visits than lines it had.
  let checked = 0, bad = 0, first = '', over = 0
  for (let i = 0; i < 60; i++) {
    const gi = newGame('leicester', 'Stats Probe', 97000 + i)
    const fi = gi.fixtures.find(f => f.week >= 4 && gi.clubs[f.homeId] && gi.clubs[f.awayId])!
    const ci = beginMatch(gi, fi, mulberry32(7000 + i), true)
    playHalf(gi, ci); playHalf(gi, ci)
    const ev = ci.events
    for (const home of [true, false]) {
      const id = home ? ci.home.teamId : ci.away.teamId
      let tries = 0
      for (let n = 1; n <= ev.length; n++) {
        const e = ev[n - 1]
        if (e.type === 'TRY' && e.teamId === id) tries++
        if (!tries) continue
        checked++
        const v = visitsTo22(ev.slice(0, n), ci.home.teamId, home)
        if (!v.visits || !v.pts || v.pts / v.visits <= 0) { bad++; first ||= `seed ${i}, line ${n}, ${tries} tries, ${v.visits} visits, ${v.pts} pts` }
      }
      // and nothing is counted twice: the points from the 22 are never more
      // than the side scored
      const full = visitsTo22(ev, ci.home.teamId, home)
      if (full.pts > (home ? ci.home.score : ci.away.score)) over++
    }
  }
  ok(checked > 500 && bad === 0, `points per 22 visit is never 0 beside a try (${checked} ticker positions, ${bad} that were${first ? `: ${first}` : ''})`)
  ok(over === 0, `and the points from the 22 never exceed the score (${over} sides that did)`)
}

console.log(fails ? `\nSTATS PROBE FAILED (${fails})` : '\nSTATS PROBE PASSED: the sheet answers to the match it came from')
if (fails) process.exit(1)
