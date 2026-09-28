/**
 * ---- GROWTH READS THE GAP; THE LAST POINTS ARE THE HARDEST (1.8.0, E5 + E6) ----
 *
 * E5, from the fm-arena thread: the gap between a man's rating and his
 * potential is his growth rate. Before this a 50/95 kid and a 50/60 kid took
 * the same annual roll and the same weekly bump (rollover.ts agePlayers,
 * season.ts weeklyTraining, academy.ts); only the pa clamp told them apart,
 * and not until the small one hit it. ageing.ts gapGrowth now scales all three.
 *
 * E6: 17 to 18 should cost more than 8 to 9. ageing.ts attrOdds is the chance a
 * point of work lands; trainPoint, the mentor's and academy coach's bumps and
 * the development focus all roll it, and the summer's attribute shift damps a
 * rise on a high attribute and spreads what did not land over his low ones, so
 * the rating his attributes describe does not move.
 *
 * Held here:
 *   TWINS. The same young men, the same summer dice, two ceilings: 40 points
 *   of room against 8. Before E5 the two gained the same (3.09 v 3.09 on this
 *   seed); now the big gap must grow at least half as fast again.
 *   THE CURVE. 17 to 18 lands well under 8 to 9, in training and in summer.
 *   THE RATING HOLDS. A summer's shift still moves a man's attribute level by
 *   his rating change plus the quarter pull, damping or not.
 *   THE WORLD MEAN. Three seasons of one world against the numbers the old
 *   curve produced on the same seed (m/777: mean rating 59.32, under-23s
 *   57.18, measured before this change): within half a point.
 *
 * Run: npx vite-node scripts/gapprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { agePlayers } from '../src/game/rollover'
import { ageAttributes, attrLevel, attrOdds, attrRoll, gapGrowth, slope, trainPoint } from '../src/game/ageing'
import { mulberry32 } from '../src/game/rng'
import { SEASON_WEEKS, type GameState, type Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

console.log('--- E5: the gap sets the pace')
{
  ok(gapGrowth(50, 51) < gapGrowth(50, 60) && gapGrowth(50, 60) < gapGrowth(50, 80) && gapGrowth(50, 80) <= gapGrowth(50, 95),
    `rises with the gap: 1pt ${gapGrowth(50, 51).toFixed(2)}, 10pt ${gapGrowth(50, 60).toFixed(2)}, 30pt ${gapGrowth(50, 80).toFixed(2)}, 45pt ${gapGrowth(50, 95).toFixed(2)}`)
  // twins: the same men, the same dice, two ceilings
  const g = newGame('northampton', 'Gap', 9)
  const subjects = Object.values(g.players)
    .filter(p => p.clubId && p.clubId !== g.userClubId && p.age >= 18 && p.age <= 20 && p.ca >= 45 && p.ca <= 58)
    .map(p => p.id)
  const snap = JSON.stringify(g)
  const gain = (room: number) => {
    const c: GameState = JSON.parse(snap)
    for (const id of subjects) { const p = c.players[id]; p.pa = Math.min(99, p.ca + room) }
    const before = subjects.map(id => c.players[id].ca)
    agePlayers(c, mulberry32(4242))
    return mean(subjects.map((id, i) => (c.players[id]?.ca ?? before[i]) - before[i]))
  }
  const big = gain(40), mid = gain(15), small = gain(8)
  console.log(`  ${subjects.length} men aged 18-20, one summer: +${big.toFixed(2)} with 40 points of room, +${mid.toFixed(2)} with 15, +${small.toFixed(2)} with 8`)
  ok(big >= small * 1.5, `the 50/90 kid outgrows his 50/58 twin (${big.toFixed(2)} v ${small.toFixed(2)}, before E5 3.09 v 3.09)`)
  ok(mid > small && big > mid, 'and the middle sits in the middle')
}

console.log('--- E6: the last points are the hardest')
{
  ok(attrOdds(8) === 1 && attrOdds(13) === 1, 'every point up to 13 lands')
  const cost = (v: number) => 1 / attrOdds(v)
  ok(cost(17) >= 1.5 * cost(8), `17 to 18 costs ${cost(17).toFixed(2)}x the work of 8 to 9`)
  ok(cost(19) > cost(17), `19 to 20 costs more again (${cost(19).toFixed(2)}x)`)
  // in training: one man, one attribute, many weeks, put back each time
  const g = newGame('northampton', 'Gap', 9)
  const p = Object.values(g.players).find(q => q.clubId === g.userClubId && q.pos === 'FH' && !q.acad)!
  p.pa = 99
  const landed = (v: number) => {
    let n = 0
    for (let w = 0; w < 4000; w++) {
      const a = { ...p.a }; const debt = p.tdebt
      p.a.pas = v
      if (trainPoint(p, 'pas', ['pas', 'han', 'vis'], attrRoll(g.seed, p.id, w, 'pas'))) n++
      p.a = a; p.tdebt = debt
    }
    return n / 4000
  }
  const at8 = landed(8), at17 = landed(17)
  console.log(`  a week's work on passing lands ${(at8 * 100).toFixed(0)}% of the time at 8, ${(at17 * 100).toFixed(0)}% at 17 (both 100% before)`)
  ok(at8 > 0.99 && at17 < 0.7 && at17 > 0.5, 'training: a 17 is harder to raise than an 8')

  // the summer: +3 rating on men with high attributes, and the level holds
  const hi = Object.values(g.players).filter(q => q.clubId && !q.acad && q.age >= 22 && q.age <= 26 &&
    Object.values(q.a).some(v => v >= 16) && Object.values(q.a).some(v => v <= 11)).slice(0, 300)
  const KEYS = ['tac', 'str', 'scr', 'lin', 'ruc', 'han', 'pas', 'kic', 'pac', 'sta', 'agi', 'vis', 'dec', 'pos', 'agg', 'wor'] as const
  let hiRise = 0, hiN = 0, loRise = 0, loN = 0
  const drift: number[] = []
  for (const q0 of hi) {
    const q: Player = JSON.parse(JSON.stringify(q0))
    const lvl0 = attrLevel(q)
    const gap = q.ca - lvl0
    const caBefore = q.ca
    q.ca += 3
    const a0 = { ...q.a }
    ageAttributes(g, q, caBefore)
    drift.push(attrLevel(q) - lvl0 - (3 + gap * 0.25))
    for (const k of KEYS) {
      const per = (q.a[k] - a0[k]) / slope(q.pos, k)
      if (a0[k] >= 16) { hiRise += per; hiN++ } else if (a0[k] <= 11) { loRise += per; loN++ }
    }
  }
  const hiR = hiRise / hiN, loR = loRise / loN
  console.log(`  ${hi.length} men, a +3 summer: attributes of 16+ rise ${hiR.toFixed(2)}, those of 11 or less ${loR.toFixed(2)} (per rating point of weight; before E6 3.28 and 2.95)`)
  ok(hiR < loR, 'summer: the high ones rise less than the low ones')
  const md = mean(drift)
  ok(Math.abs(md) < 0.35, `the rating his attributes describe still moves by the rating change plus the pull (mean miss ${md.toFixed(2)})`)
}

console.log('--- the world mean: three seasons against the old curve')
{
  const g = newGame('leicester', 'Drift', 777)
  for (let s = 0; s < 3; s++) {
    const t = g.season + 1; let guard = 0
    while (g.season < t && guard++ < SEASON_WEEKS + 5) {
      const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
      for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
      processWeekAndAdvance(g)
    }
  }
  const ps = Object.values(g.players).filter(p => p.clubId)
  const all = mean(ps.map(p => p.ca)), u23 = mean(ps.filter(p => p.age <= 23).map(p => p.ca))
  const hi18 = ps.reduce((s, p) => s + Object.values(p.a).filter(v => v >= 18).length, 0)
  console.log(`  S3: mean rating ${all.toFixed(2)} (old curve 59.32), under-23s ${u23.toFixed(2)} (57.18), attributes of 18+ ${hi18} (265)`)
  ok(Math.abs(all - 59.32) <= 0.5, 'the world mean holds')
  ok(Math.abs(u23 - 57.18) <= 0.5, 'the under-23 mean holds')
  ok(hi18 < 265 && hi18 > 100, 'an 18 is rarer, and still exists')
}

console.log(fails ? `\n${fails} FAILURES` : '\nGAP PROBE PASSED: the gap is the pace, the top is hard, the world holds')
process.exit(fails ? 1 : 0)
