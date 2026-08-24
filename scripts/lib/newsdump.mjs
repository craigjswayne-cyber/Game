// Dump every story-filing site in a file, so a conversion batch can be planned
// against what is actually there rather than against a grep.
//
// Not a probe and not shipped: a working tool for the news translation, kept
// because the same job exists for the press questions and the scout notes.
//
//   node scripts/lib/newsdump.mjs src/game/season.ts
//   node scripts/lib/newsdump.mjs src/game/season.ts --naked   (only unconverted)
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const onlyNaked = process.argv.includes('--naked')
const src = readFileSync(file, 'utf8')

/** Balanced-brace slice from an opening brace. */
function objectAt(s, open) {
  let d = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') d++
    else if (s[i] === '}') { d--; if (d === 0) return s.slice(open, i + 1) }
  }
  return s.slice(open)
}

/** Top-level `field:` value from an object literal, as written. */
function field(obj, name) {
  let d = 0
  for (let i = 0; i < obj.length; i++) {
    const c = obj[i]
    if (c === '{' || c === '[' || c === '(') d++
    else if (c === '}' || c === ']' || c === ')') d--
    else if (d === 1 && obj.startsWith(name + ':', i) && /[\s,{]/.test(obj[i - 1] ?? '')) {
      // to the comma that closes this field at this depth
      let dd = 0
      for (let j = i + name.length + 1; j < obj.length; j++) {
        const q = obj[j]
        if (q === '{' || q === '[' || q === '(') dd++
        else if (q === '}' || q === ']' || q === ')') { if (dd === 0) return obj.slice(i + name.length + 1, j).trim(); dd-- }
        else if (q === ',' && dd === 0) return obj.slice(i + name.length + 1, j).trim()
      }
    }
  }
  return null
}

const marker = 'state.news.push({'
let n = 0
for (let i = src.indexOf(marker); i !== -1; i = src.indexOf(marker, i + 1)) {
  const obj = objectAt(src, src.indexOf('{', i + marker.length - 1))
  const k = field(obj, 'k')
  if (onlyNaked && k) continue
  const line = src.slice(0, i).split('\n').length
  console.log(`### ${n++} @${file}:${line}${k ? ` [k=${k}]` : ''}`)
  console.log('SUBJ: ' + (field(obj, 'subject') ?? '(none)'))
  console.log('BODY: ' + (field(obj, 'body') ?? '(none)'))
  console.log()
}
console.error(`${n} site(s)`)
