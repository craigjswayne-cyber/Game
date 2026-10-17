import type { GameState } from '../game/model'
import { saveGame } from '../game/save'
import { storeApi } from './api'

/**
 * ---- THE SAVE QUEUE ----
 *
 * Reported by a closed-testing tester on 13 Sep 2026: "There is a noticeable
 * 1-2 second delay after tapping buttons or interactive elements throughout the
 * app. This happens repeatedly across different screens."
 *
 * MEASURED BEFORE ANYTHING WAS CHANGED, because "it feels slow" is not a
 * diagnosis. A career save is 5.02 MB at season 1 week 1 and 7.37 MB after five
 * seasons, and IndexedDB's put() structured-clones what it is handed, on the
 * main thread, before it returns:
 *
 *     season 1 wk 1    5.02 MB    structuredClone   74 ms
 *     after season 2   6.86 MB    structuredClone  104 ms
 *     after season 5   7.37 MB    structuredClone  126 ms
 *
 * That is a desktop container. The phone this is played on is several times
 * slower, and every one of the twenty-six persist() call sites paid it on every
 * tap - including the ones that only moved a bookmark. Note the first line:
 * this was never a late-career problem, it was there in week one.
 *
 * saveGame's own comment already records killing a JSON round-trip that cost
 * 92 ms for the same reason. The clone that remains is the one IndexedDB
 * insists on, so it cannot be removed - only stopped from happening so often.
 *
 * WHAT THIS DOES. persist() no longer writes. It marks the save dirty and
 * schedules one write, so a burst of mutations in the same second costs one
 * clone instead of six. A write already in flight is never raced: the queue
 * holds exactly one in-flight write and re-schedules if anything changed while
 * it ran, which also closes the stale-write ordering risk the external audit
 * flagged as a theoretical P2.
 *
 * WHAT IT DOES NOT DO. It does not make saving optional. Everything that
 * marked dirty still reaches the disk, and the app flushes on the way out -
 * pagehide and a hidden tab are where a phone actually kills a process, and
 * both are far more common than a crash mid-play. The exposure is the idle
 * window below and nothing more.
 *
 * WHY THIS ALSO ANSWERS THE AUDIT. Its P1-01 was that answerPressOption
 * mutated career state and never persisted at all, and its P1-02 asked for a
 * contract rather than a persist() sprinkled after some actions and not
 * others. A mark that costs nothing is a contract anyone can follow: mark on
 * every persistent mutation, and let one writer decide when. Adding persist()
 * to the press room was cheap only once persist() stopped being expensive.
 */
const SAVE_IDLE_MS = 600

/** What the harnesses read to prove coalescing happens. Not used by the game. */
export const saveStats = { marks: 0, writes: 0, failures: 0 }

