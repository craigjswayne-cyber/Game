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
}

/**
 * Seven of them, in the owner's own order. The small ones are always available
 * because a clubhouse is a clubhouse; the big ones ask something of the ground.
 */
export const CLOSE_EVENTS: readonly CloseEvent[] = [
  { id: 'wedding', needsHosp: 0, needsSeats: 0, base: 6_000, perSeat: 0.15, perHosp: 3_000, damage: 0 },
  { id: 'comedy', needsHosp: 0, needsSeats: 0, base: 5_000, perSeat: 0.10, perHosp: 2_500, damage: 0 },
  { id: 'townshow', needsHosp: 0, needsSeats: 4_000, base: 9_000, perSeat: 0.55, perHosp: 1_500, damage: 4_000 },
  { id: 'golf', needsHosp: 1, needsSeats: 0, base: 8_000, perSeat: 0.12, perHosp: 5_000, damage: 0 },
  { id: 'shooting', needsHosp: 1, needsSeats: 0, base: 7_000, perSeat: 0.08, perHosp: 4_500, damage: 0 },
  { id: 'sponsor', needsHosp: 2, needsSeats: 0, base: 12_000, perSeat: 0.20, perHosp: 11_000, damage: 0 },
  { id: 'concert', needsHosp: 1, needsSeats: 8_000, base: 20_000, perSeat: 2.40, perHosp: 6_000, damage: 45_000 },
]

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
  club.balance += fee
  ;(state.closeBook ??= {})[String(state.week)] = ev.id
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', 'close.newsSubj', { event: tIn('en', `close.${ev.id}`) }),
    body: tIn('en', 'close.news', { event: tIn('en', `close.${ev.id}`), fee: fmtMoney(fee), club: club.name }),
    k: 'close.news', v: { event_k: `close.${ev.id}`, fee: fmtMoney(fee), club: club.name },
  })
  return t('close.booked', { event: t(`close.${ev.id}`), fee: fmtMoney(fee) })
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
