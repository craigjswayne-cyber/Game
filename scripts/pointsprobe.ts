/**
 * ---- THE STORIES A CLUB HAS TO ANSWER FOR ----
 *
 * Owner, 7 Sep: "check rugby news for inspiration for talking points - ugly away
 * kit launch, advertising campaign goes viral for wrong reasons, low ticket
 * sales causing pressure, new breakout league threatened (doesn't ever happen)
 * rival coaches leak information about your team, playes get injured on
 * international duty occasionally."
 *
 * The wire in gossip.ts already tells jokes about other clubs. These are about
 * YOURS, and the thing worth probing is that each one DOES something - the
 * board's confidence, the bank, the mood, or the next match. A story with no
 * consequence is set dressing, and set dressing is what this was meant not to
 * be.
 *
 * Two of the six get special treatment here. The breakaway must never actually
 * happen, because the owner said so in brackets and because it never does. And
 * the international injuries were already in the game before he asked - a Test
 * runs through the same engine as a league match - so the probe proves that
 * rather than pretending something new was built.
 */
import { newGame } from '../src/game/newgame'
import { autoSelect } from '../src/game/matchEngine'
import { processWeekAndAdvance } from '../src/game/season'
import { talkingPoints, fillRate, prepLeaked } from '../src/game/talkingpoints'
import { SEASON_WEEKS } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const seen = (g: ReturnType<typeof newGame>, k: string) => g.news.some(n => n.k === k)

// ---- 1. they fire, across a season ---------------------------------------
console.log('--- 1. a season of talking points')
// CAPTURED WEEK BY WEEK, because the inbox is pruned: a story that lands in
// week 1 is long gone by week 48, so reading state.news at the end of a season
// answers "what is still in the inbox", not "what happened". The first version
// of this asked the wrong question and reported one story where there were four.
//
// BY ID, NOT BY LENGTH (28 Sep 2026). The capture used to be
// news.slice(lengthBefore), which is exactly the window contractclock warns
// about: once the log reaches NEWS_KEEP (250, about week 29 at eight or nine
// stories a week) the trim holds its length at 250, slice(250) is empty, and
// the last twenty weeks of the season were never read at all. A talking point
// that fired twice after Christmas would have passed "never twice".
const newStories = (st: ReturnType<typeof newGame>, ids: Set<number>) =>
  st.news.filter(n => !ids.has(n.id) && (ids.add(n.id), true))
const g = newGame('bath', 'Test', 4242)
const tally = new Map<string, number>()
const gIds = new Set(g.news.map(n => n.id))
for (let i = 0; i < SEASON_WEEKS; i++) {
  processWeekAndAdvance(g)
  for (const n of newStories(g, gIds)) {
    if (n.k?.startsWith('point.')) tally.set(n.k, (tally.get(n.k) ?? 0) + 1)
  }
}
console.log(`     fired in one season: ${[...tally.keys()].map(k => k.replace('point.', '')).join(', ') || 'none'}`)
ok(tally.size >= 3, `most of them land in any given year (${tally.size} of 5)`)
for (const [k, n] of tally) {
  ok(n <= 1, `${k.replace('point.', '')} fired ${n} time(s) - never twice in a season`)
}

// ---- 2. the kit, and what it does ----------------------------------------
console.log('\n--- 2. the away kit sells BECAUSE it is mocked')
const k1 = newGame('bath', 'Test', 7)
const balBefore = k1.clubs[k1.userClubId].balance
const moodBefore = k1.fanMood ?? 60
k1.week = 2
talkingPoints(k1)
ok(seen(k1, 'point.awaykit'), 'the launch lands in preseason')
ok(k1.clubs[k1.userClubId].balance > balBefore, 'the shop takes money')
ok((k1.fanMood ?? 60) < moodBefore, 'and the supporters are not delighted')

