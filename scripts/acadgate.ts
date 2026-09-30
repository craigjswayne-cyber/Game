// ---- THE AGE GATES AT THE END OF THE ACADEMY ROAD -------------------------
//
// acadprobe holds the academy as a team: 27 scholars, in shape, rotated, and
// still there a decade on. What it does not hold is the boundary, and the
// boundary is where the rules are.
//
// The rule, from the owner in v1.1.18 ("we also need an age where they need to
// either be upgraded or released... the contract should expire at age 21"):
//
//   YOUR academy    19 and under, nothing happens
//                   20, the last-academy-year notice goes out
//                   21, the development deal expires. He is promoted before
//                       that summer or he walks for nothing.
//   AI academies    22, or a CA of 62 at any age, and he graduates. Their
//                   pipelines are not run by your judgement.
//   DEMOTED seniors are not prospects at all. A man sent down by hand carries
//                   `demoted`, and the sweep must step over him - without it,
//                   demoting a 25-year-old releases him for free.
//
// The external audit of 13 Sep 2026 asked for explicit tests at 19-20, 20-21,
// release, promotion and demotion. These are five different outcomes reached
// through one loop in rollover.ts, and three of them are silent: nothing in the
// inbox says a man was NOT released.
//
// Note on the promote and demote paths: both live inline in PlayerScreen.tsx
// with no engine function behind them, so this probe sets the same flags the
// buttons set. That is a fair test of the sweep, which is what is being
// checked, and it is worth writing down that the buttons themselves are only
// reachable through the browser harnesses.
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { ACAD_CALL_WEEK, acadAdvice, acadCall, settleAcadCalls } from '../src/game/acadcall'
import { answerPress, OFFICE_OUTLET } from '../src/game/media'
import { pressBlock } from '../src/game/days'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

/** roll to the next summer, which is where the sweep lives */
function toSummer(g: GameState) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
    processWeekAndAdvance(g)
  }
}

const g = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Academy', 2727)
const club = g.clubs[g.userClubId]
const mine = () => Object.values(g.players).filter(p => p.clubId === g.userClubId)

// ---- set up one of each case, by hand, so each outcome is named -------------
const scholars = mine().filter(p => p.acad).sort((a, b) => a.id - b.id)
ok(scholars.length >= 5, `an academy to take apart (${scholars.length} scholars)`)

const [young, lastYear, expiring, promoted, spare] = scholars
young.age = 18
lastYear.age = 19        // turns 20 over the summer: the notice year
expiring.age = 20        // turns 21 over the summer: the deal expires
promoted.age = 20
spare.age = 19

// the Promote button, as PlayerScreen writes it
promoted.acad = false
promoted.demoted = false
promoted.homegrown = true

// the Demote button, on a senior nowhere near the academy age
const senior = mine().find(p => !p.acad && p.age >= 25 && p.id !== promoted.id)!
ok(!!senior, `a senior to send down (${senior?.name}, ${senior?.age})`)
senior.acad = true
senior.demoted = true
const seniorAgeBefore = senior.age

const wasScholar = new Set(scholars.map(p => p.id))
const beforeAges = new Map(Object.values(g.players).map(p => [p.id, p.age]))

toSummer(g)

// ---- 19 to 20: still here, and told ------------------------------------------
ok(lastYear.acad === true && lastYear.clubId === g.userClubId,
   `at ${lastYear.age} he is still a scholar (${lastYear.name})`)
ok(g.news.some(n => /last academy year|Last academy year/.test(n.subject)),
   'and the summer he turns 20 the inbox says the road ends next year')

// ---- 18 to 19: nothing happens, which is the point ----------------------------
ok(young.acad === true && young.clubId === g.userClubId,
   `at ${young.age} nothing happens to him at all (${young.name})`)

// ---- 20 to 21: the deal expires and he is nobody's ----------------------------
ok(expiring.acad === false, `${expiring.name} is no longer a scholar at ${expiring.age}`)
ok(expiring.clubId == null, 'his development deal expired and he belongs to no club')
ok(!club.players.includes(expiring.id), 'and he is off the squad list')
const listedAnywhere = Object.values(g.clubs).filter(c => c.players.includes(expiring.id))
ok(listedAnywhere.length === 0, `a released man is on no squad list at all (${listedAnywhere.length})`)

// ---- promoted before the summer: kept, at a professional wage -----------------
ok(promoted.clubId === g.userClubId, `${promoted.name} was promoted and is still here at ${promoted.age}`)
ok(club.players.includes(promoted.id), 'and still on the squad list')
ok(promoted.acad === false, 'and not swept back into the academy')

