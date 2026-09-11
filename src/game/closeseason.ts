/**
 * ---- WHAT A RUGBY GROUND DOES IN JULY ----
 *
 * Owner, 7 Sep: "in the extra weeks, club can put on events - weddings, music
 * events, town shows, comedy nights, golf days, shooting days, sponsor events -
 * it shouldnt be completely impossible for them to make some money."
 *
 * He is right, and the version this replaces was worse than wrong - it was
 * lazy. Extending the season to hold the tour cost every club three weeks of
 * wages with nothing to earn against, so the books were simply switched off for
 * those weeks. That kept the economy honest and made the close season a hole in
 * the calendar where a real club is at its busiest commercially: the pitch is
 * empty, the function rooms are not, and a groundsman's summer is weddings and
 * a stage.
 *
 * SO THE BOOKS STILL DO NOT RUN - wages and upkeep stay paused, because the
 * economy was tuned for a 45-week year and three extra weeks of salary would
 * take a third of every club's income back off it - but the club can now EARN.
 * The events are the only money that moves in those weeks, which makes them
 * worth planning rather than a rounding error on a ledger nobody reads.
 *
 * WHAT DECIDES THE FEE. Two things a manager can actually change: how big the
 * ground is, and how good the hospitality is. A comedy night in a clubhouse
 * pays what it pays; a concert needs seats; a sponsor dinner needs somewhere
 * worth eating in. The estate has always been a cost centre with a vague
 * promise attached - this is the first thing that pays it back in cash.
 *
 * AND THE BIG ONE COSTS YOU SOMETHING. Twenty thousand people on a pitch in
 * July is the best cheque of the summer and it wrecks the grass, so a concert
 * bills the re-turfing against the fee. It is still worth doing. It should not
 * be free.
 */
import type { GameState } from './model'
import { LEDGER_WEEKS, SEASON_WEEKS, facLevel, fmtMoney } from './model'
import { mulberry32 } from './rng'
import { t, tIn } from './i18n'

export interface CloseEvent {
  id: string
  /** hospitality level the room has to reach before it can be sold */
  needsHosp: number
  /** seats the ground has to hold */
  needsSeats: number
  /** flat fee before the ground and the rooms are counted */
  base: number
  /** how much of the fee scales with capacity */
  perSeat: number
  /** how much each level of hospitality is worth on top */
  perHosp: number
  /** re-turfing and repairs, billed against the fee */
  damage: number
  /** how often this event goes wrong, 0-1 (see MISHAPS below) */
  mishap: number
  /** what it costs when it does, as a share of the gross fee */
  mishapCost: number
}

/**
 * Seven of them, in the owner's own order. The small ones are always available
 * because a clubhouse is a clubhouse; the big ones ask something of the ground.
 */
export const CLOSE_EVENTS: readonly CloseEvent[] = [
  { id: 'wedding', needsHosp: 0, needsSeats: 0, base: 6_000, perSeat: 0.15, perHosp: 3_000, damage: 0, mishap: 0.18, mishapCost: 0.25 },
  { id: 'comedy', needsHosp: 0, needsSeats: 0, base: 5_000, perSeat: 0.10, perHosp: 2_500, damage: 0, mishap: 0.15, mishapCost: 0.20 },
  { id: 'townshow', needsHosp: 0, needsSeats: 4_000, base: 9_000, perSeat: 0.55, perHosp: 1_500, damage: 4_000, mishap: 0.22, mishapCost: 0.30 },
  { id: 'golf', needsHosp: 1, needsSeats: 0, base: 8_000, perSeat: 0.12, perHosp: 5_000, damage: 0, mishap: 0.18, mishapCost: 0.25 },
  { id: 'shooting', needsHosp: 1, needsSeats: 0, base: 7_000, perSeat: 0.08, perHosp: 4_500, damage: 0, mishap: 0.15, mishapCost: 0.30 },
  { id: 'sponsor', needsHosp: 2, needsSeats: 0, base: 12_000, perSeat: 0.20, perHosp: 11_000, damage: 0, mishap: 0.20, mishapCost: 0.25 },
  { id: 'concert', needsHosp: 1, needsSeats: 8_000, base: 20_000, perSeat: 2.40, perHosp: 6_000, damage: 45_000, mishap: 0.25, mishapCost: 0.35 },
]

/** How many go in the diary in any one week. */
export const SLATE_SIZE = 3

/**
 * ---- WHAT GOES WRONG, AND WHY IT IS THAT PARTICULAR THING ----
 *
 * Owner, 1.5.8: the diary should offer "three options, an explainer each, and
 * an occasional money cost matched to the correct event".
 *
 * The middle clause was already true. The other two were not: all seven were
 * listed every week, which is a price list rather than a decision, and the only
 * cost in the whole feature was the concert's re-turfing, quietly netted off
 * the fee before the manager ever saw it. So a summer had no downside in it and
 * booking the biggest number available was the entire game.
 *
 * Each event now carries its OWN way of going wrong - a marquee peg through the
 * irrigation at a town show, an insurance excess at the clay shoot, the
 * caterer's bill over the quote at a sponsors' dinner. Matched to the event on
 * purpose: a generic "something went wrong" card is a tax, and a manager
 * learns nothing from a tax. These teach which events carry which risk, which
 * is the thing that makes the choice between three of them mean something.
 *
 * COST IS A SHARE OF THE GROSS, not a flat figure, because the same accident
 * costs a Premier Division ground and a Championship one very different money -
 * the rest of the game's figures are proportional for the same reason
 * (proportionprobe holds the whole economy to it).
 *
 * Deterministic, and NOT off the shared rng: the same save books the same
 * wedding and gets the same broken window, however many times it is reloaded.
 */
