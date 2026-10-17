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
import { createServer } from 'node:net'

// WAIT FOR THE SERVER, NOT FOR THE CLOCK (1.9.1). Every browser harness gave
// vite a fixed 2.5 or 3 seconds and then asked for the page. On a quiet box
// that is two seconds wasted a harness, a hundred harnesses a run; on a
// loaded runner it is sometimes not enough, and the first page.goto fails
// with a refused connection that reads like a broken build. The server is
// now asked until it answers, for up to `settleMs` x 10 (30 s by default).
//
// ANY FREE PORT (1.9.2). Every harness hard-coded its own port (4173 to
// 5341), and many shared one: two checkouts running harnesses at once, or
// storeprobe and backupreach in two terminals, collided, and the guard below
// reported PREVIEW PORT TAKEN, a FAIL for a probe that had found nothing. The
// port is now whatever the system hands out, and a harness drives the page at
// the `url` (or `origin`) this returns rather than at a number it wrote down.
// PREVIEW_PORT pins one by hand, to keep a server's address known for a
// person to open alongside a run.

/** A port nothing is listening on right now: bind to 0, read it, let it go. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

const bundleOf = html => (html.match(/assets\/index-[^"]+\.js/) ?? [])[0]

/**
 * Serve this checkout's dist/ with `vite preview` and wait until it answers.
 *
 * @param {number|string} [port] 0 or nothing for a free port (the default);
 *   a number only for a tool that must hold a known address
 * @param {number} settleMs a tenth of the longest to wait for vite to answer
 * @returns {Promise<{stop: () => void, port: number, origin: string, url: string}>}
 *   `origin` is http://localhost:PORT, `url` the same with a trailing slash
 */
export async function startPreview(port = 0, settleMs = 3000) {
  const pinned = Number(port) || Number(process.env.PREVIEW_PORT) || 0
  let want
  try { want = bundleOf(readFileSync('dist/index.html', 'utf8')) } catch { /* no build: the probe's goto says so */ }
  // A free port can be taken between asking and binding (another harness
  // starting in the same instant). --strictPort makes vite exit rather than
  // wander to the next port, and a fresh port is tried. A pinned port gets
  // one attempt.
  for (let attempt = 1; ; attempt++) {
    const p = pinned || await freePort()
    const server = spawn('npx', ['vite', 'preview', '--port', String(p), '--strictPort'], {
      stdio: 'ignore',
      detached: true,
    })
    server.unref()
    let exited = false
    server.on('exit', () => { exited = true })
    const stop = () => {
      // negative pid = the whole group, so vite goes with npx
      try { process.kill(-server.pid, 'SIGKILL') } catch { /* already gone */ }
      try { server.kill('SIGKILL') } catch { /* already gone */ }
    }
    const origin = `http://localhost:${p}`
    const until = Date.now() + settleMs * 10
    let html
    for (;;) {
      try {
        const res = await fetch(`${origin}/`)
        if (res.ok) { html = await res.text(); break }
      } catch { /* not listening yet */ }
      if (exited || Date.now() > until) break   // let the probe's own goto report it
      await new Promise(r => setTimeout(r, 100))
    }
    // IS IT OURS? If vite lost the port, the probe would drive whatever else
    // is listening there: another checkout's preview, an older build, and a
    // probe went red on a fix that was in this dist and not in that one. The
    // page we serve names its bundle; if the one answering names another,
    // this is not our server.
    const got = html === undefined ? undefined : bundleOf(html)
    const foreign = Boolean(want) && html !== undefined && got !== want
    if ((exited || foreign) && !pinned && attempt < 5) { stop(); continue }
    if (foreign) {
      stop()
      throw new Error(`PREVIEW PORT TAKEN: ${origin} is serving ${got ?? 'something else'}, not this dist (${want}). Another preview holds the port; stop it and rerun.`)
    }
    // a server that never answered is left to the probe, which reports it
    return { stop, port: p, origin, url: `${origin}/` }
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
