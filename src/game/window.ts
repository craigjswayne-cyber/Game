import type { GameState } from './model'
import { LEDGER_WEEKS, SEASON_WEEKS, seasonStart } from './model'
import { tIn } from './i18n'

/**
 * ---- THE TWO TRANSFER WINDOWS (1.8.12) ----
 *
 * Owner: "There should be 2 transfer windows (end of season til beginning of
 * Oct) and (January) in a season aside from medical jokers. This should apply
 * to all teams - a team signed my player outside the window."
 *
 * THE SUMMER WINDOW opens the week after the last league week (the close
 * season, LEDGER_WEEKS) and runs through the rollover to the week holding the
 * start of October. Week 8 is Mon 28 Sep to Sat 3 Oct in 2026-27, and across
 * the calendar its Saturday falls between 28 Sep and 4 Oct, so the window
 * shuts on the first weekend of October or the last of September.
 *
 * THE JANUARY WINDOW is weeks 22 to 25: their Saturdays fall between 4 and
 * 31 January in every season the calendar produces, so all four are January
 * weeks (the first can start on 30 or 31 December) and none reaches into
 * February. In a season that opens on 10 or 11 August the window shuts on the
 * 25th or 26th rather than the 31st, which is the price of a window that is
 * the same weeks every season.
 *
 * Every week of a window is open for the whole of it, Monday to Saturday: the
 * engine settles the week's deals on the Saturday, so the window shuts when the
 * last window week is settled.
 *
 * One place for the weeks. Every gate, chip, story and probe reads these.
 */
export const SUMMER_OPEN = LEDGER_WEEKS + 1
export const SUMMER_SHUT = 8
export const JANUARY_OPEN = 22
export const JANUARY_SHUT = 25

/** Is the transfer window open in this week? */
export function windowOpen(week: number): boolean {
  return week >= SUMMER_OPEN || week <= SUMMER_SHUT || (week >= JANUARY_OPEN && week <= JANUARY_SHUT)
}

/** The last week of a window: deadline week. */
export const isDeadlineWeek = (week: number): boolean => week === SUMMER_SHUT || week === JANUARY_SHUT

/** The week after this one, across the summer. */
export const nextWeek = (week: number): number => (week >= SEASON_WEEKS ? 1 : week + 1)

/** The week before this one, across the summer. */
export const prevWeek = (week: number): number => (week <= 1 ? SEASON_WEEKS : week - 1)

/** Which window opens next from a shut week: January before it, summer after. */
export const nextOpening = (week: number): 'january' | 'summer' =>
  week > SUMMER_SHUT && week < JANUARY_OPEN ? 'january' : 'summer'

/**
 * A date as a story variable that follows the reader's language: the English
 * under `name` for the stored body, and a `_j` fragment the inbox renders in
 * whatever language is on screen (i18n.ts fill). Day 0 is Monday, 5 Saturday.
 */
function dateVars(name: string, season: number, week: number, day: number): Record<string, string> {
  const d = new Date(seasonStart(season) + ((week - 1) * 7 + (day - 5)) * 86400000)
  const frag = { k: 'date.short', d: d.getUTCDate(), dow_k: `date.day${d.getUTCDay()}`, mon_k: `date.mon${d.getUTCMonth()}` }
  return { [name]: tIn('en', 'date.short', frag), [`${name}_j`]: JSON.stringify(frag) }
}

/** The Saturday the window open in this week shuts on, and the season it falls in. */
function shutAt(state: GameState): { season: number; week: number } {
  return state.week >= SUMMER_OPEN ? { season: state.season + 1, week: SUMMER_SHUT }
    : state.week <= SUMMER_SHUT ? { season: state.season, week: SUMMER_SHUT }
    : { season: state.season, week: JANUARY_SHUT }
}

/** The Monday the next window opens on, from a shut week. */
function opensAt(state: GameState): { season: number; week: number } {
  return { season: state.season, week: nextOpening(state.week) === 'january' ? JANUARY_OPEN : SUMMER_OPEN }
}

/** The shut date for the chip and the refusals, in the reader's language. */
export function shutDate(state: GameState): Record<string, string> {
  const s = shutAt(state)
  return dateVars('date', s.season, s.week, 5)
}

/** The opening date, likewise. */
export function openDate(state: GameState): Record<string, string> {
  const o = opensAt(state)
  return dateVars('date', o.season, o.week, 0)
}

/**
 * ---- THE COUNTDOWN (owner: "a warning 3 days, 2 days, final 24 hours with a
 * clear message it is closed") ----
 *
 * Five notices a window, each on its own day of the reveal (days.ts):
 *
 *   open   Monday of the first window week
 *   left3  Wednesday of deadline week: Thursday, Friday and Saturday to go
 *   left2  Thursday
 *   left1  Friday: the final 24 hours, the window shutting on the Saturday
 *   shut   Monday of the week after, naming when it reopens
 *
 * The week's stories are settled in one go, so a notice is posted when the
 * walk reaches its day (store.ts calls postWindowNotes on every step), and the
 * settle posts anything the walk did not reach before it moves on: a week
 * simulated without the day walk still carries every notice, in order. A
 * stamp in the save (windowNote) makes each one post once, reload or not.
 */
export type WindowNote = 'open' | 'left3' | 'left2' | 'left1' | 'shut'

/** The notice due on this day of this week, if any. Pure. */
export function windowNoteOn(week: number, day: number): WindowNote | null {
  if (day === 0 && (week === SUMMER_OPEN || week === JANUARY_OPEN)) return 'open'
  if (day === 0 && (week === SUMMER_SHUT + 1 || week === JANUARY_SHUT + 1)) return 'shut'
  if (isDeadlineWeek(week)) return day === 2 ? 'left3' : day === 3 ? 'left2' : day === 4 ? 'left1' : null
  return null
}

/** The stamp a notice is posted under: one number per day of the career. */
const noteStamp = (season: number, week: number, day: number) => (season * 100 + week) * 10 + day

/** Is a notice due on this day of the current week and not yet posted? */
export function windowNoteDue(state: GameState, day: number): boolean {
  if (state.unemployed || state.retired) return false
  return !!windowNoteOn(state.week, day) && (state.windowNote ?? -1) < noteStamp(state.season, state.week, day)
}

/** Post every notice due this week up to and including `upTo` (the current
 *  day by default) that has not been posted. The manager's inbox only. */
export function postWindowNotes(state: GameState, upTo?: number): void {
  if (state.unemployed || state.retired || !state.clubs[state.userClubId]) return
  const last = upTo ?? (typeof state.day === 'number' ? state.day : 0)
  for (let day = 0; day <= last; day++) {
    const note = windowNoteOn(state.week, day)
    if (!note || !windowNoteDue(state, day)) continue
    state.windowNote = noteStamp(state.season, state.week, day)
    const k = note === 'open' ? (state.week === JANUARY_OPEN ? 'news.windowOpenJanuary' : 'news.windowOpenSummer')
      : note === 'shut' ? (nextOpening(state.week) === 'january' ? 'news.windowShutJanuary' : 'news.windowShutSummer')
      : `news.window${note[0].toUpperCase()}${note.slice(1)}`
    const v = note === 'shut' ? openDate(state) : shutDate(state)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v, day,
    })
  }
}
