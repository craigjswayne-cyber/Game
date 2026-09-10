/**
 * ---- DOES THIS READ LIKE A PERSON WROTE IT? ----
 *
 * Owner, twice: "humanise all text across all languages" - "too ai style" - and
 * then, plainly, "can we check that it is natural language".
 *
 * "Natural" is not something a probe can assert, and any file that claims to
 * measure good writing is lying. What a probe CAN do is count TICS, and a
 * machine writing English has a very small number of them. This counts three,
 * and only over the long prose - the news bodies, the press room, the handbook.
 * Short labels are terse by design, and a dash in one is punctuation rather
 * than a habit.
 *
 *   THE VOCABULARY. delve, tapestry, testament to, navigate the, seamless,
 *     robust, myriad, "not just", a sentence opening "Moreover". These are free
 *     to check and the answer here has always been zero, which is worth keeping
 *     that way rather than discovering later.
 *   THE DASH HINGE. "Statement - qualifier." One long sentence in three was
 *     built this way. Never wrong once; a tic at that rate.
 *   THE APHORISM CLOSE. A story ending on a wry balanced coda hung off a dash:
 *     "Write the script yourself - you could not do better." Ninety-three of
 *     them, which across a season is a machine with a mannerism.
 *
 * THE SPANISH IS THE CONTROL, and it is what makes any of this measurable
 * rather than a matter of taste. es.json is the same game, the same stories,
 * translated by somebody who recast the hinge into ordinary Spanish
 * punctuation: 2% against the English 32%. The hinge is therefore not
 * load-bearing - the same sentences carry the same meaning without it - so a
 * ceiling Spanish already clears is a ceiling the rest can be held to.
 *
 * The ceilings below are set where the text stands after the first pass
 * (scripts/tools/revoice.py), which halved the aphorism closes. They are not
 * where it should end up. They exist so the next pass can be measured and so
 * the tic cannot creep back in while nobody is counting.
 *
 * Run: npx vite-node scripts/voiceprobe.ts
 */
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const say = (s: string) => console.log(s)

const LANGS = ['en', 'fr', 'es', 'it', 'ja', 'af'] as const
type Lang = typeof LANGS[number]

