// Probe: named backroom staff, the candidate market and the 58% course.
import { newGame } from '../src/game/newgame'
import { STAFF_INFO } from '../src/game/model'
import { BADGE, EXAM_PASS_PCT, RETAKE_WEEKS, appointStaff, sendToCourse, staffCandidates, staffInterest, staffWageBill, type StaffRole } from '../src/game/staff'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

// 1. inherited department varies with club status
for (const [club, label] of [['toulouse', 'giant'], ['leicester', 'big'], ['pirates', 'small']] as const) {
  const g = newGame(club, 'Probe', 4242)
  const tiers = (Object.keys(STAFF_INFO) as StaffRole[]).map(k => g.staff[k])
  const people = (Object.keys(STAFF_INFO) as StaffRole[]).filter(k => g.staffPeople?.[k])
  console.log(`${label} ${club}: tiers ${tiers.join('')} people ${people.length} wages £${staffWageBill(g).toLocaleString()}/wk`)
  for (const k of Object.keys(STAFF_INFO) as StaffRole[]) {
    const p = g.staffPeople?.[k]
    if (g.staff[k] > 0 && !p) bad(`${club} ${k} has a level but no man`)
    if (p && p.tier !== g.staff[k]) bad(`${club} ${k} tier ${p.tier} != level ${g.staff[k]}`)
  }
  if (!g.news.some(n => n.subject.includes('backroom staff you have inherited'))) bad(`${club} no inherited-staff news`)
}

// 2. candidate market: deterministic, plausible, interest gated by club rep
const g = newGame('pirates', 'Probe Gaffer', 777)
const a = staffCandidates(g, 'attack')
const b = staffCandidates(g, 'attack')
if (JSON.stringify(a) !== JSON.stringify(b)) bad('candidate list is not stable')
console.log('pirates attack-coach market:', a.map(c => `${c.name} ${BADGE[c.tier]} £${c.wage}/wk fee £${c.fee} (${staffInterest(g, c)})`).join(' | '))
const golds = a.filter(c => c.tier === 3)
if (golds.some(c => staffInterest(g, c) !== 'no')) bad('a gold coach would join the Championship strugglers')

// 3. appointment: fee paid, tier applied, market refreshed
const rich = newGame('leicester', 'Probe Gaffer', 777)
rich.clubs[rich.userClubId].balance = 8_000_000
const before = rich.clubs[rich.userClubId].balance
const cands = staffCandidates(rich, 'attack')
const wanted = cands.findIndex(c => staffInterest(rich, c) !== 'no')
console.log('appoint:', appointStaff(rich, 'attack', wanted))
const p = rich.staffPeople?.attack
if (!p) bad('nobody appointed')
if (p && rich.staff.attack !== p.tier) bad('level does not mirror tier after appointment')
if (before - rich.clubs[rich.userClubId].balance !== cands[wanted].fee) bad('compensation not paid exactly')
if (JSON.stringify(staffCandidates(rich, 'attack')) === JSON.stringify(cands)) bad('market did not refresh after a hire')

