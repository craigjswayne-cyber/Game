/**
 * ---- THE LOWER LEAGUES HAVE TO BE ABLE TO PAY THEIR WAY ----
 *
 * The 1.8.3 economy audit ran four worlds for fifteen seasons and found the
 * bottom of the pyramid structurally insolvent. National One, Championship and
 * MRC wage bills grew two and a half to three times over fourteen seasons while
 * their income grew about half as much again, because every wage in the world
 * was priced on ability and age alone: a National One side that developed its
 * men paid them what a Premiership side pays the same ability, out of a tenth
 * of the income. By season nine nine clubs in ten down there were in the red,
 * there were 133 administrations across the four worlds, and 29 clubs went in
 * twice. The top flight, meanwhile, banked a median of fifteen million.
 *
 * What is asserted is the shape of the pyramid at season fourteen:
 *
 *   - at most 25% of National One, Championship and MRC clubs in the red on
 *     the year's books (after the rollover's prize money), over the last
 *     three seasons; and at the ledger close, the year's low point, at most
 *     15% of them more than eight weeks of wages in the red
 *   - at most 1.5 administrations per world per season over seasons 5 to 14
 *   - no club in administration twice inside five seasons
 *   - a top-flight median balance under eight million
 *   - and the fix is not bought by gutting the lower leagues: their mean
 *     matchday-squad rating (best 23 seniors) at season 14 holds within three
 *     points of where the old economy left it (printed for seasons 1, 7, 14;
 *     the reference is the default four worlds', so other SEEDS skip it)
 *
 * Four worlds of fifteen seasons is about six minutes a world, so the worlds
 * run as four child processes side by side and this lives on the suite's SLOW
 * list. SEEDS=4242,11 picks the worlds; S=15 the seasons; ROWS=file writes the
 * raw rows for a before-and-after comparison.
 *
 * Run: npx vite-node scripts/distressprobe.ts
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { leagueTier, LEDGER_WEEKS, type Club, type GameState } from '../src/game/model'

const SEASONS = Number(process.env.S ?? 15)
const SEEDS = (process.env.SEEDS ?? '4242,11,99,2025').split(',').map(Number)

interface Row {
  seed: number; s: number; id: string; lg: string; tier: number
  bal?: number; w?: number; sq?: number; admin?: 1
  /** the balance once the rollover has paid the season's prize money */
  end?: number
}

// every club the AI runs: the manager's only while he is out of work, as in aiecon.ts
const ai = (g: GameState) => Object.values(g.clubs).filter(c => c.id !== g.userClubId || g.unemployed)
const wagesOf = (g: GameState, c: Club) => c.players.reduce((s, id) => s + (g.players[id]?.wage ?? 0), 0)
/** the best 23 seniors' mean rating: what the club can put on a pitch */
const squadOf = (g: GameState, c: Club) => {
  const cas = c.players.map(id => g.players[id]).filter(p => p && !p.acad).map(p => p.ca).sort((a, b) => b - a).slice(0, 23)
  return cas.length ? cas.reduce((a, b) => a + b, 0) / cas.length : 0
}

function world(seed: number): Row[] {
  const g = newGame('northampton', 'Distress', seed)
  const rows: Row[] = []
  for (let s = 0; s < SEASONS; s++) {
    let snap = false
    const mine = new Map<string, Row>()
    while (g.season === s) {
      // the books close at the end of the ledger: the balance a board reads
      if (!snap && g.week === LEDGER_WEEKS + 1) {
        snap = true
        for (const c of ai(g)) {
          const r: Row = { seed, s, id: c.id, lg: c.leagueId, tier: leagueTier(c.leagueId), bal: c.balance, w: wagesOf(g, c), sq: squadOf(g, c) }
          rows.push(r)
          mine.set(c.id, r)
        }
      }
      processWeekAndAdvance(g)
    }
    // and the year's books once the rollover has paid the prize money every
    // board budgets for as this season's income (aiecon.ts aiWageRooms)
    for (const c of ai(g)) { const r = mine.get(c.id); if (r) r.end = c.balance }
    // the reckoning runs at the rollover and stamps the season about to start
    for (const c of ai(g)) {
      if (c.admin && c.admin.season === s + 1) rows.push({ seed, s, id: c.id, lg: c.leagueId, tier: leagueTier(c.leagueId), admin: 1 })
    }
  }
  return rows
}

if (process.env.DISTRESS_WORLD) {
  // a worker: one world, its rows to the file it was handed (not stdout: a
  // pipe still draining when the process exits loses the end of the line)
  writeFileSync(process.env.DISTRESS_OUT!, JSON.stringify(world(Number(process.env.DISTRESS_WORLD))))
  process.exit(0)
}

