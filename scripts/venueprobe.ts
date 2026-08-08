// Probe: F27, the road, the thin air and the heat.
//
// venue.ts turns one flat home advantage into one that varies by WHERE, and the
// whole thing stands or falls on RAW_MEAN. That constant is the world's average
// hardship, and the edge is built as `1 + (raw - RAW_MEAN) * SPREAD`. Get it
// right and the swings cancel across a season, leaving the calibrated home-win
// band untouched. Get it wrong by a tenth and every fixture in the world is
// quietly biased in the same direction, which is exactly the failure this file
// exists to prevent.
//
// So this measures it over real fixture lists rather than trusting the number in
// the file, and it measures it the way the engine consumes it: one reading per
// fixture actually played, across every competition, over several worlds.
import { newGame } from '../src/game/newgame'
import { RAW_MEAN, venueEffect } from '../src/game/venue'
import { venueOf } from '../src/game/geo'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

const SEEDS = [12345, 777, 4242, 99, 31337]
const raws: number[] = []
const edges: number[] = []
let skipped = 0
const byComp: Record<string, { n: number; sum: number }> = {}

for (const seed of SEEDS) {
  const g = newGame('northampton', 'Venue Probe', seed)
  for (const fx of g.fixtures) {
    const h = g.clubs[fx.homeId], a = g.clubs[fx.awayId]
    // Tests and anything unplaceable come back neutral by design, and counting a
    // neutral reading would drag the measurement towards whatever RAW_MEAN
    // already is. Only real, placeable club fixtures inform the constant.
    if (!h || !a || !venueOf(h.city, h.country) || !venueOf(a.city, a.country)) { skipped++; continue }
    const e = venueEffect(g, fx.homeId, fx.awayId, fx.week)
    raws.push(e.raw)
    edges.push(e.edge)
    const k = fx.compId ?? 'other'
    byComp[k] ??= { n: 0, sum: 0 }
    byComp[k].n++
    byComp[k].sum += e.raw
  }
}

if (raws.length < 5000) bad(`only ${raws.length} placeable fixtures measured, which is too thin to set a constant on`)

const mean = raws.reduce((s, v) => s + v, 0) / raws.length
const sorted = [...raws].sort((x, y) => x - y)
const pc = (p: number) => sorted[Math.floor((sorted.length - 1) * p)]
console.log(`${raws.length} placeable club fixtures over ${SEEDS.length} worlds (${skipped} neutral or unplaceable)`)
console.log(`raw hardship: mean ${mean.toFixed(4)}  min ${sorted[0].toFixed(4)}  p50 ${pc(0.5).toFixed(4)}  p95 ${pc(0.95).toFixed(4)}  max ${sorted[sorted.length - 1].toFixed(4)}`)
console.log(`RAW_MEAN in venue.ts: ${RAW_MEAN}`)

// The constant has to match what the world actually produces. A tenth of a point
// of raw hardship is 0.5% of home advantage at the current spread, so the
// tolerance here is tight on purpose.
if (Math.abs(mean - RAW_MEAN) > 0.004) {
  bad(`RAW_MEAN is ${RAW_MEAN} but the world averages ${mean.toFixed(4)}. Every fixture is biased the same way until this is corrected.`)
}

// And the consequence, stated directly: the mean EDGE must be 1.
const meanEdge = edges.reduce((s, v) => s + v, 0) / edges.length
const sortedE = [...edges].sort((x, y) => x - y)
console.log(`edge: mean ${meanEdge.toFixed(5)}  min ${sortedE[0].toFixed(4)}  max ${sortedE[sortedE.length - 1].toFixed(4)}`)
if (Math.abs(meanEdge - 1) > 0.0002) {
  bad(`the mean home-advantage multiplier is ${meanEdge.toFixed(5)}, not 1. Travel is being ADDED rather than redistributed.`)
}

// It must actually vary, or the feature does nothing.
if (sortedE[sortedE.length - 1] - sortedE[0] < 0.01) {
  bad('the edge barely moves between the easiest and hardest trip in the world')
}

console.log('\nby competition (mean raw hardship):')
for (const [k, v] of Object.entries(byComp).sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n)) {
  console.log(`  ${k.padEnd(10)} ${String(v.n).padStart(5)} fixtures  ${(v.sum / v.n).toFixed(4)}`)
}

// A sanity check on direction, because a sign error here would be invisible in
// the mean: the hardest trips in the world should be the ones a rugby supporter
// would name, and a local derby should be the easiest.
{
  const g = newGame('northampton', 'Venue Probe', 12345)
  const named: [string, string, string][] = [
    ['bulls', 'glasgow', 'Glasgow to Pretoria: altitude and 9,000km'],
    ['lions', 'connacht', 'Connacht to Johannesburg: the highveld'],
    ['northampton', 'leicester', 'Leicester to Northampton: the East Midlands derby'],
    ['saracens', 'harlequins', 'Quins to Saracens: across London'],
  ]
  console.log('\nnamed trips:')
  const seen: Record<string, number> = {}
  for (const [home, away, label] of named) {
    if (!g.clubs[home] || !g.clubs[away]) { console.log(`  (skipped ${home} v ${away}, not in this world)`); continue }
    const e = venueEffect(g, home, away, 10)
    seen[`${home}|${away}`] = e.edge
    console.log(`  ${label}: ${e.km.toLocaleString()}km, altGap ${Math.round(e.altGap)}m, edge ${e.edge.toFixed(4)}`)
    if (e.note) console.log(`      "${e.note}"`)
  }
  const highveld = seen['bulls|glasgow'] ?? seen['lions|connacht']
  const derby = seen['northampton|leicester'] ?? seen['saracens|harlequins']
  if (highveld != null && derby != null && highveld <= derby) {
    bad('a highveld trip is not harder than a local derby, so the sign is wrong somewhere')
  }
  if (derby != null && derby >= 1) {
    bad('a local derby should be LESS than the old flat advantage, or the average cannot hold')
  }
}

