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
//   A big wage bill was free. An AI club could carry forty men on Premiership
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
import { weeklyCentral, type Club, type GameState, type Player } from './model'

/** Same £30 a head the manager's club takes, because it is the same ticket. */
const GATE_PER_HEAD = 30

/**
 * Weekly cost of having a stadium, per seat, whether anybody sits in it.
 *
 * The manager's club pays this through operatingCost, which reads real facility
 * levels. AI clubs have no facility state at all, so their estate is implied by
 * the ground: a 20,000-seat club is running a 20,000-seat operation.
 */
const UPKEEP_PER_SEAT = 3.1

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
    bills.push(club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0))
  }
  if (!bills.length) return 1
  bills.sort((a, b) => a - b)
  const median = bills[Math.floor(bills.length / 2)]
  return Math.min(4, Math.max(1, median / BASE_WAGE_BILL))
}

/** A club this deep in the hole starts looking at who it can live without. */
export const FIRE_SALE = -4_000_000

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
 * Twenty weeks of wages is about eight million for a Premiership bill. A club
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
 */
const SURPLUS_WEEKS = 26

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
  const upkeep = Math.round(club.capacity * UPKEEP_PER_SEAT)
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
  const index = moneyIndex(state)
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
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
function shedWages(state: GameState, club: Club): Player | null {
  const marquee = new Set((club.marquee ?? []).slice(0, 3))
  if (club.players.length <= FLOOR_SQUAD) return null
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
    if (club.id === state.userClubId) continue
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
    if (club.id === state.userClubId || club.balance > FIRE_SALE) continue
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
