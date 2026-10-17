import type { NavEntry, Screen, Store } from './types'

/** ---- where the manager was when the page went away ----
 *
 *  A reload used to drop you on the title screen with a Continue button, which
 *  is two taps to get back to a screen you never left, and on a phone the tab
 *  gets reloaded for you all the time. The save itself lives in IndexedDB and is
 *  already written every week; this is just the bookmark, so it is small enough
 *  for localStorage and losing it costs nothing.
 *
 *  Screens that only make sense mid-flow are not bookmarked. A live match is the
 *  important one: the ticker's state is in memory and is not saved, so resuming
 *  onto 'matchday' has to mean the pre-match hub, and resuming onto the Wire or a
 *  round-up would be a queue that no longer exists. */
const NO_RESUME = new Set<Screen>(['menu', 'newgame', 'wire', 'results', 'seasonreview'])
export const WHERE_KEY = 'rm-where'

/** Is the pre-match hub still the screen on top?
 *
 *  Kicking off and taking the assistant's instant result are both MatchDay
 *  buttons, and both settle the whole week before returning. A thumb that taps
 *  twice quickly can land the second tap after the first has already been
 *  honoured and the screen has moved on to the round-up - at which point the
 *  week has advanced, so the handler would happily find NEXT week's fixture and
 *  play it with no preview, no selection and no team talk. Refusing a call that
 *  arrives when MatchDay is no longer on top costs nothing and closes that. */
export function onMatchDay(get: () => Store): boolean {
  const nav = get().nav
  return nav[nav.length - 1]?.screen === 'matchday'
}

export function noteWhere(slot: string, nav: NavEntry[]) {
  const trail = nav.filter(e => !NO_RESUME.has(e.screen)).slice(-6)
  try {
    if (!trail.length) localStorage.removeItem(WHERE_KEY)
    else localStorage.setItem(WHERE_KEY, JSON.stringify({ slot, nav: trail }))
  } catch { /* private mode: the bookmark is a nicety, not a feature */ }
}

/** Has this tab already been running the game?
 *
 *  Marked on the first call, so the first call of a launch answers no and every
 *  call after a refresh answers yes. Private mode with storage disabled answers
 *  no for ever, which fails the safe way round: the title screen. */
const SESSION_KEY = 'rm-live'
export function sameSession(): boolean {
  try {
    const seen = sessionStorage.getItem(SESSION_KEY) === '1'
    sessionStorage.setItem(SESSION_KEY, '1')
    return seen
  } catch { return false }
}

export function readWhere(): { slot: string; nav: NavEntry[] } | null {
  try {
    const raw = localStorage.getItem(WHERE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { slot?: unknown; nav?: unknown }
    if (typeof v.slot !== 'string' || !Array.isArray(v.nav) || !v.nav.length) return null
    const nav = (v.nav as NavEntry[]).filter(e => e && typeof e.screen === 'string' && !NO_RESUME.has(e.screen))
    if (!nav.length) return null
    return { slot: v.slot, nav }
  } catch { return null }
}

/** Push the day bulletin, replacing one that is already open.
 *
 *  Continue is pressed from the bulletin itself, so without the filter the back
 *  stack would grow one entry per day and the back arrow would walk the manager
 *  backwards through a week that has already happened. */
export function openDay(nav: NavEntry[]): NavEntry[] {
  return [...nav.filter(e => e.screen !== 'day' && e.screen !== 'wire'), { screen: 'day' as const }]
}
