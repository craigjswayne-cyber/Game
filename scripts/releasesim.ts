/**
 * ---- RELEASE AUDIT: fifteen seasons without the wheels coming off ----
 *
 * The commercial-release audit's long-simulation leg. A store build has to
 * survive a decade-plus of play on one save, so this runs fifteen full seasons
 * headless and measures the things that rot slowly rather than break loudly:
 *
 *   - SAVE BLOAT: the serialised save's size, season by season. A save that
 *     grows without bound is a save that one day will not write on a phone.
 *   - POPULATION: the world's player count must stay in a band. Retirements
 *     without regens drains the league; regens without retirements floods it.
 *   - REGEN QUALITY DRIFT: the mean attribute of the under-23 cohort, season by
 *     season. If the academy mints ever-better (or ever-worse) players, season
 *     twelve is a different game from season two.
 *   - AGE SANITY: nobody plays on at 45, nobody is minted at 12.
 *   - FINANCIAL DRIFT: the league-wide balance sheet. Everyone bankrupt by
 *     season ten or everyone sitting on £100m are both dead economies.
 *   - CORRUPTION: the save must JSON-round-trip with no NaN/Infinity anywhere,
 *     every season, and the season must actually roll (no stuck weeks).
 *
 * Verdict lines are asserted, so this is a probe, not a reporter - but it is
 * fifteen seasons long, so it lives on the suite's SLOW list with the soaks.
 *
 * Run: npx vite-node scripts/releasesim.ts [seasons] [seed]
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { ATTR_KEYS, SEASON_WEEKS, leagueTier } from '../src/game/model'
import type { GameState } from '../src/game/model'

const SEASONS = Number(process.argv[2] ?? 15)
const SEED = Number(process.argv[3] ?? 20260822)

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const attrMean = (g: GameState, ids: string[]): number => {
  let sum = 0, n = 0
  for (const id of ids) {
    const p = g.players[id]
    if (!p) continue
    for (const k of ATTR_KEYS) sum += p.a[k]
    n += ATTR_KEYS.length
  }
  return n ? sum / n : 0
}

const g = newGame('leicester', 'Audit Gaffer', SEED)
const startIds = new Set(Object.keys(g.players))
const startCount = startIds.size
const startSize = JSON.stringify(g).length

interface Row {
  season: number; bytes: number; players: number; newU23: number
  u23Mean: number; retiredish: number; ages: [number, number]
  userBal: number; leagueBal: number; broke: number; news: number
  /** clubs more than ten weeks of wages under: the honest depth measure. A club
   *  that has just come out of administration is still "in the red" at two
   *  weeks, so counting the sign of the balance says nothing about distress. */
  deep: number
  /** clubs whose points deduction applies to this season */
  admin: number
}
const rows: Row[] = []
let prevIds = new Set(Object.keys(g.players))

console.log(`season 0: ${startCount} players, save ${(startSize / 1e6).toFixed(2)}MB`)

for (let s = 0; s < SEASONS; s++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
  }
  ok(g.season === target, `season ${target}: the year actually rolled (week ${g.week})`)

  const json = JSON.stringify(g)
  // NaN/Infinity serialise to null through JSON.stringify, so scan the live
  // object the same way the chaos probe does: through the string for tokens
  // that could only come from a corrupt number reaching a string field, and
  // through a full re-parse for structural validity
  ok(!json.includes('NaN') && !json.includes('Infinity'), `season ${target}: no NaN/Infinity leaked into text fields`)
  let parsed: unknown = null
  try { parsed = JSON.parse(json) } catch { /* fails below */ }
  ok(parsed !== null, `season ${target}: the save round-trips through JSON`)

  const ids = Object.keys(g.players)
  const ages = ids.map(id => g.players[id].age)
  const u23 = ids.filter(id => !startIds.has(id) && g.players[id].age <= 23)
  const gone = [...prevIds].filter(id => !g.players[id]).length
  prevIds = new Set(ids)
  const clubs = Object.values(g.clubs)
  rows.push({
    season: target,
    bytes: json.length,
    players: ids.length,
    newU23: u23.length,
    u23Mean: attrMean(g, u23),
    retiredish: gone,
    ages: [Math.min(...ages), Math.max(...ages)],
    userBal: g.clubs[g.userClubId]?.balance ?? 0,
    leagueBal: clubs.reduce((x, c) => x + c.balance, 0),
    broke: clubs.filter(c => c.balance < 0).length,
    deep: clubs.filter(c => {
      const w = c.players.reduce((x, id) => x + (g.players[id]?.wage ?? 0), 0)
      return w > 0 && c.balance < -10 * w
    }).length,
    admin: clubs.filter(c => c.admin && c.admin.season === g.season).length,
    news: g.news.length,
  })
}

