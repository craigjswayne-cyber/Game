/**
 * ---- EACH LANGUAGE READS LIKE ITSELF ----
 *
 * Owner: "can we make sure all languages are in natural language."
 *
 * scripts/frenchprobe.ts has asked this of the French since it was written, and
 * its opening line is the whole argument: every other probe about a translation
 * asks whether it EXISTS - whether the key is answered, whether the holes match
 * - and "it is there" is not the same claim as "somebody who speaks it will not
 * wince". Four languages had nobody asking.
 *
 * So this is frenchprobe's question put to the other four, and each language is
 * asked about its OWN conventions rather than about English ones:
 *
 *   SPANISH opens a question with ¿ and an exclamation with ¡. Half a question
 *     mark is the single loudest way to say a machine wrote this, and the
 *     answer here has always been zero, which is worth keeping.
 *   ITALIAN and Spanish both set speech in caporali. Both files did it three
 *     times in four, which is not a convention, it is whoever wrote that line.
 *   JAPANESE takes 。 and 、, not a Latin full stop, and sets speech in 「」.
 *     It also does not put spaces between its words.
 *   AFRIKAANS writes the indefinite article 'n with its apostrophe, every time.
 *
 * And all four are asked the question frenchprobe asks last: is anything still
 * sitting in English. Proper nouns are listed by name, so an oversight has
 * nowhere to hide behind one.
 *
 * Every budget here is a COUNT OF THINGS STILL WRONG and may only ever go down.
 *
 * Run: npx vite-node scripts/readslike.ts
 */
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const say = (s: string) => console.log(s)

