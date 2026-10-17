// The estate: facility levels, the ground ladder, build times, and what the
// buildings cost to run each week.
import type { Club, FacilityId, GameState } from './types'

export const MAX_FACILITY = 5
export const FACILITY_INFO: Record<FacilityId, { name: string; icon: string; desc: string; base: number }> = {
  pitch: { name: 'facilities.pitch', icon: 'pitch', desc: 'facilities.pitchDesc', base: 260_000 },
  gym: { name: 'facilities.gym', icon: 'gym', desc: 'facilities.gymDesc', base: 350_000 },
  recovery: { name: 'facilities.recovery', icon: 'recovery', desc: 'facilities.recoveryDesc', base: 420_000 },
  paddock: { name: 'facilities.paddock', icon: 'paddock', desc: 'facilities.paddockDesc', base: 400_000 },
  kicking: { name: 'facilities.kicking', icon: 'kicking', desc: 'facilities.kickingDesc', base: 300_000 },
  briefing: { name: 'facilities.briefing', icon: 'briefing', desc: 'facilities.briefingDesc', base: 380_000 },
  academy: { name: 'facilities.academy', icon: 'academy', desc: 'facilities.academyDesc', base: 500_000 },
  shop: { name: 'facilities.shop', icon: 'store', desc: 'facilities.shopDesc', base: 240_000 },
  // F31: ground development past the turnstile. Capacity expansion already
  // exists (requestExpansion) and adds SEATS; this adds what each seat is
  // worth. Boxes, a members' lounge, a decent kitchen: the same crowd spends
  // more. Built as a facility rather than a new system because the estate
  // already handles levels, costs, board requests and weekly upkeep, and a
  // second parallel mechanism for buildings would be the same thing twice.
  hospitality: { name: 'Hospitality & Boxes', icon: 'hospitality', desc: 'Corporate boxes and lounges: every home crowd is worth more at the gate.', base: 460_000 },
}
export const facilityCost = (info: { base: number }, level: number) => info.base * (level + 1)

/**
 * HOW LONG THE BUILDERS ARE ON SITE, by the level being built (owner, v1.6.6).
 *
 * Every project used to take a flat five weeks, which made the last rung of a
 * facility no more of a commitment than the first: a world-class stand and a
 * set of lifting racks both cost one five-week window, and the only thing
 * separating them was money the board mostly underwrote. The estate is meant
 * to be the slow half of the game - squads turn over in a season, concrete
 * does not - so the ladder now costs time as well as cash, and the top of it
 * costs a quarter of a season.
 *
 * Indexed by TARGET level, so buildWeeks(1) is the first rung.
 */
const FACILITY_BUILD_WEEKS = [3, 5, 7, 9, 12] as const

/**
 * ---- THE GROUND IS A LADDER, 0 TO 5 (owner, v1.6.8) ----
 *
 * The estate's nine facilities each run 0 to 5 and the ground did not: it was
 * a number of seats that crept up 6% at a time, and the only thing that ever
 * marked progress was the number itself. These are the six grounds, by the
 * seats they hold, and they are what the campus map draws:
 *
 *   0  a village ground            1,500
 *   1  a terrace and a clubhouse   3,000
 *   2  one proper stand            6,000
 *   3  three sides seated          9,000
 *   4  a full bowl                15,000
 *   5  a stadium                  32,000
 *
 * ABSOLUTE, not relative to where a club started. A 60,000-seat ground draws
 * as a stadium because it IS one, and a club that opens at 9,000 opens at
 * stage 3 with two rungs left rather than five. That is the whole point of
 * reading the stage off the seats: the map cannot lie about the ground.
 *
 * Not every club climbs to the top, exactly as not every club affords a
 * level-five academy. How far you get is set by how many people will actually
 * come, which is demandCeiling below - and that only moves when a club fills
 * what it already has.
 */
export const GROUND_TIERS = [1_500, 3_000, 6_000, 9_000, 15_000, 32_000] as const

