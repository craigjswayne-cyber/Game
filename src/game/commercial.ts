// ---- THE COMMERCIAL DEPARTMENT (F30) ----
//
// Commercial income was one line of arithmetic: `club.rep * 1800 + 40_000` a
// week, for ever, with nothing in it you could touch. Win a title and the number
// went up because your reputation went up. That is not a commercial department,
// it is a thermometer.
//
// Now there are three things to sell - the front of the shirt, the name on the
// ground, and the kit deal - and each is a contract with a value, a length and
// sometimes a clause. The decisions are real ones:
//
//   - a long deal is safe money and is worth LESS per season than a short one,
//     because the sponsor is buying certainty off you
//   - a short deal lets you go back to the market after a good season, when your
//     reputation has moved and the market rate with it
//   - a clause pays more than market, but only if you deliver, and the biggest
//     offers hang on things you might not manage
//   - and a slot left empty pays nothing at all, which is the cost of ignoring
//     the whole screen
//
// ---- MEAN-NEUTRALITY, WHICH IS THE WHOLE PROBLEM ----
//
// The economy is calibrated. scripts/econprobe.ts holds a club to "solvent by
// playing, and not richer than the world", and that balance was struck against
// the flat formula. So the three slots do not ADD income: they DIVIDE the income
// the formula already paid. The shares below sum to exactly 1, and an offer at
// the market rate pays exactly its share of `rep * 1800`.
//
// The £40,000 floor stays outside the slots, in weeklyCentral, because it is the
// broadcast and central-distribution money that arrives whether or not anybody
// wants to sponsor you. A club that lets all three deals lapse still gets that,
// and nothing else.
//
// What a player CAN do is beat the market by taking risk: a clause-laden deal
// that pays out is worth more than the formula ever paid. That is the reward for
// engaging with the system, and it is bounded - see MAX_UPLIFT.
import { fmtMoney, logDecision, type GameState } from './model'

export type SlotId = 'shirt' | 'naming' | 'kit'

export interface SlotInfo {
  id: SlotId
  name: string
  icon: string
  /** what the sponsor is actually buying */
  desc: string
  /** this slot's share of the club's commercial income. The three sum to 1. */
  share: number
}

export const SLOTS: SlotInfo[] = [
  {
    id: 'shirt', name: 'Front of Shirt', icon: '👕', share: 0.46,
    desc: 'The main sponsor. The biggest single cheque in the building, and the one the supporters notice.',
  },
  {
    id: 'naming', name: 'Stadium Naming Rights', icon: '🏟', share: 0.24,
    desc: 'Somebody else’s name over the gates. Lucrative, and never popular on the terraces.',
  },
  {
    id: 'kit', name: 'Kit Supplier', icon: '🧵', share: 0.30,
    desc: 'Who makes the shirts. Pays in cash and in replica sales through the club shop.',
  },
]

export const SLOT_BY_ID: Record<SlotId, SlotInfo> = Object.fromEntries(SLOTS.map(s => [s.id, s])) as Record<SlotId, SlotInfo>

/** The weekly commercial pot a club of this reputation can sell, before it is
 *  divided between the three slots. This is the number the old flat formula
 *  paid, so a fully-sold club at market rate is exactly where it always was.
 *  Not exported: marketRate is the public way in, and an exported helper nothing
 *  calls is the same untested dead weight that hid a wrong constant in venue.ts. */
const commercialPot = (rep: number) => Math.max(0, rep) * 1800

/** What one slot is worth per week at the going rate for this reputation. */
export function marketRate(rep: number, slot: SlotId): number {
  return Math.round(commercialPot(rep) * SLOT_BY_ID[slot].share)
}

/** The ceiling on what a slot pays once a clause is stacked on the base, as a
 *  multiple of the going market rate. Bounded on purpose: engaging with the
 *  department should be worth real money without becoming a cheat code that
 *  outruns the wage bill. It never cuts below the base a sponsor agreed - see
 *  dealWeekly for why that distinction cost a bug. */
export const MAX_UPLIFT = 1.32

/**
 * What the department takes on its own when a deal runs out and you did nothing.
 *
 * This exists because the first cut simply emptied the slot, and scripts/econprobe
 * caught what that meant: a manager who never opens this screen loses his whole
 * commercial income over four seasons and the club goes structurally insolvent.
 * "Solvent by playing" is a stated invariant of this game, and a new screen is not
 * allowed to break it.
 *
 * So neglect is a SMALL, PERMANENT DISCOUNT rather than a cliff. At 0.92 a passive
 * manager gives up about 8% of his commercial income - real money, worth about
 * £12k a week to a big club, and visible on the ledger - while an engaged one
 * takes market or beats it. The upside is the reward, rather than the downside
 * being a punishment, which is the same shape as every other dial in this engine:
 * neutral against what it replaced, with the manager's judgement as the variance.
 *
 * A caretaker is replaceable at any time. Being stuck with a stopgap you never
 * agreed to would be the cliff again, in slower motion.
 */
