/**
 * ---- TWENTY SEASONS IN THE WOMEN'S GAME ----
 *
 * scripts/soakhealth.ts plays twenty seasons at Leicester and audits what a
 * long save does to itself. It has never once run in the women's world, and
 * half the game shipped without anybody playing it to the end.
 *
 * This is that half. It is deliberately written as a DIMENSIONAL audit rather
 * than a second health check: the question is not "does it crash" - it does
 * not - but "does every part of this world still do its job in season twenty
 * that it did in season one". Seven dimensions, each one a thing a manager
 * would notice and none of which any existing probe covered.
 *
 * WHAT IT FOUND ON ITS FIRST RUN, and why the assertions are shaped as they
 * are:
 *
 *   1. THE CELTIC PROVINCES CUP NEVER CROWNED ANYBODY. Six clubs, playoffTeams
 *      2, and season.ts had branches for 4, 6 and 8 - so it fell into the
 *      eight-team one, which reads order[6] and order[7] off a table six long.
 *      Every April it manufactured four quarter-finals, two of them against
 *      `undefined`, which no engine can play; they sat unplayed for ever, the
 *      semi-final gate never opened, and twenty seasons passed with no
 *      champion while a manager in that league watched his fixture list say
 *      "undefined". Fixed in season.ts; dimension 1 below is what catches it.
 *
 *   2. FIVE OF THE TWELVE WOMEN'S NATIONS HAVE ALMOST NO CLUB PLAYERS. South
 *      Africa starts with none at all, Italy and Japan with four. That is not
 *      a defect - the women's club world is England, France, the Pacific and
 *      the Celtic provinces, and nobody in it is South African - and the
 *      emerging-nations path written for Georgia and Uruguay in the men's game
 *      fills those squads correctly: RSA goes from 0 players to 104 inside one
 *      season and every Test is played with a real score. Dimension 4 holds
 *      that path to it rather than pretending the club world covers the globe.
 *
 *   3. NO WOMEN'S WORLD CHAMPIONSHIP, on purpose (dream.ts WORLD_COMPS), so
 *      the dreams that need one are never offered in this world. Recorded
 *      here because a reader of this file will wonder, not because it is
 *      broken.
 *
 * Run: npx tsx scripts/wsoak.ts
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, msg: string) => {
  if (!cond) { fails++; console.log('FAIL  ' + msg) } else console.log('  ok  ' + msg)
}

const SEASONS = 20
const g = newGame(LEAGUE_DEFS('w')[0].clubs[0].id, 'Soak Gaffer', 20260804, undefined, 'coach', 'w')
const startComps = Object.keys(g.comps)
console.log(`${g.clubs[g.userClubId].name}, ${SEASONS} seasons · ${startComps.length} competitions at boot\n`)

/** every fixture the world ever produced, checked as it goes: a ghost tie is
 *  gone from the save by the next August, so it cannot be found at the end */
let ghostTies = 0
const sizes: number[] = []

for (let s = 0; s < SEASONS; s++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
    for (const q of [...g.press]) if (!q.answered) { try { answerPress(g, q.id, 0) } catch { /* a stale option is the press room's business */ } }
    ghostTies += g.fixtures.filter(f => !g.clubs[f.homeId] && !g.comps[f.compId]?.isNational).length
    ghostTies += g.fixtures.filter(f => !f.homeId || !f.awayId).length
    processWeekAndAdvance(g)
  }
  sizes.push(JSON.stringify(g).length)
}

const players = Object.values(g.players)
const clubs = Object.values(g.clubs)
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]

// ---- 1. every competition still crowns somebody, every season ------------
console.log('--- 1. the trophies')
{
  const crowned = new Map<string, number>()
  for (const h of g.history) crowned.set(h.compId, (crowned.get(h.compId) ?? 0) + 1)
  // the two Test series are tours, not tournaments - the men's Autumn
  // Internationals and Summer Tours have no champion either
  const TOURS = new Set(['w:aut', 'w:sum'])
  const leagues = Object.values(g.comps).filter(c => !TOURS.has(c.id))
  for (const c of leagues) {
    const n = crowned.get(c.id) ?? 0
    ok(n >= SEASONS - 1, `${c.name}: ${n} champions in ${SEASONS} seasons`)
  }
  for (const id of TOURS) ok(!crowned.has(id), `${g.comps[id]?.name ?? id} crowns nobody, like the men's tours`)
}

// ---- 2. no fixture the engine cannot play -------------------------------
console.log('\n--- 2. the fixture list')
{
  ok(ghostTies === 0, `no fixture was ever created without two real teams (${ghostTies} seen)`)
  const unplayed = g.fixtures.filter(f => !f.played && f.week < g.week)
  ok(unplayed.length === 0, `nothing is left stranded behind the calendar (${unplayed.length})`)
}

