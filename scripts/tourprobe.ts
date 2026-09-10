/**
 * ---- THE TOUR ----
 *
 * Owner, 7 Sep: the pinnacle of the game, "a fixture list of 10 fixtures with a
 * 3 test series at the end in the country".
 *
 * It was two Tests and nothing else, which is a series rather than a tour. This
 * holds the shape: ten matches, seven of them provincial games against real
 * clubs in the host country, three Tests against the host nation at the end,
 * and a series that is decided on those three alone. A provincial win must not
 * appear in the series table, because a tour party that beats four franchises
 * and loses three Tests has lost.
 */
import { newGame } from '../src/game/newgame'
import { assistantNatFixture, natFixtureThisWeek } from '../src/game/season'
import { buildInternationals, buildWomensInternationals, isLionsSeason, isWomensTourSeason, TOUR_PROVINCIAL, TEST_NAMES, TOUR_WEEKS } from '../src/game/schedule'
import { LEAGUE_DEFS } from '../src/game/newgame'
import { W } from '../src/game/gender'
import { mulberry32 } from '../src/game/rng'
import { BASE_YEAR } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---- 1. the cycle -------------------------------------------------------
console.log('--- 1. every fourth year, two off a World Championship')
const tourYears: number[] = []
for (let s = 0; s < 20; s++) if (isLionsSeason(s)) tourYears.push(BASE_YEAR + s)
console.log(`     tours: ${tourYears.join(', ')}`)
ok(tourYears.includes(2029) && tourYears.includes(2033) && tourYears.includes(2037),
  'the real cycle: 2029, 2033, 2037')
ok(tourYears.every(y => (y - 2027) % 4 === 2), 'every one of them two years off a World Championship')

// ---- 2. the fixture list ------------------------------------------------
console.log('\n--- 2. ten matches')
const g = newGame('bath', 'Test', 31)
const tourSeason = [...Array(20).keys()].find(s => isLionsSeason(s))!
g.season = tourSeason
buildInternationals(mulberry32(g.seed), g, false)
const tour = g.fixtures.filter(f => f.compId === 'lions')
ok(tour.length === 10, `ten fixtures (${tour.length})`)
const tests = tour.filter(f => (TEST_NAMES as readonly string[]).includes(f.stage ?? ''))
const prov = tour.filter(f => f.tourMatch)
ok(tests.length === 3, `three of them Tests (${tests.length})`)
ok(prov.length === TOUR_PROVINCIAL, `seven provincial games before them (${prov.length})`)
ok(tour.every(f => f.awayId === 'LIO'), 'the tourists are away in all ten, which is what a tour is')

const comp = g.comps['lions']
const host = comp.teamIds.find(x => x !== 'LIO')!
ok(tests.every(f => f.homeId === host), `all three Tests against the host (${host})`)
const hostClubs = prov.filter(f => g.clubs[f.homeId]?.country === host).length
console.log(`     ${hostClubs} of the ${prov.length} midweek games are against clubs in ${host}`)
ok(prov.every(f => !!g.clubs[f.homeId]), 'every midweek game is against a real club')
ok(hostClubs >= 4, 'and the host\'s own franchises come first')
ok(new Set(prov.map(f => f.homeId)).size === prov.length, 'nobody is played twice')

// ---- 3. the Tests come last ---------------------------------------------
console.log('\n--- 3. the series is at the end')
ok(TOUR_WEEKS.length === 5, `the tour runs over five weeks (${TOUR_WEEKS.length})`)
for (const w of TOUR_WEEKS) {
  const inWeek = tour.filter(f => f.week === w)
  ok(inWeek.length === 2, `week ${w}: two matches (${inWeek.length})`)
  ok(inWeek.filter(f => f.midweek).length === 1, `week ${w}: one of them midweek`)
}
ok(tests.every(f => !f.midweek), 'no Test is played on a Wednesday')
const testWeeks = tests.map(f => f.week).sort((a, b) => a - b)
ok(JSON.stringify(testWeeks) === JSON.stringify(TOUR_WEEKS.slice(-3)),
  `the three Tests take the last three weekends (${testWeeks.join(', ')})`)