export const CARETAKER_RATE = 0.92

export type ClauseId = 'none' | 'top4' | 'europe' | 'silverware' | 'crowds'

export interface Clause {
  id: ClauseId
  /** what it says on the contract */
  text: string
  /** the extra fraction of market it pays while the condition holds */
  bonus: number
}

export const CLAUSES: Record<ClauseId, Clause> = {
  none: { id: 'none', text: 'No performance clause. The money is the money.', bonus: 0 },
  // The bonuses have to CLEAR the discount the clause deal is sold at, or the
  // whole offer is a trap: measured by scripts/dealprobe.ts, a 0.82x base with an
  // 0.18 bonus pays 0.97x, so taking the risk and winning still lost you money
  // against the safe deal. Every clause now beats market when it pays, at every
  // base the generator can produce.
  top4: { id: 'top4', text: 'Pays the bonus for as long as you sit in the top four.', bonus: 0.24 },
  europe: { id: 'europe', text: 'Pays the bonus in any season you are in the Champions Cup.', bonus: 0.22 },
  silverware: { id: 'silverware', text: 'Pays the bonus for a season after you win a trophy.', bonus: 0.32 },
  crowds: { id: 'crowds', text: 'Pays the bonus while the ground averages over 90% full.', bonus: 0.20 },
}

export interface Offer {
  slot: SlotId
  sponsor: string
  /** weekly base, before any clause */
  weekly: number
  /** seasons the deal runs for */
  years: number
  clause: ClauseId
  /** base as a multiple of market rate, for the UI to be honest about */
  vsMarket: number
}

export interface Deal {
  slot: SlotId
  sponsor: string
  weekly: number
  clause: ClauseId
  /** the season index this deal was signed in */
  from: number
  /** the season index it runs to, inclusive. Expires the summer after. */
  until: number
  /** the reputation it was signed against, so the UI can show it going stale */
  repAt: number
  /** true when the department took this itself because you did not act. A
   *  stopgap rather than a contract: you may replace it whenever you like. */
  auto?: boolean
}

// Invented brand names, deliberately. Real sponsors would be putting words in
// the mouths of real companies, and a fictional one reads no worse on a shirt.
const NAMES: Record<SlotId, string[]> = {
  shirt: [
    'Harborne Group', 'Vantail Energy', 'Castlebridge Insurance', 'Norlander Logistics',
    'Pemberton & Ross', 'Ironvale Steel', 'Selkirk Financial', 'Amberline Telecom',
    'Doverwood Motors', 'Greenhalgh Brewing',
  ],
  naming: [
    'Stanmoor', 'Ravensbank', 'Alderfield', 'Quenby', 'Thornecroft',
    'Larkhill', 'Brackenmoor', 'Westerhay', 'Coldwell', 'Marchmont',
  ],
  kit: [
    'Kestrel Athletic', 'Voltura', 'Brackett Sport', 'Ossian', 'Tanner & Hyde',
    'Meridian Kit', 'Foundry Athletic', 'Halstead Sportswear', 'Trueline', 'Verrick',
  ],
}

/** Deterministic on (seed, season, slot, index). No shared rng, ever: revisiting
 *  the screen must not reroll the offers on the table. */
function hash(seed: number, key: string): number {
  let h = (seed ^ 0x1b873593) >>> 0
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return (h >>> 0) % 10000
}

/**
 * The offers on the table for one slot.
 *
 * Three of them, and they are built to be a CHOICE rather than a ranking: the
 * long one pays under market, the short one pays over, and the third carries a
 * clause. Nobody has to be cleverer than anybody else to see which is which,
 * which is the point - the judgement is about your own season, not about
 * decoding the numbers.
 */