/** Which of the six grounds this is. Absolute, so it is the same answer for
 *  every club in the world and for the art on the campus map. */
export function groundLevel(capacity: number): number {
  let n = 0
  for (let i = 1; i < GROUND_TIERS.length; i++) if (capacity >= GROUND_TIERS[i]) n = i
  return n
}

/**
 * HOW LONG A STAND TAKES, by the stage being built.
 *
 * The same shape as the facility ladder: the first rung is a few weeks of
 * groundwork and the last is most of a quarter of a season, because the last
 * rung is a stadium. Indexed by TARGET stage, so groundBuildWeeks(1) is the
 * climb out of a village ground.
 */
const GROUND_BUILD_WEEKS = [6, 8, 10, 12, 16] as const

export function groundBuildWeeks(level: number): number {
  const i = Math.max(1, Math.min(GROUND_TIERS.length - 1, Math.round(level))) - 1
  return GROUND_BUILD_WEEKS[i]
}

/** Weeks to finish a build that ends at `level`. Clamped, because a corrupt
 *  save naming level 9 should take the longest build, not crash on undefined. */
export function buildWeeks(level: number): number {
  const i = Math.max(1, Math.min(MAX_FACILITY, Math.round(level))) - 1
  return FACILITY_BUILD_WEEKS[i]
}

/** The level the user's club holds. Facilities live on the club, so taking a
 *  new job means inheriting that club's buildings, not carrying your own. */
export function facLevel(state: GameState, fid: FacilityId): number {
  return state.clubs[state.userClubId]?.facilities?.[fid] ?? 0
}

/**
 * How many people this club could put in a ground for a good game, concrete
 * aside. Reputation and standing, not seats.
 *
 * Attendance used to be a pure fraction of capacity, which meant a club that
 * filled its ground qualified to expand it, and then filled the bigger one
 * too, for ever: a 20-season soak grew Northampton's 15,249 to 64,149 across
 * thirteen new stands. A catchment does not grow because you laid more
 * concrete. Once capacity passes this figure the ground stops selling out,
 * which is what ends the spiral.
 */
export function demandCeiling(club: Club): number {
  // Anchored to the club's own opening capacity, not derived from reputation.
  // Two attempts at a rep curve both failed on real data, because how big a
  // ground is relative to its following is a fact about the club, not about
  // its league: Valence Romans hold 15,000 and draw a few thousand, while
  // Franklin's Gardens sells out at 15,249. Any curve that let Valence keep
  // its gate made Welford Road expandable to 60,000.
  //
  // So: the real ground is the floor, and a successful club can grow its
  // following by a further 15% to 40%, deeper for a bigger name. Every club
  // starts below its own ceiling, which means season one is untouched by this
  // and only growth is policed.
  /**
   * ---- AND A FOLLOWING IS EARNED (v1.6.8) ----
   *
   * Anchoring on the opening ground alone capped every club in the world at
   * about 1.15x to 1.4x the seats it started with, for ever. That was right
   * while the ground crept up 6% at a time; it makes the 0-to-5 ladder above
   * a lie, because a village club on 1,500 could never justify the 3,000 that
   * is stage one, and a board that will not build seats it cannot sell would
   * refuse every rung of it.
   *
   * So the anchor grows - but only by being earned. `following` moves at the
   * rollover, and only for a club that filled what it already had for a whole
   * season (rollover.ts). Nothing about this inflates a gate on its own: a
   * club that does not sell out never moves, and one that does has a crowd
   * that demonstrably exists. It is capped, because a following is not a
   * compound interest account.
   */
  const base = (club.capacity0 ?? club.capacity) * (club.following ?? 1)
  return Math.round(base * (1.15 + Math.max(0, club.rep - 55) / 145))
}

/** The ceiling on an earned following: three and a half times the crowd a
 *  club opened with is a generation of sold-out Saturdays, and past that the
 *  town has run out of people. */
export const MAX_FOLLOWING = 3.5