export const MISHAPS: Readonly<Record<string, string>> = {
  wedding: 'close.mishapWedding',
  comedy: 'close.mishapComedy',
  townshow: 'close.mishapTownshow',
  golf: 'close.mishapGolf',
  shooting: 'close.mishapShooting',
  sponsor: 'close.mishapSponsor',
  concert: 'close.mishapConcert',
}

/** One stable number per (save, club, week, event) - the hearing's trick. */
function roll(state: GameState, id: string): number {
  let h = state.seed + state.season * 101 + state.week * 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return mulberry32(h)()
}

/**
 * THE THREE IN THE DIARY THIS WEEK. Drawn from the events the ground can
 * actually hold, so a locked row never takes one of the three slots - being
 * shown a concert you cannot host is not a choice, it is an advert for the
 * hospitality upgrade, and the Infrastructure page does that job properly.
 *
 * Stable for the week: the slate does not reshuffle under the manager's thumb
 * while he is reading it, and it does not change on reload.
 */
export function eventSlate(state: GameState): CloseEvent[] {
  const open = CLOSE_EVENTS.filter(ev => eventOpen(state, ev))
  if (open.length <= SLATE_SIZE) return open
  return [...open]
    .map(ev => ({ ev, k: roll(state, 'slate:' + ev.id) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, SLATE_SIZE)
    // back into the owner's order, so the diary reads the same way every week
    .sort((a, b) => CLOSE_EVENTS.indexOf(a.ev) - CLOSE_EVENTS.indexOf(b.ev))
    .map(x => x.ev)
}

/** Will this booking go wrong, and what does that cost? £0 when it does not. */
export function eventMishap(state: GameState, ev: CloseEvent): number {
  if (roll(state, 'mishap:' + ev.id) >= ev.mishap) return 0
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const hosp = facLevel(state, 'hospitality')
  const gross = ev.base + club.capacity * ev.perSeat + hosp * ev.perHosp
  return Math.round(gross * ev.mishapCost)
}

/** The weeks with no rugby in them: everything after the ledger closes. */
export const isCloseSeason = (week: number) => week > LEDGER_WEEKS && week <= SEASON_WEEKS

/** What this club would be paid for this event, after repairs. */
export function eventFee(state: GameState, ev: CloseEvent): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  const hosp = facLevel(state, 'hospitality')
  const gross = ev.base + club.capacity * ev.perSeat + hosp * ev.perHosp
  return Math.max(0, Math.round(gross - ev.damage))
}

/** Can the ground actually hold it? */
export function eventOpen(state: GameState, ev: CloseEvent): boolean {
  const club = state.clubs[state.userClubId]
  if (!club) return false
  return facLevel(state, 'hospitality') >= ev.needsHosp && club.capacity >= ev.needsSeats
}

/** Already booked something this week? One event a week - it is one ground. */
export function bookedThisWeek(state: GameState): string | null {
  return state.closeBook?.[String(state.week)] ?? null
}

export function bookEvent(state: GameState, id: string): string {
  const ev = CLOSE_EVENTS.find(e => e.id === id)
  const club = state.clubs[state.userClubId]
  if (!ev || !club) return t('reply.unavailable')
  if (!isCloseSeason(state.week)) return t('close.notNow')
  if (bookedThisWeek(state)) return t('close.alreadyBooked')
  if (!eventOpen(state, ev)) return t('close.cannotHost')
  const fee = eventFee(state, ev)
  // the bill for whatever went wrong, netted off the same cheque - a club is
  // paid once for a summer's evening, not paid and then invoiced a week later
  const bill = eventMishap(state, ev)
  const net = Math.max(0, fee - bill)
  club.balance += net
  ;(state.closeBook ??= {})[String(state.week)] = ev.id
  const v = { event_k: `close.${ev.id}`, fee: fmtMoney(net), club: club.name }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    // the subject key is the body key with Subj on the end (newsSubject in
    // news.ts), so a bad-night body needs its own headline or the inbox renders
    // the raw key - newsprobe caught exactly that here
    subject: tIn('en', bill > 0 ? 'close.newsBadSubj' : 'close.newsSubj', { event: tIn('en', `close.${ev.id}`) }),
    body: bill > 0
      ? tIn('en', 'close.newsBad', { event: tIn('en', `close.${ev.id}`), fee: fmtMoney(net), club: club.name, what: tIn('en', MISHAPS[ev.id]), bill: fmtMoney(bill) })
      : tIn('en', 'close.news', { event: tIn('en', `close.${ev.id}`), fee: fmtMoney(net), club: club.name }),
    k: bill > 0 ? 'close.newsBad' : 'close.news',
    v: bill > 0 ? { ...v, what_k: MISHAPS[ev.id], bill: fmtMoney(bill) } : v,
  })
  return bill > 0
    ? t('close.bookedBad', { event: t(`close.${ev.id}`), fee: fmtMoney(net), what: t(MISHAPS[ev.id]), bill: fmtMoney(bill) })
    : t('close.booked', { event: t(`close.${ev.id}`), fee: fmtMoney(fee) })
}

/**
 * The rest of the world does the same thing, because a summer where only the
 * manager's club can hire out its clubhouse is a summer that quietly makes him
 * richer than everyone else. Deterministic per club and week - it draws no rng,
 * so the shared world stream is untouched and a career already under way runs
 * exactly as it did.
 */
export function aiCloseSeason(state: GameState): void {
  if (!isCloseSeason(state.week)) return
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    const r = mulberry32(state.seed + club.id.length * 31 + state.week * 7 + state.season * 101)()
    // a modest, believable summer: the bigger the ground the better the diary
    club.balance += Math.round((6_000 + club.capacity * 0.35) * (0.6 + r * 0.8))
  }
}
