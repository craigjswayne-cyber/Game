/**
 * ---- CHAOS: the game must survive a player trying to kill it ----
 *
 * A ruthless QA sweep, requested in exactly those words: deplete the roster to
 * nothing, field fifteen fly-halves, empty the bench, zero every number that
 * can be zeroed, drive the balance ten million into the red, feed the
 * negotiation desks NaN and 2^31-1, stack every failure trigger onto the same
 * week, and keep simulating after the sack. None of it is reasonable play.
 * All of it must fail SOFTLY: no exception, no hang, no NaN burrowing into the
 * save, no money conjured from a refused deal.
 *
 * Three invariants run through every scenario here:
 *   1. NOTHING THROWS. Every engine entry point is called inside guard(),
 *      and an exception is a red result with the scenario named.
 *   2. THE SAVE STAYS A SAVE. After each scenario the whole state is walked
 *      for non-finite numbers and round-tripped through JSON - a state that
 *      cannot serialise is a save the player loses on the next reload, which
 *      is the worst crash of all because it happens tomorrow.
 *   3. REFUSAL IS FREE. A rejected bid, wage or renewal must not move a
 *      penny in either direction.
 *
 * Some scenarios exercise paths a phone can genuinely reach (release every
 * player, ignore the game for months); others are unreachable through the UI
 * (NaN in a wage field) and are tested anyway, because the save file is
 * editable JSON and "the UI would never send that" has never once been true.
 *
 * Run: npx vite-node scripts/chaosprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch, lineupFor, availablePlayers, autoSelect } from '../src/game/matchEngine'
import { agreeFee, askingPrice, offerRenewalAt, respondToOffer, signFreeAgent, signOnTerms, userBid } from '../src/game/ai'
import { SEASON_WEEKS, XV_SLOTS } from '../src/game/model'
import { mulberry32 } from '../src/game/rng'
import { releaseBlock, releaseToBudget } from '../src/game/treasury'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Run a scenario step; an exception is a named failure, not a dead probe. */
function guard(what: string, fn: () => void): boolean {
  try { fn(); return true } catch (e) {
    ok(false, `${what} threw: ${String(e).slice(0, 140)}`)
    return false
  }
}

/** Walk the whole save for numbers that would rot it: NaN, Infinity. */
function badNumberPath(x: unknown, path = 'state'): string | null {
  if (typeof x === 'number') return Number.isFinite(x) ? null : path
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      const bad = badNumberPath(x[i], `${path}[${i}]`)
      if (bad) return bad
    }
    return null
  }
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      const bad = badNumberPath(v, `${path}.${k}`)
      if (bad) return bad
    }
  }
  return null
}

/** The two save-integrity checks every scenario ends with. */
function saveHolds(g: GameState, label: string) {
  const bad = badNumberPath(g)
  ok(bad === null, `${label}: no NaN/Infinity anywhere in the save${bad ? ` (found at ${bad})` : ''}`)
  ok(guardJson(g), `${label}: the save still serialises`)
}
function guardJson(g: GameState): boolean {
  try { return JSON.stringify(g).length > 0 } catch { return false }
}

/** Advance N weeks, guarding every one. Returns weeks that completed. */
function advance(g: GameState, weeks: number, label: string): number {
  let done = 0
  for (let i = 0; i < weeks; i++) {
    if (!guard(`${label} (week ${g.week})`, () => processWeekAndAdvance(g))) break
    done++
  }
  return done
}

