/**
 * ---- THE SAVE QUEUE (1.9.2; the engine half of scripts/savequeue.mjs) ----
 *
 * persist() and touch() mark the career dirty and one writer decides when to
 * write it (src/store.ts, "THE SAVE QUEUE"). What has to hold for that to be
 * safe, checked here against the store itself with saveGame counted:
 *
 *   a burst of marks is one write, after the idle window, and it lands
 *   persistNow() writes at once and answers true only when the disk has it
 *   two writes are never in flight together, and nothing marked is lost
 *   a half-played match is never written: persistNow() answers false
 *   a write that fails raises the banner and answers false, and the next
 *     good write clears it
 *
 * The browser harness (savequeue.mjs) still proves the same coalescing
 * through the real IndexedDB on a page; this runs in a second.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// count every write, and let a test make one fail
vi.mock('../src/game/save', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/game/save')>()
  return { ...real, saveGame: vi.fn(real.saveGame) }
})

import { useStore } from '../src/store'
import { loadGame, saveGame } from '../src/game/save'
import { newGame } from '../src/game/newgame'

const SLOT = 'slot1'
const writes = vi.mocked(saveGame)
const st = useStore
const idle = (ms = 900) => new Promise(r => setTimeout(r, ms))

beforeAll(async () => {
  const g = newGame('leicester', 'Queue', 9)
  await saveGame(SLOT, g)
  st.getState().setGame((await loadGame(SLOT))!, SLOT)
  // setGame writes the opened career once; let it land
  await st.getState().persistNow()
  await idle(50)
}, 60_000)

afterEach(() => {
  st.setState({ liveMatch: null, matchRec: null })
})

describe('save queue', () => {
  it('a burst of marks is one write, after the idle window, and it lands', async () => {
    await idle()
    writes.mockClear()
    for (let i = 0; i < 6; i++) {
      st.getState().game!.managerName = `Burst ${i}`
      st.getState().touch()
    }
    expect(writes).toHaveBeenCalledTimes(0)    // nothing written on the tap
    await idle()
    expect(writes).toHaveBeenCalledTimes(1)
    expect((await loadGame(SLOT))?.managerName).toBe('Burst 5')
  })

  it('persistNow writes at once and answers true when the disk has it', async () => {
    writes.mockClear()
    st.getState().game!.managerName = 'Now'
    st.getState().touch()
    expect(await st.getState().persistNow()).toBe(true)
    expect(writes).toHaveBeenCalledTimes(1)
    expect((await loadGame(SLOT))?.managerName).toBe('Now')
    await idle()
    expect(writes).toHaveBeenCalledTimes(1)    // the timer it replaced does not write again
  })

  it('never has two writes in flight, and nothing marked during one is lost', async () => {
    let inFlight = 0, most = 0
    const real = (await vi.importActual<typeof import('../src/game/save')>('../src/game/save')).saveGame
    writes.mockImplementation(async (slot, g) => {
      inFlight++; most = Math.max(most, inFlight)
      try { await new Promise(r => setTimeout(r, 30)); await real(slot, g) } finally { inFlight-- }
    })
    try {
      const calls: Promise<boolean>[] = []
      for (let i = 0; i < 4; i++) {
        st.getState().game!.managerName = `Race ${i}`
        st.getState().touch()
        calls.push(st.getState().persistNow())
      }
      await Promise.all(calls)
      expect(most).toBe(1)
      expect((await loadGame(SLOT))?.managerName).toBe('Race 3')
    } finally {
      writes.mockImplementation(real)
    }
  })

  it('does not write a half-played match', async () => {
    writes.mockClear()
    const before = (await loadGame(SLOT))?.managerName
    st.setState({ liveMatch: {} as never })
    st.getState().game!.managerName = 'Mid-match'
    st.getState().touch()
    expect(await st.getState().persistNow()).toBe(false)
    expect(writes).toHaveBeenCalledTimes(0)
    expect((await loadGame(SLOT))?.managerName).toBe(before)
    // and it is still owed: once the match is over the mark goes through
    st.setState({ liveMatch: null })
    expect(await st.getState().persistNow()).toBe(true)
    expect((await loadGame(SLOT))?.managerName).toBe('Mid-match')
  })

  it('a failed write raises the banner and answers false; the next good write clears it', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    writes.mockRejectedValueOnce(new Error('QuotaExceededError'))
    st.getState().game!.managerName = 'Full disk'
    st.getState().touch()
    expect(await st.getState().persistNow()).toBe(false)
    expect(st.getState().saveFail).toBeGreaterThan(0)
    expect(st.getState().saveFailMsg).toMatch(/Quota/)
    spy.mockRestore()
    st.getState().touch()
    expect(await st.getState().persistNow()).toBe(true)
    expect(st.getState().saveFail).toBe(0)
    expect((await loadGame(SLOT))?.managerName).toBe('Full disk')
  })
})