/** Every facility level the club holds, 0 to 45 across the nine buildings. */
function estateSum(club: Club | undefined): number {
  if (!club?.facilities) return 0
  return (Object.keys(FACILITY_INFO) as FacilityId[]).reduce((s, fid) => s + (club.facilities?.[fid] ?? 0), 0)
}

/**
 * What it costs to open the doors each week, whether or not there is a match:
 * the ground itself, and every building on the estate with staff inside it.
 *
 * This exists because a 20-season soak ended with the manager's club on £179M
 * against an AI median of £15M, and a maxed estate (38 of 40) that had cost
 * nothing to keep. Upgrades have to be a commitment, not a ratchet.
 */
/** What a seat costs to heat, mow, steward and insure for a week. ONE number,
 *  read by the user's ledger here and by every AI club's in aiecon.ts - they
 *  were 1.1 and 3.1 for a while, which made the manager's ground a third the
 *  price of everybody else's. */
const UPKEEP_PER_SEAT = 3.1

/**
 * ---- A STADIUM COSTS MORE PER SEAT THAN A TERRACE (owner, v1.6.9) ----
 *
 * The seat price was flat, so a 32,000 stadium cost exactly twice a 16,000
 * ground to run. A real one does not: the things that arrive with size are
 * the expensive ones. A roof and the safety certificate that comes with it.
 * Lifts. Pumps. Floodlights that have to meet a broadcast standard rather
 * than let you see the ball. A stewarding ratio set by the licence rather
 * than by what you think you need. Concourse lighting and refrigeration that
 * run whether or not there is a match.
 *
 * So the seat price climbs the same ladder the ground does, and it climbs
 * faster at the top where those things live: a stage-five stadium runs at
 * 1.55 a seat against a village ground's 1.00. At the top that is the
 * difference between £4.8M and £7.4M a season, which is the point - a
 * stadium is an asset you have to keep, not a number that went up.
 *
 * MEASURED, not chosen. The first cut topped out at 1.55 and econprobe walked
 * four seasons at Northampton: the weekly ledger went from +£41k to +£6k, the
 * club's balance fell over three of the four years, and the AI median dropped
 * with it because every club in the world pays this. A ground nobody can
 * afford to keep is not a decision either - it just means the estate is never
 * built. At 1.45 the drag is real and the club still funds itself.
 *
 * ONE TABLE FOR THE WHOLE WORLD, read here for the manager and in aiecon.ts
 * for the other hundred clubs. The last time those two disagreed the manager
 * ran his ground at a third of everybody else's price and was four times
 * richer than the median by season three.
 */
export const GROUND_UPKEEP_F = [1, 1.05, 1.12, 1.20, 1.30, 1.45] as const

/** What this ground costs to run for a week, gross, before the estate and the
 *  boxes and before it has earned anything back. */
export function groundUpkeep(capacity: number): number {
  return capacity * UPKEEP_PER_SEAT * GROUND_UPKEEP_F[groundLevel(capacity)]
}

/**
 * ---- AND WHAT IT EARNS WHEN THERE IS NO RUGBY ON ----
 *
 * The multiplier above was measured on its own first, and on its own it
 * breaks the world: every club in the game pays it, and eight seasons in,
 * 57 of 101 clubs were in the red with thirteen in administration against a
 * baseline of 36 and four. A transfer market where the median club is
 * insolvent is not a harder game, it is a stopped one.
 *
 * The cause was an asymmetry rather than the number. A big ground is not
 * only a bigger bill, it is a bigger business - conferences, banqueting,
 * stadium tours, a naming deal, a concourse that trades midweek - and the
 * manager was given that upside as stories in upkeep.ts while the other
 * hundred clubs were given only the bill.
 *
 * So the same building earns on the same ladder, for everybody. It offsets
 * most of the extra cost and not all of it, which is the design: a stadium
 * is a manageable standing drag, and the REAL challenge is the variance -
 * the seats, the toilets, the cellar and the electricity bill that arrive
 * when they feel like it.
 */
const GROUND_TRADE_F = [0, 0.15, 0.35, 0.55, 0.75, 1] as const

