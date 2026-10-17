// The verdict of an engine probe, in one place.
//
//   import { ok, check, done } from './lib/probe'
//   ok(cond, 'what must be true')        // prints "  ok  ..." or "FAIL  ..."
//   check(cond, 'what', () => detail)    // the same, detail only on failure
//   done('NAME PROBE', 'what passing means')
//
// The implementation is lib/probe.mjs (1.9.2), plain JavaScript, so a browser
// harness run by node can import the same counter and verdict; this file
// gives the engine probes their types. Why it exists, and what done() does
// with the exit code, is written there.
import * as impl from './probe.mjs'

/** Record one assertion. Returns the condition so a caller can branch on it. */
export const ok: (cond: unknown, what: string) => boolean = impl.ok

/** As ok(), with a detail line printed under a failure only. */
export const check: (cond: unknown, what: string, detail?: () => string) => boolean = impl.check

/** How many assertions have failed so far. */
export const failures: () => number = impl.failures

/** Print the verdict and set the exit code from it; { exit: true } leaves at once. */
export const done: (name: string, passed?: string, opts?: { exit?: boolean, blank?: boolean }) => number = impl.done
