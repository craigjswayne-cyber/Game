// The verdict of a probe, in one place: engine probes (through probe.ts) and
// browser harnesses (directly, as plain JavaScript under node) share it.
//
// injuredquietprobe and signedappsprobe each kept their own `fails` counter,
// printed "PROBE FAILED (n)" at the end, and never set an exit code. suite.sh
// reads the exit code, so both were PASS in every run whatever they found. A
// probe's verdict is its exit code; the printed line is for the person reading.
//
//   import { ok, check, done } from './lib/probe'       // an engine probe (.ts)
//   import { ok, check, done } from './lib/probe.mjs'   // a browser harness
//   ok(cond, 'what must be true')        // prints "  ok  ..." or "FAIL  ..."
//   check(cond, 'what', () => detail)    // the same, detail only on failure
//   done('NAME PROBE', 'what passing means')
//
// done() prints a blank line, then "NAME PASSED: what" or "NAME FAILED (n)";
// { blank: false } leaves the blank line out, for a probe that never had one.
// { exit: true } leaves at once, as a browser harness must (a preview server
// or a browser can hold the process open: see lib/preview.mjs); without it
// the exit code is set and the process leaves when it is idle, or five
// seconds later at most.
//
// PROBE_FORCE_FAIL=1 adds one failure at done(), so a run can show the probe
// (and suite.sh behind it) really goes red.

let fails = 0

/**
 * Record one assertion. Returns the condition so a caller can branch on it.
 * @param {unknown} cond
 * @param {string} what
 * @returns {boolean}
 */
export function ok(cond, what) {
  console.log(`${cond ? '  ok  ' : 'FAIL  '}${what}`)
  if (!cond) fails++
  return Boolean(cond)
}

/**
 * As ok(), with a detail line printed under a failure only.
 * @param {unknown} cond
 * @param {string} what
 * @param {() => string} [detail]
 * @returns {boolean}
 */
export function check(cond, what, detail) {
  ok(cond, what)
  if (!cond && detail) console.log(`        ${detail()}`)
  return Boolean(cond)
}

/** How many assertions have failed so far. */
export const failures = () => fails

/**
 * Print the verdict and set the exit code from it.
 * @param {string} name
 * @param {string} [passed]
 * @param {{ exit?: boolean, blank?: boolean }} [opts]
 * @returns {number} the number of failures
 */
export function done(name, passed = '', { exit = false, blank = true } = {}) {
  if (process.env.PROBE_FORCE_FAIL) ok(false, 'PROBE_FORCE_FAIL is set')
  const gap = blank ? '\n' : ''
  console.log(fails ? `${gap}${name} FAILED (${fails})` : `${gap}${name} PASSED${passed ? `: ${passed}` : ''}`)
  process.exitCode = fails ? 1 : 0
  if (exit) process.exit(fails ? 1 : 0)
  // and if anything is still holding the process a few seconds after the
  // verdict (vite-node tearing its server down under load did this to
  // staffprobe), leave with the verdict rather than at the suite's timeout.
  // unref: this timer never keeps a finished probe alive by itself.
  setTimeout(() => process.exit(), 5000).unref()
  return fails
}
