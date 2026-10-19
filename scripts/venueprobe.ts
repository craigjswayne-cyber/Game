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
  type Row = { raw: number; homeWin: number; draw: number; comp: string; gap: number }
  const rows: Row[] = []
  // Nine worlds, not three: the quartile gap is a one-to-two point effect
  // measured against about +/-1.7 points of sampling noise per quartile at
  // three worlds, so any data change that reshuffles club strengths could
  // flip the comparison by luck alone (the August 2026 squad verification
  // did exactly that). Tripling the sample halves the noise; the assertion
  // itself is unchanged.
  // And 36, not nine (28 Sep 2026): the two-layer engine's contest moved the
  // stream again and the nine-world gap read +0.8, -0.5 and +2.8 points on
  // three near-identical engines. Four times the worlds halves the noise
  // again; it still runs in about a minute.
  const SEEDS9 = [12345, 777, 4242, 31337, 2468, 97531, 8080, 555, 424242]
  for (const seed of [...SEEDS9, ...SEEDS9.map(s => s * 3 + 1), ...SEEDS9.map(s => s * 7 + 2), ...SEEDS9.map(s => s * 11 + 3)]) {
    const g = newGame('northampton', 'Venue Probe', seed)
    const league = g.fixtures.filter(f =>
      g.comps[f.compId]?.type === 'league' && g.clubs[f.homeId] && g.clubs[f.awayId] &&
      venueOf(g.clubs[f.homeId].city, g.clubs[f.homeId].country) &&
      venueOf(g.clubs[f.awayId].city, g.clubs[f.awayId].country))
    league.forEach((fx, i) => {
      const e = venueEffect(g, fx.homeId, fx.awayId, fx.week)
      simMatch(g, fx, mulberry32(seed * 7919 + i), false)
      const hs = fx.homeScore ?? 0, as = fx.awayScore ?? 0
      rows.push({ raw: e.raw, homeWin: hs > as ? 1 : 0, draw: hs === as ? 1 : 0, comp: fx.compId, gap: g.clubs[fx.homeId].rep - g.clubs[fx.awayId].rep })
    })
  }
  // QUARTERS WITHIN EACH LEAGUE, then pooled. Ranked across the whole world,
  // the hardest quarter was whichever leagues travel furthest, so it measured
  // leagues as much as trips: the Major Rugby Competition (1.7.3) puts all 270
  // of its fixtures at US distances, into the top quarter, with its small
  // crowds' smaller home lean - and took the hardest quarter from 55.1% to
  // 53.9% with the engine unchanged. Inside a league the only thing that
  // differs between its easy and hard trips is the trip.
  const byComp = new Map<string, typeof rows>()
  for (const r of rows) byComp.set(r.comp, [...(byComp.get(r.comp) ?? []), r])
  const easyRows: typeof rows = [], hardRows: typeof rows = []
  for (const list of byComp.values()) {
    list.sort((a, b) => a.raw - b.raw)
    const k = Math.floor(list.length / 4)
    easyRows.push(...list.slice(0, k)); hardRows.push(...list.slice(list.length - k))
  }
  rows.sort((a, b) => a.raw - b.raw)
  const band = (slice: typeof rows) => {
    const w = slice.reduce((s, r) => s + r.homeWin, 0) / slice.length
    const d = slice.reduce((s, r) => s + r.draw, 0) / slice.length
    const mr = slice.reduce((s, r) => s + r.raw, 0) / slice.length
    return { n: slice.length, w: w * 100, d: d * 100, mr }
  }
  const easiest = band(easyRows)
  const hardest = band(hardRows)
  const all = band(rows)
  // LIKE FOR LIKE (1.9.2). With the 2026-27 line-ups, National One and the
  // Championship put their longest trips at weak clubs' far-flung grounds
  // (Camborne, Plymouth), so the hardest quarter was also the quarter whose
  // home sides were weakest, and lost more for that reason. The verdict now
  // reads each fixture against fixtures in its own league with a similar gap
  // in club reputation (bins of 5): the residual is the home side's win above
  // what that strength gap would predict, and the trip should push it up.
  const expect = new Map<string, { w: number; n: number }>()
  const key = (r: Row) => `${r.comp}|${Math.round(r.gap / 5)}`
  for (const r of rows) { const b = expect.get(key(r)) ?? { w: 0, n: 0 }; b.w += r.homeWin; b.n++; expect.set(key(r), b) }
  const resid = (slice: Row[]) => slice.reduce((a, r) => { const b = expect.get(key(r))!; return a + r.homeWin - b.w / b.n }, 0) / slice.length * 100
  const easyRes = resid(easyRows), hardRes = resid(hardRows)
  console.log(`\n${rows.length} league fixtures simmed over 36 worlds:`)
  console.log(`  easiest quarter of each league (mean raw ${easiest.mr.toFixed(3)}): home win ${easiest.w.toFixed(1)}%`)
  console.log(`  hardest quarter of each league (mean raw ${hardest.mr.toFixed(3)}): home win ${hardest.w.toFixed(1)}%`)
  console.log(`  all fixtures: home win ${all.w.toFixed(1)}%, draws ${all.d.toFixed(1)}%`)
  // REPORTED, NOT GATED (1.9.2). This was the gate: the hardest quarter's home
  // win rate above the easiest's. Measured over 48,000 fixtures it cannot be
  // one. Inside a league the trip moves the home edge by about half a per cent
  // (SPREAD 0.05 on a raw spread near 0.1), a tenth of a point of win rate,
  // while the sampling noise on the comparison is a point or more, and club
  // strength is folded into it besides (a far-flung ground is often a weak
  // club's: Camborne, Plymouth). It passed before the 2026-27 line-ups by
  // 0.4 points of luck and failed after them by luck the other way; allowing
  // for strength it failed on both. The wiring is now held exactly, below.
  console.log(`  against the strength gap (information only): hardest quarter ${hardRes >= 0 ? '+' : ''}${hardRes.toFixed(1)} points, easiest ${easyRes >= 0 ? '+' : ''}${easyRes.toFixed(1)}`)
  // A one-season slice of a single sim path is noisier than the ten-season
  // simtest, so this is a wide sanity gate rather than the calibrated band.
  // scripts/simtest.ts is what holds 55 to 56 per cent.
  if (all.w < 50 || all.w > 61) {
    bad(`the overall home-win rate came out at ${all.w.toFixed(1)}%, which is nowhere near the calibrated band`)
  }
}

