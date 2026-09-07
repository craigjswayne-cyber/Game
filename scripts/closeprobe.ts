/**
 * ---- THE SUMMER DIARY ----
 *
 * Owner, 7 Sep: "in the extra weeks, club can put on events - weddings, music
 * events, town shows, comedy nights, golf days, shooting days, sponsor events -
 * it shouldnt be completely impossible for them to make some money."
 *
 * Two things have to be true at once and they pull against each other, which is
 * the whole reason this probe exists.
 *
 * IT HAS TO PAY. "Some money" means a summer worth planning, not a rounding
 * error - so the probe measures what a real club actually clears across the
 * three weeks and holds it above a floor.
 *
 * AND IT MUST NOT UNDO THE THING IT SITS INSIDE. The books are paused in those
 * weeks because three extra weeks of wages took a third of every club's income
 * (see LEDGER_WEEKS). If the diary paid league money it would put that back the
 * other way and hand it to the manager alone. So the ceiling matters as much as
 * the floor, and the rest of the world has to be earning too.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { CLOSE_EVENTS, aiCloseSeason, bookEvent, bookedThisWeek, eventFee, eventOpen, isCloseSeason } from '../src/game/closeseason'
import { LEDGER_WEEKS, SEASON_WEEKS, fmtMoney } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---- 1. when the diary is open ------------------------------------------
console.log('--- 1. only in the weeks with no rugby in them')
ok(!isCloseSeason(1) && !isCloseSeason(LEDGER_WEEKS), 'shut all season')
ok(isCloseSeason(LEDGER_WEEKS + 1) && isCloseSeason(SEASON_WEEKS), 'open for the summer weeks')
ok(!isCloseSeason(SEASON_WEEKS + 1), 'and shut again after the last one')
const weeks = []
for (let w = 1; w <= SEASON_WEEKS; w++) if (isCloseSeason(w)) weeks.push(w)
ok(weeks.length === 3, `three weeks of it (${weeks.join(', ')})`)

// ---- 2. the owner's seven ------------------------------------------------
console.log('\n--- 2. seven things to put on')
const want = ['wedding', 'comedy', 'townshow', 'golf', 'shooting', 'sponsor', 'concert']
ok(CLOSE_EVENTS.length === 7, `seven events (${CLOSE_EVENTS.length})`)
for (const id of want) ok(CLOSE_EVENTS.some(e => e.id === id), `  ${id}`)

// ---- 3. the ground decides what it can hold -----------------------------
console.log('\n--- 3. a clubhouse is not a stadium')
const small = newGame('cinderford', 'Test', 5)
const big = newGame('leicester', 'Test', 5)
const openSmall = CLOSE_EVENTS.filter(e => eventOpen(small, e)).length
const openBig = CLOSE_EVENTS.filter(e => eventOpen(big, e)).length
console.log(`     ${small.clubs[small.userClubId].short} (${small.clubs[small.userClubId].capacity} seats): ${openSmall} of 7`)
console.log(`     ${big.clubs[big.userClubId].short} (${big.clubs[big.userClubId].capacity} seats): ${openBig} of 7`)
ok(openSmall < openBig, 'a bigger ground can sell more of them')
ok(openSmall >= 2, 'and the smallest club can still put something on')
const concert = CLOSE_EVENTS.find(e => e.id === 'concert')!
ok(!eventOpen(small, concert), 'no concert at a ground that cannot hold one')

// ---- 4. it pays, and it pays what it should -----------------------------
console.log('\n--- 4. what a summer is worth')
const g = newGame('leicester', 'Test', 9)
while (g.week <= LEDGER_WEEKS) processWeekAndAdvance(g)
ok(isCloseSeason(g.week), `the season reached the close season (week ${g.week})`)
const before = g.clubs[g.userClubId].balance
let earned = 0
while (isCloseSeason(g.week)) {
  const best = CLOSE_EVENTS.filter(e => eventOpen(g, e)).sort((a, b) => eventFee(g, b) - eventFee(g, a))[0]
  ok(!!best, `week ${g.week}: something to book`)
  if (best) {
    bookEvent(g, best.id)
    ok(bookedThisWeek(g) === best.id, `  booked ${best.id}`)
    ok(bookEvent(g, 'wedding').length > 0 && bookedThisWeek(g) === best.id,
      '  and a second booking that week is refused - it is one ground')
    earned += eventFee(g, best)
  }
  processWeekAndAdvance(g)
}
const after = g.clubs[g.userClubId].balance
console.log(`     three weeks of events: ${fmtMoney(earned)} booked, balance ${fmtMoney(before)} -> ${fmtMoney(after)}`)
ok(earned > 150_000, `"some money" means something (${fmtMoney(earned)})`)
ok(earned < 1_500_000, `and not league money - the books stay paused for a reason (${fmtMoney(earned)})`)
ok(after > before, 'the club is better off for a busy summer')

// ---- 5. and everyone else has a summer too ------------------------------
console.log('\n--- 5. the rest of the world is not idle')
const w = newGame('leicester', 'Test', 21)
while (w.week <= LEDGER_WEEKS) processWeekAndAdvance(w)
// MEASURED ON THE MECHANISM, NOT THROUGH A WHOLE WEEK. A settle also pays
// transfer fees, fines and the rich-club correction, so a club can bank its
// summer takings and still end the week down - which says nothing about whether
// the diary reached it. So aiCloseSeason is called directly and every club is
// checked, which is the actual claim: nobody's ground sits idle all summer.
const before2 = new Map(Object.values(w.clubs).map(c => [c.id, c.balance]))
aiCloseSeason(w)
const others = Object.values(w.clubs).filter(c => c.id !== w.userClubId)
const paid = others.filter(c => c.balance > (before2.get(c.id) ?? 0))
const takings = others.map(c => c.balance - (before2.get(c.id) ?? 0)).sort((a, b) => a - b)
console.log(`     ${paid.length} of ${others.length} clubs took something, from ${fmtMoney(takings[0])} to ${fmtMoney(takings[takings.length - 1])}`)
ok(paid.length === others.length, 'every club in the world hires its ground out in the summer')
ok(w.clubs[w.userClubId].balance === before2.get(w.userClubId),
  'and the manager is not paid twice - his own diary is his to book')
ok(takings[takings.length - 1] < 200_000, `nobody has a suspiciously good July (${fmtMoney(takings[takings.length - 1])})`)

console.log('')
if (fails === 0) console.log('CLOSE SEASON PROBE PASSED: the ground earns in July, and not so much that the paused books stop mattering')
else console.log(`CLOSE SEASON PROBE FAILED (${fails})`)
process.exit(fails)