// ---- 3. the advert: exposure is exposure ---------------------------------
console.log('\n--- 3. the campaign that went wrong for the sponsor\'s benefit')
let advertSeen = false
for (let s = 0; s < 8 && !advertSeen; s++) {
  const a = newGame('bath', 'Test', 100 + s)
  for (let w = 8; w <= 30; w++) {
    a.week = w
    const before = a.clubs[a.userClubId].balance
    const mood = a.fanMood ?? 60
    talkingPoints(a)
    if (seen(a, 'point.advert')) {
      advertSeen = true
      ok(a.clubs[a.userClubId].balance > before, 'the sponsor pays for the exposure')
      ok((a.fanMood ?? 60) < mood, 'and the terraces pay for it too')
      break
    }
  }
}
ok(advertSeen, 'the advert story is reachable')

// ---- 4. LOW TICKET SALES, WHICH IS THE ONE WITH TEETH --------------------
console.log('\n--- 4. an empty ground is a board matter')
// TWO IDENTICAL WORLDS, ONE WITH A GROUND NOBODY CAN FILL. That is the only
// honest way to read the cost: the story fires somewhere inside the season, so
// sampling confidence afterwards and comparing it with itself measures nothing,
// which is exactly what the first version of this did.
//
// A MANAGER WHO IS STILL IN THE JOB. Nobody picks this side, and an unmanaged
// Bath loses its manager by week 30 in about half of all worlds, full ground or
// not (six seeds read 53/12/0/9/49/25 confidence before 1.7.3's ageing and
// 0/1/7/0/57/40 after). Seed 11 was one of the survivors until ageing moved it;
// a sacked manager is at zero in both worlds and the comparison reads nothing.
// So the world is the first of a few in which the full ground keeps him.
// A MANAGER WHO PICKS HIS SIDE (1.8.14). The balance round made a stranger's
// first season at a big club harder, and an unmanaged Bath's board now sits
// near the floor in every world, full ground or empty, which measures the
// sackings and not the gates. He names his best fit XV each week, as anybody
// actually in the job would; the two worlds still differ only in the ground.
const pickXV = (g: ReturnType<typeof newGame>) => {
  const c = g.clubs[g.userClubId]
  const pool = c.players.map(id => g.players[id]).filter(p => p && !p.injury && p.bans === 0 && !p.onLoan && !p.natSquad && !p.acad)
  if (pool.length >= 23) { c.tactic.lineup = autoSelect(g, pool as any, c.tactic?.split); c.tactic.userPicked = true }
}
const run = (capacity: number, seed: number) => {
  const s2 = newGame('bath', 'Test', seed)
  s2.clubs[s2.userClubId].capacity = capacity
  for (let i = 0; i < 30; i++) { pickXV(s2); processWeekAndAdvance(s2) }
  return s2
}
const WORLDS = [11, 15, 16, 12]
let seed4 = WORLDS[0]
let f = run(1_000, seed4)    // a ground that cannot help selling out
for (const sd of WORLDS.slice(1)) {
  if (f.clubs[f.userClubId].boardConfidence >= 30) break
  seed4 = sd; f = run(1_000, sd)
}
const t = run(60_000, seed4)   // a ground that cannot be filled
console.log(`     world ${seed4}`)
console.log(`     empty ground ${Math.round(fillRate(t) * 100)}% full, board confidence ${t.clubs[t.userClubId].boardConfidence.toFixed(1)}`)
console.log(`     full ground  ${Math.round(fillRate(f) * 100)}% full, board confidence ${f.clubs[f.userClubId].boardConfidence.toFixed(1)}`)
ok(seen(t, 'point.tickets'), 'the board raises it when the ground is empty')
ok(!seen(f, 'point.tickets'), 'and never when the club is selling out')
// AVERAGED OVER THE FOUR WORLDS (1.8.0, 28 Sep 2026). One world compared
// 30 weeks of results as much as it compared two grounds: the two-layer
// engine moved the stream and the single world read 34.9 against 34.5 the
// wrong way round. The claim is the same; the evidence is four worlds.
const conf = (g: ReturnType<typeof run>) => g.clubs[g.userClubId].boardConfidence
let emptySum = 0, fullSum = 0
for (const sd of WORLDS) { emptySum += conf(run(60_000, sd)); fullSum += conf(run(1_000, sd)) }
console.log(`     over ${WORLDS.length} worlds: empty ground confidence ${(emptySum / WORLDS.length).toFixed(1)}, full ground ${(fullSum / WORLDS.length).toFixed(1)}`)
ok(emptySum < fullSum,
  'the empty ground costs the manager standing, not just words')