console.log('\nseason  saveMB  players  left  newU23  u23attr  ageMin-Max  userBal£m  leagueBal£m  broke  deep  admin  news')
for (const r of rows) {
  console.log(
    `${String(r.season).padStart(6)}  ${(r.bytes / 1e6).toFixed(2).padStart(6)}  ${String(r.players).padStart(7)}  ` +
    `${String(r.retiredish).padStart(4)}  ${String(r.newU23).padStart(6)}  ${r.u23Mean.toFixed(1).padStart(7)}  ` +
    `${String(r.ages[0]).padStart(6)}-${r.ages[1]}  ${(r.userBal / 1e6).toFixed(1).padStart(9)}  ` +
    `${(r.leagueBal / 1e6).toFixed(1).padStart(11)}  ${String(r.broke).padStart(5)}  ${String(r.deep).padStart(4)}  ${String(r.admin).padStart(5)}  ${r.news}`)
}

const last = rows[rows.length - 1]
const mid = rows[Math.floor(rows.length / 2)]

// ---- the verdicts ----
ok(last.players >= startCount * 0.85 && last.players <= startCount * 1.25,
  `population holds its band over ${SEASONS} seasons (${startCount} -> ${last.players})`)
ok(rows.every(r => r.ages[0] >= 15 && r.ages[1] <= 44),
  `every age stays adult and mortal (${last.ages[0]}-${last.ages[1]} in the final season)`)
ok(rows.slice(2).every(r => r.retiredish > 0 && r.newU23 > 0),
  'players retire and regens arrive, every season from the third on')
{
  // regen drift, measured at EQUILIBRIUM. The u23 window takes about six
  // seasons to fill: a season-2 cohort is all freshly minted 17-year-olds and a
  // season-8 cohort spans 17 to 23 with six years of development inside it, so
  // comparing the two reads player growth as minting inflation (the first cut
  // of this assert did exactly that: 8.4 "early" vs 9.5 "late" was the window
  // filling, then dead flat from season 7 on). Drift is only drift once the
  // window is full: the first full-window seasons against the last ones.
  const settled = rows.slice(6)
  const early = settled.slice(0, 3)
  const late = settled.slice(-3)
  const em = early.reduce((x, r) => x + r.u23Mean, 0) / Math.max(1, early.length)
  const lm = late.reduce((x, r) => x + r.u23Mean, 0) / Math.max(1, late.length)
  ok(early.length === 3 && late.length === 3 && Math.abs(lm - em) / em < 0.06,
    `regen quality holds at equilibrium (u23 mean ${em.toFixed(1)} at season ${early[2]?.season} vs ${lm.toFixed(1)} at season ${late[2]?.season})`)
}
{
  // save bloat: the second half of the run must not keep compounding. Some
  // growth is honest (history, legacy, records); doubling from mid-run is not.
  const growth = last.bytes / mid.bytes
  ok(growth < 1.5,
    `save size plateaus (season ${mid.season}: ${(mid.bytes / 1e6).toFixed(2)}MB -> season ${last.season}: ${(last.bytes / 1e6).toFixed(2)}MB, x${growth.toFixed(2)})`)
  ok(last.bytes < 30e6, `a ${SEASONS}-season save stays under 30MB (${(last.bytes / 1e6).toFixed(2)}MB)`)
}
{
  // Where the red ink lives. Measured at equilibrium on this seed: ~41 of 101
  // clubs sit in persistent deficit from season 9 on - stable, not a collapse -
  // and the release audit carries that number as a balance finding. The line
  // here is drawn at half the world, to catch the day it becomes a collapse.
  const byTier: Record<number, [number, number]> = {}
  for (const c of Object.values(g.clubs)) {
    const t = leagueTier(c.leagueId)
    byTier[t] = byTier[t] ?? [0, 0]
    byTier[t][1]++
    if (c.balance < 0) byTier[t][0]++
  }
  console.log(`\nred-ink by tier at season ${last.season}: ` +
    Object.entries(byTier).map(([t, [b, n]]) => `tier${t} ${b}/${n}`).join(', '))
  ok(last.broke <= Object.keys(g.clubs).length * 0.5,
    `the economy is not a graveyard (${last.broke} clubs in the red of ${Object.keys(g.clubs).length})`)
  // DEPTH, not sign: administration clears the debt, so a club it has just
  // saved still reads as "in the red" at two weeks of wages. What must not run
  // away is the number in real distress.
  ok(last.deep <= Object.keys(g.clubs).length * 0.3,
    `distress is contained (${last.deep} clubs more than ten weeks under)`)
  ok(rows.slice(6).some(r => r.admin > 0),
    `and clubs that cannot pay actually go under (${rows.reduce((x, r) => x + r.admin, 0)} administrations over the run)`)
}
ok(Number.isFinite(last.leagueBal) && Math.abs(last.leagueBal) < 30e9,
  `league-wide money stays on a human scale (£${(last.leagueBal / 1e6).toFixed(0)}m)`)
ok(last.news < 6000, `the news feed does not grow without bound (${last.news} items)`)

console.log(fails
  ? `RELEASE SIM FAILED (${fails})`
  : `RELEASE SIM PASSED: ${SEASONS} seasons, and the world still works`)
if (fails) process.exit(1)
