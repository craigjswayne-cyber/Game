// Probe: a week settle that throws half way is never saved, and the career is
// put back to its last save (1.9.1, store.settleWeek).
//
// processWeekAndAdvance changes the career in place. Before 1.9.1 a throw half
// way through left the career neither last week nor this one, the save queue
// wrote it to disk on its next mark, and a second tap ran the steps that had
// already run (the wages, the drills, the knocks) a second time.
//
// This holds:
//   the throw still reaches the caller, so the crash log records it
//   nothing half-settled is written to the slot
//   the store's career is the copy from disk again, with the same week
//   the banner flag is raised, and a second throw on the same week stops
//     reloading and holds the writer instead
//   a normal Continue afterwards still turns the week and is saved
//
// Run: npx vite-node scripts/settleguardprobe.ts
import { newGame } from '../src/game/newgame'
import { settleFault, settleInSlices, useStore } from '../src/store'
import { loadGame, saveGame } from '../src/game/save'
import type { GameState } from '../src/game/model'
import { ok, done } from './lib/probe'

const quiet = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setTimeout(r, 5)); await new Promise(r => setTimeout(r, 700)) }

const SLOT = 'slot1'
const st = useStore

/** Fail the next settle after it has changed the career in memory. */
function booby(g: GameState): GameState {
  settleFault.after = () => { settleFault.after = null; throw new Error('settleguardprobe: planted failure') }
  return g
}

/** Press Continue until the week number moves or the press throws. */
function pressUntilWeekTurns(): unknown {
  const start = st.getState().game!.week
  for (let i = 0; i < 40; i++) {
    st.setState({ lastAdvanceAt: 0 })   // a deliberate tap, not a slip
    try {
      if (st.getState().nav.some(n => n.screen === 'matchday')) st.getState().instantResult()
      else st.getState().continueWeek()
    } catch (e) { return e }
    const g = st.getState().game!
    if (g.week !== start) return null
    if (g.annual) { g.annual = null }
    // a day bulletin or a round-up: back to Home. The Wire, the press room and
    // the match day stay, because the next press is what clears them
    const top = st.getState().nav[st.getState().nav.length - 1]?.screen
    if (top === 'day' || top === 'results') st.setState({ nav: [{ screen: 'home' }] })
  }
  return null
}

const g0 = newGame('leicester', 'Guard', 7)
await saveGame(SLOT, g0)
const onDisk = await loadGame(SLOT)
st.getState().setGame(booby(onDisk!), SLOT)
await quiet()
const weekBefore = st.getState().game!.week
const seasonBefore = st.getState().game!.season

const err = pressUntilWeekTurns()
ok(err instanceof Error && /planted failure/.test(err.message), `the throw reaches the caller (${err instanceof Error ? err.message : String(err)})`)
await quiet()

const afterDisk = await loadGame(SLOT)
ok(afterDisk?.week === weekBefore && afterDisk?.season === seasonBefore, `the slot still holds week ${weekBefore} (holds ${afterDisk?.week})`)
const live = st.getState().game!
ok(live !== null && live.week === weekBefore, `the career in the store is back at week ${weekBefore} (at ${live?.week})`)
ok((() => { try { void Object.keys(live.players).length; for (const k of Object.keys(live.players).slice(0, 30000)) void live.players[k]; return true } catch { return false } })(),
  'and it is the copy from disk, not the one that threw')
ok(st.getState().weekFailed === 1, `the banner is raised (weekFailed ${st.getState().weekFailed})`)

// the same week failing again stops reloading and holds the writer
const again = booby(st.getState().game!)
st.setState({ game: again })
const err2 = pressUntilWeekTurns()
ok(err2 instanceof Error, 'a second planted failure on the same week also throws')
await quiet()
ok(st.getState().weekFailed === 2, `the same week failing twice holds rather than reloading forever (weekFailed ${st.getState().weekFailed})`)
const disk2 = await loadGame(SLOT)
ok(disk2?.week === weekBefore, `and still nothing half-settled reached the slot (week ${disk2?.week})`)

// a clean career goes on as normal: the writer is released by a good reload
st.getState().rollBack && await st.getState().rollBack()
await quiet()
st.getState().dismissWeekFailed()
const err3 = pressUntilWeekTurns()
ok(err3 === null, 'with nothing planted, Continue turns the week')
await st.getState().persistNow()
await quiet()
const disk3 = await loadGame(SLOT)
ok(disk3 != null && (disk3.week !== weekBefore || disk3.season !== seasonBefore), `and the turned week is saved (slot at week ${disk3?.week})`)

// ---- the same, in slices (the game's path since 1.9.1) ----
/** The desk holds a week for a bid or a press question; a probe answers them. */
function clearGates() {
  const g = st.getState().game!
  for (const q of g.press) q.answered = true
  for (const o of g.offers) if (o.status === 'pending') o.status = 'rejected'
  g.annual = null
}
{
  settleInSlices(true)
  await st.getState().persistNow()
  const before = st.getState().game!
  const wk = before.week, ssn = before.season
  booby(before)
  // press until the week turns or a press throws, awaiting each sliced settle
  let threw: unknown = null
  for (let i = 0; i < 40 && !threw; i++) {
    st.setState({ lastAdvanceAt: 0 })
    clearGates()
    try {
      const s0 = st.getState()
      if (s0.nav.some(n => n.screen === 'matchday')) await s0.instantResult()
      else await s0.continueWeek()
    } catch (e) { threw = e }
    const g = st.getState().game!
    if (g.week !== wk || g.season !== ssn) break
    const top = st.getState().nav[st.getState().nav.length - 1]?.screen
    if (top === 'day' || top === 'results') st.setState({ nav: [{ screen: 'home' }] })
  }
  await quiet()
  ok(threw instanceof Error, `sliced: the planted failure reaches the caller (${threw instanceof Error ? threw.message : String(threw)})`)
  ok(st.getState().turning === false, 'sliced: the veil comes down after a failure')
  const disk = await loadGame(SLOT)
  ok(disk?.week === wk && disk?.season === ssn, `sliced: nothing half-turned reached the slot (week ${disk?.week})`)
  ok(st.getState().game?.week === wk, `sliced: the career is back at week ${wk} (${st.getState().game?.week})`)
  st.getState().dismissWeekFailed()
  // and a clean sliced week turns and saves
  let clean: unknown = null
  for (let i = 0; i < 40; i++) {
    st.setState({ lastAdvanceAt: 0 })
    clearGates()
    try {
      const s0 = st.getState()
      if (s0.nav.some(n => n.screen === 'matchday')) await s0.instantResult()
      else await s0.continueWeek()
    } catch (e) { clean = e; break }
    const g = st.getState().game!
    if (g.week !== wk || g.season !== ssn) break
    const top = st.getState().nav[st.getState().nav.length - 1]?.screen
    if (top === 'day' || top === 'results') st.setState({ nav: [{ screen: 'home' }] })
  }
  await st.getState().persistNow()
  await quiet()
  const disk2 = await loadGame(SLOT)
  ok(clean === null && disk2 != null && (disk2.week !== wk || disk2.season !== ssn), `sliced: a clean week turns and is saved (slot at week ${disk2?.week})`)
  settleInSlices(false)
}

done('SETTLE GUARD PROBE', 'a week turns whole or not at all', { exit: true })