// ---- 5. THE BREAKAWAY NEVER HAPPENS -------------------------------------
console.log('\n--- 5. "(doesn\'t ever happen)"')
const b = newGame('bath', 'Test', 4242)
const compsBefore = Object.keys(b.comps).length
// COUNTED AS THEY LAND, not read off state.news at the end.
//
// The first version walked five seasons and then filtered the inbox, and
// reported one collapse with no threat in front of it. The engine was right:
// both stories fired, five weeks apart, in every one of the five seasons. The
// INBOX was wrong, because season.ts trims state.news to NEWS_KEEP and five
// seasons is far more news than that - so the threat had been swept out from
// under the ending it belonged to.
//
// A probe that reads a capped buffer at the end of a long run is measuring the
// cap. Anything counted over more than a season or two has to be counted as it
// happens.
let threats = 0, ends = 0
// (By id, for the reason given in section 1: slicing from the old length
// read nothing at all once the log hit its cap, so this counted the first
// twenty-nine weeks of five seasons and then went blind.)
const bIds = new Set(b.news.map(n => n.id))
for (let s = 0; s < 5; s++) {
  for (let i = 0; i < SEASON_WEEKS; i++) {
    processWeekAndAdvance(b)
    for (const n of newStories(b, bIds)) {
      if (n.k === 'point.breakaway') threats++
      if (n.k === 'point.breakawayEnd') ends++
    }
  }
}
console.log(`     five seasons: ${threats} threat(s), ${ends} collapse(s)`)
ok(ends <= threats, 'it never collapses without having been threatened first')
ok(Object.keys(b.comps).length <= compsBefore + 2,
  'and no breakaway competition ever appears in the world - it does not happen')
ok(!Object.values(b.comps).some(c => /breakaway|rebel|super league/i.test(c.name)),
  'not one competition is named after it')

// ---- 6. the leak reaches the pitch --------------------------------------
console.log('\n--- 6. somebody talked, and the next side had read it')
const l = newGame('bath', 'Test', 3)
ok(!prepLeaked(l), 'no leak by default')
l.leaked = l.week
ok(prepLeaked(l), 'a leak this week is live')
l.week += 1
ok(!prepLeaked(l), 'and it is spent by the following week - it is one match, not a curse')
// AND THROUGH THE REAL WEEK (1.8.1). The story is told after the week's
// fixtures, so it has to be live at the NEXT kick-off. It was stamped with the
// week it was told in, which had already been played, and the penalty in
// beginMatch never fired in any career.
{
  // one story a week at most (talkingPoints), so a season can lose its leak
  // to another story: the first of a few Bath careers that tells it
  let toldIn = -1, liveNext = false
  for (const seed of [5, 3, 11, 17, 23]) {
    const r = newGame('bath', 'Test', seed)
    for (let i = 0; i < SEASON_WEEKS && toldIn < 0; i++) {
      const before = r.news.length
      processWeekAndAdvance(r)
      if (r.news.slice(before).some(n => n.k === 'point.leak')) { toldIn = i; liveNext = prepLeaked(r) }
    }
    if (toldIn >= 0) break
  }
  ok(toldIn >= 0, 'the leak story is told in a season')
  ok(liveNext, 'and the match after it is played against a side that has read it')
}

// ---- 7. and the internationals come home hurt ---------------------------
console.log('\n--- 7. international duty, which was already in the game')
const w = newGame('bath', 'Test', 91)
let hurtOnDuty = 0
for (let s = 0; s < 3; s++) {
  for (let i = 0; i < SEASON_WEEKS; i++) {
    const away = new Set(Object.values(w.players).filter(p => p.natSquad && !p.injury).map(p => p.id))
    processWeekAndAdvance(w)
    for (const id of away) if (w.players[id]?.injury) hurtOnDuty++
  }
}
console.log(`     three seasons: ${hurtOnDuty} players came back from a Test week injured`)
ok(hurtOnDuty > 0, 'a Test runs through the same engine as a league match, so men do come home hurt')

console.log('')
if (fails === 0) console.log('POINTS PROBE PASSED: six talking points, each of them with something behind it')
else console.log(`POINTS PROBE FAILED (${fails})`)
process.exit(fails)
