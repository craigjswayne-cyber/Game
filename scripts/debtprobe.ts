/**
 * ---- THE BOARD, WHILE THE CLUB IS OVERDRAWN ----
 *
 * v1.1.13 let a manager move his whole balance into the transfer budget, and
 * charged him once for crossing the reserve. The owner's reply named what was
 * still missing:
 *
 *   "if tou spend it all then yes - if you take the club into debt then the
 *    pressure is on to fix it and the board grows the longer is stays in debt."
 *
 * A one-off charge prices the decision; it does not price living with it. So
 * the properties that make debt a risk rather than a toll:
 *
 *   1. IT ESCALATES. Week ten in the red costs more confidence than week one.
 *      A flat drain would be a tax; the whole point is that patience runs out.
 *   2. IT SCALES WITH THE HOLE, not with the club. Being two million down is a
 *      different story at Toulouse and at Cambridge, and the same story in
 *      weeks of upkeep.
 *   3. IT STOPS. Clear the debt and the pressure ends the same week - and the
 *      clock resets, so a manager who dips in and out is not punished as
 *      though he never left.
 *   4. IT IS NEVER SILENT. A drain nobody is told about is the worst thing a
 *      management game does. The first week files a letter and so does every
 *      fourth week after it.
 *   5. IT DOES NOTHING AT ALL TO A SOLVENT CLUB. Most careers never see it.
 *
 * Run: npx vite-node scripts/debtprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { debtWeek } from '../src/game/treasury'
import { operatingCost } from '../src/game/model'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

/** One week of the debt pass, and what it took off the board. */
const tick = (g: GameState): number => {
  const club = g.clubs[g.userClubId]
  const before = club.boardConfidence
  debtWeek(g)
  g.week++
  return before - club.boardConfidence
}

// ---- a solvent club never hears from this at all ----
{
  const g = newGame('northampton', 'Debt', 801)
  const club = g.clubs[g.userClubId]
  club.balance = 5_000_000
  const news0 = g.news.length
  let worst = 0
  for (let i = 0; i < 20; i++) worst = Math.max(worst, tick(g))
  ok(worst === 0, `twenty weeks in the black cost the board nothing (worst week ${worst})`)
  ok(g.news.length === news0, 'and filed no letters')
  ok(g.debtSince == null, 'and started no clock')
}

// ---- the pressure grows the longer it lasts ----
{
  const g = newGame('northampton', 'Debt', 802)
  const club = g.clubs[g.userClubId]
  club.balance = -2 * operatingCost(g, club)
  club.boardConfidence = 100
  const bites: number[] = []
  for (let i = 0; i < 12; i++) {
    club.balance = -2 * operatingCost(g, club)   // hold the hole steady; only the weeks change
    club.boardConfidence = 100                   // and read each week in isolation
    bites.push(tick(g))
  }
  ok(bites[0] > 0, `the first week in the red costs something (${bites[0].toFixed(2)})`)
  ok(bites[11] > bites[0] * 3,
     `and the twelfth costs far more than the first (${bites[0].toFixed(2)} -> ${bites[11].toFixed(2)})`)
  let rising = true
  for (let i = 1; i < bites.length; i++) if (bites[i] < bites[i - 1]) rising = false
  ok(rising, 'every week is at least as heavy as the one before it')
}

// ---- and with the depth of the hole ----
{
  const bite = (mult: number): number => {
    const g = newGame('northampton', 'Debt', 803)
    const club = g.clubs[g.userClubId]
    club.balance = -mult * operatingCost(g, club)
    club.boardConfidence = 100
    return tick(g)
  }
  const shallow = bite(0.5)
  const deep = bite(6)
  ok(deep > shallow, `six weeks of upkeep down bites harder than half of one (${shallow.toFixed(2)} vs ${deep.toFixed(2)})`)
}

// ---- clearing it ends the pressure and resets the clock ----
{
  const g = newGame('northampton', 'Debt', 804)
  const club = g.clubs[g.userClubId]
  club.boardConfidence = 100
  for (let i = 0; i < 10; i++) { club.balance = -3 * operatingCost(g, club); tick(g) }
  const deepBite = (() => { club.balance = -3 * operatingCost(g, club); club.boardConfidence = 100; return tick(g) })()
  club.balance = 1_000_000
  const after = tick(g)
  ok(after === 0, 'the week the books balance, the pressure stops dead')
  ok(g.debtSince == null, 'and the clock is cleared')
  ok(g.news.some(n => n.k === 'news.debtCleared'), 'the relief is filed')
  // back in again: the eleventh week of a NEW overdraft is week one, not week eleven
  club.balance = -3 * operatingCost(g, club)
  club.boardConfidence = 100
  const fresh = tick(g)
  ok(fresh < deepBite,
     `a new overdraft starts at week one, not where the last one left off (${fresh.toFixed(2)} vs ${deepBite.toFixed(2)})`)
}

// ---- it is never silent ----
{
  const g = newGame('northampton', 'Debt', 805)
  const club = g.clubs[g.userClubId]
  for (let i = 0; i < 9; i++) { club.balance = -3 * operatingCost(g, club); tick(g) }
  ok(g.news.some(n => n.k === 'news.debtOpened'), 'the first week in the red files a letter')
  const nags = g.news.filter(n => n.k === 'news.debtPressure').length
  ok(nags >= 2, `and it keeps saying so - ${nags} reminders in nine weeks`)
  ok(nags <= 3, `without becoming an accountant's inbox (${nags} in nine weeks)`)
}

// ---- it can take a board all the way down; that is the risk ----
{
  const g = newGame('northampton', 'Debt', 806)
  const club = g.clubs[g.userClubId]
  club.boardConfidence = 40
  for (let i = 0; i < 40; i++) { club.balance = -8 * operatingCost(g, club); tick(g) }
  ok(club.boardConfidence < 20,
     `a season spent deep in the red is a boardroom that has run out (${club.boardConfidence.toFixed(1)})`)
  ok(club.boardConfidence >= 0, 'and never goes below nought')
}

console.log(fails === 0
  ? '\nDEBT PROBE PASSED: the pressure grows, it says so, and it stops when the books balance'
  : `\nDEBT PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