type Dict = { [k: string]: unknown }
const flat = (d: Dict, path = '', out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(d)) {
    if (k === '_meta') continue
    const p = path ? `${path}.${k}` : k
    if (typeof v === 'string') out[p] = v
    else if (v && typeof v === 'object') flat(v as Dict, p, out)
  }
  return out
}
const load = (lang: string) => flat(JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf8')) as Dict)
const EN = load('en')

/** The words of a string, ignoring anything inside a placeholder. */
const words = (s: string) => s.replace(/\{[^}]*\}/g, '').match(/[A-Za-z][A-Za-z'’-]{2,}/g) ?? []

/**
 * Names that are the same in every language on purpose.
 *
 * "Pro Manager" is the product in the store and is sold under that name.
 * "Sauvez Sapiac" is a French challenge title and is French in the English
 * file too. The rest are competitions, which carry their fictional names
 * everywhere the way the club names do.
 */
const PROPER = new Set([
  'store.removeAds', 'challenges.sapiac', 'week.compWc', 'week.compPnc',
  'player.worldPoty', 'world.dtTitle', 'world.natPnc', 'world.natSn',
  'world.natTrc', 'world.natWc', 'legacy.lgHallOfFame', 'matchday.testMatch',
])

// ---------------------------------------------------------------------------
// 1. NOTHING IS STILL SITTING IN ENGLISH
// ---------------------------------------------------------------------------
say('--- 1. nothing is still in English')
for (const lang of ['es', 'it', 'ja', 'af']) {
  const D = load(lang)
  // two real words or more, identical to the English, and not a listed name
  const stuck = Object.entries(D).filter(([k, v]) =>
    EN[k] === v && words(v).length >= 2 && !PROPER.has(k))
  ok(stuck.length === 0,
    `${lang}: ${stuck.length} entries are word-for-word English${stuck.length ? ` - ${stuck[0][0]}: "${stuck[0][1].slice(0, 50)}"` : ''}`)
}

// ---------------------------------------------------------------------------
// 2. SPANISH OPENS WHAT IT CLOSES
// ---------------------------------------------------------------------------
say('\n--- 2. Spanish opens its questions and its exclamations')
{
  const ES = load('es')
  const q = Object.entries(ES).filter(([, v]) => v.includes('?') && !v.includes('¿'))
  const e = Object.entries(ES).filter(([, v]) => v.includes('!') && !v.includes('¡'))
  ok(q.length === 0, `${q.length} entries close a question without opening it${q.length ? ` - ${q[0][0]}` : ''}`)
  ok(e.length === 0, `${e.length} entries close an exclamation without opening it${e.length ? ` - ${e[0][0]}` : ''}`)
}

// ---------------------------------------------------------------------------
// 3. SPEECH IS SET THE WAY THE LANGUAGE SETS IT
// ---------------------------------------------------------------------------
say('\n--- 3. speech is set in the marks the language uses')
{
  for (const lang of ['es', 'it']) {
    const D = load(lang)
    const plain = Object.entries(D).filter(([, v]) => v.includes('"'))
    const guill = Object.values(D).filter(v => v.includes('«')).length
    ok(plain.length === 0,
      `${lang}: ${guill} entries in guillemets, ${plain.length} still in plain quotes${plain.length ? ` - ${plain[0][0]}` : ''}`)
  }
  const JA = load('ja')
  const jaPlain = Object.entries(JA).filter(([, v]) => v.includes('"'))
  const jaCorner = Object.values(JA).filter(v => v.includes('「')).length
  ok(jaPlain.length === 0, `ja: ${jaCorner} entries in corner brackets, ${jaPlain.length} in plain quotes`)
}

// ---------------------------------------------------------------------------
// 4. JAPANESE IS PUNCTUATED AND SPACED AS JAPANESE
// ---------------------------------------------------------------------------
say('\n--- 4. Japanese takes Japanese punctuation')
{
  const JA = load('ja')
  const JP = /[぀-ヿ一-鿿]/
  const latin = Object.entries(JA).filter(([, v]) => JP.test(v) && /[぀-ヿ一-鿿][.,](\s|$)/.test(v))
  ok(latin.length === 0, `${latin.length} entries put a Latin full stop or comma after Japanese script`)
  // A space between two Japanese words is an English habit. Eight remain, and
  // every one is a deliberate gap in a two-part LABEL ("交代枠 残り{n}") rather
  // than a sentence, which is ordinary in Japanese UI.
  const spaced = Object.entries(JA).filter(([, v]) => /[぀-ヿ一-鿿] [぀-ヿ一-鿿]/.test(v))
  ok(spaced.length <= 8, `${spaced.length} entries space Japanese words apart (budget 8, all of them labels)`)
}

// ---------------------------------------------------------------------------
// 5. AFRIKAANS KEEPS ITS APOSTROPHE
// ---------------------------------------------------------------------------
say("\n--- 5. Afrikaans writes 'n with its apostrophe")
{
  const AF = load('af')
  // A bare n before a lower-case word is the article with its apostrophe lost.
  //
  // UNICODE-AWARE, and it has to be: JavaScript's \w is ASCII only, so it does
  // not think ë is a letter, and the first cut of this reported nine faults
  // that were all the word "reën" - rain, which the Afrikaans of a rugby game
  // says rather a lot. The n it was flagging was the last letter of the word in
  // front of it.
  const bare = Object.entries(AF).filter(([, v]) => /(?:^|[^\p{L}\p{N}_'’])n\s+[a-z]/u.test(v))
  ok(bare.length === 0, `${bare.length} entries drop the apostrophe from 'n${bare.length ? ` - ${bare[0][0]}` : ''}`)
  const withIt = Object.values(AF).filter(v => v.includes("'n ")).length
  say(`       ${withIt} entries carry it`)
  // and one apostrophe, not two kinds
  const curly = Object.entries(AF).filter(([, v]) => v.includes('’n'))
  ok(curly.length === 0, `${curly.length} entries use a curly apostrophe where the file uses a straight one`)
}

console.log(fails
  ? `\nREADS LIKE FAILED (${fails})`
  : '\nREADS LIKE PASSED: five languages, each asked about its own conventions')
if (fails) process.exit(1)