// ===========================================================================
console.log('CHAOS 0: the board will not let you sell the club out from under it\n')
{
  // THE FINDING THAT STARTED THIS FILE: there is no release button, so
  // accepting incoming bids was the one lever that could drain a squad - and
  // it had no floor. Accept everything and the fixtures play on against a
  // ghost XV of nulls. Now the board vetoes any sale leaving < 18 seniors.
  const g = newGame('northampton', 'Chaos', 999)
  const club = g.clubs[g.userClubId]
  const seniors = club.players.map(id => g.players[id]).filter(x => x && !x.acad)
  // trim to exactly 18 seniors the blunt way (probe staging, not a user path)
  const keep = seniors.slice(0, 18).map(p => p!.id)
  const acad = club.players.filter(id => g.players[id]?.acad)
  for (const id of club.players) {
    if (!keep.includes(id) && !acad.includes(id)) { const pl = g.players[id]; if (pl) pl.clubId = null }
  }
  club.players = [...keep, ...acad]
  const seller = g.players[keep[0]]
  const bidder = Object.values(g.clubs).find(c => c.id !== club.id)!
  g.offers.push({ id: 424242, playerId: seller.id, fromClubId: bidder.id, fee: 1_000_000, week: g.week, status: 'pending', forUser: true } as never)
  const balBefore = club.balance
  let msg = ''
  guard('sale at the squad floor', () => { msg = respondToOffer(g, 424242, true) })
  ok(msg.includes('vetoes'), `at 18 seniors the board vetoes the sale ("${msg.slice(0, 60)}...")`)
  ok(club.players.includes(seller.id) && seller.clubId === club.id, 'the player never leaves')
  ok(club.balance === balBefore, 'and no money moves')
  // one man above the floor, the same sale goes through: stupid stays legal
  const extra = Object.values(g.players).find(x => !x.clubId && !x.acad)!
  extra.clubId = club.id
  club.players.push(extra.id)
  g.offers.push({ id: 424243, playerId: seller.id, fromClubId: bidder.id, fee: 1_000_000, week: g.week, status: 'pending', forUser: true } as never)
  guard('sale one above the floor', () => { msg = respondToOffer(g, 424243, true) })
  ok(msg.includes('sold'), `at 19 seniors the same sale is allowed - selling thin stays a legal, stupid choice`)
  saveHolds(g, 'squad floor')
}

// ===========================================================================
console.log('\nCHAOS 1: roster depletion - 0, 1 and 14 men (save-editing territory, past the veto)\n')
for (const keep of [0, 1, 14]) {
  const g = newGame('northampton', 'Chaos', 1000 + keep)
  const club = g.clubs[g.userClubId]
  // release everyone beyond the quota, the way a determined seller would end up
  const gone = club.players.slice(keep)
  club.players = club.players.slice(0, keep)
  for (const id of gone) { const p = g.players[id]; if (p) p.clubId = null }
  guard(`lineupFor with ${keep} men`, () => {
    const lu = lineupFor(g, g.userClubId)
    ok(Array.isArray(lu) && lu.length === 23, `${keep}-man roster: lineupFor still answers with a 23-slot sheet`)
  })
  const weeks = advance(g, 6, `${keep}-man roster`)
  ok(weeks === 6, `${keep}-man roster: six weeks simulate without an exception (${weeks}/6)`)
  const played = g.fixtures.filter(f => f.played && (f.homeId === g.userClubId || f.awayId === g.userClubId))
  ok(played.every(f => Number.isFinite(f.homeScore) && Number.isFinite(f.awayScore) && f.homeScore >= 0 && f.awayScore >= 0),
    `${keep}-man roster: every result posted is a real rugby score`)
  saveHolds(g, `${keep}-man roster`)
}

// ===========================================================================
console.log('\nCHAOS 2: positional sabotage - the XV nobody would pick\n')
{
  const g = newGame('northampton', 'Chaos', 2001)
  const club = g.clubs[g.userClubId]
  // every fly-half-ish back in the forward shirts, forwards scattered behind
  const pool = availablePlayers(g, club.players, false)
  const backs = pool.filter(p => ['FH', 'SH', 'CE', 'WG', 'FB'].includes(p.pos))
  const forwards = pool.filter(p => !['FH', 'SH', 'CE', 'WG', 'FB'].includes(p.pos))
  const lu: (number | null)[] = new Array(23).fill(null)
  for (let i = 0; i < 15; i++) lu[i] = (i < 8 ? backs[i] : forwards[i - 8])?.id ?? null
  club.tactic.lineup = lu
  club.tactic.userPicked = true
  const fx = userFixtureThisWeek(g) ?? g.fixtures.find(f => !f.played && (f.homeId === club.id || f.awayId === club.id))!
  guard('all-out-of-position XV', () => simMatch(g, fx, mulberry32(42), true))
  ok(fx.played && Number.isFinite(fx.homeScore) && Number.isFinite(fx.awayScore) && fx.homeScore >= 0 && fx.awayScore >= 0,
    `backs in the pack, pack in the backs: the match still produces a score (${fx.homeScore}-${fx.awayScore})`)
  const us = fx.homeId === club.id ? fx.homeScore : fx.awayScore
  const them = fx.homeId === club.id ? fx.awayScore : fx.homeScore
  ok(them >= us, `and the sabotaged side loses it (${us}-${them}) - out of position costs, it does not crash`)
  saveHolds(g, 'positional sabotage')
}

