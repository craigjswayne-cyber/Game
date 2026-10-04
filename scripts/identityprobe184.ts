/**
 * ---- WHAT YOU ARE KNOWN FOR, AND WHAT THE BOARD MAKES OF IT (1.8.4) ----
 *
 * Three things the manager's reputation now does beyond being read out:
 *
 *   the profile says which way it is moving (repute.ts mgrTrends)
 *   a club whose job fits the top trait listens a little harder (jobs.ts jobFit)
 *   the May letter judges the season's method (chairman.ts boardMethod), and
 *   the rollover adds those points after its summer pull, not before it
 *
 * PART 1 is five careers built from conduct rows, honestly synthetic: a full
 * career per path through the engine would take minutes each and could not
 * hold the RESULT still, which is the whole point. Every path has the same
 * record (won 16, lost 8, third of twelve); only the way it was run differs.
 * Each is read by every kind of chairman, and the table is printed.
 *
 * PART 2 changes one thing in a path's conduct and checks the reaction moves
 * with it, so the effect is the behaviour and not the label.
 *
 * PART 3 is the bounds, over a grid of conduct.
 *
 * PART 4 is a real season played through the engine to its last week, then
 * replayed from the same save with three promises broken on the record: the
 * letter says so, and the boardroom keeps the full points through the pull.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import type { GameState } from '../src/game/model'
import { migrate } from '../src/game/save'
import { tIn } from '../src/game/i18n'
import { arcOf, type Conduct } from '../src/game/arcbook'
import { mgrTraits, mgrTrends, trendLines, TREND_GAP } from '../src/game/repute'
import { boardMethod, boardSummer, chairmanOf, chairWish, CHAIR_TYPES, jobProfile, METHOD_CAP, type ChairType } from '../src/game/chairman'
import { jobChance, jobFit, JOB_FIT } from '../src/game/jobs'
import { remember } from '../src/game/memory'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const en = (k: string, v?: Record<string, unknown>) => tIn('en', k, v as never)

const seat = (g: GameState, want: ChairType) => {
  const a = arcOf(g)
  for (let s = 0; s < 64; s++) { a.chairSalt[g.userClubId] = s; if (chairmanOf(g, g.userClubId) === want) return }
  throw new Error('no salt for ' + want)
}

// ---------------------------------------------------------------- paths ---

type Path = {
  name: string
  row: Partial<Conduct>
  /** the season's books: drift is the change in cash, bal where it ended */
  drift: number; bal: number
  turned?: boolean
}
const base = (g: GameState, s: number, o: Partial<Conduct>): Conduct => ({
  s, c: g.userClubId, tier: 1, pos: 3, n: 12, m: 24, w: 16, d: 0, l: 8, pf: 24, pa: 21, lg: 24,
  deb: 0, hg: 10, buy: 0, wages: 5_000_000, hard: 1, kind: 1, broke: 0, mor: 6.2, pats: 1, ...o,
})
const PATHS: Path[] = [
  { name: 'academy-led', row: { deb: 3, hg: 36, kind: 2, mor: 6.6 }, drift: 150_000, bal: 900_000 },
  { name: 'spending-led', row: { buy: 3_500_000, hg: 6 }, drift: -600_000, bal: 2_400_000 },
  { name: 'turnaround', row: { buy: 200_000, hard: 3, kind: 2 }, drift: 1_400_000, bal: 300_000, turned: true },
  { name: 'tactical', row: { pf: 31, pa: 17, pats: 4 }, drift: 50_000, bal: 1_000_000 },
  { name: 'risky', row: { broke: 3, hard: 6, kind: 0, mor: 5.2, buy: 2_800_000 }, drift: -2_100_000, bal: -1_500_000 },
]
const SEASONS = 6
/** The last season of every path, twice over: one where each chairman's wish
 *  is the first of his pair (steady, silver, debuts, crowd) and one where it
 *  is the second (black, topfour, homegrown, profit). A part of the method the
 *  wish has already judged (the debuts, the books) is not judged twice, so
 *  the table is printed for both. */
const LASTS = (['steady', 'black'] as const).map(want => {
  const g = newGame('leicester', 'Identity', 18400)
  seat(g, 'stability')
  for (let s = 2031; s < 2080; s++) { g.season = s; if (chairWish(g) === want) return s }
  throw new Error('no season')
})

