// The other hundred clubs pay their wages too.
//
// Found in the studio audit, and it was the largest single piece of pretend in
// the game. weeklyFinance ran on ONE club: the manager's. The other hundred paid
// no wages, no staff, no upkeep, and took no gate. Their only income was prize
// money at the rollover, so every balance in the world drifted upwards forever
// and nothing that happens on a pitch or in a contract negotiation ever cost
// anybody anything.
//
// What that broke, in order of how much it mattered:
//
//   Nobody was ever forced to sell. sellerWillingness has an eight-percent
//   discount for a club in the red, which is the oldest truth in the transfer
//   market, and over ten measured seasons it fired for two to six clubs out of a
//   hundred - and only ever because they had overspent on a fee, never because
//   running a rugby club costs money.
//
//   A big wage bill was free. An AI club could carry forty men on Premier Division
//   money and feel nothing, so wage inflation had no brake and no consequence.
//
//   Full grounds meant nothing to anyone but the manager. A club could sell out
//   every week for a decade and bank exactly the same as a club playing to
//   half-empty terraces.
//
// MEAN NEUTRALITY. This is a ledger with both halves, calibrated so the median
// AI club's balance grows at about the rate it did before (measured at roughly
// £0.85M a season over ten seasons). What changes is the SPREAD: a club with a
// bloated bill and a small ground now bleeds, and a club that fills a big stadium
// banks it. scripts/aiecon.ts holds both the median and the spread.
import { seniorsOf } from './ai'
import { MARQUEE_SLOTS } from './cap'
import { demandCeiling, isMyClub, LEDGER_WEEKS, weeklyCentral, groundUpkeep, groundTrade, type Club, type GameState, type Player } from './model'

/** Same £30 a head the manager's club takes, because it is the same ticket. */
const GATE_PER_HEAD = 30

/**
 * Weekly cost of having a stadium, per seat, whether anybody sits in it.
 *
 * The manager's club pays this through operatingCost, which reads real facility
 * levels. AI clubs carry facility levels too (training growth reads them), but
 * their running costs are not built from them: the estate is implied by the
 * ground, so a 20,000-seat club is running a 20,000-seat operation.
 */
// the shared constant: see model.ts, where the user's ledger reads it too

/** Backroom staff, implied by standing rather than by a named list of people. */
const STAFF_PER_REP = 620

/**
 * THE CALIBRATION DIAL. Sponsorship and matchday commercial, per point of
 * reputation, per week, before the money index below. Everything else here is a
 * real cost or a real receipt taken from the manager's own ledger; this is the
 * one number chosen to make the median come out where it was, and the one to
 * move if it drifts.
 */
const COMMERCIAL_PER_REP = 1_800

/**
 * A median AI wage bill at kick-off of a new career, in £/week. The reference
 * point for the money index, measured rather than guessed.
 */
const BASE_WAGE_BILL = 232_000

/**
 * THE SPORT'S MONEY GROWS WITH THE SPORT.
 *
 * The first cut of this ledger had static rep-based income against wage bills
 * that inflate about eighty percent over ten seasons, so it read beautifully for
 * three years and then killed the world: by season nine the median club was
 * £16.6M down and seventy-two of a hundred were in the red. A hundred insolvent
 * clubs is not a transfer market with pressure in it, it is a broken save.
 *
 * The fix is the thing that actually happens in professional sport: as the
 * players' market rises, so do the broadcast and sponsorship deals that pay for
 * it. Indexed to the world's own median wage bill, so the ledger self-corrects
 * against whatever the market does rather than against a 2025 number, and a club
 * that inflates its bill FASTER than the world still bleeds - which is the whole
 * point of turning this on.
 *
 * Clamped below at 1 so a depressed market never charges clubs more than they
 * earn, and above at 4 so a runaway wage spiral cannot print money.
 */
export function moneyIndex(state: GameState): number {
  const bills: number[] = []
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    // THE INDEX IS THE ESTABLISHED GAME'S WAGES (1.7.3). It was calibrated on
    // the hundred clubs that were here when BASE_WAGE_BILL was measured, and it
    // scales every club's income - where income only just outruns wages, so a
    // few per cent is the whole of a club's year. Six American clubs with
    // smaller bills pulled the median down 3-5% and took the median club's
    // gain from 0.33M a season to about nothing (scripts/aiecon.ts). A new
    // league joining the world is not the sport's money deflating.
    if (club.leagueId === 'mrc') continue
    bills.push(club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0))
  }
  if (!bills.length) return 1
  bills.sort((a, b) => a - b)
  const median = bills[Math.floor(bills.length / 2)]
  return Math.min(4, Math.max(1, median / BASE_WAGE_BILL))
}