// ===========================================================================
console.log('\nCHAOS 3: the empty bench, and a bench of the walking wounded\n')
{
  const g = newGame('northampton', 'Chaos', 2002)
  const club = g.clubs[g.userClubId]
  const honest = autoSelect(g, availablePlayers(g, club.players, false))
  const noBench = honest.slice(0, 15).concat(new Array(8).fill(null))
  club.tactic.lineup = noBench
  club.tactic.userPicked = true
  const fx = g.fixtures.find(f => !f.played && (f.homeId === club.id || f.awayId === club.id))!
  guard('match with a completely empty bench', () => simMatch(g, fx, mulberry32(7), true))
  ok(fx.played, `an empty bench plays the eighty with the XV it has (${fx.homeScore}-${fx.awayScore})`)
  saveHolds(g, 'empty bench')
}
{
  const g = newGame('northampton', 'Chaos', 2003)
  const club = g.clubs[g.userClubId]
  const honest = autoSelect(g, availablePlayers(g, club.players, false))
  // bench eight men, then break all eight before kick-off
  for (const id of honest.slice(15)) {
    const p = id != null ? g.players[id] : null
    if (p) p.injury = { type: 'Hamstring', weeks: 6 }
  }
  club.tactic.lineup = honest
  club.tactic.userPicked = true
  const fx = g.fixtures.find(f => !f.played && (f.homeId === club.id || f.awayId === club.id))!
  guard('match with an all-injured bench', () => simMatch(g, fx, mulberry32(8), true))
  ok(fx.played, `an all-injured bench does not take the match down (${fx.homeScore}-${fx.awayScore})`)
  saveHolds(g, 'injured bench')
}

// ===========================================================================
console.log('\nCHAOS 4: a position wiped out - every prop and every fly-half broken\n')
{
  const g = newGame('northampton', 'Chaos', 2004)
  const club = g.clubs[g.userClubId]
  for (const id of club.players) {
    const p = g.players[id]
    if (p && (p.pos === 'LP' || p.pos === 'TP' || p.pos === 'FH')) p.injury = { type: 'Knee', weeks: 10 }
  }
  guard('lineupFor with no fit props or fly-halves', () => {
    const lu = lineupFor(g, g.userClubId)
    ok(lu.length === 23, 'the sheet still comes back 23 long')
  })
  const weeks = advance(g, 4, 'no-props world')
  ok(weeks === 4, `four weeks simulate with the front row in the physio room (${weeks}/4)`)
  saveHolds(g, 'position wipeout')
}

// ===========================================================================
console.log('\nCHAOS 5: everything zeroed - morale, condition, form, confidence\n')
{
  const g = newGame('northampton', 'Chaos', 2005)
  const club = g.clubs[g.userClubId]
  for (const id of club.players) {
    const p = g.players[id]
    if (p) { p.morale = 0; p.cond = 0; p.form = 0; p.sharp = 0 }
  }
  club.boardConfidence = 0
  g.fanMood = 0
  g.mgrTrust = 0
  const weeks = advance(g, 12, 'all-zeroes world')
  ok(weeks === 12, `twelve weeks simulate on a fully zeroed club (${weeks}/12)`)
  ok(g.unemployed, 'and a board at zero does what a board at zero should: the sack arrives')
  saveHolds(g, 'all zeroes')
}

// ===========================================================================
console.log('\nCHAOS 6: the sack-speed run, and life after the sack\n')
{
  const g = newGame('northampton', 'Chaos', 2006)
  g.clubs[g.userClubId].boardConfidence = 3.1
  // lose the room too, so nothing props the number up
  let sackedAt: number | null = null
  for (let i = 0; i < 20 && !g.unemployed; i++) {
    g.clubs[g.userClubId].boardConfidence = Math.min(g.clubs[g.userClubId].boardConfidence, 3.1)
    if (!guard('sack-speed run', () => processWeekAndAdvance(g))) break
    if (g.unemployed && sackedAt == null) sackedAt = g.week
  }
  ok(g.unemployed, `a board pinned at the threshold pulls the trigger (week ${sackedAt})`)
  // now the part the brief called "null manager reference pointers": keep
  // simulating a world that has no manager in it
  const after = advance(g, 15, 'unemployed weeks')
  ok(after === 15, `fifteen post-sack weeks simulate cleanly (${after}/15)`)
  ok((g.vacancies ?? []).length > 0, 'and the job centre has the vacancy on its books')
  saveHolds(g, 'post-sack world')
}

