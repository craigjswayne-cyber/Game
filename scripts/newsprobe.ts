// Probe: no story reaches a reader in a language they did not choose.
//
// The inbox is the biggest body of prose in the game after the commentary, and
// for a long time all of it was English no matter who was reading. The fix was
// to file every story as a key plus its variables (see model.ts NewsItem) and
// render it at the moment it is read. The fix is only worth anything if the
// NEXT story added obeys it too, and nothing about writing a news story makes
// you remember that - you are thinking about the story.
//
// So this is the thing that remembers. Three questions:
//
//   1. Does every story carry a key? A `state.news.push({` with no `k:` is a
//      story that will be English in a French career, for ever, in a save that
//      may outlive several releases.
//   2. Does every key it names actually exist - including the ones hidden
//      inside _k fragments and _l lists, which no text search would find?
//   3. Does every language have it? A key that exists only in English is a
//      French reader falling back to English and nobody noticing.
//
// THE BUDGET below is a ratchet. It exists because the conversion was done over
// many commits and a probe that cannot pass is a probe somebody switches off.
// It may go DOWN and never up. At zero it stops being a budget and becomes what
// it was always for: a story without a key fails the build.
//
// Run: npx vite-node scripts/newsprobe.ts
import { readFileSync, readdirSync } from 'node:fs'

/** Story-filing sites still writing prose with no key. ONLY EVER DECREASE. */
const BUDGET = 147

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const GAME = 'src/game'
const files = readdirSync(GAME).filter(f => f.endsWith('.ts')).map(f => `${GAME}/${f}`)

type Dict = { [k: string]: unknown }
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Dict
const LANGS: Record<string, Dict> = { en: load('src/locales/en.json'), fr: load('src/locales/fr.json') }

const lookup = (d: Dict, key: string): unknown =>
  key.split('.').reduce<unknown>((o, part) => (o && typeof o === 'object' ? (o as Dict)[part] : undefined), d)

/** The object literal passed to a push, by matching braces from the opening one.
 *  Depth-tracked rather than regexed, because these objects contain nested
 *  objects, template literals with `${}` in them, and JSON.stringify calls. */
function objectAt(src: string, openIdx: number): string {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return src.slice(openIdx, i + 1) }
  }
  return src.slice(openIdx)
}

/** Does this object literal set `k:` at its OWN top level? A `{ k: '...' }`
 *  inside an _l list is a list item's key, not the story's, and counting it
 *  would let a story pass by naming its parts. */
