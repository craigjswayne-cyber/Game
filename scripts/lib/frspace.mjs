// Normalise the no-break spaces in the French dictionary.
//
// French sets a space before : ; ! ? and inside guillemets, and that space has
// to be U+00A0 or a narrow screen can wrap the punctuation onto its own line.
// Every hand-written French line arrives with a plain space in it, because a
// plain space is what a keyboard makes. This puts them right.
//
//   node scripts/lib/frspace.mjs
//
// Run it after editing src/locales/fr.json. scripts/frenchprobe.ts fails the
// build if you forget, which is how this file came to exist: the probe caught
// the same mistake in two consecutive commits of mine.
//
// NOTE THE ESCAPES. The first version of this had the no-break space as a
// literal in the source and silently did nothing - a literal U+00A0 in a
// character class is invisible in every editor and survives exactly one
// copy-paste.   cannot be mistyped or mangled.
import { readFileSync, writeFileSync } from 'node:fs'

const NB = ' '
const P = 'src/locales/fr.json'
const src = readFileSync(P, 'utf8')
const d = JSON.parse(src)

let n = 0
const fix = (s) => {
  const out = s
    .replace(/(?<=[^  ]) (?=[:;!?])/g, NB)
    .replace(/« (?=\S)/g, '«' + NB)
    .replace(/(?<=\S) »/g, NB + '»')
  if (out !== s) n++
  return out
}
const walk = (o) => {
  if (typeof o === 'string') return fix(o)
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]))
  }
  return o
}

// _meta is a note to whoever translates next, not display text.
const meta = d._meta
const out = walk(d)
if (meta !== undefined) out._meta = meta
writeFileSync(P, JSON.stringify(out, null, 2) + '\n')
console.log(`${n} entr${n === 1 ? 'y' : 'ies'} given no-break spaces`)
