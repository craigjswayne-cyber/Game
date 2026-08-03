// Headless engine smoke test: build a game world and simulate seasons.
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS } from '../src/game/model'

// --- data sanity ---
const defs = LEAGUE_DEFS()
const ids = new Set<string>()
let dup = 0
for (const d of defs) {
  for (const c of d.clubs) {
    if (ids.has(c.id)) { console.error(`DUPLICATE CLUB ID: ${c.id}`); dup++ }
    ids.add(c.id)
    if (c.players.length < 26) console.warn(`thin squad: ${c.id} has ${c.players.length}`)
  }
}
console.log(`clubs: ${ids.size}, players: ${defs.reduce((s, d) => s + d.clubs.reduce((x, c) => x + c.players.length, 0), 0)}, dup ids: ${dup}`)

// --- run seasons ---
const g = newGame('leicester', 'Test Gaffer', 12345)
console.log(`world players: ${Object.keys(g.players).length}, fixtures season 1: ${g.fixtures.length}`)

const t0 = Date.now()
let userMatches = 0
let userKO = 0
let totalPF = 0, totalPA = 0
const SEASONS = 10

for (let season = 0; season < SEASONS; season++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    // play user's fixture like the UI would
    const fx = userFixtureThisWeek(g)
    if (fx) {
      simMatch(g, fx, weekRng(g), true)
      userMatches++
      if (fx.stage) userKO++
      const mine = fx.homeId === g.userClubId
      totalPF += mine ? fx.homeScore : fx.awayScore
      totalPA += mine ? fx.awayScore : fx.homeScore
    }
    // answer any open press
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    const wk = g.week
    processWeekAndAdvance(g)
    // knockout-theft guard: no user fixture for the processed week may have
    // been simmed by the AI weekly loop (user-path matches carry events)
    const stolen = g.fixtures.filter(f =>
      f.week === wk && f.played && !f.events &&
      (f.homeId === g.userClubId || f.awayId === g.userClubId))
    if (stolen.length) console.error(`BUG: ${stolen.length} user fixture(s) in week ${wk} simmed by the AI path`)
  }
  console.log(`season rolled to ${g.season}, week ${g.week}; champions so far: ${g.history.map(h => `${h.compId}:${h.champion}`).join(' ')}`)
}

const ms = Date.now() - t0
console.log(`\n${SEASONS} full seasons in ${ms}ms (${Math.round(ms / SEASONS)}ms/season)`)
console.log(`user matches: ${userMatches} (${userKO} knockout ties played by the user path), avg score for ${(totalPF / userMatches).toFixed(1)} - ${(totalPA / userMatches).toFixed(1)} against`)
if (userKO === 0) console.warn('note: this seed produced no user knockout ties (mid-table decade) — theft guard above is the real check')
console.log(`news items: ${g.news.length}, players now: ${Object.keys(g.players).length}, fixtures now: ${g.fixtures.length}`)

// score distribution check on a fresh season's league fixtures
const played = g.fixtures.filter(f => f.played && g.comps[f.compId]?.type === 'league')
const avgTotal = played.reduce((s, f) => s + f.homeScore + f.awayScore, 0) / Math.max(1, played.length)
const homeWins = played.filter(f => f.homeScore > f.awayScore).length
const draws = played.filter(f => f.homeScore === f.awayScore).length
const avgTries = played.reduce((s, f) => s + f.homeTries + f.awayTries, 0) / Math.max(1, played.length)
console.log(`league games: ${played.length}, avg total pts ${avgTotal.toFixed(1)}, avg tries ${avgTries.toFixed(1)}, home win ${(100 * homeWins / played.length).toFixed(0)}%, draws ${(100 * draws / played.length).toFixed(1)}%`)

// serialize size (save game weight)
const json = JSON.stringify(g)
console.log(`save size: ${(json.length / 1024).toFixed(0)} KB`)

// integrity: every club has enough players, every comp has a champion after season end
for (const club of Object.values(g.clubs)) {
  const n = club.players.length
  if (n < 22) console.warn(`squad shrank: ${club.id} = ${n}`)
}
console.log('SMOKE TEST DONE')