/** Every string in a locale, with the key it lives under. */
function stringsOf(lang: Lang): [string, string][] {
  const out: [string, string][] = []
  const walk = (o: unknown, path: string) => {
    if (typeof o === 'string') { out.push([path, o]); return }
    if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[${i}]`)); return }
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (k === '_meta' || k === '//') continue
        walk(v, path ? `${path}.${k}` : k)
      }
    }
  }
  walk(JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf8')), '')
  return out
}

/** The prose, as opposed to the labels: a news body, a press answer, a handbook
 *  entry. Japanese does not put spaces between words, so it is measured in
 *  characters. */
const isLong = (lang: Lang, s: string) =>
  lang === 'ja' ? s.length >= 60 : s.split(/\s+/).length >= 20

// the dash hinge, and the same dash closing the last clause of the piece
const HINGE = / - |——/
const CLOSE = /(?: - |——)[^.。]{5,45}[.。]\s*$/

// ---------------------------------------------------------------------------
// 1. THE VOCABULARY NOBODY ACTUALLY USES
// ---------------------------------------------------------------------------
say('\n--- 1. the words that give a machine away')
{
  const TELLS: [string, RegExp][] = [
    ['delve / tapestry / testament / seamless / myriad', /\b(delve|tapestry|testament to|landscape of|navigate the|underscore[sd]?|showcase[sd]?|seamless|robust|vibrant|myriad|plethora|realm of)\b/i],
    // the COPULAR form only. "Handle the occasion, not just the opposition" is
    // an ordinary contrast and good English; "it isn't just a game, it's ..."
    // is the escalation a generator reaches for, and that is what this catches.
    ['"X isn\'t just Y" as an escalation', /\b(?:is|are|was|were) not just\b|\b(?:isn't|aren't|wasn't|weren't|it's|that's) just\b[^.]{2,60}(?:it|that)['\u2019]?s\b/i],
    ['a sentence opening Moreover / Furthermore / Indeed', /(?:^|[.!?]\s+)(Indeed|Moreover|Furthermore|Ultimately|Crucially|Notably|Importantly)\b/],
    ['"it is not X, it is Y"', /\b(?:is|was|are|were) not (?:a|an|the)\b[^.]{2,40}\b(?:it|that) (?:is|was)\b/i],
    ['"the kind of X that"', /\bthe kind of\b[^.]{2,30}\bthat\b/i],
  ]
  const prose = stringsOf('en')
  for (const [name, rx] of TELLS) {
    const hits = prose.filter(([, s]) => rx.test(s))
    ok(hits.length === 0,
      `${name}: ${hits.length}${hits.length ? ` - ${hits[0][0]}: "${hits[0][1].slice(0, 60)}..."` : ''}`)
  }
}

// ---------------------------------------------------------------------------
// 2. THE DASH HINGE, AGAINST THE SPANISH THAT PROVES IT OPTIONAL
// ---------------------------------------------------------------------------
say('\n--- 2. the dash hinge')
{
  // where the text stands now, plus a point or two of room. Spanish is here to
  // be looked at, not to be met tomorrow.
  const CEILING: Record<Lang, number> = { en: 30, fr: 27, es: 5, it: 24, ja: 25, af: 30 }
  for (const lang of LANGS) {
    const long = stringsOf(lang).filter(([, s]) => isLong(lang, s))
    const n = long.filter(([, s]) => HINGE.test(s)).length
    const pct = Math.round((n / long.length) * 100)
    ok(pct <= CEILING[lang],
      `${lang}: ${n} of ${long.length} long strings hinge on a dash (${pct}%, ceiling ${CEILING[lang]}%)`)
  }
  say('       Spanish carries the same stories at 2%, which is what says the rest can come down')
}

// ---------------------------------------------------------------------------
// 3. THE APHORISM CLOSE
// ---------------------------------------------------------------------------
say('\n--- 3. stories that all end the same way')
{
  const CEILING: Record<Lang, number> = { en: 55, fr: 48, es: 10, it: 38, ja: 90, af: 62 }
  for (const lang of LANGS) {
    const long = stringsOf(lang).filter(([, s]) => isLong(lang, s))
    const n = long.filter(([, s]) => CLOSE.test(s.trim())).length
    ok(n <= CEILING[lang], `${lang}: ${n} pieces close on a dash-hung coda (ceiling ${CEILING[lang]})`)
  }
  // Japanese is deliberately generous: —— is an ordinary device in Japanese
  // prose rather than the English tic wearing a translation, and revoice.py
  // leaves it alone for that reason.
}

// ---------------------------------------------------------------------------
// 4. EVERY SENTENCE STARTING THE SAME WAY
//
// A writer varies where a sentence begins. A generator reaches for the noun
// phrase: "The board...", "A week of...". This is the loosest of the three
// checks and the ceiling is correspondingly loose; it is here to catch a drift,
// not to police a paragraph.
// ---------------------------------------------------------------------------
say('\n--- 4. how sentences begin')
{
  const prose = stringsOf('en').filter(([, s]) => s.split(/\s+/).length >= 6)
  const articles = prose.filter(([, s]) => /^(?:The|A|An)\s/.test(s.trim())).length
  const pct = Math.round((articles / prose.length) * 100)
  ok(pct <= 22, `${articles} of ${prose.length} English lines open on The/A/An (${pct}%, ceiling 22%)`)
}

console.log(fails
  ? `\nVOICE PROBE FAILED (${fails})`
  : '\nVOICE PROBE PASSED: the tics are counted, and none of them is getting worse')
if (fails) process.exit(1)
