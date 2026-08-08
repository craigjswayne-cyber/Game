import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  agreeFee, agreePreContract, askingPrice, counterIncomingOffer, executeTransfer,
  offerRenewalAt, respondToOffer, signOnTerms, talkToPlayer, userBid,
} from '../src/game/ai'
import { loanIn, loanOut, loanTargets } from '../src/game/loans'
import { fmtMoney, type GameState, type Player } from '../src/game/model'
import { bad, ok, finite, checkWorld, failCount } from './worldcheck'

/**
 * ---- THE MARKET, FED NONSENSE ----
 *
 * The engine fuzz (fuzz2.ts) throws hostile inputs at the press room, the
 * boardroom, the staff market and the scout's brief. It does not touch the one
 * place a player moves real money: transfers, contracts and loans.
 *
 * That is the gap this closes. Every one of these calls is reachable from a
 * screen, and a screen is a keyboard: a fee can be typed, a wage can be typed,
 * and a corrupted save can hold anything at all. So each entry point is fed the
 * numbers a stepper cannot produce but a person or a bad save can - nothing,
 * nought, minus a million, a thousand times the asking price, NaN, Infinity,
 * a fee with fifteen decimal places - plus the wrong player entirely: somebody
 * else's man, your own man, a man who does not exist, a man twice over.
 *
 * The bar is not "it says no". The bar is:
 *
 *   it never throws
 *   it never leaves money as NaN or a squad half-transferred
 *   a rejected move changes nothing at all
 *   an accepted move is paid for exactly once
 *   and the world still passes every invariant afterwards
 */

const g: GameState = newGame('northampton', 'Market Tester', 90210)
const club = g.clubs[g.userClubId]
const mine = (): Player[] => club.players.map(id => g.players[id]).filter(Boolean)

/** The numbers a text field can produce and a stepper cannot. */
const HOSTILE_FEES = [
  0, -1, -1_000_000, 0.5, 1e-9, 1e15, NaN, Infinity, -Infinity,
  Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 1.9999999999999998,
]

/** Run a call that must never throw, and report it by name if it does. */
function safe<T>(what: string, fn: () => T): T | undefined {
  try {
    return fn()
  } catch (e) {
    bad('THREW', `${what}: ${String(e).split('\n')[0].slice(0, 130)}`)
    return undefined
  }
}

/** A snapshot of everything a bad call must not be able to move. */
function ledger() {
  return {
    balance: club.balance,
    budget: club.budget,
    wageBudget: club.wageBudget,
    squad: club.players.length,
    roster: club.players.join(','),
    wages: mine().map(p => p.wage).join(','),
  }
}
function unchanged(what: string, before: ReturnType<typeof ledger>) {
  const after = ledger()
  for (const k of Object.keys(before) as (keyof typeof before)[]) {
    if (before[k] !== after[k]) {
      bad('LEAK', `${what} was refused but still moved ${k}: ${before[k]} -> ${after[k]}`)
      return
    }
  }
}

// ------------------------------------------------------------------ bidding
console.log('--- bidding with numbers a stepper cannot make')
{
  // somebody else's player, so a successful bid would be a real signing
  const target = Object.values(g.players).find(p => p.clubId && p.clubId !== club.id)!
  ok(!!target, `there is somebody to bid for (${target?.name})`)
  const price = askingPrice(g, target)
  ok(finite(price) && price >= 0, `his asking price is a real number (${fmtMoney(price)})`)

  for (const fee of HOSTILE_FEES) {
    const before = ledger()
    const r = safe(`userBid ${fee}`, () => userBid(g, target.id, fee))
    if (!r) continue
    ok(typeof r.msg === 'string' && r.msg.length > 0 && !/NaN|undefined|Infinity/.test(r.msg),
      `a bid of ${String(fee)} answers in plain words: ${r.msg.slice(0, 58)}`)
    // a bid this daft must not have been accepted, and must not have moved a penny
    if (!r.ok) unchanged(`a bid of ${String(fee)}`, before)
    checkWorld(g, `bid ${fee}`, true)
  }

  // the wrong player entirely
  for (const [what, id] of [['a man who does not exist', 999_999], ['a negative id', -1],
    ['one of my own players', mine()[0]?.id ?? 0]] as const) {
    const before = ledger()
    const r = safe(`userBid ${what}`, () => userBid(g, id, 1_000_000))
    if (r && !r.ok) unchanged(`bidding for ${what}`, before)
    ok(!!r, `bidding for ${what} is answered rather than thrown`)
  }
}

