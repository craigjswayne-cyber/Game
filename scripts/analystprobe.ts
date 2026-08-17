// Probe: the analyst's read - accuracy scales with the suite and the assistant,
// following a sound read helps on the day, and it is never a guarantee.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { weekRng } from '../src/game/season'
import { analystRead, analystSkill, rollIsRight, settleAnalyst } from '../src/game/analyst'

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
let recRight = 0, recWrong = 0
// THIS TEST HAS NOW BEEN WRONG TWICE, IN THE SAME DIRECTION, ABOUT THE SAME
// NUMBER - and both times the analyst was calibrated all along.
//
// Version 1 held ~39 reads from one career to a flat +/-0.18 band (a coin
// flip; it duly tipped during Pass 2). Version 2 pooled four careers and held
// ~170 reads to a 2-SE binomial band - which assumes 170 INDEPENDENT draws,
// and they are not. The read's roll is hash(seed, week, opponent):
// deterministic constants. The four worlds are fixed seeds and the schedule
// comes from newGame, so every run samples the SAME frozen panel, whose
// realized accuracy is whatever those particular hashes happen to be.
// Measured across 2,000 synthetic careers, frozen per-career accuracy spans
// 46% to 70% (p5-p95) around a true 58%. The panel only shifts when an
// engine change reshuffles careers (a facility upgrade lands a week later, a
// skill threshold moves), and then the pooled number JUMPS: it went from
// +5.1 over target to +7.7 - past the 2-SE bar of 7.5 - the week the
// garbage-time batch shipped, with the roll mechanism untouched.
//
// So the CALIBRATION assert is now the direct one (block 3b): the roll
// itself, over 270,000 synthetic triples, a property the engine owns and one
// that actually converges. The career walk below keeps only a WIDE sanity
// band whose job is catching inverted wiring (right/wrong swapped reads
// ~42%, sixteen points off) - because frozen-panel luck legitimately
// reaches nine.
let expSum = 0
const WORLDS: [string, number][] = [
  ['leicester', 909], ['bath', 31], ['toulouse', 8080], ['leinster', 555],
]
for (const [wclub, wseed] of WORLDS) {
  const t = newGame(wclub, 'Analyst Probe', wseed)
  const tc = t.clubs[t.userClubId]
  tc.facilities = { ...(tc.facilities ?? {}), briefing: 3 }
  t.staff.assistant = 2
  for (let i = 0; i < 60; i++) {
    const f = userFixtureThisWeek(t)
    if (f) {
      const opp = f.homeId === t.userClubId ? f.awayId : f.homeId
      const r = analystRead(t, opp)
      if (r) { n++; expSum += analystSkill(t); if (r.right) right++ }
      t.matchPrep = r?.prep
      simMatch(t, f, weekRng(t), false)
      if (r) settleAnalyst(t, opp)
    }
    processWeekAndAdvance(t)
  }
  // the followed-read ledger is per career, so it pools like everything else
  recRight += t.analystRecord?.right ?? 0
  recWrong += t.analystRecord?.wrong ?? 0
}
const target = expSum / n
console.log(`accuracy over ${n} reads in ${WORLDS.length} careers: ${((right / n) * 100).toFixed(1)}% (skill those reads were rolled against ${(target * 100).toFixed(1)}%)`)
if (n < 100) bad(`only ${n} reads across ${WORLDS.length} careers`)
const off = Math.abs(right / n - target)
console.log(`  off by ${(off * 100).toFixed(1)} points (frozen-panel sanity band 12; calibration is asserted on the roll itself below)`)
if (off > 0.12) bad('career accuracy is so far from skill the wiring must be inverted')

