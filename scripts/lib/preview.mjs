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
import { readFileSync } from 'node:fs'

// WAIT FOR THE SERVER, NOT FOR THE CLOCK (1.9.1). Every browser harness gave
// vite a fixed 2.5 or 3 seconds and then asked for the page. On a quiet box
// that is two seconds wasted a harness, a hundred harnesses a run; on a
// loaded runner it is sometimes not enough, and the first page.goto fails
// with a refused connection that reads like a broken build. The server is
// now asked until it answers, for up to `settleMs` x 10 (30 s by default).

/**
 * @param {number|string} port
 * @param {number} settleMs a tenth of the longest to wait for vite to answer
 * @returns {Promise<{stop: () => void}>}
 */
export async function startPreview(port, settleMs = 3000) {
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  })
  server.unref()
  const until = Date.now() + settleMs * 10
  for (;;) {
    try {
      const res = await fetch(`http://localhost:${port}/`)
      if (res.ok) break
    } catch { /* not listening yet */ }
    if (Date.now() > until) break       // let the probe's own goto report it
    await new Promise(r => setTimeout(r, 100))
  }
  // IS IT OURS? --strictPort makes vite exit when the port is taken, and the
  // probe then drives whatever else is listening there: another checkout's
  // preview, an older build. Every probe here hard-codes its port, so two
  // worktrees running harnesses at once graded each other's builds, and a
  // probe went red on a fix that was in this dist and not in that one. The
  // page we serve names its bundle; if the one answering names another, stop.
  try {
    const want = (readFileSync('dist/index.html', 'utf8').match(/assets\/index-[^"]+\.js/) ?? [])[0]
    const got = ((await (await fetch(`http://localhost:${port}/`)).text()).match(/assets\/index-[^"]+\.js/) ?? [])[0]
    if (want && got !== want) {
      throw new Error(`PREVIEW PORT TAKEN: localhost:${port} is serving ${got ?? 'something else'}, not this dist (${want}). Another preview holds the port; stop it and rerun.`)
    }
  } catch (e) {
    if (String(e).includes('PREVIEW PORT TAKEN')) {
      try { process.kill(-server.pid, 'SIGKILL') } catch { /* already gone */ }
      throw e
    }
    // a fetch that fails outright is left to the probe, which reports it
  }
  return {
    stop() {
      // negative pid = the whole group, so vite goes with npx
      try { process.kill(-server.pid, 'SIGKILL') } catch { /* already gone */ }
      try { server.kill('SIGKILL') } catch { /* already gone */ }
    },
  }
}

/**
 * Wait for a condition in the page instead of a fixed sleep: resolves true as
 * soon as `fn` (run in the page, given `arg`) is truthy, or false after
 * `timeout` ms, so the probe's own assertion still decides. Never throws.
 */
export async function until(page, fn, arg, timeout = 5000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 50 }); return true } catch { return false }
}

/** End the probe on its verdict, without waiting for a stray handle. */
export function done(failures) {
  process.exit(failures ? 1 : 0)
}