export function groundTrade(capacity: number): number {
  return capacity * UPKEEP_PER_SEAT * 0.26 * GROUND_TRADE_F[groundLevel(capacity)]
}

export function operatingCost(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  // Hospitality (F31) carries a second bill on top of the flat per-level cost,
  // and it has to, because it earns a PERCENTAGE OF THE GATE and the gate is
  // large next to £1,400 a week. At £1,400 a level a maxed block returned four
  // times its upkeep in every world, which is not a decision, it is a printer.
  // Boxes need chefs, hosts and cleaners whether or not there is a match, so a
  // second charge is honest as well as necessary.
  //
  // £2,800 is MEASURED, not estimated. The first figure was £4,500, derived by
  // hand from "one home game every three weeks", and scripts/econprobe walked
  // four real seasons and showed what that actually did: +£20k a week on the gate
  // against +£23k of upkeep, so a manager who built boxes was slightly worse off
  // than one who did not. A building nobody should build is not a decision
  // either. At £2,800 it returns about 1.4x its upkeep at Northampton's crowd.
  //
  // It scales with the gate, so it is worth more at a big ground than a small
  // one. That is correct rather than a flaw - boxes at a 40,000 stadium really
  // are better business - but it does mean the ratio is nearer 3x for a giant,
  // and anybody raising the 4% should re-read that sentence first.
  const boxes = (club.facilities?.hospitality ?? 0) * 2_800
  // THE SAME GROUND COSTS THE SAME TO RUN, whoever owns it. This charged the
  // user 1.1 a seat a week while aiecon charges every other club in the world
  // 3.1 (UPKEEP_PER_SEAT) - so a 25,000-seat ground cost the manager £27.5k a
  // week and his rivals £77.5k, about £2.25M a season of free money that no
  // decision earned. Measured at Sale, the user held 4.6x the median AI balance
  // by season three without doing anything.
  //
  // The audit that found this also proposed indexing the user's RECEIPTS by
  // moneyIndex, the way aiWeek indexes every AI club's. That was tried and
  // reverted: measured over five seasons it made the divergence worse rather
  // than better, because indexing rewards a high-reputation club (Sale went
  // from 15.8M to 29.8M and cleared the richest AI club in the division) while
  // the seat cost falls hardest on a big ground (Leicester went the other way).
  // The two do not cancel; they redistribute. The seat price is an incoherence
  // and is fixed here. The indexing is a design question about whether a
  // manager's income should track wage inflation, and it needs deciding rather
  // than patching.
  // net of what the ground trades on a non-matchday: the same building, so
  // the same ladder (groundTrade above)
  return Math.round(groundUpkeep(club.capacity) - groundTrade(club.capacity) + estateSum(club) * 1_400 + boxes)
}

/**
 * The weekly commercial cheque: the reputation-driven sponsorship and broadcast
 * share, plus a central-distribution top-up for a club whose ground is smaller
 * than its name.
 *
 * The top-up exists because the wage bill scales with reputation while the gate
 * scales with the stadium, so a big name in a small ground was structurally
 * insolvent through nothing the manager did: Northampton (rep 86, 15,249 seats)
 * fell from +2.4M to -7.3M over four seasons while Leicester (rep 83, 25,849)
 * banked +17.2M. Paying everyone more would have been the wrong shape - it
 * would have handed Leicester money it did not need. So pay the gap and only
 * the gap, capped, because the expectation flattens at the top and an uncapped
 * slope made Toulouse six times richer than the league it plays in.
 *
 * A club whose ground fits its name gets exactly what it always got.
 */
/** the leagues whose small grounds draw the solidarity share (weeklyCentral) */
const SOLIDARITY = ['prem', 'top14', 'urc']

