/**
 * THE SUMMER, CHECKED (was scripts/qa/rollover.ts, a printout nobody ran).
 *
 * A career is played to the last week of the season and the rollover step is
 * taken with the world snapshotted either side of it. For every rollover:
 *   1. the season index moves on by one and the week starts again;
 *   2. every league table is back to zero (played and points);
 *   3. a new set of fixtures exists: none played, none carried over from the
 *      old season, and every league club has games in its own league;
 *   4. every league that crowned a champion is in the roll of honour
 *      (state.history) for the season just finished, under that champion;
 *   5. every player still in the world is a year older;
 *   6. contracts age: a man at the same club whose deal had years to run
 *      keeps the same end season (one year fewer left), and nobody at a club
 *      holds a deal that has already ended.
 *
 * Run: npx vite-node scripts/rolloverprobe.ts [seasons=2]
 * PROBE_QUICK=1 plays one men's and one women's summer.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS, type GameState } from '../src/game/model'
import { ok, check, done } from './lib/probe'

const SEASONS = Number(process.argv[2] ?? (process.env.PROBE_QUICK ? 1 : 2))

function step(g: GameState) {
  const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}

function summer(g: GameState, label: string) {
  let guard = 0
  while (g.week !== SEASON_WEEKS && guard++ < SEASON_WEEKS + 5) step(g)
  ok(g.week === SEASON_WEEKS, `${label}: reached the last week of the season`)
  const s0 = g.season
  const leagues0 = Object.values(g.comps).filter(c => c.type === 'league')
  const champs = new Map(leagues0.filter(c => c.champion).map(c => [c.id, c.champion!]))
  const oldFixtures = new Set(g.fixtures.map(f => f.id))
  const pre = new Map(Object.values(g.players).map(p => [p.id, { age: p.age, ends: p.contractEnds, club: p.clubId, mat: !!p.maternity }]))

  step(g)

  // 1
  check(g.season === s0 + 1, `${label}: the season moves on by one`, () => `${s0} -> ${g.season}`)
  check(g.week < SEASON_WEEKS / 2, `${label}: the week starts again`, () => `week ${g.week}`)

  // 2
  const leagues = Object.values(g.comps).filter(c => c.type === 'league')
  const dirty = leagues.filter(c => c.table.some(r => r.p !== 0 || r.pts !== 0))
  check(leagues.length > 0 && dirty.length === 0, `${label}: ${leagues.length} league tables reset to zero`,
    () => `not reset: ${dirty.map(c => c.id).join(' ')}`)

  // 3
  const played = g.fixtures.filter(f => f.played)
  const carried = g.fixtures.filter(f => oldFixtures.has(f.id))
  ok(g.fixtures.length > 0, `${label}: a new fixture list exists (${g.fixtures.length})`)
  check(played.length === 0, `${label}: none of the new season's fixtures is already played`, () => `${played.length} played`)
  check(carried.length === 0, `${label}: no fixture carried over from the old season`, () => `${carried.length} carried`)
  const idle: string[] = []
  for (const c of leagues) for (const t of c.teamIds) if (!g.fixtures.some(f => f.compId === c.id && (f.homeId === t || f.awayId === t))) idle.push(`${c.id}/${t}`)
  check(idle.length === 0, `${label}: every league club has fixtures in its league`, () => idle.slice(0, 6).join(' '))

  // 4
  const missing = [...champs].filter(([id, champ]) => !g.history.some(h => h.season === s0 && h.compId === id && h.champion === champ))
  check(champs.size > 0 && missing.length === 0, `${label}: ${champs.size} league champions in the roll of honour for season ${s0}`,
    () => `missing: ${missing.map(([id, c]) => `${id}=${c}`).join(' ')}`)

  // 5
  let still = 0; const notAged: string[] = []
  for (const p of Object.values(g.players)) {
    const b = pre.get(p.id); if (!b) continue
    still++
    if (p.age !== b.age + 1) notAged.push(`${p.name} ${b.age}->${p.age}`)
  }
  check(still > 1000 && notAged.length === 0, `${label}: all ${still} players who stayed in the world are a year older`, () => notAged.slice(0, 5).join(', '))

  // 6
  let running = 0, kept = 0
  const expired: string[] = []
  for (const p of Object.values(g.players)) {
    const b = pre.get(p.id)
    if (p.clubId && p.contractEnds < g.season) expired.push(`${p.name} ends ${p.contractEnds}`)
    if (!b || !b.club || b.club !== p.clubId || b.ends <= s0 || b.mat) continue
    running++
    if (p.contractEnds === b.ends) kept++
  }
  // a running deal can still be renewed over the summer, so most, not all
  check(running > 500 && kept / running >= 0.9, `${label}: running contracts carry the same end season, a year shorter (${kept}/${running})`,
    () => `${running - kept} changed`)
  check(expired.length === 0, `${label}: nobody at a club holds a deal that has ended`, () => expired.slice(0, 5).join(', '))
}

for (const [gender, club, seed] of [['m', 'leicester', 101], ['w', 'w:bristol', 202]] as const) {
  const g: GameState = newGame(club, 'Roll', seed, undefined, undefined, gender)
  for (let s = 0; s < SEASONS; s++) summer(g, `${gender} s${g.season}`)
}

done('ROLLOVER PROBE', 'tables reset, fixtures new, champions recorded, contracts and players a year on')