export const saveQueue = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null
  let dirty = false
  // a week settle threw (settleWeek): that career, and only that one, is not
  // fit to write until it has been put back from disk. Tied to the object, so
  // opening or starting another career saves normally (1.9.1 re-audit, N1).
  let heldFor: GameState | null = null
  // did the last write attempt reach the disk? flush() answers with it
  let lastOk = true

  /** False when the write was held back and the save is still dirty. */
  const write = async (): Promise<boolean> => {
    const { game, saveSlot, liveMatch, matchRec } = storeApi().getState()
    if (!game) return true
    if (heldFor && game === heldFor) { lastOk = false; return false }
    // NEVER A HALF-PLAYED MATCH (1.8.1). From the first tick the engine writes
    // tries, cards and injuries onto the players (game/resume.ts), so the game
    // object mid-match is neither the pre-match save nor the finished one. The
    // resume record holds the match; the career slot waits for finishMatch,
    // whose own mark writes it. This only ever mattered by accident (a mark
    // made just before Kick Off whose timer fired after it), but touch() now
    // marks, and the live tactic dials call touch().
    //
    // AND NOT WHEN THE MATCH HAS ONLY LEFT THE SCREEN (1.8.2). The crash
    // screen's way out clears liveMatch and leaves the half-played career in
    // memory; the record (matchRec) is what says a match is still owed.
    if (liveMatch || matchRec) { lastOk = false; return false }
    dirty = false
    try {
      saveStats.writes++
      await saveGame(saveSlot, game)
      lastOk = true
      if (storeApi().getState().saveFail) storeApi().setState({ saveFail: 0, saveFailMsg: null })
    } catch (e) {
      // A REJECTED WRITE USED TO BE INVISIBLE. Every call site is
      // fire-and-forget, so a disk that had stopped accepting writes carried on
      // looking perfectly healthy while saving nothing. A failure raises a
      // banner instead, and a later success clears it.
      const msg = e instanceof Error ? e.message : String(e)
      console.error('save failed', e)
      saveStats.failures++
      lastOk = false
      storeApi().setState(s => ({ saveFail: s.saveFail + 1, saveFailMsg: msg, tick: s.tick + 1 }))
    }
    return true
  }

  /** One writer. A second caller joins the write in flight rather than racing it. */
  const run = async (): Promise<void> => {
    if (inFlight) { dirty = true; await inFlight; if (dirty) await run(); return }
    let wrote = true
    const w = write()
    inFlight = w.then(r => { wrote = r })
    try { await inFlight } finally { inFlight = null }
    // held back for a live match: stay dirty and let the next mark bring it
    // round, rather than spinning here until full time
    if (wrote && dirty) await run()
  }

  return {
    hold(g: GameState) { heldFor = g; if (timer) { clearTimeout(timer); timer = null } },
    release() { heldFor = null; dirty = false },
    /** End the hold this settle took on this career, keeping what is marked:
     *  the week has turned whole and the next write should carry it. A hold
     *  on any other career, or one a failure took, is not this settle's to
     *  lift (1.9.1 bug hunt). */
    resume(g: GameState) { if (heldFor === g) heldFor = null },
    /** soft: restart the idle timer rather than keep the first one, so a
     *  stream of marks (a slider dragged through twenty steps) is one write
     *  after the last of them, not one write in the middle of the drag */
    mark(soft = false) {
      saveStats.marks++
      dirty = true
      if (timer && !soft) return
      if (timer) clearTimeout(timer)
      // WRITTEN WHEN THE PHONE IS IDLE (1.9.1 performance re-audit). put()
      // copies the whole career on the main thread, 100 to 250 ms on a
      // desktop, and the idle timer used to drop that copy a beat after the
      // tap that caused it, where the next tap would meet it. Once the timer
      // runs out the write waits for an idle moment too, two seconds at most.
      timer = setTimeout(() => {
        timer = null
        const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : null
        if (idle) idle(() => { if (dirty) void run() }, { timeout: 2000 })
        else void run()
      }, SAVE_IDLE_MS)
    },
    /** True only when the career in memory is now on disk: nothing left
     *  dirty and the last write landed. A held, deferred or failed write
     *  answers false, so a caller that needs the disk can tell (N2). */
    async flush(): Promise<boolean> {
      if (timer) { clearTimeout(timer); timer = null }
      await run()
      // A CALLER THAT JOINED A WRITE IN FLIGHT CAME BACK TOO EARLY (1.9.1 bug
      // hunt). run() waited for the write already going, whose owner then
      // started the re-write carrying this caller's change and cleared dirty,
      // so this answered "on disk" from the earlier write while the change was
      // still on its way. Wait for whatever write is running now, then answer.
      while (inFlight) {
        await inFlight
        if (dirty && !inFlight) await run()
      }
      return !dirty && lastOk
    },
    /** Best effort on the way out: no await to give, so it starts the write and
     *  lets the platform finish it. */
    flushSync() {
      if (timer) { clearTimeout(timer); timer = null }
      if (dirty || inFlight) void run()
    },
  }
})()