// ---- 3. the rosters ------------------------------------------------------
console.log('\n--- 3. the rosters')
{
  const orphans = players.filter(p => p.clubId && !g.clubs[p.clubId]).length
  const badRefs = clubs.flatMap(c => c.players.filter(id => !g.players[id])).length
  ok(orphans === 0, `no player points at a club that is gone (${orphans})`)
  ok(badRefs === 0, `no club points at a player that is gone (${badRefs})`)
  const POS = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB']
  const thin = clubs.filter(c => POS.some(pos =>
    c.players.map(id => g.players[id]).filter(p => p?.pos === pos).length < 1))
  ok(thin.length === 0, `every club can still field every position (${thin.length} cannot)`)
  const squads = clubs.map(c => c.players.length)
  ok(Math.min(...squads) >= 30, `and nobody has been whittled to nothing (smallest squad ${Math.min(...squads)})`)
}

// ---- 4. the Test world ---------------------------------------------------
console.log('\n--- 4. the Test world')
{
  const nats = new Set<string>()
  for (const c of Object.values(g.comps)) if (c.isNational) for (const t of c.teamIds) nats.add(t)
  /**
   * MEASURED AT A TEST WEEK, NOT IN AUGUST. Counting heads at the rollover
   * says South Africa and Japan have nobody, and the first version of this
   * probe duly failed on it - wrongly. The women's club world is England,
   * France, the Pacific and the Celtic provinces, so nobody in it is South
   * African, and the emerging-nations path written for Georgia and Uruguay
   * (season.ts, "EMERGING NATIONS NEED A SQUAD") generates those squads when
   * the window opens and lets them go when it shuts. A clubless player is not
   * carried through a summer, which is correct and is why the August count is
   * zero - the question is whether a squad exists when a Test is played.
   */
  const before = g.season
  let guard2 = 0
  while (g.season === before && guard2++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    processWeekAndAdvance(g)
    const live = g.fixtures.filter(f => g.comps[f.compId]?.isNational && f.played)
    if (live.length >= 20) break
  }
  const thinNat = [...nats].filter(n => Object.values(g.players).filter(p => p.nat === n).length < 15)
  ok(thinNat.length === 0,
    `by the time the Tests are on, all ${nats.size} nations have a squad to pick from (${thinNat.join(',') || 'none thin'})`)
  const tests = g.fixtures.filter(f => g.comps[f.compId]?.isNational)
  const dead = tests.filter(f => f.played && f.homeScore === 0 && f.awayScore === 0)
  ok(dead.length === 0, `and every Test played was a real match, not two empty squads (${dead.length} blank)`)
}

// ---- 5. the economy ------------------------------------------------------
console.log('\n--- 5. the economy')
{
  const buds = clubs.map(c => c.budget)
  const vals = players.map(p => p.value)
  const worst = Math.min(...clubs.map(c => c.balance))
  console.log(`     budget med £${(med(buds) / 1e6).toFixed(2)}m · value med £${(med(vals) / 1e6).toFixed(2)}m`
    + ` · deepest balance £${(worst / 1e6).toFixed(2)}m`)
  ok(med(buds) > 500_000, 'clubs can still buy after twenty seasons')
  ok(med(vals) < 8_000_000, 'and prices have not run away from them')
  // the men's world reaches about -£9m on the same measure over the same span,
  // so this is a shape the whole game has rather than a women's fault
  ok(worst > -25_000_000, `no club has fallen into a hole it can never climb out of (${(worst / 1e6).toFixed(1)}m)`)
  const afford = clubs.filter(c => c.budget >= med(vals) * 0.8).length
  ok(afford / clubs.length > 0.2, `${afford} of ${clubs.length} clubs can still pay for a median player`)
}

// ---- 6. the prose --------------------------------------------------------
console.log('\n--- 6. the prose')
{
  let raw = 0, unfilled = 0
  for (const n of g.news) {
    if (/^[a-z]+\.[A-Za-z0-9_]+$/.test(n.subject ?? '')) raw++
    if (/\{[a-zA-Z_]+\}/.test((n.subject ?? '') + (n.body ?? ''))) unfilled++
  }
  ok(raw === 0, `no raw key reached the inbox (${raw} of ${g.news.length})`)
  ok(unfilled === 0, `no placeholder went unfilled (${unfilled})`)
}

// ---- 7. the save ---------------------------------------------------------
console.log('\n--- 7. the save')
{
  const mb = sizes[sizes.length - 1] / 1e6
  const growth = sizes[sizes.length - 1] / sizes[4]
  console.log(`     ${mb.toFixed(2)}MB after ${SEASONS} seasons, ${growth.toFixed(2)}x its season-five size`)
  ok(mb < 12, `the save is still a save (${mb.toFixed(2)}MB)`)
  ok(growth < 1.6, 'and it is flattening off rather than compounding')
}

console.log(fails === 0
  ? `\nW SOAK PASSED: ${SEASONS} seasons in the women's game, and every part of it still works`
  : `\nW SOAK FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
