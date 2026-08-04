// Probe: the club estate - starting levels by status, board requests to 5,
// stadium expansion, and the weekly effects that hang off them.
import { newGame } from '../src/game/newgame'
import { expansionPlan, processWeekAndAdvance, requestExpansion, requestFacility } from '../src/game/season'
import { FACILITY_INFO, MAX_FACILITY, estateGrade, type FacilityId } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }
const ids = Object.keys(FACILITY_INFO) as FacilityId[]

// 1. starting estates track club standing
for (const club of ['toulouse', 'leicester', 'montauban', 'pirates']) {
  const g = newGame(club, 'Probe', 4242)
  const c = g.clubs[g.userClubId]
  const grade = estateGrade(c)
  console.log(`${club.padEnd(11)} rep ${c.rep} estate ${grade.sum}/${grade.max} ${grade.label.padEnd(11)} ${ids.map(f => c.facilities?.[f] ?? 0).join('')}`)
  if (!c.facilities) bad(`${club} has no facilities`)
  for (const f of ids) {
    const lvl = c.facilities?.[f] ?? -1
    if (lvl < 0 || lvl > MAX_FACILITY) bad(`${club} ${f} level ${lvl}`)
  }
}
const big = estateGrade(newGame('toulouse', 'P', 4242).clubs['toulouse']).sum
const small = estateGrade(newGame('pirates', 'P', 4242).clubs['pirates']).sum
if (!(big > small + 6)) bad(`a giant's estate (${big}) barely beats a Championship club's (${small})`)

// every club in the world has one, and they are stable across saves
const w = newGame('leicester', 'Probe', 99)
const missing = Object.values(w.clubs).filter(c => !c.facilities).length
if (missing) bad(`${missing} clubs have no estate`)
const w2 = newGame('leicester', 'Probe', 99)
if (JSON.stringify(w.clubs['bath'].facilities) !== JSON.stringify(w2.clubs['bath'].facilities)) bad('estates are not deterministic')

// 2. requests run all the way to level 5
const g = newGame('leicester', 'Probe Gaffer', 777)
const club = g.clubs[g.userClubId]
club.boardConfidence = 85
let built = 0
for (let i = 0; i < 6; i++) {
  club.balance = 30_000_000
  g.facilityAskCooldown = 0
  const msg = requestFacility(g, 'shop')
  if (!g.facilityBuild) { console.log(`  shop stopped at level ${club.facilities?.shop}: ${msg}`); break }
  built++
  for (let k = 0; k < 6; k++) processWeekAndAdvance(g)
}
console.log(`shop built ${built} times, now level ${club.facilities?.shop} of ${MAX_FACILITY}`)
if ((club.facilities?.shop ?? 0) !== MAX_FACILITY) bad('could not build the shop to level 5')
club.balance = 30_000_000; g.facilityAskCooldown = 0
const capped = requestFacility(g, 'shop')
if (!capped.includes('world class')) bad(`level-5 facility still accepts requests: ${capped}`)

// 3. the shop actually pays - same week, same world, only the shop differs
const deltas: number[] = []
for (const shop of [0, 5]) {
  const t = newGame('leicester', 'Probe', 555)
  const tc = t.clubs[t.userClubId]
  tc.facilities = { ...(tc.facilities ?? {}), shop }
  const before = tc.balance
  processWeekAndAdvance(t)
  deltas.push(tc.balance - before)
}
console.log(`weekly balance change: no shop ${deltas[0].toLocaleString()}, level-5 shop ${deltas[1].toLocaleString()}`)
if (!(deltas[1] > deltas[0])) bad('the megastore earns nothing')

// 4. stadium expansion needs a full ground
const s2 = newGame('leicester', 'Probe', 31337)
const sc = s2.clubs[s2.userClubId]
sc.balance = 40_000_000
sc.boardConfidence = 80
console.log('early ask   :', requestExpansion(s2))
if (sc.capacity !== s2.clubs[s2.userClubId].capacity) bad('capacity changed on a declined request')
const cap0 = sc.capacity
// play a chunk of the season so there is a gate record, then ask again
for (let i = 0; i < 12; i++) processWeekAndAdvance(s2)
s2.facilityAskCooldown = 0
sc.balance = 40_000_000
const plan = expansionPlan(s2)
console.log(`after 12w   : ${plan.played} home games, ${plan.avg.toLocaleString()} avg (${Math.round(plan.fill * 100)}% full)`)
console.log('second ask  :', requestExpansion(s2))
if (plan.fill >= 0.86 && sc.capacity === cap0) bad('a full ground was refused its expansion')
if (sc.capacity < cap0) bad('capacity went backwards')

if (fails) { console.error(`ESTATE PROBE: ${fails} failures`); process.exit(1) }
console.log('ESTATE PROBE PASSED')