// ===========================================================================
console.log('\nCHAOS 7: money - deep debt, and the negotiation desks fed garbage\n')
{
  const g = newGame('northampton', 'Chaos', 2007)
  const club = g.clubs[g.userClubId]
  club.balance = -10_000_000
  club.budget = -10_000_000
  const weeks = advance(g, 10, 'ten-million-in-debt world')
  ok(weeks === 10, `ten weeks simulate ten million in the red (${weeks}/10)`)
  ok(Number.isFinite(club.balance), `the balance is still a number (${Math.round(club.balance)})`)
  saveHolds(g, 'deep debt')
}
{
  const g = newGame('northampton', 'Chaos', 2008)
  const club = g.clubs[g.userClubId]
  const target = Object.values(g.players).find(p => p.clubId && p.clubId !== club.id && !p.acad)!
  const own = g.players[club.players[0]]
  const before = () => JSON.stringify([club.balance, club.budget, g.clubs[target.clubId!]?.balance, own.wage])
  const evil = [-5_000_000, -1, NaN, Infinity, -Infinity, 2_147_483_647, Number.MAX_SAFE_INTEGER, 1e18]
  for (const v of evil) {
    const snap = before()
    let r1: { ok: boolean } | null = null, r2: { ok: boolean } | null = null, r3: { ok: boolean } | null = null
    guard(`userBid(${v})`, () => { r1 = userBid(g, target.id, v) })
    guard(`agreeFee(${v})`, () => { r2 = agreeFee(g, target.id, v) })
    guard(`offerRenewalAt(${v})`, () => { r3 = offerRenewalAt(g, own.id, v) })
    ok(r1 !== null && !(r1 as { ok: boolean }).ok, `a bid of ${v} is refused`)
    ok(r2 !== null && !(r2 as { ok: boolean }).ok, `a fee of ${v} is refused`)
    ok(r3 !== null && !(r3 as { ok: boolean }).ok, `a wage of ${v} is refused`)
    ok(before() === snap, `and the refusal moved no money (${v})`)
  }
  // signOnTerms with poisoned wage/signOn on a player whose fee was never agreed
  guard('signOnTerms with maxint everything', () => {
    const r = signOnTerms(g, target.id, 2_147_483_647, 2_147_483_647, 2_147_483_647, false)
    ok(!r.ok, 'maxint fee/wage/sign-on is refused end to end')
  })
  saveHolds(g, 'garbage money inputs')
}
{
  // the zero-pound contract and the 99-year deal, planted directly in the save
  const g = newGame('northampton', 'Chaos', 2009)
  const club = g.clubs[g.userClubId]
  const p = g.players[club.players[0]]
  p.wage = 0
  p.contractEnds = g.season + 99
  const weeks = advance(g, 4, 'zero-wage 99-year contract')
  ok(weeks === 4, 'a zero-pound 99-year contract does not derail the wage run')
  ok(Number.isFinite(club.balance), 'and the books still balance to a number')
  saveHolds(g, 'contract extremes')
}

// ===========================================================================
console.log('\nCHAOS 8: the overlap - every failure trigger on the same week\n')
{
  const g = newGame('northampton', 'Chaos', 2010)
  const club = g.clubs[g.userClubId]
  club.boardConfidence = 3.0
  club.balance = -10_000_000
  club.budget = -10_000_000
  const gone = club.players.slice(14)
  club.players = club.players.slice(0, 14)
  for (const id of gone) { const p = g.players[id]; if (p) p.clubId = null }
  for (const id of club.players) { const p = g.players[id]; if (p) { p.morale = 0; p.cond = 0 } }
  g.week = Math.max(g.week, 9) // past the early-season sack grace
  const weeks = advance(g, 8, 'the overlap week')
  ok(weeks === 8, `insolvent + sack-line + 14 men, all at once: eight weeks still settle (${weeks}/8)`)
  ok(g.unemployed, 'exactly one of the failure paths fires: the sack (money troubles write letters, not exits)')
  saveHolds(g, 'overlapping failures')
}