/** A career down this path: two plain seasons, then four of the method. */
function career(p: Path, chair: ChairType, over?: Partial<Conduct>, half = 1): GameState {
  const g = newGame('leicester', 'Identity', 18400)
  seat(g, chair)
  const a = arcOf(g)
  const first = LASTS[half] - SEASONS + 1
  a.conduct = Array.from({ length: SEASONS }, (_, i) =>
    base(g, first + i, i < 2 ? {} : { ...p.row, ...(i === SEASONS - 1 ? over ?? {} : {}) }))
  a.turned = p.turned ? [g.userClubId] : []
  g.season = LASTS[half]
  const club = g.clubs[g.userClubId]
  club.balance = p.bal
  g.books = { season: g.season, clubId: club.id, fromWeek: 1, opening: p.bal - p.drift, lines: {} }
  g.injectedThisSeason = 0
  return g
}
const FIRST = LASTS[1] - SEASONS + 1
const lastRow = (g: GameState) => g.arc!.conduct[g.arc!.conduct.length - 1]

// the clubs whose jobs a trait can fit: one of each profile in this world
const world = newGame('leicester', 'Identity', 18400)
const ofProfile = (prof: string) => Object.values(world.clubs).find(c => c.players.length && c.id !== world.userClubId && jobProfile(world, c.id) === prof)?.id
const academyClub = ofProfile('academy')
const newcomerClub = ofProfile('newcomer')
// a club in the red is a troubled job; none is at the start, so one is put there
const troubledClub = Object.values(world.clubs).find(c => c.players.length && c.id !== world.userClubId && c.rep < 70 && jobProfile(world, c.id) === 'steady')!.id

/** jobChance at a club, read in this path's career, with the fit and without. */
function jobRead(g: GameState, clubId: string | undefined) {
  if (!clubId) return null
  const c = g.clubs[clubId]
  const bal = c.balance
  if (clubId === troubledClub) c.balance = -500_000
  const fit = jobFit(g, clubId)
  const ch = jobChance(g, clubId)
  c.balance = bal
  return { fit, ch }
}

// ---- 1. five careers, one record ----
console.log('\n--- 1. five careers with the same record, read by every chairman')
console.log(`    (constructed conduct rows: ${SEASONS} seasons each, the last four in the method; every row won 16 lost 8, 3rd of 12)`)
console.log("    (cells: the method's points, and in brackets the whole May letter's: wish, job demand and method)")
type Grid = Record<string, Record<ChairType, number>>
const tables: Grid[] = [{}, {}], totals: Grid[] = [{}, {}]
const letters: Record<string, string[]> = {}
const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n)
for (const half of [0, 1]) {
  const table = tables[half], total = totals[half]
  console.log(`\n    season ${half + 1}, the wishes: ${CHAIR_TYPES.map(c => `${c} ${chairWish(career(PATHS[0], c, undefined, half))}`).join(', ')}`)
  console.log(`    ${pad('path', 13)} ${CHAIR_TYPES.map(c => pad(c, 11)).join('')} top trait      trajectory`)
  for (const p of PATHS) {
    table[p.name] = {} as Record<ChairType, number>
    total[p.name] = {} as Record<ChairType, number>
    let traitTxt = '', trendTxt = ''
    for (const chair of CHAIR_TYPES) {
      const g = career(p, chair, undefined, half)
      const m = boardMethod(g, lastRow(g))
      table[p.name][chair] = m.d
      // and the whole summer letter: the wish and the job's demand as well
      const c0 = g.clubs[g.userClubId].boardConfidence
      boardSummer(g, lastRow(g))
      total[p.name][chair] = g.clubs[g.userClubId].boardConfidence - c0 + m.d
      letters[`${half}|${p.name}|${chair}`] = m.rows.map(r => en(r.k as string))
      if (chair === 'stability') {
        traitTxt = mgrTraits(g).map(x => x.id).join(',')
        trendTxt = trendLines(g).map(x => en(x.k, { trait_k: x.trait_k })).join(' / ')
      }
    }
    const cell = (c: ChairType) => `${table[p.name][c] > 0 ? '+' : ''}${table[p.name][c]} (${total[p.name][c] > 0 ? '+' : ''}${total[p.name][c]})`
    console.log(`    ${pad(p.name, 13)} ${CHAIR_TYPES.map(c => pad(cell(c), 11)).join('')} ${pad(traitTxt, 14)} ${half ? trendTxt : ''}`)
  }
}
const table = tables[1]
console.log('\n    what each letter said on method (season 2, the chairman with the most to say):')
for (const p of PATHS) {
  const chair = [...CHAIR_TYPES].sort((a, b) => letters[`1|${p.name}|${b}`].length - letters[`1|${p.name}|${a}`].length || Math.abs(table[p.name][b]) - Math.abs(table[p.name][a]))[0]
  console.log(`      ${pad(p.name, 13)} (${chair}): ${letters[`1|${p.name}|${chair}`].join(' ') || '(nothing on method)'}`)
}
console.log('\n    job fit (chance with the fit, lift over the same career without it):')
for (const p of PATHS) {
  const g = career(p, 'stability')
  const cells = [['academy', academyClub], ['troubled', troubledClub], ['newcomer', newcomerClub]].map(([prof, id]) => {
    const r = jobRead(g, id)
    return `${prof} ${r ? `${r.ch.toFixed(2)}${r.fit ? ` (fit: ${r.fit})` : ''}` : 'n/a'}`
  })
  console.log(`      ${pad(p.name, 13)} ${cells.join('   ')}`)
}
console.log()