function hasTopLevelKey(obj: string): boolean {
  let depth = 0
  for (let i = 0; i < obj.length; i++) {
    const c = obj[i]
    if (c === '{' || c === '[' || c === '(') depth++
    else if (c === '}' || c === ']' || c === ')') depth--
    // `k: 'news.x'` and the shorthand `k,` both count. The shorthand is what
    // the wire() helper writes, and missing it made the probe report a file it
    // had just finished converting as untouched.
    else if (depth === 1 && obj.startsWith('k', i) && /[\s,{]/.test(obj[i - 1] ?? '') && /^[:,\s]/.test(obj[i + 1] ?? '')) return true
  }
  return false
}

/** The key a story is filed under, taken from the object's own top level. Two
 *  when the site picks between them with a ternary. */
function storyKeysOf(obj: string): string[] {
  const out: string[] = []
  let depth = 0
  for (let i = 0; i < obj.length; i++) {
    const c = obj[i]
    if (c === '{' || c === '[' || c === '(') depth++
    else if (c === '}' || c === ']' || c === ')') depth--
    else if (depth === 1 && obj.startsWith('k:', i) && /[\s,{]/.test(obj[i - 1] ?? '')) {
      // to the end of the VALUE, which may be a ternary spanning lines, and
      // only the dotted names off it: `k: pl.kind === 'plans' ? 'news.keptPlans'
      // : ...` mentions 'plans', which is the condition, not a key.
      const line = obj.slice(i, obj.indexOf('\n', i) + 1 || undefined)
      for (const m of line.matchAll(/'([A-Za-z0-9_]+\.[A-Za-z0-9_.]+)'/g)) out.push(m[1])
    }
  }
  return out
}

// ---- 1. every story carries a key ----------------------------------------
say('--- 1. every story is filed with a key')
const naked: string[] = []
const storyKeys = new Set<string>()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const marker = 'state.news.push({'
  for (let i = src.indexOf(marker); i !== -1; i = src.indexOf(marker, i + 1)) {
    const open = src.indexOf('{', i + marker.length - 1)
    const obj = objectAt(src, open)
    if (!hasTopLevelKey(obj)) naked.push(`${f}:${src.slice(0, i).split('\n').length}`)
    else for (const k of storyKeysOf(obj)) storyKeys.add(k)
  }
}
say(`  ${naked.length} story site${naked.length === 1 ? '' : 's'} without a key (budget ${BUDGET})`)
if (naked.length) say('  ' + naked.slice(0, 12).join('\n  ') + (naked.length > 12 ? `\n  ...and ${naked.length - 12} more` : ''))
ok(naked.length <= BUDGET,
  naked.length <= BUDGET
    ? `no story is filed as untranslatable prose beyond the budget of ${BUDGET}`
    : `${naked.length - BUDGET} story site(s) over the budget of ${BUDGET} - a story with no key is English for ever`)
if (naked.length < BUDGET) {
  ok(false, `THE BUDGET IS STALE: ${naked.length} left but it still says ${BUDGET}. Lower it - a ratchet that is not tightened is not a ratchet`)
}

// ---- 2. every key a story names exists, in every language -----------------
say('\n--- 2. every key a story names exists in every language')
const blob = files.map(f => readFileSync(f, 'utf8')).join('\n')
const wanted = new Set<string>()
// plain 'news.x' literals, the _k fragments, and the k: inside _l list items
for (const m of blob.matchAll(/'(news\.[A-Za-z0-9_.]+)'/g)) wanted.add(m[1])
// a fragment may name any namespace, not just news: pers.Leader, facilities.gym
for (const m of blob.matchAll(/\b\w+_k:\s*'([A-Za-z0-9_.]+)'/g)) wanted.add(m[1])
for (const m of blob.matchAll(/\b\w+_k:\s*[^,\n]*\?\s*'([A-Za-z0-9_.]+)'\s*:\s*'([A-Za-z0-9_.]+)'/g)) {
  wanted.add(m[1]); wanted.add(m[2])
}
say(`  ${wanted.size} keys named by stories`)
for (const lang of Object.keys(LANGS)) {
  const gone = [...wanted].filter(k => lookup(LANGS[lang], k) === undefined)
  ok(gone.length === 0,
    `${lang} answers every key a story names${gone.length ? ` - missing ${gone.length}: ${gone.slice(0, 6).join(', ')}` : ''}`)
}

// ---- 3. a story's subject key exists wherever its body key does -----------
//
// newsSubject() builds the subject key by putting Subj on the end of the body
// key, so a body with no matching subject renders the raw key as the headline -
// the single most visible way this can break.
say('\n--- 3. every body key has the subject key that goes with it')
say(`  ${storyKeys.size} stories filed with a key`)
for (const lang of Object.keys(LANGS)) {
  const orphans = [...storyKeys].filter(k => lookup(LANGS[lang], k + 'Subj') === undefined)
  ok(orphans.length === 0,
    `${lang} has a subject for every story${orphans.length ? ` - missing ${orphans.length}: ${orphans.slice(0, 6).join(', ')}` : ''}`)
}

// ---- 4. the two languages say the same thing ------------------------------
//
// i18nprobe checks this across the whole dictionary; here it is checked for the
// news namespace specifically, with the placeholder names compared, because a
// story whose French forgets {player} renders a sentence with a hole in it.
say('\n--- 4. the placeholders match between languages')
const holes = (s: unknown): string => {
  const text = typeof s === 'string' ? s
    : s && typeof s === 'object' ? Object.values(s as Dict).filter(x => typeof x === 'string').join(' ')
    : ''
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort().join(',')
}
const enNews = (LANGS.en.news ?? {}) as Dict
const bad: string[] = []
for (const key of Object.keys(enNews)) {
  for (const lang of Object.keys(LANGS).filter(l => l !== 'en')) {
    const other = lookup(LANGS[lang], `news.${key}`)
    if (other === undefined) { bad.push(`${lang}:news.${key} missing`); continue }
    if (holes(enNews[key]) !== holes(other)) {
      bad.push(`${lang}:news.${key} (en "${holes(enNews[key])}" vs "${holes(other)}")`)
    }
  }
}
ok(bad.length === 0, `every story fills the same holes in both languages${bad.length ? ` - ${bad.length}: ${bad.slice(0, 5).join('; ')}` : ''}`)

say(fails ? `\nNEWS PROBE FAILED (${fails})` : `\nNEWS PROBE PASSED: ${wanted.size} story keys, every one of them in every language`)
process.exitCode = fails ? 1 : 0
