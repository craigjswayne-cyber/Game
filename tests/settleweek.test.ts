/**
 * ---- THE WEEK TURNS WHOLE OR NOT AT ALL (1.9.2; was the core of
 * scripts/settleguardprobe.ts, which still runs the full walk) ----
 *
 * store.settleWeek: processWeekAndAdvance changes the career in place, so a
 * throw half way used to leave a career that was neither week, written to disk
 * by the next mark. Now a throw holds the writer, puts the career back to the
 * copy on disk and rethrows; the same week failing twice holds rather than
 * reloading for ever; and a clean Continue afterwards turns and saves.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { settleFault, useStore } from '../src/store'
import { loadGame, saveGame } from '../src/game/save'

const SLOT = 'slot1'
const st = useStore
const quiet = () => new Promise(r => setTimeout(r, 800))

/** Fail the next settle after it has changed the career in memory. */
const plant = () => { settleFault.after = () => { settleFault.after = null; throw new Error('planted failure') } }

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
    if (g.annual) g.annual = null
    const top = st.getState().nav[st.getState().nav.length - 1]?.screen
    if (top === 'day' || top === 'results') st.setState({ nav: [{ screen: 'home' }] })
  }
  return null
}

let weekBefore = 0
let seasonBefore = 0

beforeAll(async () => {
  await saveGame(SLOT, newGame('leicester', 'Guard', 7))
  st.getState().setGame((await loadGame(SLOT))!, SLOT)
  await quiet()
  weekBefore = st.getState().game!.week
  seasonBefore = st.getState().game!.season
}, 60_000)

describe('settleWeek', () => {
  it('a throw reaches the caller, nothing half-settled is saved, and the career is put back', async () => {
    const thrown = st.getState().game!
    plant()
    const err = pressUntilWeekTurns()
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/planted failure/)
    await quiet()
    const disk = await loadGame(SLOT)
    expect([disk?.season, disk?.week]).toEqual([seasonBefore, weekBefore])
    const live = st.getState().game!
    expect(live.week).toBe(weekBefore)
    expect(live).not.toBe(thrown)              // the copy from disk, not the one that threw
    expect(st.getState().weekFailed).toBe(1)
  }, 60_000)

  it('the same week failing again holds the writer instead of reloading for ever', async () => {
    plant()
    expect(pressUntilWeekTurns()).toBeInstanceOf(Error)
    await quiet()
    expect(st.getState().weekFailed).toBe(2)
    expect((await loadGame(SLOT))?.week).toBe(weekBefore)
  }, 60_000)

  it('after a good reload, a clean Continue turns the week and saves it', async () => {
    await st.getState().rollBack()
    await quiet()
    st.getState().dismissWeekFailed()
    expect(pressUntilWeekTurns()).toBeNull()
    expect(await st.getState().persistNow()).toBe(true)
    const disk = await loadGame(SLOT)
    expect(disk != null && (disk.week !== weekBefore || disk.season !== seasonBefore)).toBe(true)
  }, 60_000)
})