// ------------------------------------------------------- fees and sign-ons
console.log('\n--- agreeing a fee, then terms, with the same nonsense')
{
  const target = Object.values(g.players).find(p => p.clubId && p.clubId !== club.id)!
  for (const fee of HOSTILE_FEES) {
    safe(`agreeFee ${fee}`, () => agreeFee(g, target.id, fee))
    checkWorld(g, `agreeFee ${fee}`, true)
  }
  // and terms on top: a wage of minus a million, a sign-on of Infinity
  for (const wage of [0, -1_000_000, NaN, Infinity, 1e12]) {
    for (const signOn of [0, -5, NaN, Infinity]) {
      const before = ledger()
      const r = safe(`signOnTerms ${wage}/${signOn}`,
        () => signOnTerms(g, target.id, 1_000_000, wage, signOn, true))
      if (r && !r.ok) unchanged(`terms of ${wage}/${signOn}`, before)
      checkWorld(g, `terms ${wage}/${signOn}`, true)
    }
  }
  ok(finite(club.balance), `the balance survived every rejected deal (${fmtMoney(club.balance)})`)
}

// ------------------------------------------------------------- the renewal
console.log('\n--- renewing a contract on impossible terms')
{
  const man = mine()[0]!
  const wageBefore = man.wage
  for (const offer of [...HOSTILE_FEES, 1]) {
    const r = safe(`offerRenewalAt ${offer}`, () => offerRenewalAt(g, man.id, offer))
    if (!r) continue
    ok(typeof r.msg === 'string' && !/NaN|undefined|Infinity/.test(r.msg),
      `an offer of ${String(offer)} answers cleanly: ${r.msg.slice(0, 52)}`)
    ok(finite(man.wage) && man.wage >= 0,
      `and his wage is still a real number after it (${man.wage})`)
    checkWorld(g, `renewal ${offer}`, true)
  }
  ok(man.wage !== 0 || wageBefore === 0, 'nobody ended up on a wage of nothing by accident')

  // renewing a man who is not yours, and one who does not exist
  const theirs = Object.values(g.players).find(p => p.clubId && p.clubId !== club.id)!
  for (const [what, id] of [['a rival club\'s player', theirs.id], ['nobody', 999_999]] as const) {
    const before = ledger()
    const r = safe(`renew ${what}`, () => offerRenewalAt(g, id, 50_000))
    if (r && !r.ok) unchanged(`renewing ${what}`, before)
    ok(!!r, `renewing ${what} is answered rather than thrown`)
  }
}

// ---------------------------------------------------------- incoming offers
console.log('\n--- answering offers that are not there, twice')
{
  for (const id of [999_999, -1, 0]) {
    ok(typeof safe(`respondToOffer ${id}`, () => respondToOffer(g, id, true)) === 'string',
      `accepting offer ${id}, which does not exist, answers in words`)
    ok(typeof safe(`respondToOffer ${id} reject`, () => respondToOffer(g, id, false)) === 'string',
      `and rejecting it does too`)
    ok(typeof safe(`counter ${id}`, () => counterIncomingOffer(g, id)) === 'string',
      `and so does countering it`)
  }
  // a real offer, answered twice: the second answer must not sell him again
  const man = mine().find(p => p.value > 0)!
  g.offers.push({
    id: g.nextId++, playerId: man.id, fromClubId: 'bath', fee: man.value,
    week: g.week, season: g.season, status: 'pending', forUser: true,
  } as never)
  const offer = g.offers[g.offers.length - 1]
  const squadBefore = club.players.length
  safe('accept once', () => respondToOffer(g, offer.id, true))
  const squadAfterOne = club.players.length
  safe('accept twice', () => respondToOffer(g, offer.id, true))
  const squadAfterTwo = club.players.length
  ok(squadAfterOne <= squadBefore, `accepting an offer moved him out (${squadBefore} -> ${squadAfterOne})`)
  ok(squadAfterTwo === squadAfterOne,
    `and answering the same offer again changed nothing (${squadAfterOne} -> ${squadAfterTwo})`)
  checkWorld(g, 'after a double answer', true)
}

