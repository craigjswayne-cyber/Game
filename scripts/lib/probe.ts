// The verdict of an engine probe, in one place.
//
// injuredquietprobe and signedappsprobe each kept their own `fails` counter,
// printed "PROBE FAILED (n)" at the end, and never set an exit code. suite.sh
// reads the exit code, so both were PASS in every run whatever they found. A
// probe's verdict is its exit code; the printed line is for the person reading.
//
//   import { ok, check, done } from './lib/probe'
//   ok(cond, 'what must be true')        // prints "  ok  ..." or "FAIL  ..."
//   check(cond, 'what', () => detail)    // the same, detail only on failure
//   done('NAME PROBE', 'what passing means')
//
// PROBE_FORCE_FAIL=1 adds one failure at done(), so a run can show the probe
// (and suite.sh behind it) really goes red.

let fails = 0

/** Record one assertion. Returns the condition so a caller can branch on it. */
export function ok(cond: boolean, what: string): boolean {
  console.log(`${cond ? '  ok  ' : 'FAIL  '}${what}`)
  if (!cond) fails++
  return cond
}

/** As ok(), with a detail line printed under a failure only. */
export function check(cond: boolean, what: string, detail?: () => string): boolean {
  ok(cond, what)
  if (!cond && detail) console.log(`        ${detail()}`)
  return cond
}

/** How many assertions have failed so far. */
export const failures = () => fails

/** Print the verdict and set the exit code from it. */
export function done(name: string, passed = ''): number {
  if (process.env.PROBE_FORCE_FAIL) ok(false, 'PROBE_FORCE_FAIL is set')
  console.log(fails ? `\n${name} FAILED (${fails})` : `\n${name} PASSED${passed ? `: ${passed}` : ''}`)
  process.exitCode = fails ? 1 : 0
  // and if anything is still holding the process a few seconds after the
  // verdict (vite-node tearing its server down under load did this to
  // staffprobe), leave with the verdict rather than at the suite's timeout.
  // unref: this timer never keeps a finished probe alive by itself.
  setTimeout(() => process.exit(), 5000).unref()
  return fails
}
