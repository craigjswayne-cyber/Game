// Probe: the national coach shapes his squad, and the country desk has the
// numbers it promises.
//
// User, on the international element: "its meant to be the pinnacle but is
// hidden away... lets build it all." Four claims:
//
//   1. While a window is open, the coach can DROP a name and CALL UP the next
//      man - under the federation's rules: the squad is capped at the window
//      size, never trimmed below 23, the injured and the unattached refused,
//      and every change voids the old Test XV so match day repicks from the
//      room that actually exists.
//   2. Between windows there is nothing to shape - call-ups are refused.
//   3. The tenure keeps its own Test record: a played Test lands on
//      state.natRecord, not just the manager's combined ledger.
//   4. The country's press want the national coach during a window, and what
//      he says moves the UNION's confidence, not the club board's.
//
// Second wave (user: "there should be no age limits or restrictions on who
// should be picked" / "your international record still stays on your
// profile"):
//
//   5. The eligible list is the WHOLE qualified population - no cap, no
//      rating floor - and a loanee or a free agent is the coach's call, not
//      the game's refusal.
//   6. The user's own federation names its best REAL players whatever their
//      rating: a nation of 60-rated pros gets its own men called, not a
//      squad of generated stand-ins.
//   7. Leaving the job moves the Test record to the profile's permanent
//      history instead of the bin.
import { newGame } from '../src/game/newgame'
import { natFixtureThisWeek, processWeekAndAdvance, userMatchThisWeek } from '../src/game/season'
import { natCallUp, natDrop, natEligible, natWindow, NAT_SQUAD_FLOOR } from '../src/game/country'
import { answerPress, generatePress } from '../src/game/media'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState } from '../src/game/model'
// namespace lookup, not a named import: on the old code the export does not
// exist, and a missing named import would kill the whole run at load time -
// this way the old-code demonstration shows every red on its own line
import * as M from '../src/game/model'
const closeNatTenure = (M as { closeNatTenure?: (s: GameState) => void }).closeNatTenure

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'CountryDesk', 61)
g.natTeam = 'SCO'
g.natConfidence = 60
g.natRecord = { m: 0, w: 0, d: 0, l: 0 }

// ---- 2. between windows: nothing to shape ----
ok(natWindow(g) == null, `no window open at week ${g.week}`)
const anyone = Object.values(g.players).find(p => p.nat === 'SCO' && p.clubId && !p.injury && !p.natSquad)!
const early = natCallUp(g, anyone.id)
ok(early != null, `between windows the call-up is refused ("${early}")`)

// ---- walk into an open window ----
for (let i = 0; i < 60 && !g.natSquads['SCO']; i++) processWeekAndAdvance(g)
const squad = g.natSquads['SCO']!
ok(!!squad && squad.length > 0, `a window opened and the federation named ${squad?.length} men (wk${g.week})`)
const w = natWindow(g)!
ok(!!w, 'natWindow reports the window open')

// ---- 1a. drop, to the floor and not through it ----
const beforeDrops = squad.length
let dropped = 0
let floorMsg: string | null = null
while (true) {
  const victim = g.players[squad[squad.length - 1]]
  const moraleBefore = victim.morale
  const r = natDrop(g, victim.id)
  if (r != null) { floorMsg = r; break }
  dropped++
  ok(!squad.includes(victim.id), `dropped ${victim.name} - out of the squad`)
  ok(victim.natSquad === false, 'his window flag cleared')
  ok(victim.morale <= moraleBefore, `being sent home stung (${moraleBefore.toFixed(1)} -> ${victim.morale.toFixed(1)})`)
  if (dropped > 10) break
}
ok(squad.length === NAT_SQUAD_FLOOR, `the squad stops at the floor of ${NAT_SQUAD_FLOOR} (${beforeDrops} -> ${squad.length})`)
ok(floorMsg != null && floorMsg.includes(String(NAT_SQUAD_FLOOR)), `the refusal names the floor ("${floorMsg}")`)

// ---- 1b. the Test XV is voided by a squad change ----
g.natLineup = { team: 'SCO', lineup: squad.slice(0, 15) }
const backIn = natEligible(g)[0]
ok(!!backIn && !backIn.natSquad, `the next man in is waiting (${backIn?.name})`)
const callRes = natCallUp(g, backIn.id)
ok(callRes == null, 'the call-up goes through')
ok(squad.includes(backIn.id) && backIn.natSquad === true, 'he is in the room with the flag on')
ok(g.natLineup == null, 'the old Test XV is voided - match day repicks from the real room')

// ---- 1c. the cap holds, and the unfit are refused ----
while (squad.length < w.size) {
  const next = natEligible(g)[0]
  if (!next || natCallUp(g, next.id) != null) break
}
ok(squad.length === w.size, `filled back to the federation cap of ${w.size}`)
const over = natEligible(g)[0]
const capMsg = over ? natCallUp(g, over.id) : 'no eligible player left'
ok(capMsg != null && capMsg.includes(String(w.size)), `the cap is enforced and named ("${capMsg}")`)
const crock = Object.values(g.players).find(p => p.nat === 'SCO' && p.clubId && p.injury && !p.natSquad)
if (crock) {
  const r = natDrop(g, squad[squad.length - 1]) // make room first
  ok(r == null, 'made room for the medical test')
  const injMsg = natCallUp(g, crock.id)
  ok(injMsg != null && injMsg.toLowerCase().includes('injur'), `the injured are refused ("${injMsg}")`)
} else {
  console.log('  --  no injured Scot to test the medical refusal this walk')
}