// Determinism: the same trip in the same week must read the same every time. The
// briefing is worthless if the warning changes when you revisit the screen.
{
  const g = newGame('northampton', 'Venue Probe', 555)
  const fx = g.fixtures.find(f => g.clubs[f.homeId] && g.clubs[f.awayId])!
  const a = venueEffect(g, fx.homeId, fx.awayId, fx.week)
  const b = venueEffect(g, fx.homeId, fx.awayId, fx.week)
  if (JSON.stringify(a) !== JSON.stringify(b)) bad('venueEffect is not deterministic')
}

// And it must survive a world it cannot place, rather than throwing or poisoning
// a dial with NaN.
{
  const g = newGame('northampton', 'Venue Probe', 606)
  const e1 = venueEffect(g, 'ENG', 'FRA', 10)                 // a Test: nations are not clubs
  const e2 = venueEffect(g, 'no-such-club', 'leicester', 10)
  for (const [label, e] of [['a Test match', e1], ['a missing club', e2]] as const) {
    if (e.edge !== 1) bad(`${label} did not come back neutral (edge ${e.edge})`)
    if (e.note !== null) bad(`${label} produced a briefing note out of nothing`)
  }
  const broken = newGame('northampton', 'Venue Probe', 607)
  broken.clubs.leicester.city = undefined as unknown as string
  const e3 = venueEffect(broken, 'leicester', 'bath', 10)
  if (!Number.isFinite(e3.edge)) bad('a club with no city produced a non-finite edge')
}

// ---- and does it actually show up in results? -----------------------------
//
// Everything above is geometry: it proves the multiplier is built correctly and
// averages 1. It does not prove the engine does anything with it. So this sims
// real fixtures and splits the home-win rate by how hard the trip was. If the
// wiring works, the hardest quarter of trips is won by the home side more often
// than the easiest quarter - and the two still average out to the calibrated
// band, which is the whole point of redistributing rather than adding.
{
  const { simMatch } = await import('../src/game/matchEngine')
  const { mulberry32 } = await import('../src/game/rng')
  type Row = { raw: number; homeWin: number; draw: number }
  const rows: Row[] = []
  for (const seed of [12345, 777, 4242]) {
    const g = newGame('northampton', 'Venue Probe', seed)
    const league = g.fixtures.filter(f =>
      g.comps[f.compId]?.type === 'league' && g.clubs[f.homeId] && g.clubs[f.awayId] &&
      venueOf(g.clubs[f.homeId].city, g.clubs[f.homeId].country) &&
      venueOf(g.clubs[f.awayId].city, g.clubs[f.awayId].country))
    league.forEach((fx, i) => {
      const e = venueEffect(g, fx.homeId, fx.awayId, fx.week)
      simMatch(g, fx, mulberry32(seed * 7919 + i), false)
      const hs = fx.homeScore ?? 0, as = fx.awayScore ?? 0
      rows.push({ raw: e.raw, homeWin: hs > as ? 1 : 0, draw: hs === as ? 1 : 0 })
    })
  }
  rows.sort((a, b) => a.raw - b.raw)
  const q = Math.floor(rows.length / 4)
  const band = (from: number, to: number) => {
    const slice = rows.slice(from, to)
    const w = slice.reduce((s, r) => s + r.homeWin, 0) / slice.length
    const d = slice.reduce((s, r) => s + r.draw, 0) / slice.length
    const mr = slice.reduce((s, r) => s + r.raw, 0) / slice.length
    return { n: slice.length, w: w * 100, d: d * 100, mr }
  }
  const easiest = band(0, q)
  const hardest = band(rows.length - q, rows.length)
  const all = band(0, rows.length)
  console.log(`\n${rows.length} league fixtures simmed over 3 worlds:`)
  console.log(`  easiest quarter (mean raw ${easiest.mr.toFixed(3)}): home win ${easiest.w.toFixed(1)}%`)
  console.log(`  hardest quarter (mean raw ${hardest.mr.toFixed(3)}): home win ${hardest.w.toFixed(1)}%`)
  console.log(`  all fixtures: home win ${all.w.toFixed(1)}%, draws ${all.d.toFixed(1)}%`)
  if (hardest.w <= easiest.w) {
    bad(`the hardest trips are not harder to win: ${hardest.w.toFixed(1)}% against ${easiest.w.toFixed(1)}% on the easiest. The edge is built but nothing reads it.`)
  }
  // A one-season slice of a single sim path is noisier than the ten-season
  // simtest, so this is a wide sanity gate rather than the calibrated band.
  // scripts/simtest.ts is what holds 55 to 56 per cent.
  if (all.w < 50 || all.w > 61) {
    bad(`the overall home-win rate came out at ${all.w.toFixed(1)}%, which is nowhere near the calibrated band`)
  }
}

if (fails) { console.error(`VENUE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nVENUE PROBE PASSED')