/**
 * A club this deep in the hole starts looking at who it can live without, in
 * weeks of wages.
 *
 * Until 1.8.3 it was a flat four million, which is twelve weeks of a Premiership
 * bill and twenty to fifty of a National One one. The board below sheds wages at
 * twelve weeks and the bank stops the slide at twenty, so a small club hit the
 * floor, and then administration, without ever putting a man on the market.
 * Ten weeks sits just ahead of the shedding, for everybody.
 */
export const FIRE_SALE_WEEKS = 10

/**
 * ---- WHAT A CLUB CAN PAY (1.8.3) ----
 *
 * The fifteen-season audit found the bottom of the pyramid structurally
 * insolvent. Every wage in the world was priced by playerWage on ability and
 * age alone, so a National One side that developed its men paid them what a
 * Premiership side pays the same ability, out of a fraction of the income:
 * its bill grew two and a half to three times over fourteen seasons against
 * income that grew by half, and by season nine nine clubs in ten down there
 * were in the red. A renewal never fell below the man's current wage, so a
 * bill, once grown, could only grow.
 *
 * Real clubs pay what their income lets them. This is that number: the share
 * of the market rate a board can offer when it renews, buys, signs a free
 * agent or promotes a graduate. One at a club that can afford its bill, and the scale
 * is exactly what it was; below one where the bill outruns the income, so the
 * next deals come in cheaper and the bill walks back towards what the club
 * earns. A thin bank balance counts against it, so a club in the red pays
 * less again until it has cleared the debt and put a cushion by. The
 * manager's own club never reads it: his negotiations, and the demands on
 * his contract screen, are unchanged.
 */

/** The lowest share of the scale a board will offer. A man takes a cut to
 *  stay at a club that cannot pay, but not below half his worth. */
const PAY_FLOOR = 0.5

/** The share of what is left after staff and the ground that a board will
 *  commit to wages, so a club that pays its way also puts a little by. */
const WAGE_SHARE = 0.92

/** A board likes this many weeks of wages in the bank, and pays less until it
 *  has them. Aiming at nought left half of every lower league either side of
 *  it, so in the red as often as not, and eight weeks still left National One
 *  at about nought: a board's pressure only balances the drift of its men's
 *  ability up the scale once it is short of the cushion, so the cushion has
 *  to sit above where the balance comes to rest (scripts/distressprobe.ts:
 *  44%, then 21-38%, then 12% of the lower leagues in the red at season 14,
 *  31% once the transfer allowance stopped reading it, aiTransferBudget). */
const RESERVE_WEEKS = 12

/** A shortfall against that cushion is planned to be made up over this many
 *  ledger weeks: one season. */
const REPAY_WEEKS = 45

/** Before this many weeks of the season, too few gates have been taken to
 *  read, and the expected gate stands in for them. */
const GATE_READ_WEEKS = 10

/** Prize money per place from the bottom (rollover.ts): a board budgets for a
 *  mid-table finish. */
const PRIZE_PER_PLACE = 120_000

/**
 * Each club's weekly gate across the season so far, as the ledger booked it
 * (aiWeek: home fixtures inside the ledger, at £30 a head on the index).
 * Early in a season, before there are gates to read, the expected one: the
 * attendance formula's own centre (matchEngine.ts) on the seats the club can
 * sell, at one home game for each opponent in its league.
 */
function gateRates(state: GameState, clubs: Club[], index: number): Map<string, number> {
  const weeks = Math.min(LEDGER_WEEKS, state.week)
  const out = new Map<string, number>()
  if (weeks >= GATE_READ_WEEKS) {
    const one = clubs.length === 1 ? clubs[0].id : null
    for (const f of state.fixtures) {
      if (!f.played || !f.att || f.week > LEDGER_WEEKS || (one && f.homeId !== one)) continue
      out.set(f.homeId, (out.get(f.homeId) ?? 0) + f.att * GATE_PER_HEAD * index / weeks)
    }
    return out
  }
  for (const club of clubs) {
    const homes = Math.max(0, (state.comps[club.leagueId]?.table.length ?? 12) - 1)
    const interest = Math.min(0.96, Math.max(0.24, 0.44 + club.rep / 250 + 60 / 430))
    const att = Math.min(club.capacity, demandCeiling(club)) * interest
    out.set(club.id, homes * att * GATE_PER_HEAD * index / LEDGER_WEEKS)
  }
  return out
}

/**
 * What each AI club can afford to spend on wages a week: its income less its
 * staff and its ground, a mid-table share of the prize money, and the margin.
 * Measured once and passed around, because the rollover needs it after the
 * season's fixtures (its gates) have been cleared.
 */
