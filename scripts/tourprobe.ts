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
import { buildInternationals, isLionsSeason, TOUR_PROVINCIAL, TEST_NAMES, TOUR_WEEKS } from '../src/game/schedule'
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
ok(tests.every(f => f.week === TOUR_WEEKS[1]), 'all three Tests are in the final week')
ok(prov.filter(f => f.week === TOUR_WEEKS[0]).length === 5, 'five midweek games open the tour a week earlier')
const lastProvRound = Math.max(...prov.map(f => f.round))
ok(tests.every(f => f.round > lastProvRound), 'and every Test is ordered after every provincial game')

// ---- 4. the series is decided on the Tests alone ------------------------
console.log('\n--- 4. a provincial win is not a series win')
ok(comp.teamIds.length === 2 && comp.teamIds.includes('LIO'),
  'the series table holds two teams - the tourists and the host')
ok(comp.rounds === 3, 'and it is a three-round series')
ok(!comp.table.some(r => g.clubs[r.teamId ?? '']),
  'no club has a row in it, so beating a franchise cannot win the series')

console.log('')
if (fails === 0) console.log('TOUR PROBE PASSED: ten matches, seven provinces, three Tests, and the series decided on the Tests')
else console.log(`TOUR PROBE FAILED (${fails})`)
process.exit(fails)
