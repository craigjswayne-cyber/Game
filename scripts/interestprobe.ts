/**
 * ---- A FILTER THAT CANNOT LIE ----
 *
 * Owner, £100m in the bank at a small club, looking at a market of names he
 * could not buy: "there needs to be an interested switch on button - for
 * players who would sign for the club... a few top players are mercenaries and
 * will come for big wages."
 *
 * The rule was always there. It lived inside agreeFee as a single unnamed
 * condition and the only way to learn it was to bid and lose a week. It now
 * lives in interest.ts and the Transfer Centre's Interested chip asks the same
 * function - which is the whole point, and the whole risk. A filter that says
 * "he would come" about a man the engine will refuse is worse than no filter,
 * because it turns a wall you can see into a wall you cannot.
 *
 * So the claim is agreement, tested the only way worth testing it: bid for
 * every man in the market at a fee his club will take, and check that the chip
 * and the negotiating table said the same thing about every one of them.
 *
 * Run: npx vite-node scripts/interestprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { INTEREST_GAP, interestPremium, transferInterest } from '../src/game/interest'
import { agreeFee, askingPrice, personalTermsDemand } from '../src/game/ai'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

/** A small club with money: exactly the owner's position. */
function pauper(seed: number): GameState {
  const g = newGame('cambridge', 'Interest', seed)
  const user = g.clubs[g.userClubId]
  user.budget = 200_000_000
  user.balance = 200_000_000
  return g
}

// ---- the chip and the table agree, man for man ----
{
  const g = pauper(501)
  const market = Object.values(g.players)
    .filter(p => p.clubId && p.clubId !== g.userClubId)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 200)
  // THE CLAIM IS ONE-WAY IN EACH DIRECTION, and it has to be, because a fee can
  // be refused for half a dozen honest reasons that have nothing to do with
  // interest - the ink is still wet on his last move, the budget will not cover
  // it, his club simply want more. Those are not disagreements. The two things
  // that would make the chip a liar are:
  //   a man the chip hid, who then agrees a fee   - the filter cost you a signing
  //   a man the chip showed, refused for interest - the filter wasted your week
  let hiddenButWilling = 0
  let shownButWalled = 0
  let walled = 0
  for (const p of market) {
    const said = transferInterest(g, p)
    // bid the full ask, so nothing but interest can be the reason for a refusal
    const res = agreeFee(g, p.id, askingPrice(g, p))
    const refusedOnInterest = !res.ok && /will not drop this far/.test(res.msg)
    if (said === 'no') { walled++; if (res.ok) hiddenButWilling++ }
    else if (refusedOnInterest) shownButWalled++
  }
  ok(hiddenButWilling === 0, `${market.length} players: nobody the chip hid would have agreed a fee (${hiddenButWilling} would)`)
  ok(shownButWalled === 0, `and nobody the chip showed was refused for dropping down (${shownButWalled} was)`)
  ok(walled > 0, `the wall is real at a small club - ${walled} of ${market.length} would not drop this far`)
}

// ---- who gets through the wall, and why ----
{
  const g = pauper(502)
  const user = g.clubs[g.userClubId]
  const big = Object.values(g.clubs).find(c => c.rep > user.rep + INTEREST_GAP + 8)!
  const at = (mut: (p: Player) => void): Player => {
    const p = { ...g.players[big.players[0]] } as Player
    p.morale = 8
    p.transferListed = false
    p.pers = 'Professional'
    mut(p)
    g.players[p.id] = p
    return p
  }
  ok(transferInterest(g, at(() => {})) === 'no',
     'a happy, unlisted professional at a far bigger club will not talk')
  ok(transferInterest(g, at(p => { p.transferListed = true })) === 'listening',
     'a man his own club has listed will talk')
  ok(transferInterest(g, at(p => { p.morale = 3 })) === 'listening',
     'an unhappy man will talk')
  ok(transferInterest(g, at(p => { p.pers = 'Mercenary' })) === 'listening',
     'a mercenary will talk to anybody - the owner asked for exactly this door')
}

// ---- and the mercenary charges for it ----
{
  const g = pauper(503)
  const user = g.clubs[g.userClubId]
  const big = Object.values(g.clubs).find(c => c.rep > user.rep + INTEREST_GAP + 8)!
  const base = g.players[big.players[0]]
  const pro = { ...base, pers: 'Professional' as const, morale: 3 }
  const merc = { ...base, pers: 'Mercenary' as const, morale: 8 }
  g.players[pro.id] = pro
  const proWage = personalTermsDemand(g, pro)
  g.players[merc.id] = merc
  const mercWage = personalTermsDemand(g, merc)
  ok(mercWage > proWage,
     `the mercenary's camp opens higher than the unhappy pro's (${mercWage} vs ${proWage}/wk)`)
  ok(interestPremium(g, merc) > interestPremium(g, pro),
     'and that is the drop-down premium, not a coincidence of the wage curve')
}

// ---- nobody at your own level is walled off ----
{
  const g = newGame('northampton', 'Interest', 504)
  const user = g.clubs[g.userClubId]
  const peers = Object.values(g.players).filter(p => {
    const c = p.clubId ? g.clubs[p.clubId] : null
    return c && c.id !== user.id && Math.abs(c.rep - user.rep) <= INTEREST_GAP
  })
  const walled = peers.filter(p => transferInterest(g, p) === 'no')
  ok(walled.length === 0,
     `a big club can talk to all ${peers.length} players at clubs within ${INTEREST_GAP} points (${walled.length} refused)`)
}

console.log(fails === 0
  ? '\nINTEREST PROBE PASSED: the chip promises exactly what the table delivers'
  : `\nINTEREST PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