export function aiWageRooms(state: GameState, only?: Club): Map<string, number> {
  const index = moneyIndex(state)
  const clubs = (only ? [only] : Object.values(state.clubs)).filter(c => !isMyClub(state, c.id))
  const gates = gateRates(state, clubs, index)
  const out = new Map<string, number>()
  for (const club of clubs) {
    const w = aiWeek(state, club, index)
    const size = state.comps[club.leagueId]?.table.length ?? 12
    const prize = ((size + 1) / 2) * PRIZE_PER_PLACE / LEDGER_WEEKS
    const income = w.central + w.commercial + (gates.get(club.id) ?? 0) + prize
    out.set(club.id, Math.max(0, (income - w.staff - w.upkeep) * WAGE_SHARE))
  }
  return out
}

/**
 * The share of the market rate this club offers on its next deals, 0.5 to 1.
 * `room` comes from aiWageRooms; without it the club's own is measured.
 * Always 1 for the manager's club.
 */
export function aiPayRate(state: GameState, club: Club, room?: number): number {
  if (isMyClub(state, club.id)) return 1
  const r = room ?? aiWageRooms(state, club).get(club.id) ?? 0
  const bill = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  if (bill <= 0) return 1
  const afford = r + Math.min(0, club.balance - RESERVE_WEEKS * bill) / REPAY_WEEKS
  // squared, because only the deals that come up this year can move the
  // bill: a club fifteen per cent over its means has to offer about a
  // quarter under the scale on those to close the gap in a contract cycle
  // (measured: offering just the shortfall left lower-league bills sitting
  // 15-20% over their income for good, scripts/distressprobe.ts)
  const share = Math.min(1, afford / bill)
  return Math.max(PAY_FLOOR, share * share)
}

/**
 * Can this AI club carry another wage of `wage` a week within its means: its
 * income covers the bill with him on it (after paying down any shortfall on
 * the cushion). Money in the bank is not income: a rich board that signed
 * on its balance paid for it in the mean AI club's gain (scripts/aiecon.ts).
 * A free agent costs no fee, so this is the whole question (rivalbids.ts).
 */
export function aiCanCarry(state: GameState, club: Club, wage: number, room?: number): boolean {
  if (isMyClub(state, club.id) || club.balance <= 0) return false
  const r = room ?? aiWageRooms(state, club).get(club.id) ?? 0
  const bill = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0) + wage
  return r + Math.min(0, club.balance - RESERVE_WEEKS * bill) / REPAY_WEEKS >= bill
}

/**
 * AN AI BOARD IN DEBT DOES NOT GO SHOPPING (1.8.3).
 *
 * The summer allowance was reputation times £45,000 plus fifteen per cent of
 * any surplus, and nothing else, so a club twenty weeks of wages under water
 * was handed the same war chest as a solvent one and spent it on men whose
 * wages it could not pay. Now the reputation part is paid at the club's pay
 * rate, and half of any debt comes off the total, down to nothing at all. A
 * club that can pay its way and is in the black gets exactly what it got.
 *
 * The cushion (RESERVE_WEEKS) is deliberately not in here. A first cut took
 * half of any shortfall against it, and since most clubs sit under twelve
 * weeks of wages in the bank, the average AI allowance at season twenty of a
 * soak fell from £4.4M to £1.3M (scripts/soakhealth.ts): a market with
 * nobody in it to buy the manager's players. Without it the soak reads
 * £2.4M, the lower in part because nobody is sitting on thirty million any
 * more, and the lower leagues' books still clear the line: 31% of them in
 * the red at season fourteen, against 12% with it (scripts/distressprobe.ts).
 */
export function aiTransferBudget(state: GameState, club: Club, room?: number): number {
  const rate = aiPayRate(state, club, room)
  const base = club.rep * 45_000 * rate + Math.max(0, club.balance) * 0.15 + Math.min(0, club.balance) * 0.5
  return Math.max(0, Math.round(base / 50_000) * 50_000)
}

/**
 * Twelve weeks of wages in the red, and the board stops asking nicely.
 *
 * A ledger with no brake on it is not an economy, it is a countdown. The first
 * calibration of this had none: the median held for three seasons and then fell
 * away, and by season nine forty-seven clubs in a hundred were under water with
 * the worst at minus thirty-seven million. Nothing in the model ever pulled a
 * bleeding club back, because a wage bill it could not afford was still a wage
 * bill it kept paying.
 *
 * Real boards shed wages. This shears the top earner a club can live without,
 * one a week while it is this deep, which drops the bill, which closes the gap -
 * and puts the man on the market, where a manager can have him.
 */
