// Start and REALLY stop a preview server for a browser probe.
//
// This exists because of a bug that made a passing probe report a failure, which
// is the worst kind of harness bug: it is indistinguishable from a real one, and
// the instinct is to go looking in the game.
//
// breaker.mjs printed "BREAKER PASSED: it would not break" and then exited 124 -
// the timeout wrapper's code. It had run every attack, found nothing, printed its
// verdict, reached the end of the script, and then node refused to exit, so
// `timeout 900` eventually killed it and suite.sh recorded FAIL against a probe
// that had passed.
//
// Two causes, both fixed here rather than in each probe:
//
//   spawn('npx', ['vite', 'preview', ...]) starts npx, which starts vite as a
//   CHILD. server.kill() kills npx and orphans vite, which keeps running and
//   holding the port. Killing the whole process group is the only thing that
//   stops what was actually started - and it is also why five stray preview
//   servers were found sitting on ports 4173-4177 after earlier runs.
//
//   stdio: 'pipe' with nobody reading leaves pipes attached to a process that
//   outlives its parent. 'ignore' means there is nothing to hold open.
//
// And `done()` exits explicitly rather than trusting the event loop to drain: a
// probe's verdict is its exit code, and a probe that has finished saying what it
// found has no business still being alive.
import { spawn } from 'node:child_process'

/**
 * @param {number} port
 * @param {number} settleMs how long to give vite before the first request
 * @returns {Promise<{stop: () => void}>}
 */
export async function startPreview(port, settleMs = 3000) {
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  })
  server.unref()
  await new Promise(r => setTimeout(r, settleMs))
  return {
    stop() {
      // negative pid = the whole group, so vite goes with npx
      try { process.kill(-server.pid, 'SIGKILL') } catch { /* already gone */ }
      try { server.kill('SIGKILL') } catch { /* already gone */ }
    },
  }
}

/** End the probe on its verdict, without waiting for a stray handle. */
export function done(failures) {
  process.exit(failures ? 1 : 0)
}