// 4. the course: sit it, verdict lands the same day
//
// This section used to assert that sendToCourse BOOKED a course - that
// p.course was set and drained six weeks later. Courses resolve on the day
// now, so nothing ever writes p.course, and the assertion had been failing
// ever since without anybody noticing, because this probe was not in the
// per-round pipeline. What it checks now is what the system does: the exam is
// sat immediately, the badge and the wage move together, and a gold-badged man
// is turned away rather than charged for a course he cannot sit.
const c2 = newGame('leicester', 'Probe Gaffer', 31337)
c2.clubs[c2.userClubId].balance = 8_000_000
// make sure somebody holds the job at a tier below gold
if (!c2.staffPeople?.physio || c2.staff.physio >= 3) {
  const idx = staffCandidates(c2, 'physio').findIndex(c => c.tier < 3 && staffInterest(c2, c) !== 'no')
  if (idx >= 0) appointStaff(c2, 'physio', idx)
}
const before2 = c2.staffPeople?.physio?.tier ?? 0
const wage0 = c2.staffPeople?.physio?.wage ?? 0
const purse0 = c2.clubs[c2.userClubId].balance
console.log('course  :', sendToCourse(c2, 'physio'))
if (c2.clubs[c2.userClubId].balance >= purse0) bad('the course was free')
// SIT UNTIL IT MOVES, AT MOST EIGHT TIMES (28 Sep 2026). This sat twice and
// demanded a promotion, but a sitting passes 58% of the time and a failure
// locks the man out (RETAKE_WEEKS), so the second call was usually refused
// and "two sittings" was one: the badge stayed put in about four worlds in
// ten, and on a shifted seed list it did. Worse, the gold loop below then
// spun for ever against the lock-out (the run hit the suite's 20-minute
// timeout). The clock is now moved to the end of each lock-out, as a manager would
// wait it out; eight sittings all failing is 0.42^8, about 1 in 1,000.
const sit = () => {
  const msg = sendToCourse(c2, 'physio')
  const at = c2.staffPeople?.physio?.retakeAt
  if (/cannot sit it again yet/.test(msg) && at != null) {
    // to the week the lock-out ends (RETAKE_WEEKS on), across a summer if need be
    c2.season = Math.floor(at / 100); c2.week = at % 100
    return sendToCourse(c2, 'physio')
  }
  return msg
}
for (let i = 0; i < 7 && (c2.staffPeople?.physio?.tier ?? 0) === before2; i++) console.log('again   :', sit())
if (c2.staffPeople?.physio?.course) bad('a course was left in flight, which nothing sets any more')
// a verdict, not a wait: the tier has already moved by the time the call returns
if ((c2.staffPeople?.physio?.tier ?? 0) === before2) bad('eight sittings and the badge never moved')
if ((c2.staffPeople?.physio?.wage ?? 0) <= wage0) bad('a better badge did not cost more in wages')
// and gold is the ceiling: he is refused, and not charged
for (let i = 0; i < 40 && (c2.staffPeople?.physio?.tier ?? 0) < 3; i++) sit()
if ((c2.staffPeople?.physio?.tier ?? 0) < 3) bad('forty sittings and no gold badge')
const goldPurse = c2.clubs[c2.userClubId].balance
const refusal = sendToCourse(c2, 'physio')
if (!/gold badge/i.test(refusal)) bad(`a gold-badged man was not turned away: ${refusal}`)
if (c2.clubs[c2.userClubId].balance !== goldPurse) bad('a refused course still took the fee')
const after = c2.staffPeople?.physio?.tier ?? 0
const verdict = c2.news.filter(n => n.subject.includes('badge')).map(n => n.subject)
console.log(`physio tier ${before2} -> ${after}; news: ${verdict.join(' / ')}`)
if (!verdict.length) bad('no course verdict news')
if (c2.staff.physio !== after) bad('staff level out of step with tier after the course')

// 5. the pass rate really is 58%
//
// The gate is deterministic on (seed, week, role), so this samples ACROSS WEEKS
// as well as seeds. Sampling one week across seeds is one slice of a hash and
// reads a few points off; spreading the sittings over a season measures the
// gate rather than a corner of it.
//
// The seven-week wait that used to sit in this loop is gone. It was there when a
// course took six weeks to resolve; now the verdict lands inside the call, and
// advancing the world afterwards only gave a season rollover the chance to
// replace the man and confuse the count.
//
// EVERY ROLE IN EACH WORLD, 300 WORLDS (28 Sep 2026), not the assistant alone
// in 900. The gate reads (seed, week, role), so each role in a world is its
// own draw: about 2,100 sittings for a third of the worlds. At 900 the rate's
// standard error was 1.6 points against a band of 4 (2.4 of them); at 2,100
// it is 1.1 (3.7), and the probe spends a minute less building worlds.
let pass = 0, n = 0
const ROLES = Object.keys(STAFF_INFO) as StaffRole[]
for (let seed = 1; seed <= 300; seed++) {
  const t = newGame('leicester', 'Rate', seed)
  t.clubs[t.userClubId].balance = 9_000_000
  ROLES.forEach((role, ri) => {
    t.week = 1 + ((seed + ri * 7) % 20)          // spread the sittings across the season
    if (!t.staffPeople?.[role]) {
      const i = staffCandidates(t, role).findIndex(c => c.tier < 3 && staffInterest(t, c) !== 'no')
      if (i < 0) return
      appointStaff(t, role, i)
    }
    const person = t.staffPeople?.[role]
    if (!person || person.tier >= 3 || person.retakeAt != null) return
    const tier0 = person.tier
    sendToCourse(t, role)
    n++
    if ((t.staffPeople?.[role]?.tier ?? 0) > tier0) pass++
  })
}
const pct = (pass / n) * 100
console.log(`course pass rate over ${n} sittings: ${pct.toFixed(1)}% (target ${EXAM_PASS_PCT}%)`)
if (Math.abs(pct - EXAM_PASS_PCT) > 4) bad(`pass rate ${pct.toFixed(1)}% is off target`)

if (fails) { console.error(`STAFF PROBE: ${fails} failures`); process.exit(1) }
console.log('STAFF PROBE PASSED')