export function weeklyCentral(club: Club): number {
  // F30 moved the reputation-driven sponsorship out of here and into three
  // signable deals (commercial.ts). What is left is the money that arrives
  // whether or not anybody wants their name on your shirt: the broadcast and
  // central-distribution share, plus the small-ground top-up documented below.
  // The two halves together still pay what this one line used to, so long as the
  // three slots are sold at market rate - which is what makes the split neutral
  // against a calibrated economy, and what scripts/dealprobe.ts checks.
  const commercial = 40_000
  // THE TOP FLIGHT'S SOLIDARITY SHARE (1.8.14). The gap was sized to a club's
  // name, so the top flight's smallest name in its smallest ground was broke
  // by design: Newcastle, managed by anybody, lost £78k a week (their upkeep,
  // to the pound) and the manager was sacked in a quarter of seasons after
  // meeting the board's own objective. A top-flight club is now expected to
  // fill 18,000 seats whatever its name, and the share per missing seat is
  // larger at that level; a big ground gets nothing it did not get before.
  // THE EUROPEAN TOP FLIGHTS ONLY (1.8.15). Applied to every tier-1 league it
  // paid £86m a season into 41 clubs, most of it to American and Japanese
  // grounds of 4,500 to 6,000 seats in leagues where every ground is that size
  // (Washington alone £146k a week): by season fifteen of a world no club was in
  // the red and the sport held £1.1bn against £294m on 1.8.13. Premiership, Top
  // 14 and URC only: Newcastle keeps the full share (four careers of two
  // seasons, balance -£1.7m and two sackings on 1.8.13, +£0.05m and none on
  // this), at about half the cost.
  const top = SOLIDARITY.includes(club.leagueId)
  const expectedSeats = Math.max(top ? 18_000 : 0, Math.min(23_000, Math.max(0, club.rep - 45) * 620))
  const missingSeats = Math.max(0, expectedSeats - club.capacity)
  const perSeat = top ? 12 : 8.5
  // 8.5 per missing seat: 30 a ticket, ~85% full, one home game every three weeks
  // The MRC plays five home games where everyone else plays eleven (1.7.3), so
  // its central pot carries the gates its calendar does not: about six missing
  // home games of a small ground, spread over the ledger's weeks. Without it an
  // American club was broke by design, and fire-sold its best men into the
  // rest of the world every season.
  const shortSeason = club.leagueId === 'mrc' ? 18_000 : 0
  return Math.round(commercial + missingSeats * perSeat + shortSeason)
}

/**
 * What a club's infrastructure looks like before a manager touches it: sized
 * to its standing, varied per facility, deterministic per club. Ambitious
 * mid-table clubs have a good gym and no megastore; giants have both.
 */
export function initFacilities(club: Club, seed = 0): Partial<Record<FacilityId, number>> {
  const base = Math.max(0, Math.min(4, Math.round((club.rep - 50) / 10)))
  let h = (2166136261 ^ seed) >>> 0
  for (let i = 0; i < club.id.length; i++) h = Math.imul(h ^ club.id.charCodeAt(i), 16777619) >>> 0
  const out: Partial<Record<FacilityId, number>> = {}
  for (const fid of Object.keys(FACILITY_INFO) as FacilityId[]) {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13
    const r = (h >>> 0) % 100
    out[fid] = Math.max(0, Math.min(MAX_FACILITY, base + (r < 22 ? 1 : r < 52 ? -1 : 0)))
  }
  return out
}

/** A one-word verdict on the whole estate, for the infrastructure header. */
export function estateGrade(club: Club): { label: string; sum: number; max: number } {
  const ids = Object.keys(FACILITY_INFO) as FacilityId[]
  const sum = ids.reduce((s, f) => s + (club.facilities?.[f] ?? 0), 0)
  const max = ids.length * MAX_FACILITY
  const pct = sum / max
  return {
    // a KEY, so the screens t() it and the board's letters tIn('en', …) it
    label: pct >= 0.8 ? 'facilities.gradeWorldClass' : pct >= 0.62 ? 'facilities.gradeExcellent'
      : pct >= 0.44 ? 'facilities.gradeGood' : pct >= 0.26 ? 'facilities.gradeAdequate'
      : pct >= 0.12 ? 'facilities.gradeBasic' : 'facilities.gradeThreadbare',
    sum, max,
  }
}