const DEBT_WEEKS = 12

/** Never below a matchday 23, a full bench, and cover for injuries. */
const FLOOR_SQUAD = 30

/**
 * The bank, the owner, the refinancing: the depth of hole a club is allowed to
 * be in, in weeks of wages.
 *
 * Shedding wages alone does not catch every club, because a squad cannot be shed
 * below thirty men and the rollover tops it back up again. Without a floor the
 * worst-run club in the world reached minus thirty-five million over ten measured
 * seasons, which is not a struggling rugby club, it is a number that has stopped
 * meaning anything on a screen the manager can read.
 *
 * Twenty weeks of wages is about eight million for a Premier Division bill. A club
 * held at that floor stays firmly in the red, which is the point: the eight
 * percent discount in sellerWillingness keeps applying, and a manager with money
 * has somebody to talk to.
 */
const DEBT_FLOOR_WEEKS = 20

/**
 * A board sitting on this much dead money spends it, in weeks of wages.
 *
 * The mirror of the debt rule, and it exists for the same reason: the richest
 * clubs in the first calibration banked seventy-eight million doing nothing with
 * it, which is both unrealistic and a transfer market the manager cannot live in.
 * The manager's own board does exactly this every summer (boardReinvests).
 *
 * Twenty weeks, not twenty-six (1.8.3). With the lower leagues paying what
 * they can (aiPayRate), the top flight's median balance at season fourteen
 * came down from £15.0M to £8.4M, and this rule was what held it there: forty
 * per cent of anything over twenty-six weeks a summer, against a club making
 * a couple of million a year, settles about five million above the line.
 * With twenty weeks and the cushion above it reads £3.8M, which is still
 * months of wages in the bank (scripts/distressprobe.ts, four worlds).
 */
const SURPLUS_WEEKS = 20

export interface AiLedger {
  gate: number
  central: number
  commercial: number
  wages: number
  staff: number
  upkeep: number
  net: number
}

/**
 * One club's week, itemised. Exported so the probe reads the engine's own sums
 * rather than a hand-rolled mirror that drifts the day a line changes - the
 * lesson econprobe.ts learned twice.
 *
 * The index is passed in rather than computed here: it is a property of the whole
 * world, and working it out a hundred times a week would be a hundred passes over
 * every squad in the game.
 */
export function aiWeek(state: GameState, club: Club, index = moneyIndex(state)): AiLedger {
  const wages = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  const home = state.fixtures.find(f =>
    f.week === state.week && f.played && f.homeId === club.id && f.att)
  // The gate is indexed too, and it has to be. The calibration before this one
  // left it flat on the argument that a ticket is a ticket, and that one decision
  // put a slow structural leak under every club in the world: the gate is about a
  // third of income, so as wages inflated its share shrank and the median slid a
  // million a season with nothing in the model able to stop it. Ticket prices rise
  // with the sport's money like everything else. What still varies, and what still
  // decides who banks and who bleeds, is how many people come.
  const gate = home?.att ? Math.round(home.att * GATE_PER_HEAD * index) : 0
  const central = Math.round(weeklyCentral(club) * index)
  const commercial = Math.round(club.rep * COMMERCIAL_PER_REP * index)
  const staff = Math.round(club.rep * STAFF_PER_REP * index)
  // the same ladder the manager's ground climbs (model.ts, GROUND_UPKEEP_F):
  // a stadium costs more a seat than a terrace, for everybody
  const upkeep = Math.round(groundUpkeep(club.capacity) - groundTrade(club.capacity))
  return {
    gate, central, commercial, wages, staff, upkeep,
    net: gate + central + commercial - wages - staff - upkeep,
  }
}

/**
 * Run the week for every club except the manager's.
 *
 * No rng. A ledger is arithmetic, and drawing on the shared stream here would
 * move every match in the world - the EK lesson, applied to money.
 */
export function aiWeeklyFinance(state: GameState): void {
  // the close season: same rule as the user's club, for the same reason
  if (state.week > LEDGER_WEEKS) return
  const index = moneyIndex(state)
  for (const club of Object.values(state.clubs)) {
    // isMyClub, not userClubId: a club whose manager has been sacked is run by
    // its board like any other. The old test left its books frozen - no wages
    // out, no gate in - for as long as he was out of work (1.8.1)
    if (isMyClub(state, club.id)) continue
    const week = aiWeek(state, club, index)
    club.balance += week.net
    if (week.wages > 0 && club.balance < -DEBT_WEEKS * week.wages) {
      shedWages(state, club)
      const floor = -DEBT_FLOOR_WEEKS * week.wages
      if (club.balance < floor) club.balance = floor
    }
  }
}

