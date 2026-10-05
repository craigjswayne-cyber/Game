// Does the screen's language leak into the save? (1.8.5 save QA)
//
//   npx vite-node scripts/qa/langsave.ts -- <save.json> [weeks=24] [lang=fr]
//
// The same career, from the same file, played the same weeks twice: once with
// the screen in English and once in another language. The simulation must not
// care, and neither must the bytes it saves - a career written in French and
// read in English (or moved to a phone set to English) should carry nothing
// French. Every differing path is grouped by the story key it sits under, and
// the French story is then rendered in French and English to show the reader's
// side is still right.
import { readFileSync } from 'node:fs'
import { migrate } from '../../src/game/save'
import type { GameState } from '../../src/game/model'
import { ensureLang, setLang, setWorld, setManagerGender, t, type Lang } from '../../src/game/i18n'
import { genderOf } from '../../src/game/gender'
process.env.SAVEGEN_LIB = '1'
const { playWeek, startCareer } = await import('./savegen')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
const args = process.argv.slice(2).filter(a => a !== '--')
const WEEKS = Number(args[1] ?? 24)
const LANG = (args[2] ?? 'fr') as Lang
// no file: a career of this build, 40 weeks in
const json = JSON.stringify(migrate(args[0] ? JSON.parse(readFileSync(args[0], 'utf8')).state : (() => {
  const g = startCareer('m', 4242); for (let w = 0; w < 40; w++) playWeek(g); return JSON.parse(JSON.stringify(g))
})()))
const load = () => {
  const g = migrate(JSON.parse(json) as GameState)
  setWorld(genderOf(g)); setManagerGender(g.mgrGender === 'w' ? 'w' : 'm')
  return g
}
await ensureLang(LANG)
setLang('en')
const E = load(); for (let w = 0; w < WEEKS; w++) playWeek(E)
setLang(LANG)
const F = load(); for (let w = 0; w < WEEKS; w++) playWeek(F)

const paths: string[] = []
function diff(a: Any, b: Any, path: string) {
  if (a === b) return
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { paths.push(path); return }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`)
}
diff(JSON.parse(JSON.stringify(E)), JSON.parse(JSON.stringify(F)), '')
const byKey = new Map<string, Set<string>>()
for (const p of paths) {
  const m = p.match(/^\.news\.(\d+)\.(.*)$/)
  const where = m ? `news ${E.news[Number(m[1])]?.k ?? '?'} :: ${m[2].replace(/^v\./, 'v.')}` : p.replace(/\.\d+/g, '.#')
  ;(byKey.get(where) ?? byKey.set(where, new Set()).get(where)!).add(p)
}
console.log(`${WEEKS} weeks, en vs ${LANG}: ${paths.length} differing paths, ${byKey.size} kinds`)
for (const [k, s] of [...byKey.entries()].sort()) console.log(`  ${k}  x${s.size}`)
// the reader's side: a story played in English renders in the other language
// with that language's country name, and vice versa
const nat = E.news.find(n => n.v && Object.keys(n.v).some(k => k.endsWith('_n')))
if (nat) {
  setLang(LANG); const inF = t(nat.k!, nat.v as Any)
  setLang('en'); const inE = t(nat.k!, nat.v as Any)
  console.log(`  a nation story (${nat.k}) reads "${inE}" / "${inF}"`)
}
const simSame = JSON.stringify(E.fixtures.map(f => [f.homeScore, f.awayScore])) === JSON.stringify(F.fixtures.map(f => [f.homeScore, f.awayScore]))
  && JSON.stringify(Object.values(E.players).map(p => [p.ca, p.clubId, p.injury?.weeks ?? 0])) === JSON.stringify(Object.values(F.players).map(p => [p.ca, p.clubId, p.injury?.weeks ?? 0]))
console.log(simSame ? 'SIM IDENTICAL in both languages (scores, abilities, clubs, injuries)' : 'SIM DIFFERS between languages')
console.log(paths.length ? `LANGSAVE: ${paths.length} paths differ` : 'LANGSAVE PASSED: the save is the same bytes in both languages')
process.exit(simSame ? 0 : 1)
