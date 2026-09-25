/**
 * ---- AN INJURY IS NAMED IN THE READER'S LANGUAGE ----
 *
 * Release audit, 1.7.1. Injury.desc is the complaint as it was RECORDED, in
 * English, always (model.ts says so, and says injuryDesc() is what a screen
 * reads). Four screens read .desc straight off the injury - the Medical
 * Centre's treatment room, Training, and two places on the player page - so a
 * French manager read "Hamstring" where the Dayroom and the match said
 * "Ischio-jambiers". Nothing caught it because English readers see no
 * difference and the language probes check dictionaries, not what a screen
 * chooses to print.
 *
 * Two halves: no screen reads an injury's .desc directly, and injuryDesc()
 * really does answer in the reader's language.
 *
 * Run: npx vite-node scripts/injurytextprobe.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { injuryDesc } from '../src/game/model'
import { ensureLang, setLang, tIn } from '../src/game/i18n'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const files = (dir: string): string[] => readdirSync(dir).flatMap(n => {
  const p = join(dir, n)
  return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) ? [p] : []
})
const hits: string[] = []
for (const f of files('src/ui')) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return
    // a PLAYER's injury (p.injury.desc); a local already run through injuryDesc()
    // is a different thing with the same last word (MatchDay's injury sheet)
    if (/\.injury!?\??\.desc\b/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`)
  })
}
for (const h of hits) console.log(`       ${h}`)
ok(hits.length === 0, `no screen prints an injury's recorded English (${hits.length})`)

await ensureLang('fr')
setLang('fr')
const inj = { desc: tIn('en', 'injury.hamstring'), dk: 'injury.hamstring' }
ok(injuryDesc(inj) === tIn('fr', 'injury.hamstring') && injuryDesc(inj) !== inj.desc,
  `and injuryDesc answers in French ("${injuryDesc(inj)}", recorded "${inj.desc}")`)
setLang('en')

console.log(fails ? `\nINJURY TEXT PROBE FAILED (${fails})` : '\nINJURY TEXT PROBE PASSED: every screen names an injury in the language it is read in')
process.exit(fails ? 1 : 0)
