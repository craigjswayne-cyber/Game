// Probe: commissioned scouting - brief, wait, report, and the quality ladder.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEARCH_WEEKS, commissionScout, searchFee, type SearchMonths } from '../src/game/commission'
import { appointStaff, staffCandidates, staffInterest } from '../src/game/staff'
import { knowledge } from '../src/game/scout'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

function withScout(seed: number) {
  const g = newGame('leicester', 'Scout Probe', seed)
  g.clubs[g.userClubId].balance = 20_000_000
  if (!g.staffPeople?.scout) {
    const i = staffCandidates(g, 'scout').findIndex(c => staffInterest(g, c) !== 'no')
    if (i >= 0) appointStaff(g, 'scout', i)
  }
  return g
}

// 1. no scout, no brief
const bare = newGame('pirates', 'Scout Probe', 4242)
bare.staff.scout = 0
bare.staffPeople = { ...(bare.staffPeople ?? {}), scout: undefined }
const refused = commissionScout(bare, 'any', 3)
console.log('no scout    :', refused)
if (!refused.includes('no chief scout')) bad('a club with no scout still sent one out')

// 2. brief, cost, no double-booking
const g = withScout(777)
const bal0 = g.clubs[g.userClubId].balance
console.log('3-month     :', commissionScout(g, 'FH', 3))
if (!g.commission) bad('no commission recorded')
const spent = bal0 - g.clubs[g.userClubId].balance
if (spent !== searchFee(3, g.staff.scout)) bad(`fee mismatch: paid ${spent}`)
console.log('again       :', commissionScout(g, 'any', 6))
if (g.commission?.months !== 3) bad('a second brief overwrote the first')

// 3. the report lands on time, with knowledge gained
const target = g.commission!.done
let guard = 0
while (g.season * 100 + g.week < target && guard++ < 60) processWeekAndAdvance(g)
processWeekAndAdvance(g)
if (g.commission) bad('the brief never resolved')
const finds = g.scoutFinds ?? []
console.log(`report      : ${finds.length} names`)
for (const f of finds) {
  const p = g.players[f.playerId]
  console.log(`   ${'★'.repeat(f.grade + 1).padEnd(4)} ${p.name} (${p.pos}, ${p.age}, know ${knowledge(g, p)}) - ${f.note}`)
  if (knowledge(g, p) < 40) bad(`${p.name} was watched for months and is still unknown`)
  if (f.grade < 0 || f.grade > 3) bad(`grade out of range for ${p.name}`)
}
if (!finds.length) bad('a 3-month brief returned nothing at all')
if (!g.news.some(n => n.subject.includes('files his report'))) bad('no report news')

// 4. longer briefs bring more names and a better hit rate
const sizes: Record<number, number[]> = { 3: [], 6: [], 9: [] }
const goods: Record<number, number[]> = { 3: [], 6: [], 9: [] }
for (const months of [3, 6, 9] as SearchMonths[]) {
  for (let seed = 1; seed <= 6; seed++) {
    const t = withScout(seed * 31)
    commissionScout(t, 'any', months)
    const until = t.commission!.done
    let g2 = 0
    while (t.season * 100 + t.week < until && g2++ < 60) processWeekAndAdvance(t)
    processWeekAndAdvance(t)
    const fs = t.scoutFinds ?? []
    sizes[months].push(fs.length)
    goods[months].push(fs.filter(f => f.grade >= 2).length)
  }
}
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
for (const m of [3, 6, 9]) {
  console.log(`${m} months  : ${mean(sizes[m]).toFixed(1)} names, ${mean(goods[m]).toFixed(1)} of them worth signing (${SEARCH_WEEKS[m as SearchMonths]}w, ${searchFee(m as SearchMonths, 2).toLocaleString()})`)
}
if (!(mean(sizes[9]) > mean(sizes[3]))) bad('a 9-month brief brings no more names than a 3-month one')
if (!(mean(goods[9]) > mean(goods[3]))) bad('a longer brief is no better at finding useful players')

if (fails) { console.error(`SCOUT PROBE: ${fails} failures`); process.exit(1) }
console.log('SCOUT PROBE PASSED')