ok(prov.filter(f => f.midweek).length === 5,
  'a province is played every Wednesday, right through the series')

// ---- 4. the series is decided on the Tests alone ------------------------
console.log('\n--- 4. a provincial win is not a series win')
ok(comp.teamIds.length === 2 && comp.teamIds.includes('LIO'),
  'the series table holds two teams - the tourists and the host')
ok(comp.rounds === 3, 'and it is a three-round series')
ok(!comp.table.some(r => g.clubs[r.teamId ?? '']),
  'no club has a row in it, so beating a franchise cannot win the series')

// ---- 5. the women's tour ------------------------------------------------
console.log('\n--- 5. the women tour too, two years later')
const wYears: number[] = []
for (let s2 = 0; s2 < 20; s2++) if (isWomensTourSeason(s2)) wYears.push(BASE_YEAR + s2)
console.log(`     women's tours: ${wYears.join(', ')}`)
ok(wYears[0] === 2031, `the first is 2031, two years after the men's first (${wYears[0]})`)
ok(wYears.every(y => isLionsSeason(y - BASE_YEAR - 2) || y - 2 < BASE_YEAR),
  'every one of them falls two years after a men\'s tour')
ok(!wYears.some(y => tourYears.includes(y)), 'and the two games never tour in the same summer')

const wClub = LEAGUE_DEFS('w')[0].clubs[0].id
const wg = newGame(wClub, 'Test', 31, undefined, 'coach', 'w')
wg.season = [...Array(20).keys()].find(s2 => isWomensTourSeason(s2))!
buildWomensInternationals(mulberry32(wg.seed), wg)
const wtour = wg.fixtures.filter(f => f.compId === W + 'lions')
ok(wtour.length === 10, `ten fixtures on the women's tour too (${wtour.length})`)
ok(wtour.filter(f => (TEST_NAMES as readonly string[]).includes(f.stage ?? '')).length === 3,
  'three Tests at the end of it')
const wHost = wg.comps[W + 'lions'].teamIds.find(x => x !== 'LIO')
ok(['NZL', 'CAN', 'FRA'].includes(wHost ?? ''),
  `and it goes where it was sent - NZ, Canada or France (${wHost})`)
ok(!wg.comps['lions'], 'the men\'s tour does not exist in a women\'s world')

// ---- 6. the country still plays, and somebody else runs it ---------------
console.log('\n--- 6. the assistant takes the country')
ok(!!g.comps['tour'],
  'a tour year still has a summer Test programme - the unions tour with what is left')
const natFx = g.fixtures.filter(f => f.compId === 'tour')
ok(natFx.length > 0, `${natFx.length} summer Tests alongside the tour`)
ok(natFx.every(f => f.week <= Math.max(...TOUR_WEEKS)), 'all inside the summer')

// with the job taken, the tour is the manager's match and the country is not
const j = newGame('bath', 'Test', 31)
j.season = tourSeason
j.natTeam = 'ENG'
buildInternationals(mulberry32(j.seed), j, false)
j.isles = { season: j.season, answer: 'yes' }
let mine = 0, assistants = 0
for (const week of TOUR_WEEKS) {
  j.week = week
  const f = natFixtureThisWeek(j)
  const a = assistantNatFixture(j)
  if (f && (f.homeId === 'LIO' || f.awayId === 'LIO')) mine++
  if (a) assistants++
}
console.log(`     across the five weeks: ${mine} matches are his, ${assistants} handed to the assistant`)
ok(mine > 0, 'the tour matches are the ones he takes')
ok(assistants > 0, 'and England\'s summer is run by somebody else')

// and without the job, his country is his again
const n = newGame('bath', 'Test', 31)
n.season = tourSeason
n.natTeam = 'ENG'
buildInternationals(mulberry32(n.seed), n, false)
n.week = TOUR_WEEKS[0]
ok(!assistantNatFixture(n), 'a manager who did not take the tour keeps his own country')

console.log('')
if (fails === 0) console.log('TOUR PROBE PASSED: both games tour, ten matches each, three Tests, and the country left in other hands')
else console.log(`TOUR PROBE FAILED (${fails})`)
process.exit(fails)
