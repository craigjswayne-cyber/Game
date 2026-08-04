// 20-season long-save health audit: ledger growth, save size, world integrity
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS } from '../src/game/model'

const g = newGame('leicester', 'Soak Gaffer', 20260804)

function report(label: string) {
  const size = JSON.stringify(g).length
  const players = Object.values(g.players)
  const careerRows = players.reduce((s, p) => s + p.career.length, 0)
  console.log([
    label,
    `save ${(size / 1e6).toFixed(2)}MB`,
    `players ${players.length}`,
    `news ${g.news.length}`,
    `press ${g.press.length}`,
    `offers ${g.offers.length}`,
    `chem ${Object.keys(g.chem ?? {}).length}`,
    `grudges ${(g.grudges ?? []).length}`,
    `pledges ${(g.pledges ?? []).length}`,
    `preC ${(g.preContracts ?? []).length}`,
    `agencyBest ${Object.keys(g.agency?.best ?? {}).length}`,
    `hof ${(g.hof ?? []).length}`,
    `careerRows ${careerRows}`,
    `fixtures ${g.fixtures.length}`,
  ].join(' | '))
}

report('start')
// economy watch: fee inflation + balance drift over the decades
const feeBuckets: number[][] = [[], [], [], []]
const parseFee = (body: string): number | null => {
  const m = body.match(/for a fee of £([\d.]+)(m|k)/)
  return m ? parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : 1e3) : null
}
function econReport(label: string) {
  const ai = Object.values(g.clubs).filter(c => c.id !== g.userClubId)
  const bals = ai.map(c => c.balance).sort((a, b) => a - b)
  const med = bals[Math.floor(bals.length / 2)]
  const budget = ai.reduce((s, c) => s + c.budget, 0) / ai.length
  const mine = g.clubs[g.userClubId]
  console.log(`${label} econ | user bal ${(mine.balance / 1e6).toFixed(1)}M | AI bal min ${(bals[0] / 1e6).toFixed(1)}M med ${(med / 1e6).toFixed(1)}M max ${(bals[bals.length - 1] / 1e6).toFixed(1)}M | AI budget avg ${(budget / 1e6).toFixed(1)}M`)
}
let farewells = 0, milestoneNews = 0
const wcSeedTops: string[] = []
const milestoneSubjects = new Map<string, number>()
const seen = new Set<number>()
for (let season = 0; season < 20; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, Math.floor(Math.random() * 0) )
    for (const n of g.news) {
      if (seen.has(n.id)) continue
      seen.add(n.id)
      if (n.subject.includes('The last dance')) farewells++
      {
        const fee = parseFee(n.body)
        if (fee != null) feeBuckets[Math.min(3, Math.floor(season / 5))].push(fee)
      }
      if (n.subject.includes('Career win number') || n.subject.includes('in the dugout')) {
        milestoneNews++
        milestoneSubjects.set(n.subject, (milestoneSubjects.get(n.subject) ?? 0) + 1)
      }
    }
    processWeekAndAdvance(g)
  }
  const wc = g.comps['wc']
  if (wc?.seeds?.length) wcSeedTops.push(wc.seeds[0])
  if ((season + 1) % 5 === 0) { report(`s${season + 1}`); econReport(`s${season + 1}`) }
}
// fee inflation: median deal per 5-season era should stay the same order
{
  const med = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0
  console.log(`transfer fees by era: ${feeBuckets.map((b, i) => `s${i * 5 + 1}-${i * 5 + 5}: n${b.length} med ${(med(b) / 1e6).toFixed(2)}M`).join(' | ')}`)
  const first = med(feeBuckets[0]), last = med(feeBuckets[3])
  if (first > 0 && last > first * 3) console.log('WARN: fee inflation over 3x across the save')
}
// natrank long-horizon: watch for Elo compression or bound-pinning
{
  const vals = Object.values(g.natRank ?? {})
  const min = Math.min(...vals), max = Math.max(...vals)
  const pinned = vals.filter(v => v <= 40.5 || v >= 99.5).length
  console.log(`natrank after 20 seasons: min ${min.toFixed(1)} max ${max.toFixed(1)} spread ${(max - min).toFixed(1)} pinned-at-bounds ${pinned}`)
}
console.log(`farewell arcs: ${farewells} · manager milestone news: ${milestoneNews} (dupes: ${[...milestoneSubjects.values()].filter(v => v > 1).length})`)
console.log(`WC top seeds by cycle: ${wcSeedTops.join(', ') || 'none observed'}`)
// D-round ledgers: bounded and coherent after 20 seasons
{
  const vb = Object.keys(g.vsBook ?? {}).length
  const db = Object.keys(g.derbyBook ?? {}).length
  const poty = Object.values(g.players).filter(p => (p.poty ?? 0) > 0).length
  const legends = (g.legendOf ?? []).length
  const runs = Object.values(g.vsBook ?? {}).map(r => r.run ?? 0)
  const runMax = runs.length ? Math.max(...runs) : 0
  const runMin = runs.length ? Math.min(...runs) : 0
  console.log(`d-ledgers: vsBook ${vb} opponents · derbyBook ${db} · gateRecord ${g.gateRecord ? g.gateRecord.att : 'none'} · natConf ${g.natConfidence ?? 'n/a'} · tenureStart s${g.tenureStart} · legends ${legends} · living POTY holders ${poty}`)
  console.log(`ds-round: streak extremes ${runMin}..${runMax} · potyRoll ${(g.potyRoll ?? []).length} seasons`)
  if ((g.potyRoll ?? []).some(w => !w.name || w.season > g.season)) console.log('WARN: bad potyRoll entry')
  const badRuns = Object.entries(g.vsBook ?? {}).filter(([, r]) => (r.run ?? 0) > r.w || -(r.run ?? 0) > r.l)
  if (badRuns.length) console.log(`WARN: ${badRuns.length} streak/total mismatches in vsBook`)
  if (vb > 200) console.log('WARN: vsBook unbounded?')
  if (g.gateRecord && !g.clubs[g.gateRecord.oppId]) console.log('WARN: gate record dangling club')
}
// integrity sweep at the end
let orphans = 0, badRefs = 0
for (const c of Object.values(g.clubs)) {
  for (const id of c.players) if (!g.players[id]) orphans++
}
for (const p of Object.values(g.players)) {
  if (p.clubId && !g.clubs[p.clubId]) badRefs++
}
console.log(`integrity: roster orphans ${orphans}, bad club refs ${badRefs}`)