export function offersFor(state: GameState, slot: SlotId): Offer[] {
  const club = state.clubs[state.userClubId]
  if (!club) return []
  const rep = club.rep
  const mkt = marketRate(rep, slot)
  const names = NAMES[slot]
  const out: Offer[] = []

  // A: the long, safe, slightly cheap one
  {
    const h = hash(state.seed, `${slot}|${state.season}|long`)
    const years = 3 + (h % 2)                       // 3 or 4
    // above CARETAKER_RATE, or the safe long deal would be worse than doing
    // nothing at all and the whole offer would be a trap
    const vs = 0.95 + ((h >> 4) % 5) / 100          // 0.95 to 0.99
    out.push({
      slot, sponsor: names[h % names.length], years,
      weekly: Math.round(mkt * vs), clause: 'none', vsMarket: vs,
    })
  }
  // B: the short one at a premium, which asks you to come back and do this again
  {
    const h = hash(state.seed, `${slot}|${state.season}|short`)
    const years = 1 + (h % 2)                       // 1 or 2
    const vs = 1.04 + ((h >> 4) % 7) / 100          // 1.04 to 1.10
    out.push({
      slot, sponsor: names[(h + 3) % names.length], years,
      weekly: Math.round(mkt * vs), clause: 'none', vsMarket: vs,
    })
  }
  // C: the one with a clause in it
  {
    const h = hash(state.seed, `${slot}|${state.season}|clause`)
    const pool: ClauseId[] = ['top4', 'europe', 'silverware', 'crowds']
    const clause = pool[h % pool.length]
    const years = 2 + (h % 3)                       // 2 to 4
    // The base is BELOW market, and the clause is what lifts it over. That is
    // the trade: you are selling the sponsor your ambition, at a discount if it
    // turns out to be talk.
    const vs = 0.90 + ((h >> 4) % 6) / 100          // 0.90 to 0.95
    out.push({
      slot, sponsor: names[(h + 6) % names.length], years,
      weekly: Math.round(mkt * vs), clause, vsMarket: vs,
    })
  }
  return out
}

/** Is this clause paying out right now? Deterministic on the world's own state. */
export function clauseActive(state: GameState, clause: ClauseId): boolean {
  if (clause === 'none') return false
  const club = state.clubs[state.userClubId]
  if (!club) return false
  switch (clause) {
    case 'top4': {
      const comp = state.comps[club.leagueId]
      if (!comp?.table?.length) return false
      // sortTable lives in schedule.ts and importing it here would make a cycle,
      // so this ranks on the same keys: points, then difference.
      const rows = [...comp.table].sort((a, b) =>
        (b.pts ?? 0) - (a.pts ?? 0) || ((b.pf ?? 0) - (b.pa ?? 0)) - ((a.pf ?? 0) - (a.pa ?? 0)))
      const pos = rows.findIndex(r => r.teamId === club.id)
      // Before a ball is kicked nobody is top four. A clause that paid on an
      // empty table would hand out the bonus every August for nothing.
      return pos >= 0 && pos < 4 && rows.some(r => (r.p ?? 0) > 0)
    }
    case 'europe':
      return !!state.comps.cc?.table?.some(r => r.teamId === club.id) ||
        !!state.fixtures.some(f => f.compId === 'cc' && (f.homeId === club.id || f.awayId === club.id))
    case 'silverware':
      // a trophy in the last two seasons of the record book
      return (state.mgr?.trophies ?? []).some(t => (state.season - (t.season ?? -99)) <= 1)
    case 'crowds': {
      const home = state.fixtures.filter(f => f.played && f.homeId === club.id && f.att)
      if (home.length < 3) return false
      const avg = home.reduce((s, f) => s + (f.att ?? 0), 0) / home.length
      return avg / Math.max(1, club.capacity) >= 0.9
    }
    default:
      return false
  }
}

/**
 * What one live deal pays this week, clause included.
 *
 * The cap bounds the CLAUSE UPLIFT, not the agreed base. Capping the total was
 * wrong and dealprobe caught it: a sponsor who agreed £100k was paid £91k
 * because the ceiling sat below the contract, which is the game quietly tearing
 * up a deal the manager had signed. A base is a base. What must not run away is
 * clause money stacked on top of a rising market.
 *
 * The finite guard is not decoration. A damaged save with a NaN weekly would
 * otherwise add NaN to club.balance, and from that moment every number in the
 * career is NaN for ever - the same failure a NaN tactic dial once caused for
 * squad condition.
 */
export function dealWeekly(state: GameState, deal: Deal): number {
  const base = Number.isFinite(deal.weekly) ? Math.max(0, deal.weekly) : 0
  const bonus = clauseActive(state, deal.clause) ? (CLAUSES[deal.clause]?.bonus ?? 0) : 0
  const market = marketRate(state.clubs[state.userClubId]?.rep ?? 0, deal.slot)
  const ceiling = Math.max(base, Math.round(market * MAX_UPLIFT))
  const paid = Math.round(base * (1 + bonus))
  return Number.isFinite(paid) ? Math.min(ceiling, paid) : 0
}

/** Every live deal added up: what the commercial department pays this week. */
export function commercialWeekly(state: GameState): number {
  let sum = 0
  for (const slot of SLOTS) {
    const d = state.deals?.[slot.id]
    if (d && d.until >= state.season) sum += dealWeekly(state, d)
  }
  return sum
}

