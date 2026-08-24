// Probe: the match commentary follows the reader, and the pitch still works.
//
// Every match a manager takes charge of writes eighty minutes of commentary,
// and it is the most-read prose in the game by a distance - a career reads it
// forty times a season. All of it was English no matter who was watching.
//
// The fix is the one the inbox got: a line is filed as a key plus its values
// and rendered when it is read. pushLine() does that; pushEvent() takes
// finished English and is what every line used to be. So:
//
//   1. How many lines are still called as English? THE BUDGET is a ratchet -
//      it may fall and never rise. At zero, pushEvent stops being reachable
//      from anywhere but pushLine and a line called as English fails the build.
//   2. Does every key a line names exist, in every language?
//   3. Do the two languages fill the same holes? A French line that forgets
//      {player} renders a sentence with a hole in it.
//   4. Does the English still say what it said? The stored English is not
//      decoration: the pitch mock-up reads the last line back and matches on
//      its wording to decide whether to draw a scrum, a lineout or a maul. The
//      phrases it matches on are pinned here, because breaking one of them
//      empties the pitch and nothing else in the suite would notice.
//
// Run: npx vite-node scripts/commprobe.ts
import { readFileSync } from 'node:fs'

/** Commentary lines still called as finished English. ONLY EVER DECREASE. */
const BUDGET = 35

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

type Dict = { [k: string]: unknown }
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Dict
const LANGS: Record<string, Dict> = { en: load('src/locales/en.json'), fr: load('src/locales/fr.json') }
const lookup = (d: Dict, key: string): unknown =>
  key.split('.').reduce<unknown>((o, part) => (o && typeof o === 'object' ? (o as Dict)[part] : undefined), d)

const SRC = 'src/game/matchEngine.ts'
const src = readFileSync(SRC, 'utf8')

// ---- 1. how much English is left ------------------------------------------
say('--- 1. every line is called with a key')
// pushEvent's own definition, and pushLine's one call to it, are not lines.
const calls: number[] = []
for (let i = src.indexOf('pushEvent('); i !== -1; i = src.indexOf('pushEvent(', i + 1)) {
  const before = src.slice(Math.max(0, i - 40), i)
  if (/function\s+$/.test(before) || /tIn\('en', k, v\), playerId, k, v\)/.test(src.slice(i, i + 90))) continue
  calls.push(src.slice(0, i).split('\n').length)
}
say(`  ${calls.length} line${calls.length === 1 ? '' : 's'} still called as English (budget ${BUDGET})`)
if (calls.length) say('  ' + SRC + ':' + calls.slice(0, 14).join(', ') + (calls.length > 14 ? `, ...${calls.length - 14} more` : ''))
ok(calls.length <= BUDGET,
  calls.length <= BUDGET
    ? `no commentary beyond the budget of ${BUDGET} is called as English`
    : `${calls.length - BUDGET} line(s) over the budget of ${BUDGET} - a line called as English is English for ever`)
if (calls.length < BUDGET) {
  ok(false, `THE BUDGET IS STALE: ${calls.length} left but it still says ${BUDGET}. Lower it - a ratchet that is not tightened is not a ratchet`)
}

// ---- 2. every key a line names exists, in every language -------------------
say('\n--- 2. every key a line names exists in every language')
const wanted = new Set<string>()
for (const m of src.matchAll(/'(comm\.[A-Za-z0-9_.]+)'/g)) wanted.add(m[1])
for (const m of src.matchAll(/\b\w+_k:\s*'([A-Za-z0-9_.]+)'/g)) wanted.add(m[1])
for (const m of src.matchAll(/\b\w+_k:\s*[^,\n]*\?\s*'([A-Za-z0-9_.]+)'\s*:\s*'([A-Za-z0-9_.]+)'/g)) {
  wanted.add(m[1]); wanted.add(m[2])
}
say(`  ${wanted.size} keys named by commentary`)
for (const lang of Object.keys(LANGS)) {
  const gone = [...wanted].filter(k => lookup(LANGS[lang], k) === undefined)
  ok(gone.length === 0,
    `${lang} answers every key the commentary names${gone.length ? ` - missing ${gone.length}: ${gone.slice(0, 6).join(', ')}` : ''}`)
}

// ---- 3. the two languages fill the same holes -----------------------------
say('\n--- 3. the placeholders match between languages')
const holes = (s: unknown): string => {
  const text = typeof s === 'string' ? s
    : s && typeof s === 'object' ? Object.values(s as Dict).filter(x => typeof x === 'string').join(' ')
    : ''
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort().join(',')
}
const enComm = (LANGS.en.comm ?? {}) as Dict
const bad: string[] = []
for (const key of Object.keys(enComm)) {
  for (const lang of Object.keys(LANGS).filter(l => l !== 'en')) {
    const other = lookup(LANGS[lang], `comm.${key}`)
    if (other === undefined) { bad.push(`${lang}:comm.${key} missing`); continue }
    if (holes(enComm[key]) !== holes(other)) {
      bad.push(`${lang}:comm.${key} (en "${holes(enComm[key])}" vs "${holes(other)}")`)
    }
  }
}
ok(bad.length === 0, `every line fills the same holes in both languages${bad.length ? ` - ${bad.length}: ${bad.slice(0, 5).join('; ')}` : ''}`)

// ---- 4. the English the pitch reads back is still there --------------------
//
// MatchDay.tsx decides what to draw on the pitch by matching the last line's
// English. That is a wart and it is on the list to replace with event types,
// but until it is, these phrases are load-bearing: change the wording and the
// mock-up silently stops drawing set pieces. They are asserted against the
// ENGLISH DICTIONARY as well as the source, because once a line is keyed its
// wording lives in en.json and a translator editing "the maul" out of the
// English would break the pitch from a locale file.
say('\n--- 4. the phrases the pitch mock-up matches on')
const PINNED = ['maul', 'scrum', 'lineout', 'Quick tap', 'penalty']
const enBlob = JSON.stringify(LANGS.en.comm ?? {}) + src
for (const phrase of PINNED) {
  ok(enBlob.toLowerCase().includes(phrase.toLowerCase()),
    `"${phrase}" still appears in the English commentary (MatchDay.tsx matches on it)`)
}

say(fails ? `\nCOMM PROBE FAILED (${fails})` : `\nCOMM PROBE PASSED: ${wanted.size} commentary keys, every one of them in every language`)
process.exitCode = fails ? 1 : 0
