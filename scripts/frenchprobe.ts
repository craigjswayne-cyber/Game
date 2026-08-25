// Probe: the French reads like French.
//
// Every other probe about the French asks whether it EXISTS - whether a key is
// answered, whether the holes match. None of them asks whether it is any good,
// and "it is there" is not the same claim as "a French player will not wince".
// This holds the things a machine can actually judge.
//
// 1. PUNCTUATION CANNOT WRAP AWAY FROM ITS SENTENCE. French sets a space before
//    : ; ! and ?, and inside guillemets. A plain space there is breakable, so a
//    narrow phone is free to put "Coup d'envoi" on one line and "!" on the
//    next, which looks like a bug because it is one. 987 entries had it. The
//    space is U+00A0 now, which renders identically and cannot break.
//
// 2. NOTHING IS STILL IN ENGLISH. An entry identical to its English twin is
//    either an oversight or a proper noun. Proper nouns are listed, so the
//    oversights have nowhere to hide.
//
// 3. THE QUOTE MARKS ARE FRENCH. Speech in the French dictionary is set in
//    guillemets, not in the double quotes the English uses. A stray " is a
//    sentence somebody translated without looking at the ones around it.
//
// Run: npx vite-node scripts/frenchprobe.ts
import { readFileSync } from 'node:fs'

/** French entries still carrying an English habit. ONLY EVER DECREASE. */
const BUDGET = { wrap: 0, english: 0, quotes: 0 }

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

type Dict = { [k: string]: unknown }
const EN = JSON.parse(readFileSync('src/locales/en.json', 'utf8')) as Dict
const FR = JSON.parse(readFileSync('src/locales/fr.json', 'utf8')) as Dict

const flat = (d: Dict, path = '', out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(d)) {
    const p = path ? `${path}.${k}` : k
    if (typeof v === 'string') out[p] = v
    else if (v && typeof v === 'object') flat(v as Dict, p, out)
  }
  return out
}
// _meta is a note to translators, not display text.
const drop = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_meta')))
const F = drop(flat(FR))
const E = drop(flat(EN))

// ---- 1. punctuation that can wrap away from its sentence ------------------
say('--- 1. the space before French punctuation cannot break')
const NB = ' '
const wrap = Object.entries(F).filter(([, v]) =>
  /[^  ] [:;!?]/.test(v) || new RegExp(`« [^${NB}]`).test(v) || new RegExp(`[^${NB}] »`).test(v))
say(`  ${wrap.length} entr${wrap.length === 1 ? 'y' : 'ies'} with a breakable space before : ; ! ? or inside « » (budget ${BUDGET.wrap})`)
if (wrap.length) say('  ' + wrap.slice(0, 8).map(([k, v]) => `${k}: ${v.slice(0, 60)}`).join('\n  '))
ok(wrap.length <= BUDGET.wrap, `no more than ${BUDGET.wrap} entries let their punctuation wrap`)

// ---- 2. entries still in English ------------------------------------------
say('\n--- 2. nothing is still sitting in English')
// The words that are the same in both languages, and are meant to be.
const SAME_IN_BOTH = new Set([
  'pers.Leader', 'persLower.Leader', 'count.matchOne', 'traits.Metronome',
])
const untranslated = Object.keys(F).filter(k =>
  E[k] !== undefined && E[k] === F[k] && !SAME_IN_BOTH.has(k) &&
  /[a-z]{3,}\s+[a-z]{3,}/.test(E[k]))
say(`  ${untranslated.length} prose entries identical to their English (budget ${BUDGET.english})`)
if (untranslated.length) say('  ' + untranslated.slice(0, 8).join('\n  '))
ok(untranslated.length <= BUDGET.english, `no more than ${BUDGET.english} entries are still English`)

// ---- 3. speech is set in guillemets ---------------------------------------
say('\n--- 3. speech is set in guillemets, not in English quotes')
const straight = Object.entries(F).filter(([, v]) => /"/.test(v))
say(`  ${straight.length} entries using a double quote (budget ${BUDGET.quotes})`)
if (straight.length) say('  ' + straight.slice(0, 8).map(([k, v]) => `${k}: ${v.slice(0, 60)}`).join('\n  '))
ok(straight.length <= BUDGET.quotes, `no more than ${BUDGET.quotes} entries use English quote marks`)

say(fails ? `\nFRENCH PROBE FAILED (${fails})` : `\nFRENCH PROBE PASSED: ${Object.keys(F).length} entries, and they read like French`)
process.exitCode = fails ? 1 : 0