// THE ENGINE READS THE EDGE, EXACTLY (1.9.2). Every league fixture of one
// world is opened (not played) and the home advantage it starts with read
// off the match. Away from an artificial pitch (its own small edge) and the
// manager's own club (the fans' mood), nothing else moves it, so it must be
// the base advantage times the trip's edge, to the last decimal. No dice are
// involved: this cannot pass or fail by luck, and it fails the moment the
// edge stops reaching the match.
{
  const { beginMatch } = await import('../src/game/matchEngine')
  const { mulberry32 } = await import('../src/game/rng')
  const g = newGame('northampton', 'Venue Probe', 2026)
  let checked = 0, wrong = 0, worst = ''
  const spread = new Set<string>()
  for (const fx of g.fixtures) {
    if (g.comps[fx.compId]?.type !== 'league' || fx.venue || fx.homeId === g.userClubId) continue
    const h = g.clubs[fx.homeId], a = g.clubs[fx.awayId]
    if (!h || !a) continue
    const e = venueEffect(g, fx.homeId, fx.awayId, fx.week)
    const ctx = beginMatch(g, fx, mulberry32(fx.id), false, null)
    if (ctx.surface === 'artificial') continue
    checked++
    if (Math.abs(ctx.hfa - 1.06 * e.edge) > 1e-9) { wrong++; worst ||= `${fx.homeId} v ${fx.awayId}: ${ctx.hfa} against ${1.06 * e.edge}` }
    if (Math.abs(e.edge - 1) > 1e-6) spread.add(fx.compId)
  }
  console.log(`\n${checked} league fixtures opened: the home advantage is the trip's edge on every one (${wrong} off)`)
  if (wrong) bad(`the match does not start on the trip's edge (${wrong} of ${checked}, e.g. ${worst})`)
  if (spread.size < 5) bad(`the edge varies in only ${spread.size} leagues`)
}

if (fails) { console.error(`VENUE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nVENUE PROBE PASSED')
