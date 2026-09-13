// ---- MONEY DOES NOT APPEAR OR EVAPORATE -----------------------------------
//
// executeTransfer in ai.ts is the one place a fee actually moves. It is
// reached from the AI's own market, from the user's negotiations and from the
// loan-to-buy door, and every one of those callers trusts it to move both
// halves: the player one way, the money the other.
//
// The external audit of 13 Sep 2026 asked for accounting invariants over
// buyer/seller balance, budget, wage, ownership and total money movement, and
// noted no confirmed defect. realMoney() already refuses a nonsense figure at
// the door - marketfuzz found that one, and the "£NaN/week" signing story is in
// the comment above it - so what is missing is not a guard on the input. It is
// a check that a good input leaves the books balanced.
//
// The strongest statement available is conservation: a club-to-club transfer
// is a transfer, not a creation. Whatever the fee, the total of every club
// balance in the world is the same afterwards as it was before. A sign flipped
// anywhere in that function breaks it and nothing else in the suite would say
// so, because both clubs would still look individually plausible.
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { executeTransfer } from '../src/game/ai'
import { SEASON_WEEKS, absWeek } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const purse = (g: GameState) => Object.values(g.clubs).reduce((n, c) => n + c.balance, 0)
const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

/** a saleable man at a club that is not ours, and a buyer that is not his */
function pickDeal(g: GameState): { p: Player; from: string; to: string } | undefined {
  for (const p of Object.values(g.players)) {
    if (!p.clubId || p.acad || p.onLoan || p.loanFrom) continue
    const to = Object.values(g.clubs).find(c => c.id !== p.clubId)
    if (to) return { p, from: p.clubId, to: to.id }
  }
  return undefined
}

// ---- a single transfer, read from both sides --------------------------------
{
  const g = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Ledger', 3131)
  const deal = pickDeal(g)!
  const { p, from, to } = deal
  const seller = g.clubs[from], buyer = g.clubs[to]
  const fee = 750_000

  const before = {
    purse: purse(g),
    sellerBal: seller.balance, buyerBal: buyer.balance,
    sellerBud: seller.budget, buyerBud: buyer.budget,
  }
  seller.captain = p.id                    // the armband must not travel
  p.transferListed = true
  seller.tactic.lineup = [p.id, ...seller.tactic.lineup.slice(1)]

  executeTransfer(g, p, to, fee)

  ok(purse(g) === before.purse,
     `the world holds the same money after a ${money(fee)} transfer (${money(purse(g) - before.purse)} difference)`)
  ok(seller.balance === before.sellerBal + fee, `${seller.short} are ${money(fee)} better off`)
  ok(buyer.balance === before.buyerBal - fee, `${buyer.short} are ${money(fee)} worse off`)

  // budget is deliberately NOT conserved: seven-tenths of a sale comes back as
  // money to spend, and a buyer cannot be driven below zero. Asserted as the
  // rule it is rather than as a balance.
  ok(seller.budget === before.sellerBud + Math.round(fee * 0.7),
     `seven-tenths of the fee returns to ${seller.short}'s budget (${money(seller.budget - before.sellerBud)})`)
  ok(buyer.budget === Math.max(0, before.buyerBud - fee),
     `${buyer.short}'s budget falls by the fee and stops at zero (${money(buyer.budget)})`)

  ok(p.clubId === to, 'he belongs to the buyer')
  ok(buyer.players.includes(p.id) && !seller.players.includes(p.id), 'and to exactly one squad list')
  ok(!seller.tactic.lineup.includes(p.id), 'he is out of the old XV')
  // NOT `captain === null`: executeTransfer clears the armband and then calls
  // ensureCaptains, which hands it to somebody still at the club. A club is
  // never left without a captain, so the invariant is that the armband stayed
  // behind and stayed on a player who is actually there.
  ok(seller.captain !== p.id, 'the armband did not travel with him')
  ok(seller.captain != null && seller.players.includes(seller.captain),
     `and went to somebody still at ${seller.short} (${g.players[seller.captain!]?.name})`)
  ok(p.transferListed === false, 'he comes off the list')
  ok(p.joinedAt === absWeek(g.season, g.week), 'and the week he signed is stamped')
}

// ---- a fee that is not a figure moves nothing -------------------------------
//
// realMoney is the door. This checks the door is shut from the inside: not
// that the call returns, but that the books are untouched afterwards.
{
  for (const [fee, what] of [[NaN, 'NaN'], [Infinity, 'infinity'], [-1, 'a negative fee'],
                             [1e15, 'a fee past the ceiling']] as Array<[number, string]>) {
    const g = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Ledger', 3131)
    const deal = pickDeal(g)!
    const before = { purse: purse(g), club: deal.p.clubId, squad: g.clubs[deal.to].players.length }
    executeTransfer(g, deal.p, deal.to, fee)
    const held = purse(g) === before.purse && deal.p.clubId === before.club &&
                 g.clubs[deal.to].players.length === before.squad
    ok(held, `${what} moves neither the player nor a penny`)
  }
}

// ---- a free transfer is still a transfer ------------------------------------
{
  const g = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Ledger', 3131)
  const deal = pickDeal(g)!
  const before = purse(g)
  executeTransfer(g, deal.p, deal.to, 0)
  ok(purse(g) === before, 'a free transfer moves no money')
  ok(deal.p.clubId === deal.to, 'and moves the player')
}

// ---- and a career's worth of market, unattended ------------------------------
//
// The single-deal checks above are exact but artificial. This one lets the AI
// market run for four seasons and asks only that the books stay readable:
// every balance a real number, every squad list matching every clubId. A sign
// error that only fires on one of the AI's own paths shows up here.
{
  const g = newGame(LEAGUE_DEFS('m')[0].clubs[0].id, 'Ledger', 7373)
  let broke = ''
  const check = (when: string) => {
    if (broke) return
    for (const c of Object.values(g.clubs)) {
      if (!Number.isFinite(c.balance)) return void (broke = `${when}: ${c.short} has a balance of ${c.balance}`)
      if (!Number.isFinite(c.budget)) return void (broke = `${when}: ${c.short} has a budget of ${c.budget}`)
      if (c.budget < 0) return void (broke = `${when}: ${c.short} has a negative budget of ${money(c.budget)}`)
    }
    const owned = new Map<number, number>()
    for (const c of Object.values(g.clubs)) for (const id of c.players) owned.set(id, (owned.get(id) ?? 0) + 1)
    for (const p of Object.values(g.players)) {
      const n = owned.get(p.id) ?? 0
      if (p.clubId && n !== 1) return void (broke = `${when}: ${p.name} is on ${n} squad lists`)
      if (!p.clubId && n !== 0) return void (broke = `${when}: free agent ${p.name} is on ${n} squad lists`)
    }
  }
  for (let s = 0; s < 4; s++) {
    const target = g.season + 1
    let guard = 0
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g), false)
      g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
      check(`S${g.season}W${g.week}`)
      processWeekAndAdvance(g)
    }
  }
  ok(broke === '', `four seasons of market keep every book readable${broke ? ` - ${broke}` : ''}`)
  console.log(`  (the world holds ${money(purse(g))} across ${Object.keys(g.clubs).length} clubs after four seasons)`)
}

console.log(fails
  ? `\nLEDGER PROBE FAILED (${fails})`
  : '\nLEDGER PROBE PASSED: a transfer moves money, it does not make it')
process.exit(fails ? 1 : 0)