const scratch = mkdtempSync(join(tmpdir(), 'distress-'))
const runWorld = (seed: number) => new Promise<Row[]>((resolve, reject) => {
  const out = join(scratch, `${seed}.json`)
  const child = spawn('npx', ['vite-node', 'scripts/distressprobe.ts'], {
    env: { ...process.env, DISTRESS_WORLD: String(seed), DISTRESS_OUT: out }, stdio: ['ignore', 'ignore', 'inherit'],
  })
  child.on('close', code => {
    if (code !== 0 || !existsSync(out)) reject(new Error(`world ${seed} exited ${code}`))
    else resolve(JSON.parse(readFileSync(out, 'utf8')))
  })
})

const rows = (await Promise.all(SEEDS.map(runWorld))).flat()
rmSync(scratch, { recursive: true, force: true })
if (process.env.ROWS) writeFileSync(process.env.ROWS, JSON.stringify(rows))

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const M = (x: number) => (x / 1e6).toFixed(1)
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
const groups: Record<string, (r: Row) => boolean> = {
  'T1 (prem/top14/urc/srp/jl1)': r => r.tier === 1 && r.lg !== 'mrc',
  'MRC': r => r.lg === 'mrc',
  'T2 champ': r => r.lg === 'champ',
  'T2 prod2': r => r.lg === 'prod2',
  'T3 natl1': r => r.lg === 'natl1',
}
const low = (r: Row) => r.lg === 'natl1' || r.lg === 'champ' || r.lg === 'mrc'
const snap = rows.filter(r => r.bal !== undefined)
const last = SEASONS - 1

console.log(`${SEEDS.length} worlds (${SEEDS.join(', ')}), ${SEASONS} seasons`)
console.log('\nBalance at ledger close by tier: median / p10 / min, % in red, % on the -20 week floor, % under -13 weeks')
for (const s of [0, 2, 4, 6, 9, 11, 14].filter(s => s <= last)) {
  for (const [name, f] of Object.entries(groups)) {
    const xs = snap.filter(r => r.s === s && f(r))
    if (!xs.length) continue
    const b = xs.map(r => r.bal!)
    const pct = (n: number) => `${(100 * n / xs.length).toFixed(0).padStart(3)}%`
    console.log(`s${s} ${name.padEnd(28)} n=${String(xs.length).padStart(3)} med ${M(q(b, 0.5)).padStart(6)} p10 ${M(q(b, 0.1)).padStart(6)} min ${M(Math.min(...b)).padStart(6)}`
      + ` red ${pct(xs.filter(r => r.bal! < 0).length)} floor ${pct(xs.filter(r => r.w! > 0 && r.bal! <= -20 * r.w! + 1).length)} warn ${pct(xs.filter(r => r.w! > 0 && r.bal! < -13 * r.w!).length)}`)
  }
}

console.log('\nMatchday-squad rating (mean of the best 23 seniors) and weekly wage bill, by tier')
for (const s of [1, 7, 14].filter(s => s <= last)) {
  console.log(`s${s} ` + Object.entries(groups).map(([name, f]) => {
    const xs = snap.filter(r => r.s === s && f(r))
    return `${name.split(' ')[0] === 'T1' ? 'T1' : name.split(' ').pop()} ${mean(xs.map(r => r.sq!)).toFixed(1)} (${Math.round(mean(xs.map(r => r.w!)) / 1000)}k)`
  }).join('  '))
}

const adm = rows.filter(r => r.admin)
console.log('\nAdministrations by season (all worlds)')
const bySeason: Record<number, Record<string, number>> = {}
for (const r of adm) { bySeason[r.s] ??= {}; bySeason[r.s][r.lg] = (bySeason[r.s][r.lg] ?? 0) + 1 }
for (const s of Object.keys(bySeason).map(Number).sort((a, b) => a - b)) console.log(`  s${s}: ${JSON.stringify(bySeason[s])}`)
const times: Record<string, number[]> = {}
for (const r of adm) (times[r.seed + ':' + r.id] ??= []).push(r.s)
const counts = Object.values(times).map(t => t.length)
const byLeague: Record<string, number> = {}
for (const r of adm) byLeague[r.lg] = (byLeague[r.lg] ?? 0) + 1
console.log(`  total ${adm.length}, distinct clubs ${counts.length}, twice or more ${counts.filter(x => x >= 2).length}, by league ${JSON.stringify(byLeague)}`)