// ---- 5. no velvet rope on the call-up list ----
const everyQualified = Object.values(g.players).filter(p =>
  p.nat === 'SCO' && !p.injury && !p.natSquad).length
const wholePool = natEligible(g)
ok(wholePool.length === everyQualified,
  `the eligible list is the whole qualified population, uncapped (${wholePool.length} of ${everyQualified})`)
ok(wholePool.length > 12, `and it runs past the old dozen (${wholePool.length} names)`)
ok(wholePool.some(p => p.ca < 68 || p.age <= 21),
  'young and low-rated names are on the list, not behind a floor')
// a loanee is the coach's call
ok(natDrop(g, squad[squad.length - 1]) == null, 'made room for the loanee')
const loanee = wholePool.filter(p => !p.natSquad)[0]
loanee.onLoan = true
ok(natCallUp(g, loanee.id) == null, `a player out on loan can still be picked (${loanee.name})`)
// so is a man with no club
ok(natDrop(g, squad[squad.length - 1]) == null, 'made room for the free agent')
const fa = natEligible(g)[0]
fa.clubId = null
ok(natCallUp(g, fa.id) == null, `a free agent can still be picked (${fa.name})`)

// ---- 3. a played Test lands on the tenure's own record ----
// an open window usually means a real Test already stands this week - use
// it; stage a synthetic one only when the calendar is bare
let test = natFixtureThisWeek(g)
if (!test) {
  const synth: Fixture = {
    id: 950_002, compId: 'sn', round: 1, week: g.week, homeId: 'SCO', awayId: 'ENG',
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
  }
  g.fixtures.push(synth)
  test = synth
}
const mine = userMatchThisWeek(g)
ok(mine?.id === test.id, 'the Test is his match this week')
// his side wins, whichever shirt and whichever end of the fixture
const mineHome = test.homeId === 'SCO' || test.homeId === 'LIO'
test.played = true
test.homeScore = mineHome ? 27 : 13; test.awayScore = mineHome ? 13 : 27
test.homeTries = mineHome ? 3 : 1; test.awayTries = mineHome ? 1 : 3
const recBefore = { ...g.natRecord! }
processWeekAndAdvance(g)
ok(g.natRecord!.m === recBefore.m + 1 && g.natRecord!.w === recBefore.w + 1,
  `the tenure record counts the win (${recBefore.w}W -> ${g.natRecord!.w}W of ${g.natRecord!.m})`)

// ---- 4. the window press beat moves the union, not the board ----
// a fresh state with the window staged, so the walk above cannot bleed in
const h = newGame('northampton', 'CountryPress', 62)
h.natTeam = 'SCO'
h.natConfidence = 60
for (let i = 0; i < 60 && !h.natSquads['SCO']; i++) processWeekAndAdvance(h)
let item: (typeof h.press)[number] | undefined
for (let seed = 1; seed <= 300 && !item; seed++) {
  h.press = []
  h.natCoachAskAt = undefined
  generatePress(h, mulberry32(seed))
  item = h.press.find(q => q.options.some(o => o.natConf))
}
ok(!!item, `the country's press raise the window (${item ? `"${item.question.slice(0, 60)}..."` : 'never asked in 300 rooms'})`)
if (item) {
  const bold = item.options.findIndex(o => (o.natConf ?? 0) > 0)
  const confBefore = h.natConfidence!
  const boardBefore = h.clubs[h.userClubId].boardConfidence
  answerPress(h, item.id, bold)
  ok(h.natConfidence! > confBefore, `backing the squad moves the union (${confBefore} -> ${h.natConfidence})`)
  ok(h.clubs[h.userClubId].boardConfidence === boardBefore, 'and leaves the club board where it was')
}

// ---- 6. the user's federation has no rating floor of its own ----
// make every club Scot a 60-rated pro: the old build's ca >= 68 floor would
// find nobody real and fill the room with generated stand-ins instead
const g2 = newGame('northampton', 'NoFloor', 63)
g2.natTeam = 'SCO'
g2.natConfidence = 60
let realScots = 0
for (const p of Object.values(g2.players)) {
  if (p.nat === 'SCO' && p.clubId && !p.injury && !p.onLoan) { p.ca = 60; realScots++ }
}
for (let i = 0; i < 60 && !g2.natSquads['SCO']; i++) processWeekAndAdvance(g2)
const sq2 = (g2.natSquads['SCO'] ?? []).map(id => g2.players[id]).filter(Boolean)
const realCalled = sq2.filter(p => p.clubId).length
ok(realCalled >= Math.min(realScots, NAT_SQUAD_FLOOR),
  `a nation of 60-rated pros still gets its own men called (${realCalled} real in a squad of ${sq2.length}, ${realScots} in the game)`)

// ---- 7. the record survives the job ----
const before7 = { ...g.natRecord! }
ok(typeof closeNatTenure === 'function', 'closeNatTenure exists - one door for both exits')
closeNatTenure?.(g)
ok(g.natTeam == null && g.natRecord == null, 'the live tenure fields clear on the way out')
const hist = g.natHistory ?? []
const last = hist[hist.length - 1]
ok(!!last && last.nat === 'SCO' && last.m === before7.m && last.w === before7.w,
  `the Test record moved to the profile's history (${last ? `${last.nat} ${last.w}W ${last.d}D ${last.l}L of ${last.m}` : 'nothing archived'})`)

console.log(fails ? `\nCOUNTRY PROBE FAILED (${fails})` : '\nCOUNTRY PROBE PASSED: the pinnacle has a desk of its own')
process.exit(fails ? 1 : 0)