// 3b. THE CALIBRATION ASSERT: the roll itself is fair. 500 seeds x 45 weeks
// x 12 opponents = 270,000 triples through the exact function analystRead
// rolls with. For a given hash this is a CONSTANT, so the band is tight and
// it moves only if someone moves the mechanism.
{
  const OPPS = ['leicester', 'bath', 'toulouse', 'leinster', 'saracens', 'sale',
    'quins', 'bristol', 'exeter', 'gloucester', 'tigers', 'northampton']
  const SKILL = 0.58
  let below = 0, total = 0
  for (let seed = 1; seed <= 500; seed++) {
    for (let abs = 1; abs <= 45; abs++) {
      for (const o of OPPS) { total++; if (rollIsRight(seed, abs, o, SKILL)) below++ }
    }
  }
  const frac = below / total
  console.log(`the roll, measured directly: ${(frac * 100).toFixed(2)}% right over ${total} triples (intended ${(SKILL * 100).toFixed(0)}%)`)
  if (Math.abs(frac - SKILL) > 0.01) bad('the roll mechanism itself is off its intended rate')
}
if (right === n) bad('every read was right - it is meant to be a judgement, not a certainty')
console.log(`record followed: right ${recRight}, wrong ${recWrong}`)
if (recRight + recWrong !== n) bad(`record counted ${recRight + recWrong} of ${n} followed reads`)

// 4. following a sound read is worth something on the day.
//
// This used to compare ONE fixture per seed across forty seeds and assert a strict
// inequality on the aggregate margin. That cannot work: a match margin has a
// standard deviation around fifteen points, so thirty paired samples cannot resolve
// an effect worth a couple of points a game. It read 359 against 429 and called it
// a failure, and it would have read the reverse just as easily on another seed set.
//
// Worse, while it was noisy it was also right, and the noise hid why: matchPrep
// handed out the same flat bonus whether the analyst's read was sound or nonsense,
// so the opponent's real soft spot never entered the match. The whole system -
// briefing room, assistant, accuracy model, followed ledger - was decoration.
//
// Now it plays a full season in each arm, same seed, same squad, same fixtures:
// one manager follows every sound read, the other always preps fitness. Twenty-odd
// fixtures a season across twelve seeds is enough paired evidence to see a real
// effect of this size, and the assertion is on the SIGN of the mean, not on one
// aggregate that a single blowout can flip.
{
  const seasons: number[] = []
  for (let seed = 1; seed <= 12; seed++) {
    const margin: Record<string, number> = {}
    for (const follow of ['follow', 'ignore']) {
      const w = newGame('leicester', 'Edge', seed * 31)
      const wc = w.clubs[w.userClubId]
      wc.facilities = { ...(wc.facilities ?? {}), briefing: 5 }
      w.staff.assistant = 3
      let total = 0
      for (let i = 0; i < 34; i++) {
        const f = userFixtureThisWeek(w)
        if (f) {
          const opp = f.homeId === w.userClubId ? f.awayId : f.homeId
          const r = analystRead(w, opp)
          w.matchPrep = follow === 'follow' && r?.right ? r.prep : 'fitness'
          simMatch(w, f, weekRng(w), false)
          const mine = f.homeId === w.userClubId ? f.homeScore : f.awayScore
          const theirs = f.homeId === w.userClubId ? f.awayScore : f.homeScore
          total += mine - theirs
          if (r) settleAnalyst(w, opp)
        }
        processWeekAndAdvance(w)
      }
      margin[follow] = total
    }
    seasons.push(margin.follow - margin.ignore)
  }
  const mean = seasons.reduce((a, b) => a + b, 0) / seasons.length
  const better = seasons.filter(d => d > 0).length
  console.log(`season margin, following sound reads minus ignoring them: mean ${mean.toFixed(1)} ` +
    `over ${seasons.length} seasons, ahead in ${better} of them`)
  if (mean <= 0) bad(`following sound reads is worth ${mean.toFixed(1)} points a season - the read does nothing`)
  if (better <= seasons.length / 2) bad(`following sound reads won only ${better} of ${seasons.length} seasons`)
}

if (fails) { console.error(`ANALYST PROBE: ${fails} failures`); process.exit(1) }
console.log('ANALYST PROBE PASSED')