// the same record, different reactions
const sig = (name: string) => [0, 1].map(h => CHAIR_TYPES.map(c => tables[h][name][c]).join(',')).join(';')
ok(new Set(PATHS.map(p => sig(p.name))).size === PATHS.length, `five paths with one record draw five different board reactions (${PATHS.map(p => sig(p.name)).join(' | ')})`)
const tsig = (name: string) => [0, 1].map(h => CHAIR_TYPES.map(c => totals[h][name][c]).join(',')).join(';')
ok(new Set(PATHS.map(p => tsig(p.name))).size === PATHS.length, 'and five different May letters in all')
ok(table['risky'].stability < 0 && table['risky'].ambition < 0 && table['risky'].youth < 0 && table['risky'].commercial < 0, 'risky management costs confidence with every chairman')
ok(table['academy-led'].youth > table['academy-led'].ambition, `a youth chairman credits the academy more than an ambitious one (${table['academy-led'].youth} against ${table['academy-led'].ambition})`)
ok(table['tactical'].ambition > 0 && table['tactical'].stability > 0, 'attacking rugby pleases the ambitious chair, a mean defence the stable one')
ok(table['spending-led'].ambition > table['spending-led'].stability, `bold spending reads better to ambition than stability (${table['spending-led'].ambition} against ${table['spending-led'].stability})`)
ok(tables[0]['turnaround'].stability > 0 && tables[0]['turnaround'].commercial > 0, 'books mended within means please a careful chairman')
ok(tables[1]['turnaround'].stability === 0 && totals[1]['turnaround'].stability > 0, 'unless his wish was the books, which judged them already: no double count')
// different identity lines
const idLines = PATHS.map(p => { const g = career(p, 'stability'); return trendLines(g).map(x => x.trait_k).join(',') })
ok(new Set(idLines).size === PATHS.length, `and five different trajectory lines (${idLines.join(' | ')})`)
for (const p of PATHS) {
  const g = career(p, 'stability')
  ok(trendLines(g).length >= 1 && trendLines(g).length <= 2, `${p.name}: one or two trajectory lines, no more (${trendLines(g).length})`)
}
// fits
{
  const acad = career(PATHS[0], 'stability'), spend = career(PATHS[1], 'stability'), turn = career(PATHS[2], 'stability')
  if (academyClub) ok(!!jobFit(acad, academyClub) && !jobFit(spend, academyClub), 'an academy club hears the youth developer, not the spender')
  else console.log('        (no academy-profile club in this world to test against)')
  ok(!!jobFit(turn, troubledClub) || (() => { const c = turn.clubs[troubledClub]; const b = c.balance; c.balance = -500_000; const f = !!jobFit(turn, troubledClub); c.balance = b; return f })(),
    'a club in the red hears the man who turned one round')
  if (newcomerClub) ok(!!jobFit(spend, newcomerClub) && !jobFit(acad, newcomerClub), "new money hears the spender, not the academy man")
  else console.log('        (no newcomer-profile club in this world to test against)')
}

