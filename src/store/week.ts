import type { GameState } from '../game/model'
import { processWeekAndAdvance, processWeekAndAdvanceAsync } from '../game/season'
import { firstStepOfWeek, matchDayIndex } from '../game/days'
import { postWindowNotes } from '../game/window'
import { countFinished, countWeek } from '../game/usage'
import { storeApi } from './api'
import { saveQueue } from './saveQueue'
import type { NavEntry, Store } from './types'

/** THE WEEK TURNS ALL AT ONCE OR NOT AT ALL (1.9.1).
 *
 *  processWeekAndAdvance changes the career in place, step by step: wages,
 *  drills, knocks, the table, the calendar. A throw halfway left a career that
 *  was neither last week nor this one, the next mark wrote it to disk, and a
 *  second tap ran the steps that had already run. Now a throw holds the writer
 *  so the half-turned career is never saved, puts the career back to the copy
 *  on disk, and rethrows so the crash log still records it. The same week
 *  failing twice in a row stops there rather than reloading forever. */
let failedWeek: string | null = null
/** settleguardprobe plants a failure here, after the week has been changed in
 *  memory, to prove the change is never written. Nothing in the game sets it. */
export const settleFault: { after: ((g: GameState) => void) | null } = { after: null }
export function settleWeek(g: GameState, get: () => Store): void {
  const key = `${g.seed}:${g.season}:${g.week}`
  try {
    processWeekAndAdvance(g)
    settleFault.after?.(g)
    failedWeek = null
  } catch (e) {
    saveQueue.hold(g)
    if (failedWeek === key) storeApi().setState(s => ({ weekFailed: 2, tick: s.tick + 1 }))
    else { failedWeek = key; void get().rollBack() }
    throw e
  }
}

/** A week settle running in slices (settleWeekAsync): nothing else may turn
 *  a week, or change the career, until it is done. */
let settling = false
export const isSettling = (): boolean => settling

/** settleWeek, sliced so the screen keeps painting (season.weekSteps). The
 *  save queue is held for the career while the week is half-turned, the
 *  screen is covered so no tap reaches the career, and a throw takes exactly
 *  the path settleWeek's does. */
export async function settleWeekAsync(g: GameState, get: () => Store): Promise<void> {
  const key = `${g.seed}:${g.season}:${g.week}`
  settling = true
  saveQueue.hold(g)
  storeApi().setState({ turning: true })
  try {
    await processWeekAndAdvanceAsync(g)
    settleFault.after?.(g)
    failedWeek = null
    saveQueue.resume()
  } catch (e) {
    if (failedWeek === key) storeApi().setState(s => ({ weekFailed: 2, tick: s.tick + 1 }))
    else { failedWeek = key; void get().rollBack() }
    throw e
  } finally {
    settling = false
    storeApi().setState({ turning: false })
  }
}

/** The browser game settles in slices; the probes, which have no screen to
 *  keep painting, settle in one go. Set once by App on mount. */
let sliceSettles = false
export const settleInSlices = (on: boolean): void => { sliceSettles = on }
export const slicedSettles = (): boolean => sliceSettles

/** Land on the first day of a freshly settled week.
 *
 *  Monday first, because that is where the results and the treatment room are.
 *  If the whole week is somehow empty this falls through to the round-up screen,
 *  which is what a blank week used to show.
 *
 *  Split out of continueWeek because finishMatch needs exactly the same landing:
 *  a week that ended in a match and a week that ended in a blank Saturday should
 *  resume on the same footing. */
export function landOnNextWeek(
  g: GameState,
  set: (fn: (s: Store) => Partial<Store>) => void,
  get: () => Store,
  extra: NavEntry[] = [],
  // a match played out on the way back into a career (resumeLiveMatch): Home
  // and nothing over it, as every load lands (round 5)
  homeOnly = false,
) {
  // the feedback report's week count (game/usage.ts): device state, keyed so
  // a week is counted once however it was reached
  countWeek(`${g.seed}:${g.season}:${g.week}`)
  // and the season it closed, when this Monday opens the end-of-season review:
  // the feedback card waits for a finished season (usage.feedbackDue)
  if (g.annual) countFinished(`${g.seed}:${g.annual.season}`)
  const step = firstStepOfWeek(g)
  g.day = step.kind === 'day' ? step.day : step.kind === 'match' ? (matchDayIndex(g) ?? 0) : 0
  // the window's countdown is posted as the walk reaches its day (window.ts)
  postWindowNotes(g)
  const dayEntry: NavEntry[] = step.kind === 'day' ? [{ screen: 'day' }] : []
  // THE ANNUAL GATE (25C): a rollover just happened, so before anything else
  // the manager gets the "ready for a new season?" page. It rides on TOP of
  // the normal landing, so its one button simply pops back into the new
  // season's Monday.
  const annualEntry: NavEntry[] = g.annual ? [{ screen: 'annual' }] : []
  // `extra` goes on TOP: after your own final whistle the round-up is the screen
  // you want, and the new week's Monday sits underneath it, so backing out of the
  // round-up puts you at the start of the week rather than nowhere.
  set(s => ({
    nav: homeOnly ? [{ screen: 'home' }] : [{ screen: 'home' }, ...dayEntry, ...extra, ...annualEntry],
    tick: s.tick + 1,
  }))
  void get().persist()
}