/** Sign an offer. Replaces whatever was in that slot. */
export function signOffer(state: GameState, offer: Offer): string {
  const club = state.clubs[state.userClubId]
  if (!club) return 'No club.'
  const live = state.deals?.[offer.slot]
  // a caretaker the department took on your behalf is a stopgap, not a contract:
  // replacing it is the whole point of being told about it
  if (live && live.until >= state.season && !live.auto) {
    return `The ${SLOT_BY_ID[offer.slot].name.toLowerCase()} is already under contract to ${live.sponsor} until the end of ${2026 + live.until}. You cannot sell it twice.`
  }
  state.deals ??= {}
  state.deals[offer.slot] = {
    slot: offer.slot, sponsor: offer.sponsor, weekly: offer.weekly, clause: offer.clause,
    from: state.season, until: state.season + offer.years - 1, repAt: club.rep,
  }
  const yrs = offer.years === 1 ? 'one season' : `${offer.years} seasons`
  logDecision(state, `Signed ${offer.sponsor} for the ${SLOT_BY_ID[offer.slot].name.toLowerCase()}: ${fmtMoney(offer.weekly)} a week over ${yrs}.`, true)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: `${SLOT_BY_ID[offer.slot].icon} ${offer.sponsor} sign on with ${club.short}`,
    body: offer.clause === 'none'
      ? `${offer.sponsor} take the ${SLOT_BY_ID[offer.slot].name.toLowerCase()} for ${yrs} at ${fmtMoney(offer.weekly)} a week. The commercial department is pleased with itself, and the money starts arriving on Friday.`
      : `${offer.sponsor} take the ${SLOT_BY_ID[offer.slot].name.toLowerCase()} for ${yrs} at ${fmtMoney(offer.weekly)} a week, with a clause: ${CLAUSES[offer.clause].text.toLowerCase()} Deliver and it is the best deal in the building. Do not, and you have sold cheap.`,
  })
  return `Done. ${offer.sponsor}, ${fmtMoney(offer.weekly)} a week, ${yrs}.`
}

/**
 * Season rollover: retire the deals that have run their course and tell the
 * manager, so an empty slot is a decision he knows he is making rather than a
 * quiet hole in the accounts.
 */
export function expireDeals(state: GameState) {
  if (!state.deals) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  for (const slot of SLOTS) {
    const d = state.deals[slot.id]
    if (!d || d.until >= state.season) continue
    // The department does not leave the front of the shirt blank. It takes the
    // best thing on its desk, which is below the going rate because nobody
    // negotiated it - see CARETAKER_RATE for why this is a discount and not a
    // cliff.
    const rate = Math.round(marketRate(club.rep, slot.id) * CARETAKER_RATE)
    const h = hash(state.seed, `auto|${slot.id}|${state.season}|${club.id}`)
    const names = NAMES[slot.id]
    state.deals[slot.id] = {
      slot: slot.id, sponsor: names[h % names.length], weekly: rate, clause: 'none',
      from: state.season, until: state.season + 1, repAt: club.rep, auto: true,
    }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `${slot.icon} ${d.sponsor} deal expires`,
      body: `The ${slot.name.toLowerCase()} is out of contract: ${d.sponsor} have come to the end of their term. Rather than leave it blank the commercial department has taken a rolling arrangement with ${names[h % names.length]} at ${fmtMoney(rate)} a week, which is under the going rate because nobody argued for you. Better offers are on the table whenever you want them, and you can replace this one at any time.`,
    })
  }
}

/**
 * A world that has never seen this system has to start with its shirt sold, or
 * every existing save loses its commercial income overnight and every new career
 * starts poorer than the balance sheet it was calibrated against.
 *
 * So an untouched club is INHERITED fully sold, at market rate, on staggered
 * expiries. That is both the safe migration and the truer fiction: you do not
 * arrive at a club with the front of its shirt blank.
 */
export function seedDeals(state: GameState) {
  const club = state.clubs[state.userClubId]
  if (!club || state.deals) return
  state.deals = {}
  for (const [i, slot] of SLOTS.entries()) {
    const h = hash(state.seed, `inherit|${slot.id}|${club.id}`)
    const names = NAMES[slot.id]
    state.deals[slot.id] = {
      slot: slot.id, sponsor: names[h % names.length],
      weekly: marketRate(club.rep, slot.id), clause: 'none',
      from: state.season,
      // staggered, so all three do not fall due in the same summer
      until: state.season + 1 + ((h + i) % 3),
      repAt: club.rep,
    }
  }
}