// ===========================================================================
console.log('\nCHAOS 9: match-engine boundaries - mismatches, violence and volume\n')
{
  // the biggest mismatch the save can hold: a club of broken 1-rated men
  const g = newGame('northampton', 'Chaos', 2011)
  const victim = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId === 'prem')!
  for (const id of victim.players) {
    const p = g.players[id]
    if (p) { p.ca = 1; p.cond = 1; p.form = 0; p.morale = 0 }
  }
  const fx = g.fixtures.find(f => !f.played && (f.homeId === g.userClubId && f.awayId === victim.id) ||
    (f.awayId === g.userClubId && f.homeId === victim.id))
    ?? g.fixtures.find(f => !f.played && (f.homeId === victim.id || f.awayId === victim.id))!
  guard('maximum mismatch', () => simMatch(g, fx, mulberry32(11), true))
  ok(fx.played && fx.homeScore >= 0 && fx.awayScore >= 0 && Number.isFinite(fx.homeScore + fx.awayScore),
    `a squad of broken 1-rated men still produces a score (${fx.homeScore}-${fx.awayScore})`)
  ok(Math.max(fx.homeScore, fx.awayScore) < 300, `and the blowout has a ceiling a scoreboard can hold (${Math.max(fx.homeScore, fx.awayScore)})`)
  saveHolds(g, 'maximum mismatch')
}
{
  // maximum violence: both sides at aggression 100 in front of 40 different refs
  const g = newGame('northampton', 'Chaos', 2012)
  for (const c of Object.values(g.clubs)) { c.tactic.aggression = 100 }
  let sims = 0
  for (const fx of g.fixtures.filter(f => !f.played && g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 40)) {
    if (!guard(`all-out-aggression match ${fx.id}`, () => simMatch(g, fx, mulberry32(fx.id), true))) break
    if (!Number.isFinite(fx.homeScore) || fx.homeScore < 0 || fx.awayScore < 0) {
      ok(false, `aggression-100 match posted a broken score (${fx.homeScore}-${fx.awayScore})`)
      break
    }
    sims++
  }
  ok(sims === 40, `forty matches of maximum aggression, forty sane scorelines (${sims}/40)`)
  saveHolds(g, 'maximum violence')
}

// ===========================================================================
console.log('\nCHAOS 10: free agents, ghosts and the man signed twice\n')
{
  const g = newGame('northampton', 'Chaos', 2013)
  const club = g.clubs[g.userClubId]
  // sign a man who is already yours; sign a man who does not exist
  guard('signing your own player as a free agent', () => {
    const r = signFreeAgent(g, club.players[0])
    ok(!r.ok, 'your own player cannot be re-signed as a free agent')
  })
  guard('signing a ghost', () => {
    const r = signFreeAgent(g, 98_765_432)
    ok(!r.ok, 'a player id that does not exist is refused, not dereferenced')
  })
  guard('bidding for a ghost', () => {
    const r = userBid(g, 98_765_432, 500_000)
    ok(!r.ok, 'and a bid for him goes nowhere')
  })
  guard('asking the price of a ghost squad-less man', () => {
    const p = Object.values(g.players).find(x => !x.clubId)
    if (p) askingPrice(g, p)
  })
  saveHolds(g, 'ghosts')
}

// ===========================================================================
console.log('\nCHAOS 11: the release-to-budget button, hammered\n')
{
  // the one button that moves cash: spam it a thousand times and it must stop
  // at the board's reserve, never mint, never loop forever
  const g = newGame('northampton', 'Chaos', 2014)
  const club = g.clubs[g.userClubId]
  // hand the club a war chest first, or the reserve floor refuses every slice
  // and the conservation claim is trivially true on zero movement
  club.balance += 20_000_000
  const total = () => club.balance + club.budget
  const t0 = total()
  let moved = 0
  guard('release-to-budget x1000', () => {
    for (let i = 0; i < 1000; i++) {
      const r = releaseToBudget(g)
      if (r.ok) moved++
    }
  })
  ok(moved > 0, `with money above the reserve, slices really move (${moved})`)
  ok(moved < 1000, `and the tap stops working at the floor rather than looping forever (${moved}/1000 accepted)`)
  ok(Math.abs(total() - t0) < 1, `a thousand taps conserve money exactly (${Math.round(t0)} -> ${Math.round(total())})`)
  ok(releaseBlock(g) !== null, 'and the board reserve is where it stopped')
  saveHolds(g, 'release spam')
}

console.log(fails ? `\nCHAOS PROBE: ${fails} FAILURES - the audit log above names each one` : '\nCHAOS PROBE PASSED: it bends, it refuses, it never breaks')
process.exit(fails ? 1 : 0)
