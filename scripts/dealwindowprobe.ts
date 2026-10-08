/**
 * ---- A DEAL AGREED WHILE THE WINDOW IS SHUT (1.8.15) ----
 *
 * Owner: "you should be able to buy players outside of transfer window... BUT
 * they cant transfer until the window is open. The money doesnt leave your
 * account so you could buy many people and then not afford them once the
 * window opens. Those transfers should be cancelled. If a transfer is
 * happening it should be added to their profile." And sales the same way.
 *
 *   1. a fee and terms can be agreed while the window is shut; the man stays
 *      where he is and nothing is paid
 *   2. the deal is on the record the profile reads (pendingDeal)
 *   3. two deals that each fit the budget but not together: when the window
 *      opens the first goes through and the second falls through, with the
 *      reason in the inbox
 *   4. a bid accepted while shut is an agreed sale that completes on opening
 *   5. a deal can be called off, and an agreed deal survives a save reload
 *
 * Run: npx vite-node scripts/dealwindowprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { agreeFee, askingPrice, callOffDeal, pendingDeal, personalTermsDemand, respondToOffer, signOnTerms, windowOpen } from '../src/game/ai'
import { migrate } from '../src/game/save'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g: GameState = newGame('northampton', 'Deal Window', 31)
g.boardGrace = 999_999
while (windowOpen(g.week) || g.week < 10) processWeekAndAdvance(g)
ok(!windowOpen(g.week), `the window is shut (week ${g.week})`)

const user = g.clubs[g.userClubId]
const targets = Object.values(g.players)
  .filter((p): p is Player => !!p.clubId && p.clubId !== user.id && !p.acad && !p.loanFrom && !p.onLoan && !p.retiring && g.clubs[p.clubId]?.leagueId === 'champ' && p.age < 30 && (p.joinedAt == null))
  .sort((a, b) => askingPrice(g, b) - askingPrice(g, a))
const [a, b] = targets.filter(p => askingPrice(g, p) >= 300_000)
const askA = askingPrice(g, a), askB = askingPrice(g, b)
// each fits on its own, not both together
user.budget = Math.max(askA, askB) + 50_000
const budget0 = user.budget, balance0 = user.balance, fromA = a.clubId, fromB = b.clubId

console.log('\n--- 1 and 2. agreed while shut, nothing paid, on the record\n')
const fa = agreeFee(g, a.id, askA)
ok(fa.ok, `the fee for ${a.name} is agreed while the window is shut (${askA})`)
const ta = signOnTerms(g, a.id, askA, Math.round(personalTermsDemand(g, a) * 1.05), 0, false)
ok(ta.ok, `and the terms: "${ta.msg.slice(0, 80)}"`)
ok(a.clubId === fromA, 'he stays at his club until the window opens')
ok(user.budget === budget0 && user.balance === balance0, 'and nothing is paid')
ok(pendingDeal(g, a.id)?.kind === 'buy', 'the agreed deal is on the record his profile reads')
ok(!agreeFee(g, a.id, askA).ok, 'and it cannot be agreed twice')

const fb = agreeFee(g, b.id, askB)
const tb = fb.ok ? signOnTerms(g, b.id, askB, Math.round(personalTermsDemand(g, b) * 1.05), 0, false) : fb
ok(tb.ok, `a second deal is agreed too (${b.name}, ${askB}), each within the budget of ${budget0}`)

console.log('\n--- 4. a bid accepted while shut\n')
const mine = user.players.map(id => g.players[id]).find(p => p && !p.acad && !p.loanFrom)!
const bidder = Object.values(g.clubs).find(c => c.id !== user.id && c.budget > 2_000_000)!
g.offers.push({ id: g.nextId++, playerId: mine.id, fromClubId: bidder.id, toClubId: user.id, fee: 400_000, week: g.week, forUser: true, status: 'pending' })
const sold = respondToOffer(g, g.offers[g.offers.length - 1].id, true)
ok(pendingDeal(g, mine.id)?.kind === 'sell' && mine.clubId === user.id, `the sale is agreed and he stays until the window opens: "${sold.slice(0, 70)}"`)

console.log('\n--- 5. called off, and kept across a save\n')
const reloaded = migrate(structuredClone(g))
ok((reloaded.pendingDeals ?? []).length === 3, `three agreed deals survive a save reload (${(reloaded.pendingDeals ?? []).length})`)
const spare = targets.find(p => p.id !== a.id && p.id !== b.id && askingPrice(g, p) <= user.budget)!
agreeFee(g, spare.id, askingPrice(g, spare))
signOnTerms(g, spare.id, askingPrice(g, spare), Math.round(personalTermsDemand(g, spare) * 1.05), 0, false)
const had = !!pendingDeal(g, spare.id)
callOffDeal(g, spare.id)
ok(had && !pendingDeal(g, spare.id), 'a deal can be called off')

console.log('\n--- 3. the window opens\n')
const before = new Set(g.news.map(n => n.id))
while (!windowOpen(g.week)) processWeekAndAdvance(g)
const news = g.news.filter(n => !before.has(n.id) && (n.k === 'news.dealDone' || n.k === 'news.dealOff'))
ok(a.clubId === user.id, `the first deal went through on the Monday the window opened (week ${g.week})`)
ok(b.clubId === fromB, 'the second, which no longer fits the budget, did not')
ok(news.some(n => n.k === 'news.dealOff' && n.playerId === b.id), `and the inbox says why: "${String(news.find(n => n.playerId === b.id)?.v?.why ?? '').slice(0, 70)}"`)
ok(mine.clubId === bidder.id, `the agreed sale went through (${mine.name} to ${bidder.short})`)
ok((g.pendingDeals ?? []).length === 0, 'and nothing is left waiting')

console.log(fails ? `\nDEAL WINDOW PROBE FAILED (${fails})` : '\nDEAL WINDOW PROBE PASSED: agreed while shut, paid when open, cancelled when it cannot be paid')
process.exit(fails ? 1 : 0)
