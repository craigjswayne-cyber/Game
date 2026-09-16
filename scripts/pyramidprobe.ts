// ---- THE PYRAMID KEEPS ITS SHAPE ------------------------------------------
//
// Promotion and relegation move clubs between leagues once a year, in
// rollover.ts, and nothing has ever checked afterwards that the pyramid still
// adds up. The external audit of 13 Sep 2026 called it a coverage gap rather
// than a defect, and read the implementation as structurally sound: this probe
// exists so that stays true rather than being re-read every release.
//
// The failure it is built for is not a wrong champion. It is a club that ends
// up in two leagues at once, or in none, or a division that quietly grows by
// one every season - the sort of thing that reads as "my league has 13 teams"
// four seasons into a career, long after the rollover that did it.
//
// So it asserts structure, not outcomes: who went up is the league's business,
// but how many went up, and whether the club they displaced is somewhere, is
// arithmetic that must hold every single year in both worlds.
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

/** leagueId for every club, which is the thing promotion actually changes */
const leagueMap = (g: GameState): Record<string, string> =>
  Object.fromEntries(Object.values(g.clubs).map(c => [c.id, c.leagueId]))

/** The leagues that exist, taken from the clubs rather than a hard-coded list,
 *  so this reads the women's pyramid as readily as the men's. */
const leagueIds = (g: GameState): string[] =>
  [...new Set(Object.values(g.clubs).map(c => c.leagueId))].filter(Boolean).sort()

function checkSeason(g: GameState, before: Record<string, string>, bootIds: string[], label: string) {
  // ---- nobody vanishes and nobody is minted ----
  const now = Object.keys(g.clubs).sort()
  ok(now.length === bootIds.length && now.every((id, i) => id === bootIds[i]),
     `${label}: the same ${bootIds.length} clubs exist as at boot (${now.length})`)

  // ---- every club is in exactly one league, and that league is real ----
  const homeless = Object.values(g.clubs).filter(c => !c.leagueId)
  ok(homeless.length === 0,
     `${label}: every club has a league${homeless.length ? ` (${homeless.slice(0, 3).map(c => c.name).join(', ')})` : ''}`)

  const orphan = leagueIds(g).filter(id => !g.comps[id])
  ok(orphan.length === 0,
     `${label}: every league a club names exists as a competition${orphan.length ? ` (${orphan.join(', ')})` : ''}`)

  // ---- the competition's list and the clubs' own answer are the same list ----
  //
  // These are two separate records of one fact and they are written in two
  // different places at rollover, which is exactly the shape of bug that
  // survives a soak: both halves stay internally consistent and disagree with
  // each other.
  const mismatched: string[] = []
  const doubled: string[] = []
  const seen = new Map<string, string>()
  for (const lid of leagueIds(g)) {
    const comp = g.comps[lid]
    if (!comp) continue
    const listed = [...comp.teamIds].sort()
    const claiming = Object.values(g.clubs).filter(c => c.leagueId === lid).map(c => c.id).sort()
    if (listed.length !== claiming.length || listed.some((id, i) => id !== claiming[i])) {
      mismatched.push(`${lid}: table lists ${listed.length}, clubs claim ${claiming.length}`)
    }
    for (const id of comp.teamIds) {
      const already = seen.get(id)
      if (already) doubled.push(`${g.clubs[id]?.name ?? id} in ${already} and ${lid}`)
      else seen.set(id, lid)
    }
  }
  ok(mismatched.length === 0, `${label}: teamIds matches leagueId in every league${mismatched.length ? ` (${mismatched.join('; ')})` : ''}`)
  ok(doubled.length === 0, `${label}: no club appears in two leagues${doubled.length ? ` (${doubled.slice(0, 3).join('; ')})` : ''}`)

  // ---- movement is paired, and only ever between adjacent divisions ----
  //
  // A promotion without a relegation is a division that grew. Counting the
  // moves per ordered pair and requiring the mirror to match catches that
  // without this probe needing to know which clubs were supposed to move.
  const moves = new Map<string, number>()
  for (const [id, was] of Object.entries(before)) {
    const nowLeague = g.clubs[id]?.leagueId
    if (!nowLeague || nowLeague === was) continue
    moves.set(`${was}>${nowLeague}`, (moves.get(`${was}>${nowLeague}`) ?? 0) + 1)
  }
  const unpaired: string[] = []
  for (const [route, n] of moves) {
    const [from, to] = route.split('>')
    const back = moves.get(`${to}>${from}`) ?? 0
    if (back !== n) unpaired.push(`${n} went ${from}->${to} but ${back} came back`)
  }
  ok(unpaired.length === 0, `${label}: every club that went up displaced one coming down${unpaired.length ? ` (${unpaired.join('; ')})` : ''}`)

  // ---- and therefore the divisions are the size they were ----
  const sizes = Object.fromEntries(leagueIds(g).map(lid =>
    [lid, Object.values(g.clubs).filter(c => c.leagueId === lid).length]))
  return sizes
}

