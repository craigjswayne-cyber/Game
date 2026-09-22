// Probe: the club estate - starting levels by status, board requests to 5,
// stadium expansion, and the weekly effects that hang off them.
import { newGame } from '../src/game/newgame'
import { expansionPlan, processWeekAndAdvance, requestExpansion, requestFacility, requestFunds } from '../src/game/season'
import { FACILITY_INFO, MAX_FACILITY, STAND_BUILD_WEEKS, estateGrade, type FacilityId } from '../src/game/model'

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
// THE SEATS ARRIVE WITH THE STAND, not with the yes (v1.6.6). The approval
// signs the contract and puts the builders on site for twelve weeks; the
// capacity only moves when they are gone.
if (plan.fill >= 0.86 && !s2.stadiumBuild) bad('a full ground was refused its expansion')
if (s2.stadiumBuild) {
  if (sc.capacity !== cap0) bad('the seats landed before the stand was built')
  // and the one builders' slot is taken while it goes up
  s2.facilityAskCooldown = 0
  sc.balance = 40_000_000
  const blocked = requestFacility(s2, 'shop')
  if (s2.facilityBuild) bad('a facility was started while the stand was going up')
  console.log('mid-build   :', blocked)
  const owed = s2.stadiumBuild.seats
  let wk = 0
  while (s2.stadiumBuild && wk < STAND_BUILD_WEEKS + 4) { processWeekAndAdvance(s2); wk++ }
  console.log(`stand opens : after ${wk} weeks, ${cap0.toLocaleString()} -> ${sc.capacity.toLocaleString()}`)
  if (s2.stadiumBuild) bad('the stand never finished')
  else if (sc.capacity !== cap0 + owed) bad(`the stand opened at ${sc.capacity}, expected ${cap0 + owed}`)
  // one tick more than the duration, which is the convention every build in
  // the game already follows: the week the order is placed is still played
  // out before the builders start counting (a three-week facility opens on
  // the fourth tick too).
  if (wk !== STAND_BUILD_WEEKS + 1) bad(`the stand took ${wk} ticks, not ${STAND_BUILD_WEEKS + 1}`)
  if (!s2.news.some(n => n.k === 'news.expOpened')) bad('the stand opened with no word to the manager')
}
if (sc.capacity < cap0) bad('capacity went backwards')

// 5. pressing the board (v1.1.4): a denial stamps the ledger; asking again
// inside it draws the formal warning and HALVES respect; the ask after that
// is the sack. Both capital doors (facility and ground) share one ledger.
{
  const e = newGame('leicester', 'Pushy Probe', 2468)
  const ec = e.clubs[e.userClubId]
  ec.boardConfidence = 30 // guarantees the first denial (needs >= 45)
  ec.balance = 0
  e.facilityAskCooldown = 0
  requestFacility(e, 'shop')
  if (e.facilityBuild) bad('a broke club at confidence 30 got its request approved')
  if (!e.boardAsks?.capital) bad('a denial did not stamp the escalation ledger')
  const confAfterDenial = ec.boardConfidence
  const warned = requestFacility(e, 'shop') // inside the denial: strike one
  console.log(`pushed once : confidence ${confAfterDenial} -> ${ec.boardConfidence} | ${warned.slice(0, 60)}...`)
  if (e.unemployed) bad('the FIRST push sacked the manager instead of warning him')
  if (ec.boardConfidence !== Math.round(confAfterDenial * 0.5)) {
    bad(`the warning did not halve respect (${confAfterDenial} -> ${ec.boardConfidence})`)
  }
  if (!e.news.some(n => n.k === 'news.boardPushed')) bad('no formal warning letter landed')
  const out = requestFacility(e, 'shop') // past the warning: the sack
  console.log(`pushed twice: ${out.slice(0, 60)}...`)
  if (!e.unemployed) bad('pushing past the warning did not cost the job')
  if (!e.news.some(n => n.k === 'news.sackedPushed')) bad('the dismissal letter is missing')
  if (!e.vacancies.some(v => v.clubId === ec.id)) bad('the sacking opened no vacancy')
}

// 6. the funds ask, engine-owned (it was an untyped flag on the save): once
// a season win or lose, and the same escalation applies to a repeat inside
// a refusal. An approved ask politely refuses a second try with no strike.
{
  const y = newGame('leicester', 'Funds Probe', 1357)
  const yc = y.clubs[y.userClubId]
  yc.boardConfidence = 90
  const before = yc.budget
  const granted = requestFunds(y)
  console.log(`funds, adored: budget ${before.toLocaleString()} -> ${yc.budget.toLocaleString()} | ${granted.slice(0, 50)}...`)
  if (!(yc.budget > before)) bad('an adoring board granted nothing')
  const afterFirst = yc.budget
  const again = requestFunds(y)
  if (y.unemployed || y.news.some(n => n.k === 'news.boardPushed')) {
    bad('re-asking after a YES escalated - only refusals arm the ledger')
  }
  if (yc.budget !== afterFirst) bad('the polite second ask changed the budget')
  console.log(`funds, again : ${again.slice(0, 50)}...`)

  const n = newGame('leicester', 'Broke Probe', 8642)
  const nc = n.clubs[n.userClubId]
  nc.boardConfidence = 50 // denied: not owed, not adored, no tenure
  requestFunds(n)
  if (!n.boardAsks?.funds) bad('a funds denial did not stamp the ledger')
  const c0 = nc.boardConfidence
  requestFunds(n) // strike one
  if (n.unemployed) bad('first funds push sacked instead of warning')
  if (nc.boardConfidence !== Math.round(c0 * 0.5)) bad(`funds warning did not halve respect (${c0} -> ${nc.boardConfidence})`)
  requestFunds(n) // strike two
  if (!n.unemployed) bad('pushing the funds door past its warning did not cost the job')
  console.log(`funds, denied then pushed twice: sacked as promised`)
}

if (fails) { console.error(`ESTATE PROBE: ${fails} failures`); process.exit(1) }
console.log('ESTATE PROBE PASSED')
