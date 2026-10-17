/**
 * ---- A WEEK THAT FAILED TWICE STAYS STOPPED, AND A SAVE ANSWERS FOR ITSELF
 * (1.9.1 bug hunt) ----
 *
 * Two holes found before release, both in the sliced settle's new paths:
 *
 *   A week that failed twice leaves a half-turned career in memory, held so it
 *   is never written (weekFailed 2). Continue was still live, and a third
 *   settle that got through lifted the hold: the half-turned career, settled
 *   again on top, went to disk. Now no week turns on a stuck career.
 *
 *   persistNow() from a caller that arrived while another write was running
 *   came back "on disk" from that earlier write, before the re-write carrying
 *   its own change had landed - and said so even when that re-write failed.
 *   spendCredit takes that answer as its guarantee. Now it waits.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../src/game/save', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/game/save')>()
  return { ...real, saveGame: vi.fn(real.saveGame) }
})

import { settleFault, settleInSlices, useStore } from '../src/store'
import { loadGame, saveGame } from '../src/game/save'
import { newGame } from '../src/game/newgame'

const st = useStore
const writes = vi.mocked(saveGame)
const quiet = (ms = 800) => new Promise(r => setTimeout(r, ms))
const plant = () => { settleFault.after = () => { settleFault.after = null; throw new Error('planted failure') } }

/** Press on until the week turns; the error if a settle threw, 'no turn' if
 *  it never did. */
async function press(): Promise<unknown> {
  const start = st.getState().game!.week
  for (let i = 0; i < 40; i++) {
    st.setState({ lastAdvanceAt: 0 })
    try {
      const nav = st.getState().nav
      await (nav.some(n => n.screen === 'matchday') ? st.getState().instantResult() : st.getState().continueWeek())
    } catch (e) { return e }
    const g = st.getState().game!
    if (g.week !== start) return null
    if (g.annual) g.annual = null
    const top = st.getState().nav[st.getState().nav.length - 1]?.screen
    if (top === 'day' || top === 'results') st.setState({ nav: [{ screen: 'home' }] })
  }
  return 'no turn'
}

describe('a stuck week, and a save that answers for itself', () => {
  beforeAll(async () => {
    settleInSlices(true)
    await saveGame('slot1', newGame('leicester', 'Guard', 7))
    st.getState().setGame((await loadGame('slot1'))!, 'slot1')
    await quiet()
  }, 60_000)

  it('a week that failed twice turns no more, and nothing half-turned reaches the disk', async () => {
    const w0 = (await loadGame('slot1'))!.week
    plant(); expect(await press()).toBeInstanceOf(Error); await quiet()
    expect(st.getState().weekFailed).toBe(1)
    plant(); expect(await press()).toBeInstanceOf(Error); await quiet()
    expect(st.getState().weekFailed).toBe(2)
    const held = st.getState().game!
    // Continue again: refused, the same career, still held
    expect(await press()).toBe('no turn')
    expect(st.getState().game).toBe(held)
    expect(await st.getState().persistNow()).toBe(false)
    expect((await loadGame('slot1'))!.week).toBe(w0)
    // and the banner going away does not open the way either
    st.getState().dismissWeekFailed()
    expect(await press()).toBe('no turn')
    expect((await loadGame('slot1'))!.week).toBe(w0)
  }, 120_000)

  it('a save that joins one in flight answers for its own change, not the earlier one', async () => {
    // a fresh career: the stuck one above is not the subject here
    await saveGame('slot2', newGame('leicester', 'Q', 9))
    st.getState().setGame((await loadGame('slot2'))!, 'slot2')
    await quiet(300)
    await st.getState().persistNow()
    const real = (await vi.importActual<typeof import('../src/game/save')>('../src/game/save')).saveGame
    let n = 0
    writes.mockImplementation(async (slot, g) => {
      const mine = ++n
      const snap = structuredClone(g)
      await new Promise(r => setTimeout(r, 50))
      if (mine === 2) throw new Error('QuotaExceededError')
      await real(slot, snap)
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    st.getState().game!.managerName = 'A'; st.getState().touch()
    const a = st.getState().persistNow()
    await new Promise(r => setTimeout(r, 10))
    st.getState().game!.managerName = 'B'; st.getState().touch()
    // the write carrying B is the one that fails: B must not hear "on disk"
    expect(await st.getState().persistNow()).toBe(false)
    expect((await loadGame('slot2'))!.managerName).toBe('A')
    await a
    writes.mockRestore(); err.mockRestore()
  }, 60_000)
})
