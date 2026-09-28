// Probe: one rule for quote marks in the press room (game/quotes.ts).
//
// The screen wrapped every question and answer in English curly quotes while
// half the strings brought their own, so the room printed “... ”I'll be
// ready.”” in six languages. The rule: a string never carries the outer quotes
// of the manager's own words (speech() adds them in the reader's convention),
// speech inside a question or reaction uses the language's primary marks, and
// a quotation inside the manager's words drops to the secondary ones.
//
// Run: npx vite-node scripts/quoteprobe.ts
import { readFileSync } from 'node:fs'
import { speech, unwrap, prose } from '../src/game/quotes'

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

type Dict = { [k: string]: unknown }
const flat = (d: Dict, path = '', out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(d)) {
    const p = path ? `${path}.${k}` : k
    if (typeof v === 'string') out[p] = v
    else if (v && typeof v === 'object') flat(v as Dict, p, out)
  }
  return out
}
const LANGS = ['en', 'fr', 'es', 'it', 'ja', 'af'] as const
const PAIRS: Record<string, string> = { '"': '"', "'": "'", '“': '”', '‘': '’', '«': '»', '「': '」', '『': '』' }
const PRIMARY: Record<string, RegExp> = {
  // the marks a language must NOT use for speech in reported text
  en: /"/, af: /"/, fr: /"/, es: /"/, it: /"/, ja: /"|“/,
}

say('--- 1. no press, talk or coverage string wears its own outer quotes')
for (const lang of LANGS) {
  const d = JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf8')) as Dict
  const f = flat({ press: d.press, talk: d.talk, world: d.world } as Dict)
  const wrapped = Object.entries(f).filter(([, v]) => {
    const body = v.replace(/\s*[(（][^()（）]*[)）]$/, '').trim()
    const c = PAIRS[body[0]]
    return !!c && body.length > 1 && body.endsWith(c)
  })
  ok(wrapped.length === 0, `${lang}: ${wrapped.length} wrapped${wrapped.length ? ' - ' + wrapped.slice(0, 3).map(([k]) => k).join(', ') : ''}`)
  const straight = Object.entries(f).filter(([, v]) => PRIMARY[lang].test(v))
  ok(straight.length === 0, `${lang}: speech in the language's own marks${straight.length ? ' - ' + straight.slice(0, 3).map(([k]) => k).join(', ') : ''}`)
}

say('\n--- 2. speech() adds one pair, in the reader\'s marks, and never doubles')
ok(speech('I am going nowhere', 'en') === '“I am going nowhere”', 'English')
ok(speech("'I am going nowhere'", 'en') === '“I am going nowhere”', 'an old saved answer is not doubled')
ok(speech('Je ne vais nulle part', 'fr') === '« Je ne vais nulle part »', 'French, with the space that cannot break')
ok(speech('« Je ne vais nulle part »', 'fr') === '« Je ne vais nulle part »', 'French, already wrapped, not doubled')
ok(speech('No me voy', 'es') === '«No me voy»', 'Spanish')
ok(speech('どこにも行かない', 'ja') === '「どこにも行かない」', 'Japanese')
ok(speech('He said “no” to me', 'en') === '“He said ‘no’ to me”', 'a quotation inside steps down in English')
ok(speech('Il a dit « non »', 'fr') === '« Il a dit “non” »', 'and in French')
ok(speech('彼は「いや」と言った', 'ja') === '「彼は『いや』と言った」', 'and in Japanese')
ok(speech('', 'en') === '', 'an empty answer stays empty, so the screen can say so')
ok(unwrap("'Judge us in May - aim high' (+£400k war chest)") === 'Judge us in May - aim high (+£400k war chest)', 'an answer with a note keeps the note')
ok(prose('He says "crisis".', 'en') === 'He says “crisis”.', 'an old saved question has its straight quotes set')

say(fails ? `\nQUOTE PROBE FAILED (${fails})` : '\nQUOTE PROBE PASSED: one pair of quotes, in the reader\'s language, every time')
process.exitCode = fails ? 1 : 0