// ---- 2. change the conduct, the reaction changes ----
console.log('\n--- 2. the reaction is the behaviour')
{
  const kept = career(PATHS[4], 'stability', { broke: 0 })
  const broke = career(PATHS[4], 'stability')
  const dk = boardMethod(kept, lastRow(kept)).d, db = boardMethod(broke, lastRow(broke)).d
  ok(dk > db, `the risky season with the promises kept instead of broken: ${db} becomes ${dk}`)
  const idle = career(PATHS[0], 'youth', { deb: 0 })
  const busy = career(PATHS[0], 'youth')
  const wish = chairWish(busy)
  const di = boardMethod(idle, lastRow(idle)).d, dd = boardMethod(busy, lastRow(busy)).d
  ok(wish === 'debuts' ? di === dd : dd > di, `a youth chairman, three debuts or none: ${dd} or ${di}${wish === 'debuts' ? ' (his wish judged the debuts already, so the method does not count them twice)' : ''}`)
  const flat = career(PATHS[3], 'ambition', { pf: 24 })
  const att = career(PATHS[3], 'ambition')
  ok(boardMethod(att, lastRow(att)).d > boardMethod(flat, lastRow(flat)).d, 'an ambitious chairman, the same win record scored with tries or without')
  // the trajectory reads the rows, not a label: the method reversed fades it
  const g = career(PATHS[0], 'stability')
  ok(mgrTrends(g).some(x => x.id === 'youth' && x.dir !== 'fade'), `four seasons of debuts: youth is forming (${trendLines(g).map(x => en(x.k, { trait_k: x.trait_k })).join(' / ')})`)
  const a = arcOf(g)
  for (let i = 0; i < 6; i++) a.conduct.push(base(g, FIRST + SEASONS + i, { buy: 3_500_000 }))
  const lines = trendLines(g).map(x => en(x.k, { trait_k: x.trait_k }))
  ok(mgrTrends(g).some(x => x.id === 'youth' && x.dir === 'fade') && mgrTrends(g).some(x => x.id === 'spender' && x.dir !== 'fade'),
    `then six seasons of fees: youth fades and the spender forms (${lines.join(' / ')})`)
  // rising, not just new: the same trait, stronger than TREND_GAP seasons ago
  const r = career(PATHS[0], 'stability')
  const ra = arcOf(r)
  ra.conduct = Array.from({ length: 8 }, (_, i) => base(r, FIRST + i, i < 5 ? { deb: 2, hg: 25 } : { deb: 5, hg: 45 }))
  ok(mgrTrends(r).some(x => x.id === 'youth' && x.dir === 'rise'), `more debuts than ${TREND_GAP} seasons ago: "${trendLines(r).map(x => en(x.k, { trait_k: x.trait_k }))[0]}"`)
  ok(trendLines(newGame('bath', 'Fresh', 18402)).length === 0, 'a new career has no trajectory')
}