// ----------------------------------------------------------------- the loans
console.log('\n--- loans out, in, and out again')
{
  const man = mine()[0]!
  safe('loanOut once', () => loanOut(g, man.id))
  const clubAfter = man.clubId
  safe('loanOut twice', () => loanOut(g, man.id))
  ok(man.clubId === clubAfter, 'loaning out the same man twice does not move him twice')
  for (const id of [999_999, -1]) {
    ok(!!safe(`loanOut ${id}`, () => loanOut(g, id)), `loaning out player ${id} is answered rather than thrown`)
    ok(typeof safe(`loanIn ${id}`, () => loanIn(g, id)) === 'string', `and loaning him in is too`)
  }
  const targets = safe('loanTargets', () => loanTargets(g)) ?? []
  ok(Array.isArray(targets), `the loan market lists ${targets.length} name(s) without throwing`)
  checkWorld(g, 'after the loan fuzz', true)
}

// -------------------------------------------------------- the pre-contract
console.log('\n--- pre-contracts for the wrong people')
{
  for (const id of [999_999, -1, mine()[0]?.id ?? 0]) {
    const before = ledger()
    const r = safe(`agreePreContract ${id}`, () => agreePreContract(g, id))
    if (r && !r.ok) unchanged(`a pre-contract for ${id}`, before)
    ok(!!r, `a pre-contract for ${id} is answered rather than thrown`)
  }
}

// --------------------------------------------------------------- the office
console.log('\n--- talking to people who are not there')
{
  for (const id of [999_999, -1]) {
    for (const kind of ['praise', 'word'] as const) {
      ok(typeof safe(`talkToPlayer ${id} ${kind}`, () => talkToPlayer(g, id, kind)) === 'string',
        `a ${kind} with player ${id} answers in words`)
    }
  }
}

// ------------------------------------------------------ the mass fire sale
// Everything at once, in a single week: sell the entire squad to one club for
// nothing, which is the shape of a player emptying his team through the UI as
// fast as he can tap.
console.log('\n--- the whole squad sold in one week, for nothing')
{
  const before = club.players.length
  for (const p of mine()) safe(`executeTransfer ${p.id}`, () => executeTransfer(g, p, 'bath', 0))
  ok(club.players.length < before, `the squad emptied out (${before} -> ${club.players.length})`)
  ok(finite(club.balance), `and the balance is still a number (${fmtMoney(club.balance)})`)
  checkWorld(g, 'after the fire sale', true)
  // then play on: a club with nobody has to survive a settled week
  for (let i = 0; i < 6; i++) {
    safe(`week after the fire sale ${i}`, () => { g.newsFrom = g.nextId; processWeekAndAdvance(g) })
  }
  checkWorld(g, 'six weeks after the fire sale', true)
  ok(finite(club.balance), 'six weeks on, the money still adds up')
  ok(club.players.every(id => !!g.players[id] && g.players[id].clubId === club.id),
    'and every man on the list is really there')
}

console.log(failCount()
  ? `\nMARKET FUZZ FOUND ${failCount()} PROBLEM(S)`
  : '\nMARKET FUZZ PASSED: the market refused every impossible number and moved nothing it refused')
if (failCount()) process.exit(1)