/**
 * Release the best-paid man the club can live without.
 *
 * Deliberately the same shape as trimToCap in cap.ts, which does this when a
 * squad breaches the salary cap: highest wage first, never a marquee man, never
 * below a floor squad, released as a free agent rather than sold, because a board
 * cutting costs in a hurry takes the saving and not the fee.
 */
export function shedWages(state: GameState, club: Club): Player | null {
  // the two marquee men the cap recognises, not three
  const marquee = new Set((club.marquee ?? []).slice(0, MARQUEE_SLOTS))
  // The floor is a SENIOR squad. `club.players.length` counted the 27-man
  // academy, so the floor sat at three seniors and never held. trimToCap had
  // the same fault and was fixed for it (CAP-01, 1.6.5); this is that fix,
  // brought to the other door that releases men for money (1.8.1).
  if (seniorsOf(state, club) <= FLOOR_SQUAD) return null
  const seniors = club.players
    .map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.acad && !p.youth && !marquee.has(p.id) && !p.loanFrom)
    .sort((a, b) => b.wage - a.wage)
  const going = seniors[0]
  if (!going) return null
  club.players = club.players.filter(id => id !== going.id)
  club.tactic.lineup = club.tactic.lineup.map(id => (id === going.id ? null : id))
  if (club.captain === going.id) club.captain = null
  if (club.vice === going.id) club.vice = null
  going.clubId = null
  going.transferListed = false
  // A FREE AGENT SETTLES FOR LESS, and this line is not decoration.
  //
  // Without it, every contract a struggling board could not afford went into the
  // free-agent pool at full price, and the rollover's squad top-up handed those
  // men to whoever was short of bodies - including the manager. Measured on
  // econprobe: his club went from making £2.1M in its third season to LOSING
  // £2.4M in its fourth, having signed nobody and sold nobody, because the
  // world's discarded wage bills were quietly becoming his.
  //
  // Thirty percent off is also just true: a man released in October takes what
  // is offered.
  going.wage = Math.round(going.wage * 0.7)
  return going
}

/**
 * The summer: a board that is sitting on dead money spends it on the club.
 *
 * Called from the rollover, alongside the user's own boardReinvests. No new
 * buildings are modelled for AI clubs - the stadium growth pass already handles
 * the one thing that matters to a manager, which is who can hold a bigger crowd
 * than him - so this is the academy, the training ground and the debt: money that
 * leaves the account and does not come back as a transfer war chest.
 */
export function aiBoardsReinvest(state: GameState): void {
  const index = moneyIndex(state)
  for (const club of Object.values(state.clubs)) {
    if (isMyClub(state, club.id)) continue
    const wages = aiWeek(state, club, index).wages
    const keep = wages * SURPLUS_WEEKS
    if (wages <= 0 || club.balance <= keep) continue
    club.balance -= Math.round((club.balance - keep) * 0.4)
  }
}

/**
 * Clubs in real trouble put somebody up for sale.
 *
 * NOT their best player: a board balancing books sells the man it can most afford
 * to lose, which is the highest-value SURPLUS body - someone with two better men
 * ahead of him in his position. That is also the version a manager can do
 * something about, because fire-selling stars would flood the market with men no
 * club would ever really let go.
 *
 * The first cut of this looked at ONE club a week, chosen by rotation, which over
 * a hundred clubs meant each board considered its own solvency about once a
 * century. It now scans them all and stops each one at two listings, so a
 * struggling club is visibly shopping without the market drowning in bodies.
 *
 * No rng: the choice is the highest value among the surplus, which is arithmetic.
 */
export function aiFireSale(state: GameState): number {
  let listed = 0
  for (const club of Object.values(state.clubs)) {
    if (isMyClub(state, club.id)) continue
    const wages = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
    if (wages <= 0 || club.balance > -FIRE_SALE_WEEKS * wages) continue
    const squad = club.players
      .map(id => state.players[id])
      .filter((p): p is Player => !!p && !p.youth && !p.acad)
    if (squad.length <= 26) continue   // nobody sells below a 23 plus cover
    const already = squad.filter(p => p.transferListed).length
    if (already >= 2) continue
    const free = squad.filter(p => !p.transferListed)
    const surplus = free.filter(p => {
      const better = squad.filter(x => x.id !== p.id && x.pos === p.pos && x.ca >= p.ca).length
      return better >= 2
    })
    const pool = surplus.length ? surplus : free
    if (!pool.length) continue
    const sell = pool.reduce((best, p) => (p.value > best.value ? p : best), pool[0])
    sell.transferListed = true
    listed++
  }
  return listed
}