// ---- 3. bounds ----
console.log('\n--- 3. bounds')
{
  let worst = 0, maxRows = 0, n = 0
  const g = career(PATHS[0], 'stability')
  const club = g.clubs[g.userClubId]
  for (const chair of CHAIR_TYPES) {
    seat(g, chair)
    for (const broke of [0, 1, 4]) for (const kind of [0, 4]) for (const hard of [0, 8]) for (const mor of [4, 7])
      for (const deb of [0, 5]) for (const pf of [18, 36]) for (const pa of [14, 30]) for (const buy of [0, 6_000_000])
        for (const [bal, drift] of [[2e6, 5e5], [-1e6, -2e6], [1e6, -3e5]]) {
          club.balance = bal
          g.books = { season: g.season, clubId: club.id, fromWeek: 1, opening: bal - drift, lines: {} }
          const m = boardMethod(g, base(g, g.season, { broke, kind, hard, mor, deb, pf, pa, buy }))
          worst = Math.max(worst, Math.abs(m.d)); maxRows = Math.max(maxRows, m.rows.length); n++
        }
  }
  ok(worst <= METHOD_CAP, `the method never moves the board more than ${METHOD_CAP} either way (worst ${worst} over ${n} seasons)`)
  ok(worst === METHOD_CAP, 'and the cap is reached, so it is the cap holding and not the parts falling short')
  ok(maxRows <= 2, `the letter names two methods at most (${maxRows})`)
  // the job lift is exactly JOB_FIT, or nothing
  let maxLift = 0
  for (const p of PATHS) {
    const with_ = career(p, 'stability')
    const without = career(p, 'stability')
    arcOf(without).conduct = []; arcOf(without).turned = []
    for (const id of [academyClub, newcomerClub].filter((x): x is string => !!x)) {
      const lift = jobChance(with_, id) - jobChance(without, id)
      if (jobFit(with_, id)) maxLift = Math.max(maxLift, lift)
      else ok(Math.abs(lift) < 1e-9, `${p.name} at ${id}: no fit, no lift`)
    }
  }
  ok(maxLift <= JOB_FIT + 1e-9, `a fitting job is ${Math.round(JOB_FIT * 100)} points of chance at most (largest ${Math.round(maxLift * 100)})`)
}

// ---- 4. a real season, replayed with promises broken ----
console.log('\n--- 4. a real season through the engine, its May replayed')
{
  const g = newGame('gloucester', 'Real', 18403)
  const start = g.season
  let eve = ''
  for (let i = 0; i < 80 && g.season === start; i++) {
    const c = g.clubs[g.userClubId]
    if (!g.unemployed && c) c.boardConfidence = Math.max(c.boardConfidence, 70)
    eve = JSON.stringify(g)
    processWeekAndAdvance(g)
  }
  ok(g.season === start + 1, 'the season rolled over')
  const run = (broken: number) => {
    const h = migrate(JSON.parse(eve) as GameState)
    seat(h, 'stability')
    for (let i = 0; i < broken; i++) remember(h, { kind: 'promise-broken', clubId: h.userClubId, sal: 2 })
    processWeekAndAdvance(h)
    const letter = [...h.news, ...(h.arc?.queue ?? [])].filter(n => n.k === 'arc.verdict').pop()
    const rows = letter ? JSON.parse(String(letter.v?.rows_ll ?? '[]')) as { k: string }[] : []
    return { conf: h.clubs[h.userClubId].boardConfidence, rows: rows.map(r => r.k), row: h.arc!.conduct[h.arc!.conduct.length - 1] }
  }
  const A = run(0), B = run(3)
  console.log(`        real row: won ${A.row.w} drew ${A.row.d} lost ${A.row.l}, ${A.row.pos} of ${A.row.n}, debuts ${A.row.deb}, hard ${A.row.hard}, kept ${A.row.kind}, broken ${A.row.broke}`)
  console.log(`        letter as played: ${A.rows.join(', ') || '(none)'}; with three broken: ${B.rows.join(', ')}`)
  ok(B.row.broke === 3 + A.row.broke, `the conduct row counts them (${B.row.broke})`)
  ok(B.rows.includes('arc.meth.broke') && !A.rows.includes('arc.meth.broke'), 'the board letter says promises were broken')
  const expect = boardMethod(migrate(JSON.parse(eve) as GameState), null).d
  ok(expect === 0, 'no conduct row, no method')
  const gap = Math.round((A.conf - B.conf) * 100) / 100
  // three broken promises cost 2, the most that part can; any kept credit (+1)
  // the season had goes with them, so the gap is 2 or 3. Had the points gone in
  // before the summer pull they would have arrived as 55% of that
  ok(gap >= 2 && gap <= 3, `and the boardroom keeps the full points through the summer pull (${A.conf.toFixed(1)} against ${B.conf.toFixed(1)}: ${gap})`)
}

console.log(fails ? `\nIDENTITY 1.8.4 PROBE FAILED (${fails})` : '\nIDENTITY 1.8.4 PROBE PASSED: the name is earned, it moves, and the board reads how it was earned')
process.exit(fails ? 1 : 0)