// ---- demoted senior: the sweep steps over him ---------------------------------
ok(senior.clubId === g.userClubId,
   `a hand-demoted ${seniorAgeBefore}-year-old is not released (${senior.name}, now ${senior.age})`)
ok(club.players.includes(senior.id), 'and keeps his place on the squad list')
ok(senior.demoted === true, 'and keeps the flag that protects him')

// ---- the rule, over the whole academy, not just the men we planted ------------
//
// The five cases above are constructed. This is the invariant behind them: after
// the summer there is no such thing as a 21-year-old on a development deal at
// your club. Whoever the manager promoted and whoever he did not, the gate
// closed on all of them.
const overage = mine().filter(p => p.acad && !p.demoted && p.age >= 21)
ok(overage.length === 0,
   `no scholar of yours is 21 or older after the summer${overage.length ? ` (${overage.map(p => `${p.name} ${p.age}`).join(', ')})` : ''}`)

// ---- and the AI's own gate, which is a different gate --------------------------
const aiScholars = Object.values(g.players).filter(p => p.acad && p.clubId && p.clubId !== g.userClubId)
const aiOverage = aiScholars.filter(p => p.age >= 22)
ok(aiOverage.length === 0,
   `no AI club is carrying a 22-year-old scholar${aiOverage.length ? ` (${aiOverage.length})` : ''}`)
// The CA gate is not the age gate and must not be tested as one. A scholar who
// crosses 62 in October is not plucked out mid-season: he graduates at the
// summer, like everyone else. Testing for "no AI scholar is 62+" fails
// immediately and for the wrong reason - 98 of them are, most straight off the
// intake. So the rule is tested the way the rule works: take the ones who are
// good enough NOW, run one more summer, and none of them should still be
// scholars on the other side of it.
const readyNow = aiScholars.filter(p => p.ca >= 62).map(p => p.id)
toSummer(g)
const stillScholars = readyNow.filter(id => g.players[id]?.acad)
ok(readyNow.length > 0, `AI scholars good enough for the first team (${readyNow.length})`)
ok(stillScholars.length === 0,
   `and a summer later not one of them is still a scholar${stillScholars.length ? ` (${stillScholars.length})` : ''}`)

// ---- a graduate is re-priced, not left on academy money -------------------------
//
// Graduating without re-pricing left a senior squad man on a development deal
// for the rest of his career. The sweep fixes it and the Promote button was
// fixed to match in 16D; both are worth holding.
const graduated = Object.values(g.players).filter(p =>
  wasScholar.has(p.id) === false && p.homegrown && p.clubId && !p.acad &&
  (beforeAges.get(p.id) ?? 99) >= 21)
const onScholarMoney = graduated.filter(p => p.wage < 1000)
ok(onScholarMoney.length === 0,
   `no graduate is still on academy money${onScholarMoney.length ? ` (${onScholarMoney.length})` : ''}`)

