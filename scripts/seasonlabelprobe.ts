/**
 * ---- THE SEASON IS ALWAYS seasonLabel() ----
 *
 * Release audit, pass 8 (the first ten minutes), 1.7.1: the new-career summary
 * said "Season 2025-26" and the very next screen, the home masthead, said
 * "2026-27". The summary had the year typed into the JSX, and when BASE_YEAR
 * moved (model.ts) the one screen that did not ask seasonLabel() was left a
 * year behind - the first thing a stranger reads, and it contradicts itself.
 *
 * So no screen may carry a season written out by hand: a "2025-26"-shaped
 * literal in the UI source fails here, and the label it wants is seasonLabel().
 *
 * Run: npx vite-node scripts/seasonlabelprobe.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { seasonLabel } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const files = (dir: string): string[] => readdirSync(dir).flatMap(n => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []
})
const hits: string[] = []
for (const f of files('src/ui')) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return
    if (/['">`]20\d\d[-–]\d\d['"<`]/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 90)}`)
  })
}
for (const h of hits) console.log(`       ${h}`)
ok(hits.length === 0, `no screen writes a season out by hand (${hits.length})`)
ok(/^20\d\d-\d\d$/.test(seasonLabel(0)), `seasonLabel(0) is a season (${seasonLabel(0)})`)

console.log(fails ? `\nSEASON LABEL PROBE FAILED (${fails})` : '\nSEASON LABEL PROBE PASSED: every screen asks seasonLabel() what year it is')
process.exit(fails ? 1 : 0)