// ---- the verdict ----
const atEnd = snap.filter(r => r.s === last)
// IN THE RED, READ ON THE YEAR'S BOOKS (1.8.5 release QA). This used to be
// one snapshot at the ledger close of the last season, and it swung from 10%
// to 63% between worlds, and by eight points or more on changes that only
// moved the world's draws (16-45% across this release's variants). Two
// reasons, both measured (scripts/distressprobe.ts ROWS, six worlds; an
// econdiag of world 7): the ledger close is the year's low point, before the
// rollover pays the prize money that every board's wage budget counts as this
// season's income (aiWageRooms), about 0.8M for a lower-league club, six
// weeks of its wages; and the lower leagues come to rest at break-even, so a
// sign test on one snapshot of clubs sitting either side of nought is a coin
// toss per club. The year's books (after the prize money), averaged over the
// last three seasons, measure the same thing without the timing or the toss,
// and the trough itself is held on depth below, where distress actually is.
// Six worlds read 2-14% on the year's books (18-37% at the trough), so the
// line comes down from 35% to 25%: tighter, not looser.
const lastThree = [last - 2, last - 1, last].filter(s => s >= 0)
const lowYears = snap.filter(r => lastThree.includes(r.s) && low(r) && r.end !== undefined)
const redShare = lowYears.filter(r => r.end! < 0).length / Math.max(1, lowYears.length)
const troughShare = atEnd.filter(low).filter(r => r.bal! < 0).length / Math.max(1, atEnd.filter(low).length)
console.log(`  (at the ledger close of season ${last}, before the prize money: ${(100 * troughShare).toFixed(0)}% in the red)`)
ok(redShare <= 0.25, `seasons ${lastThree[0]}-${last}: ${(100 * redShare).toFixed(0)}% of National One, Championship and MRC clubs in the red on the year's books (at most 25%)`)
// the trough: a club a few weeks short before its prize money is paid is
// planned; one more than eight weeks of wages short is in trouble
const deep = Math.max(0, ...lastThree.map(s => {
  const xs = snap.filter(r => r.s === s && low(r))
  return xs.filter(r => r.w! > 0 && r.bal! < -8 * r.w!).length / Math.max(1, xs.length)
}))
ok(deep <= 0.15, `at the ledger close, at most ${(100 * deep).toFixed(0)}% of the lower leagues more than eight weeks of wages in the red in any of seasons ${lastThree[0]}-${last} (at most 15%)`)

const window = adm.filter(r => r.s >= 5 && r.s <= last)
const perWorldSeason = window.length / (SEEDS.length * Math.max(1, last - 4))
const worst = Math.max(0, ...SEEDS.flatMap(seed => Array.from({ length: Math.max(0, last - 4) }, (_, i) =>
  window.filter(r => r.seed === seed && r.s === i + 5).length)))
ok(perWorldSeason <= 1.5, `${perWorldSeason.toFixed(2)} administrations per world per season over seasons 5-${last} (at most 1.5; worst single world-season ${worst})`)

const repeats = Object.entries(times).filter(([, t]) => t.sort((a, b) => a - b).some((s, i) => i > 0 && s - t[i - 1] < 5))
ok(!repeats.length, `no club in administration twice inside five seasons (${repeats.length}: ${repeats.map(([k, t]) => `${k} s${t.join('/s')}`).join(', ') || 'none'})`)

const top = atEnd.filter(groups['T1 (prem/top14/urc/srp/jl1)']).map(r => r.bal!)
ok(q(top, 0.5) < 8e6, `the top-flight median balance at season ${last} is ${M(q(top, 0.5))}M (under 8M)`)

// The pre-fix economy at season 14, on these four worlds (1.8.2, 43e53b3):
// National One 62.0, Championship 66.8, MRC 68.3, ProD2 68.3. A cheaper market
// must not empty them.
const BEFORE: Record<string, number> = { natl1: 62.0, champ: 66.8, mrc: 68.3, prod2: 68.3 }
if (last !== 14 || SEEDS.join() !== '4242,11,99,2025') {
  console.log('  (the squad-quality reference is for the default four worlds over 15 seasons: not compared)')
} else {
  for (const [lg, was] of Object.entries(BEFORE)) {
    const now = mean(atEnd.filter(r => r.lg === lg).map(r => r.sq!))
    ok(now >= was - 3, `${lg} matchday squads hold their quality (${now.toFixed(1)}, was ${was.toFixed(1)})`)
  }
}

console.log(fails ? `\nDISTRESS PROBE FAILED (${fails})` : '\nDISTRESS PROBE PASSED: the lower leagues pay their way, and nobody banks the world')
process.exit(fails ? 1 : 0)