// ---- THE SUMMER DECISION (1.8.1) ------------------------------------------------
//
// Owner: "a yearly academy intake with a decision at the end of each season to
// sign or drop for those who join." Every summer the academy director brings
// each first-year scholar and each lad at the age gate to the office, the week
// is held until each is answered, and the answer does what its button says.
{
  const h = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Academy', 5151)
  const hc = h.clubs[h.userClubId]
  const calls = () => h.press.filter(q => !q.answered && q.options.some(o => o.acad))
  /** play to the week the questions are asked, keeping the board sweet */
  const toCallWeek = () => {
    let guard = 0
    while (!(h.week === ACAD_CALL_WEEK + 1) && guard++ < SEASON_WEEKS * 2) {
      hc.boardConfidence = Math.max(60, hc.boardConfidence)
      for (const q of h.press) if (!q.answered && !q.options.some(o => o.acad)) q.answered = true
      processWeekAndAdvance(h)
    }
  }
  const readAll = () => { for (const n of h.news) { n.read = true; n.cleared = true } }

  for (let summer = 1; summer <= 2; summer++) {
    // a lad at the gate, planted, so the second kind of call is always asked
    const gateLad = hc.players.map(id => h.players[id]).find(p => p && p.acad && !p.demoted && p.age < 20)!
    gateLad.age = 20
    toCallWeek()
    readAll()
    // the week's other questions are not what is being tested
    for (const q of h.press) if (!q.answered && !q.options.some(o => o.acad)) q.answered = true
    const owed = hc.players.map(id => h.players[id]).filter(p => acadCall(h, p))
    const asked = calls()
    ok(asked.length > 0 && asked.length === owed.length,
      `summer ${summer}: every scholar owed a decision is asked (${asked.length} of ${owed.length})`)
    const firsts = owed.filter(p => acadCall(h, p) === 'first')
    if (summer === 2) ok(firsts.length > 0, `and the first-years who joined this season are among them (${firsts.length})`)
    // three answers since 1.8.2 (room.ts): keep him, keep him and loan him
    // out for next season, or release him
    ok(asked.every(q => q.outlet === OFFICE_OUTLET && q.options.length === 3 && q.options.some(o => o.acad === 'loan') && q.qv?.adv_k),
      'each is an office question with three answers (keep, loan, release) and the director\'s advice')
    ok(pressBlock(h)?.kind === 'press', 'and the week is held until they are answered')

    // promote the gate lad, at the wage the button quoted
    const gq = asked.find(q => q.playerId === gateLad.id)!
    const gi = gq.options.findIndex(o => o.acad === 'promote')
    const quoted = gq.options[gi].acadWage!
    answerPress(h, gq.id, gi)
    ok(!gateLad.acad && gateLad.clubId === h.userClubId && gateLad.wage === quoted,
      `a promoted lad is a first-team player on the quoted ${quoted}/wk (${gateLad.wage})`)
    // release one, sign the rest
    const rest = calls()
    const goes = rest[0]
    const goner = goes ? h.players[goes.playerId!] : undefined
    if (goes) answerPress(h, goes.id, goes.options.findIndex(o => o.acad === 'release'))
    ok(!goner || (goner.clubId == null && !hc.players.includes(goner.id)), 'a released scholar leaves the club')
    const signed: number[] = []
    for (const q of calls()) {
      const i = q.options.findIndex(o => o.acad !== 'release')
      signed.push(q.playerId!)
      answerPress(h, q.id, i)
    }
    ok(signed.every(id => h.players[id]?.clubId === h.userClubId), 'every signed scholar is still here')
    ok(signed.every(id => (h.players[id]?.contractEnds ?? 0) >= h.season + 3), 'on a deal that runs past the gate')
    ok(calls().length === 0 && pressBlock(h)?.kind !== 'press', 'and once all are answered the week can turn')
    // THE AI DECIDES ITS OWN FIRST-YEARS AT THE ROLLOVER (settleAcadCalls), on
    // the director's advice as it reads at that instant. The advice is measured
    // against the club's squad, which moves week to week and again inside the
    // final tick, so advice read at any other moment is a different question:
    // checked from the call week, the probe failed on any world where one
    // borderline lad's club signed or sold somebody before the summer. So the
    // decision is taken on a copy of the save, advice and decision on the SAME
    // state, and the real career goes on through its summer untouched.
    let guard = 0
    const season = h.season
    const copy = JSON.parse(JSON.stringify(h)) as GameState
    const aiFirst = Object.values(copy.players).filter(p => p.acad && p.clubId && p.clubId !== copy.userClubId && p.acadJoined === copy.season)
    const aiDrop = aiFirst.filter(p => !acadAdvice(copy, p)).map(p => p.id)
    settleAcadCalls(copy)
    while (h.season === season && guard++ < 10) processWeekAndAdvance(h)
    ok(gateLad.clubId === h.userClubId && !gateLad.acad, 'the promoted lad is still here after the summer sweep')
    // (the academies a new world starts with were never an intake, so the
    // first summer has no first-years anywhere; the second has a full year's)
    if (summer === 2) ok(aiFirst.length > 0, `AI academies had first-years to decide (${aiFirst.length}, ${aiDrop.length} advised away)`)
    ok(aiDrop.every(id => copy.players[id]?.clubId == null || !copy.players[id]?.acad),
      `the AI released the ${aiDrop.length} its director advised it to`)
    ok(hc.players.map(id => h.players[id]).some(p => p && p.acad && p.acadJoined === h.season),
      'and a new intake has joined, stamped with the season it joined')
    const noIntake = Object.values(h.clubs).filter(c =>
      !c.players.some(id => h.players[id]?.acad && h.players[id]?.acadJoined === h.season))
    ok(noIntake.length === 0, `every club in the world took an intake this summer${noIntake.length ? ` (missing: ${noIntake.map(c => c.id).join(', ')})` : ''}`)
  }
}

console.log(fails
  ? `\nACADEMY GATE FAILED (${fails})`
  : '\nACADEMY GATE PASSED: 19 stays, 20 is warned, 21 walks, and a demoted man is not a prospect')
process.exit(fails ? 1 : 0)
