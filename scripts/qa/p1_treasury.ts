// P1 probe: does cash moved to the transfer budget get charged twice?
import { newGame } from '../../src/game/newgame'
import { releaseToBudget } from '../../src/game/treasury'
import { agreeFee, signOnTerms, personalTermsDemand, askingPrice, executeTransfer } from '../../src/game/ai'
import { fmtMoney } from '../../src/game/model'

const g = newGame('leicester', 'Treasury', 4242)
const uc = g.clubs[g.userClubId]
console.log('start balance', fmtMoney(uc.balance), 'budget', fmtMoney(uc.budget))

// Case A: buy a player straight from the opening budget, no treasury move
const gA = newGame('leicester', 'Treasury', 4242)
const A = gA.clubs[gA.userClubId]
const b0 = A.balance, t0 = A.budget
const target = Object.values(gA.players)
  .filter(p => p.clubId && p.clubId !== gA.userClubId && !p.loanFrom && askingPrice(gA, p) <= 1_000_000 && askingPrice(gA, p) >= 400_000)
  .sort((a, b) => askingPrice(gA, b) - askingPrice(gA, a))[0]
const fee = askingPrice(gA, target)
executeTransfer(gA, target, gA.userClubId, fee)
console.log(`A: fee ${fmtMoney(fee)}: balance ${fmtMoney(b0)} -> ${fmtMoney(A.balance)} (delta ${fmtMoney(A.balance - b0)}), budget ${fmtMoney(t0)} -> ${fmtMoney(A.budget)} (delta ${fmtMoney(A.budget - t0)})`)

// Case B: move exactly the fee from balance to budget first, then buy
const gB = newGame('leicester', 'Treasury', 4242)
const B = gB.clubs[gB.userClubId]
const bB0 = B.balance, tB0 = B.budget
const move = 1_000_000
const r = releaseToBudget(gB, move)
console.log('B: releaseToBudget', r.ok, '->', 'balance', fmtMoney(B.balance), 'budget', fmtMoney(B.budget))
const targetB = gB.players[target.id]
executeTransfer(gB, targetB, gB.userClubId, fee)
console.log(`B: after buying same player for ${fmtMoney(fee)}: balance ${fmtMoney(B.balance)} (delta ${fmtMoney(B.balance - bB0)}), budget ${fmtMoney(B.budget)} (delta ${fmtMoney(B.budget - tB0)})`)
console.log(`Cash cost of the same signing: no move ${fmtMoney(b0 - A.balance)} vs with a ${fmtMoney(move)} move ${fmtMoney(bB0 - B.balance)}; extra cash gone = ${fmtMoney((bB0 - B.balance) - (b0 - A.balance))}`)

// Case C: move ALL cash to budget then spend it all: where does the balance end?
const gC = newGame('leicester', 'Treasury', 4242)
const C = gC.clubs[gC.userClubId]
const bC0 = C.balance, tC0 = C.budget
const rc = releaseToBudget(gC, C.balance)
console.log('C: move all:', rc.ok, 'balance', fmtMoney(C.balance), 'budget', fmtMoney(C.budget))
// spend the whole budget on players via the same executor the UI reaches
let spent = 0
for (const p of Object.values(gC.players).filter(p => p.clubId && p.clubId !== gC.userClubId && !p.loanFrom).sort((a, b) => b.value - a.value)) {
  const f = askingPrice(gC, p)
  if (f > C.budget) continue
  executeTransfer(gC, p, gC.userClubId, f)
  spent += f
  if (C.budget < 200_000) break
}
console.log(`C: spent ${fmtMoney(spent)} of a budget that was ${fmtMoney(tC0)} own + ${fmtMoney(bC0)} moved. Balance now ${fmtMoney(C.balance)} (started ${fmtMoney(bC0)}); budget left ${fmtMoney(C.budget)}`)
console.log(`C: expected balance if budget is an allowance inside cash: ${fmtMoney(bC0 - spent)}; if budget is a separate pot: ${fmtMoney(0)}; actual: ${fmtMoney(C.balance)}`)