// ---- the playoff decides it, and the result is honoured ---------------------
//
// 21A made the English trapdoor a game: week 44's barrage decides whether the
// bottom Premiership club stays. rollover.ts falls back to the automatic swap
// when no barrage was played, which is right, but it means the honoured case
// and the fallback case look identical from the outside.
//
// The tie has to be read BEFORE the final advance. The swap and the season
// rebuild happen inside the same processWeekAndAdvance, and the rebuild throws
// the fixture list away, so a check that runs afterwards finds nothing and
// passes for the wrong reason. That is how this arrived the first time it was
// written: a checkBarrage() that was never called at all.
type Barrage = { winner: string; loser: string; winnerWasPrem: boolean }

function readBarrage(g: GameState): Barrage | undefined {
  const bar = g.fixtures.find(f => f.compId === 'prem' && f.stage === 'BAR' && f.played)
  if (!bar) return undefined
  const winner = bar.homeScore > bar.awayScore ? bar.homeId : bar.awayId
  return {
    winner,
    loser: winner === bar.homeId ? bar.awayId : bar.homeId,
    winnerWasPrem: g.clubs[winner]?.leagueId === 'prem',
  }
}

function checkBarrage(g: GameState, b: Barrage, label: string) {
  const w = g.clubs[b.winner], l = g.clubs[b.loser]
  ok(w?.leagueId === 'prem',
     `${label}: ${w?.short} won the barrage and is in the top flight (${w?.leagueId})`)
  ok(l?.leagueId !== 'prem',
     `${label}: ${l?.short} lost it and is not (${l?.leagueId})`)
  ok(l?.leagueId === 'champ',
     `${label}: and the loser is in the division below, ${b.winnerWasPrem ? 'survival defended' : 'promotion taken'} (${l?.leagueId})`)
}

function run(world: 'm' | 'w', club: string, seasons: number) {
  const g = newGame(club, 'Pyramid', 4242, undefined, 'coach', world, 'm')
  const bootIds = Object.keys(g.clubs).sort()
  const bootSizes = Object.fromEntries(leagueIds(g).map(lid =>
    [lid, Object.values(g.clubs).filter(c => c.leagueId === lid).length]))
  const worldName = world === 'm' ? "the men's world" : "the women's world"
  console.log(`\n---- ${worldName}: ${g.clubs[g.userClubId].name}, ${seasons} seasons ----`)
  console.log(`  ${bootIds.length} clubs across ${leagueIds(g).length} leagues: ${Object.entries(bootSizes).map(([k, v]) => `${k} ${v}`).join(', ')}`)

  let barrages = 0
  for (let s = 0; s < seasons; s++) {
    const target = g.season + 1
    const before = leagueMap(g)
    let guard = 0
    let bar: Barrage | undefined
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g), false)
      g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
      if (world === 'm') bar = readBarrage(g) ?? bar
      processWeekAndAdvance(g)
    }
    const label = `season ${s + 1}`
    const sizes = checkSeason(g, before, bootIds, label)
    const grew = Object.entries(sizes).filter(([lid, n]) => n !== bootSizes[lid])
    ok(grew.length === 0, `${label}: every division is the size it started${grew.length ? ` (${grew.map(([l, n]) => `${l} ${bootSizes[l]}->${n}`).join(', ')})` : ''}`)
    if (bar) { barrages++; checkBarrage(g, bar, label) }
  }
  if (world === 'm') {
    ok(barrages > 0, `the English trapdoor was played at least once in ${seasons} seasons (${barrages})`)
  }
}

run('m', LEAGUE_DEFS('m')[0].clubs[0].id, 6)
run('w', LEAGUE_DEFS('w')[0].clubs[0].id, 4)

console.log(fails
  ? `\nPYRAMID PROBE FAILED (${fails})`
  : '\nPYRAMID PROBE PASSED: nobody in two leagues, nobody in none, and every division the size it started')
process.exit(fails ? 1 : 0)
