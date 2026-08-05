// Probe: the analyst's read - accuracy scales with the suite and the assistant,
// following a sound read helps on the day, and it is never a guarantee.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { weekRng } from '../src/game/season'
import { analystRead, analystSkill, settleAnalyst } from '../src/game/analyst'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

// 1. skill tracks the analysis suite and the assistant coach
const g = newGame('leicester', 'Analyst Probe', 4242)
const club = g.clubs[g.userClubId]
club.facilities = { ...(club.facilities ?? {}), briefing: 0 }
g.staff.assistant = 0
const low = analystSkill(g)
club.facilities = { ...(club.facilities ?? {}), briefing: 5 }
g.staff.assistant = 3
const high = analystSkill(g)
console.log(`skill: bare club ${(low * 100).toFixed(0)}%, level-5 suite + gold assistant ${(high * 100).toFixed(0)}%`)
if (!(high > low + 0.3)) bad('the analysis suite barely matters')
if (high > 0.95) bad('the analyst is effectively never wrong')

// 2. the read is stable on revisit, and names a unit with a recommendation
const fx = userFixtureThisWeek(g)!
const oppId = fx.homeId === g.userClubId ? fx.awayId : fx.homeId
const r1 = analystRead(g, oppId)!
const r2 = analystRead(g, oppId)!
if (JSON.stringify(r1) !== JSON.stringify(r2)) bad('the read changes when you look again')
console.log(`read: ${r1.unit} -> prep ${r1.prep} (${r1.right ? 'sound' : 'wrong'}) - ${r1.claim}`)
if (!r1.claim || !r1.prep) bad('read missing claim or recommendation')

// 3. accuracy over many weeks lands near the skill number
let right = 0, n = 0
const t = newGame('leicester', 'Analyst Probe', 909)
const tc = t.clubs[t.userClubId]
tc.facilities = { ...(tc.facilities ?? {}), briefing: 3 }
t.staff.assistant = 2
const target = analystSkill(t)
for (let i = 0; i < 60; i++) {
  const f = userFixtureThisWeek(t)
  if (f) {
    const opp = f.homeId === t.userClubId ? f.awayId : f.homeId
    const r = analystRead(t, opp)
    if (r) { n++; if (r.right) right++ }
    t.matchPrep = r?.prep
    simMatch(t, f, weekRng(t), false)
    if (r) settleAnalyst(t, opp)
  }
  processWeekAndAdvance(t)
}
console.log(`accuracy over ${n} reads: ${((right / n) * 100).toFixed(0)}% (skill ${(target * 100).toFixed(0)}%)`)
if (n < 20) bad(`only ${n} reads in 60 weeks`)
if (Math.abs(right / n - target) > 0.18) bad('accuracy is far from the stated skill')
if (right === n) bad('every read was right - it is meant to be a judgement, not a certainty')
const rec = t.analystRecord!
console.log(`record followed: right ${rec.right}, wrong ${rec.wrong}`)
if (rec.right + rec.wrong !== n) bad(`record counted ${rec.right + rec.wrong} of ${n} followed reads`)

// 4. following a sound read is worth something on the day
let withEdge = 0, without = 0
for (let seed = 1; seed <= 40; seed++) {
  for (const follow of [true, false]) {
    const w = newGame('leicester', 'Edge', seed)
    const wc = w.clubs[w.userClubId]
    wc.facilities = { ...(wc.facilities ?? {}), briefing: 5 }
    w.staff.assistant = 3
    const f = w.fixtures.filter(x => x.homeId === w.userClubId || x.awayId === w.userClubId)[0]
    const opp = f.homeId === w.userClubId ? f.awayId : f.homeId
    const r = analystRead(w, opp)!
    if (!r.right) continue
    w.matchPrep = follow ? r.prep : 'fitness'
    simMatch(w, f, weekRng(w), false)
    const mine = f.homeId === w.userClubId ? f.homeScore : f.awayScore
    const theirs = f.homeId === w.userClubId ? f.awayScore : f.homeScore
    if (follow) withEdge += mine - theirs; else without += mine - theirs
  }
}
console.log(`sound read followed: aggregate margin ${withEdge}; ignored: ${without}`)
if (!(withEdge > without)) bad('following a sound read did not help at all')

if (fails) { console.error(`ANALYST PROBE: ${fails} failures`); process.exit(1) }
console.log('ANALYST PROBE PASSED')
