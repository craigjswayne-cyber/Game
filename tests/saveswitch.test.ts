/**
 * ---- THE CAREER ON ITS WAY OUT (1.9.4 persistence audit) ----
 *
 * persist() and touch() mark the career dirty and the save queue writes
 * whatever career the store holds when its timer fires. Opening another
 * career (setGame: Load on the Saves screen or the title) inside that window
 * used to hand the mark to the NEW career, so the outgoing one never wrote its
 * last change: star a man on the shortlist, open the Saves screen, load the
 * other slot, and the star was gone. Held here against the store itself.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { useStore } from '../src/store'
import { loadGame, saveGame } from '../src/game/save'
import { newGame } from '../src/game/newgame'

const st = useStore
const idle = (ms = 900) => new Promise(r => setTimeout(r, ms))

beforeAll(async () => {
  await saveGame('swA', newGame('leicester', 'Career A', 11))
  await saveGame('swB', newGame('bath', 'Career B', 12))
}, 60_000)

describe('opening another career', () => {
  it('writes what the outgoing career marked to its own slot', async () => {
    st.getState().setGame((await loadGame('swA'))!, 'swA')
    await st.getState().persistNow()
    await idle()
    st.getState().game!.managerName = 'A, last change'
    st.getState().touch()
    // straight to the other slot, as the Saves screen's Load does
    st.getState().setGame((await loadGame('swB'))!, 'swB')
    await idle()
    await st.getState().persistNow()
    expect((await loadGame('swA'))?.managerName).toBe('A, last change')
    expect((await loadGame('swB'))?.managerName).toBe('Career B')
  }, 60_000)

  it('and the incoming career\'s own marks still land', async () => {
    st.getState().game!.managerName = 'B, changed'
    st.getState().touch()
    await idle()
    await st.getState().persistNow()
    expect((await loadGame('swB'))?.managerName).toBe('B, changed')
    expect((await loadGame('swA'))?.managerName).toBe('A, last change')
  }, 60_000)

  it('never writes an outgoing career mid-match or held by a failed week', async () => {
    st.getState().setGame((await loadGame('swA'))!, 'swA')
    await st.getState().persistNow()
    await idle()
    st.setState({ liveMatch: {} as never })
    st.getState().game!.managerName = 'A, mid-match'
    st.getState().touch()
    st.getState().setGame((await loadGame('swB'))!, 'swB')
    st.setState({ liveMatch: null })
    await idle()
    await st.getState().persistNow()
    expect((await loadGame('swA'))?.managerName).toBe('A, last change')
  }, 60_000)
})
