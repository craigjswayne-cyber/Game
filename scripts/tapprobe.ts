// Probe: one tap is one week.
//
// Found in the studio audit. continueWeek had no re-entrancy guard and the
// Continue button never disabled itself. processWeekAndAdvance is synchronous so
// there was never a true race, but the browser queues a second touch and
// dispatches it the moment the first handler returns, and a week settle measures
// 34ms median / 48ms worst on a two-season save - comfortably inside a human
// double tap. A player who tapped again because nothing had visibly happened was
// advancing two days, or skipping a day bulletin, or going straight through a
// matchday without seeing it.
//
// This drives the STORE rather than a browser, because the bug is queue
// arithmetic and a Playwright click cannot be dispatched faster than the handler
// returns. Calling continueWeek twice in a row with no await between them is
// exactly what two queued touch events do.
import { newGame } from '../src/game/newgame'
import { TAP_GUARD_MS, useStore } from '../src/store'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const st = useStore
const where = () => {
  const g = st.getState().game!
  return `s${g.season}w${g.week}d${g.day ?? 0}`
}

// ---- a double tap on a bulletin day moves exactly one day ------------------
{
  const g = newGame('northampton', 'Tap Probe', 31)
  st.setState({ game: g, nav: [{ screen: 'home' }], lastAdvanceAt: 0 })
  const before = where()
  st.getState().continueWeek()
  const afterOne = where()
  // the second tap arrives before anything has cleared the flag, which is what a
  // queued touch event looks like from the handler's point of view
  st.getState().continueWeek()
  const afterTwo = where()
  console.log(`  ${before} -> one tap ${afterOne} -> second tap ${afterTwo}`)
  ok(afterOne !== before, 'the first tap moves the game on')
  ok(afterTwo === afterOne, 'and the second tap, queued behind it, changes nothing')
}

// ---- the guard is not a one-way door --------------------------------------
//
// The failure mode of a guard like this is worse than the bug it fixes: jam it and
// Continue is dead for the rest of the save.
//
// Counting distinct days was the wrong assertion and failed twice before I stopped
// writing it: how many bulletin days a week has depends on the fixture list, and
// pre-season week 1 at Bath has exactly one. The property that actually matters is
// that NO DELIBERATE TAP IS SWALLOWED - every spaced-out tap must either move the
// game or hand over to a match. That holds whatever the calendar looks like.
{
  const g = newGame('bath', 'Tap Probe', 77)
  st.setState({ game: g, nav: [{ screen: 'home' }], lastAdvanceAt: 0 })
  let swallowed = 0
  let taps = 0
  for (let i = 0; i < 30; i++) {
    const before = where()
    const navBefore = st.getState().nav.length
    st.getState().continueWeek()
    taps++
    const moved = where() !== before || st.getState().nav.length !== navBefore
    if (!moved) swallowed++
    // if it handed over to a match, play it out of the way so the walk continues
    const mi = st.getState().nav.findIndex(n => n.screen === 'matchday')
    if (mi >= 0) st.setState({ nav: [{ screen: 'home' }] })
    st.setState({ lastAdvanceAt: 0 })   // a deliberate tap, not a slip
  }
  console.log(`  ${taps} deliberate taps, ${swallowed} of them did nothing at all`)
  ok(swallowed === 0, 'no deliberate tap is ever swallowed - the guard debounces, it does not latch')
}

// ---- and a match day still stops the walk ---------------------------------
//
// The guard must not swallow the matchday hand-off: Continue on a match day
// navigates rather than settling, and a debounced tap must not eat that.
{
  const g = newGame('leicester', 'Tap Probe', 5)
  st.setState({ game: g, nav: [{ screen: 'home' }], lastAdvanceAt: 0 })
  let hitMatch = false
  for (let i = 0; i < 40; i++) {
    st.getState().continueWeek()
    if (st.getState().nav.some(n => n.screen === 'matchday')) { hitMatch = true; break }
    st.setState({ lastAdvanceAt: 0 })
  }
  ok(hitMatch, 'Continue still reaches a matchday')
}

console.log(fails ? `\nTAP PROBE FAILED (${fails})` : '\nTAP PROBE PASSED: one tap is one week')
process.exit(fails ? 1 : 0)
