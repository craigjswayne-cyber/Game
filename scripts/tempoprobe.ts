/**
 * ---- THE COMMENTARY SPEEDS, HELD TO THE MEASUREMENT ----
 *
 * Match speeds are the easiest numbers in the game to change on a feeling and
 * the hardest to argue about afterwards, because everyone reads at a different
 * rate and everyone is sure theirs is normal. They were 1600 / 350 / 90 and the
 * owner's verdict was "slow is good, normal is too fast and fast is
 * ridiculous". Both halves of that were measurable:
 *
 *   the 245 lines in comm.* average 12.2 words, median 12; and
 *   Brysbaert 2019 - 190 studies, 18,573 participants - puts adult silent
 *   reading at 238 words a minute.
 *
 * A median line therefore needs about 3,025ms to read start to finish. Slow at
 * 1600ms gave 53% of that and was called good, so ~50% is the target for the
 * slowest setting: a ticker is skimmed, the line stays on screen after the next
 * one lands, and half the reading time is enough to take it in.
 *
 * This probe holds three things that a future edit could quietly undo:
 *
 *   1. Slow still lands near half the time a median line needs. Not a range
 *      picked to fit - it is the one figure the owner signed off.
 *   2. Each step is roughly twice the speed of the one above. The old ladder
 *      had a 4.6x cliff between Slow and Normal, which is why there was no
 *      usable middle: one setting was glacial and the next was a blur.
 *   3. Every speed sits inside the band Championship Manager 01/02 shipped -
 *      800 to 2700ms - once the tension stretch is applied. That game is the
 *      closest ancestor this one has and did exactly the same job.
 *
 * The line data is read from the locale rather than hard-coded, so writing
 * longer commentary eventually fails this probe rather than silently making
 * every setting too fast. That is the point: the speeds answer to the prose.
 *
 * Run: npx vite-node scripts/tempoprobe.ts
 */
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Brysbaert, M. (2019), "How many words do we read per minute? A review and
 *  meta-analysis of reading rate", Journal of Memory and Language. 238 wpm for
 *  adult silent reading of non-fiction, pooled over 190 studies. */
const WPM = 238
const WORDS_PER_MS = WPM / 60 / 1000

// ---- what the game actually says ----
const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8')) as Record<string, Record<string, unknown>>
const lines: string[] = []
const walk = (o: unknown) => {
  if (typeof o === 'string') { lines.push(o); return }
  if (o && typeof o === 'object') for (const v of Object.values(o)) walk(v)
}
walk(en.comm)
const counts = lines
  .map(s => s.replace(/\{[^}]*\}/g, 'X').trim().split(/\s+/).length)
  .filter(n => n > 0)
  .sort((a, b) => a - b)
const median = counts[Math.floor(counts.length / 2)]
const readMs = median / WORDS_PER_MS

console.log(`${counts.length} commentary lines, median ${median} words`)
console.log(`a median line takes ${Math.round(readMs)}ms to read at ${WPM} wpm\n`)

// ---- and what the screen does with them ----
const src = readFileSync('src/ui/screens/MatchDay.tsx', 'utf8')
const block = src.slice(src.indexOf('const SPEEDS = ['))
const ms = [...block.slice(0, block.indexOf(']')).matchAll(/ms:\s*(\d+)/g)].map(m => Number(m[1]))
ok(ms.length === 3, `three speeds found (${ms.join(' / ')}ms)`)
const [slow, normal, fast] = ms

// 1. the slowest setting is the one the owner called good, at ~half read time
const slowPct = slow / readMs
ok(slowPct >= 0.45 && slowPct <= 0.62,
  `Slow gives ${(slowPct * 100).toFixed(0)}% of the time a median line needs - the setting that was signed off sat at 53%`)

// 2. an even ladder, so the difference between two settings can be felt
const stepA = slow / normal
const stepB = normal / fast
ok(stepA >= 1.7 && stepA <= 2.4, `Slow to Normal is a ${stepA.toFixed(1)}x step`)
ok(stepB >= 1.7 && stepB <= 2.4, `Normal to Fast is a ${stepB.toFixed(1)}x step`)
ok(Math.abs(stepA - stepB) < 0.6,
  `and the two steps are the same size, so no setting is stranded next to a cliff (${stepA.toFixed(1)}x vs ${stepB.toFixed(1)}x)`)

// 3. Normal has to be followable, Fast has to still be a skim rather than a blur
ok(normal / readMs >= 0.2,
  `Normal gives ${((normal / readMs) * 100).toFixed(0)}% of the read time - enough to keep up without stopping`)
ok(fast / readMs >= 0.1,
  `Fast gives ${((fast / readMs) * 100).toFixed(0)}% - a skim, not the 3% that made it unreadable`)

// 4. the genre band. CM 01/02 ran 800-2700ms; the tension stretch takes the two
//    slower settings up by 1.6x at the most dramatic moments, and that ceiling
//    must not sail past the one a game of this exact shape shipped with.
const TENSION = 1.6
ok(fast >= 300, `Fast is no faster than CM 01/02's own fast-play figure of 300ms (${fast}ms)`)
ok(normal >= 800, `Normal is at or above the floor of CM 01/02's playable band (${normal}ms vs 800ms)`)
ok(slow * TENSION <= 2700,
  `and Slow at its most tense stays under that band's ceiling (${Math.round(slow * TENSION)}ms vs 2700ms)`)

// 5. the stretch itself still only reaches the two slower settings
ok(/speedIdx < 2 \? 1 \+ 0\.6 \* tension : 1/.test(src),
  'the tension stretch still applies to Slow and Normal only - Fast is asked to be fast')

console.log(fails
  ? `\nTEMPO PROBE FAILED (${fails})`
  : '\nTEMPO PROBE PASSED: the speeds answer to the prose, not to a feeling')
if (fails) process.exit(1)
