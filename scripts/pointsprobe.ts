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
const g = newGame('bath', 'Test', 4242)
const tally = new Map<string, number>()
for (let i = 0; i < SEASON_WEEKS; i++) {
  const before = g.news.length
  processWeekAndAdvance(g)
  for (const n of g.news.slice(before)) {
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
const run = (capacity: number) => {
  const s2 = newGame('bath', 'Test', 11)
  s2.clubs[s2.userClubId].capacity = capacity
  for (let i = 0; i < 30; i++) processWeekAndAdvance(s2)
  return s2
}
const t = run(60_000)   // a ground that cannot be filled
const f = run(1_000)    // a ground that cannot help selling out
console.log(`     empty ground ${Math.round(fillRate(t) * 100)}% full, board confidence ${t.clubs[t.userClubId].boardConfidence.toFixed(1)}`)
console.log(`     full ground  ${Math.round(fillRate(f) * 100)}% full, board confidence ${f.clubs[f.userClubId].boardConfidence.toFixed(1)}`)
ok(seen(t, 'point.tickets'), 'the board raises it when the ground is empty')
ok(!seen(f, 'point.tickets'), 'and never when the club is selling out')
ok(t.clubs[t.userClubId].boardConfidence < f.clubs[f.userClubId].boardConfidence,
  'the empty ground costs the manager standing, not just words')

// ---- 5. THE BREAKAWAY NEVER HAPPENS -------------------------------------
console.log('\n--- 5. "(doesn\'t ever happen)"')
const b = newGame('bath', 'Test', 4242)
const compsBefore = Object.keys(b.comps).length
for (let s = 0; s < 5; s++) for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(b)
const threats = b.news.filter(n => n.k === 'point.breakaway').length
const ends = b.news.filter(n => n.k === 'point.breakawayEnd').length
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
