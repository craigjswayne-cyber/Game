// Apply the v1.0.2 rename table to the shipped source.
//
// Run: node scripts/rename-apply.mjs [--dry]
//
// SCOPED, NOT GLOBAL, and that is the whole design. A blanket search and
// replace across src/data would rewrite player names that share a word with a
// club or a ground - Richmond, Bath and Sale are all surnames as well as
// places. So every club edit is made INSIDE that club's own entry, found by its
// id, and nothing outside those bounds is touched.
//
// THREE SHAPES IN THE DATA, and each of the first two passes of this script
// silently under-applied because it only knew about some of them:
//
//   1. object literal   id: 'bath', name: 'Bath', short: 'Bath',
//   2. helper call      club('ealing', 'Ealing Trailfinders', 'Ealing', ...)
//   3. double quotes    "Gillman's Ground"   (used when the value has an
//                       apostrophe; the alternative is 'St Helen\'s')
//
// Missing shape 2 left 49 of 101 clubs unrenamed; missing shape 3 left 2 more.
// Both passes reported success. That is why this script now prints an edit
// count the caller is expected to check against the table, and why
// scripts/iplint.ts exists to fail the build rather than trust any of it.
//
// Idempotent: a second run finds the new names in place and the old ones gone.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dry = process.argv.includes('--dry')
const src = readFileSync('scripts/rename-map.ts', 'utf8')

const rowsOf = (marker) => {
  const body = src.slice(src.indexOf(`export const ${marker}`))
  const list = body.slice(body.indexOf('['), body.indexOf('\n]'))
  return [...list.matchAll(/\{([^}]*)\}/g)].map(m => {
    const o = {}
    for (const f of m[1].matchAll(/(\w+):\s*'((?:[^'\\]|\\.)*)'/g)) o[f[1]] = f[2].replace(/\\'/g, "'")
    return o
  })
}
export const COMPS = rowsOf('COMPS')
export const CLUBS = rowsOf('CLUBS')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** The value as it may be written in source: either quote style, escaped or not. */
const lit = (s) => `(?:'${esc(s).replace(/'/g, "\\\\?'")}'|"${esc(s)}")`
/** Any string literal, either style. */
const ANY = `(?:'(?:[^'\\\\]|\\\\.)*'|"[^"]*")`
/** Write a value back out in a form that parses. */
const out = (s) => (s.includes("'") ? `"${s}"` : `'${s}'`)
/** A short name that still fits a phone table cell. */
const shortOf = (name) => {
  if (name.length <= 12) return name
  const cut = name.split(/[-\s]/)[0]
  return cut.length >= 3 ? cut : name.slice(0, 12)
}

let edits = 0
const missed = []
/** path -> transformed text. Verification reads THIS, not the disk: in a dry
 *  run nothing is written, so re-reading the files reported every single name
 *  as unrenamed and the check was worthless exactly when it mattered most. */
const result = new Map()

for (const f of readdirSync('src/data/leagues').filter(n => n.endsWith('.ts'))) {
  const p = join('src/data/leagues', f)
  let t = readFileSync(p, 'utf8')
  const before = t
  for (const c of CLUBS) {
    // shape 1: an object literal, edited only between its id and its player list
    const at = t.indexOf(`id: '${c.id}',`)
    if (at >= 0) {
      const end = t.indexOf('players:', at)
      if (end > at) {
        let block = t.slice(at, end)
        const orig = block
        block = block.replace(new RegExp(`name: ${lit(c.was)}`), `name: ${out(c.now)}`)
        block = block.replace(new RegExp(`short: ${ANY}`), `short: ${out(shortOf(c.now))}`)
        block = block.replace(new RegExp(`stadium: ${lit(c.wasGround)}`), `stadium: ${out(c.nowGround)}`)
        if (block !== orig) { t = t.slice(0, at) + block + t.slice(end); edits++ }
        continue
      }
    }
    // shape 2: club('id', 'Name', 'Short', 'City', 'Ground', ...)
    const call = new RegExp(
      `(club\\('${esc(c.id)}',\\s*)${lit(c.was)}(,\\s*)${ANY}(,\\s*${ANY},\\s*)${lit(c.wasGround)}`)
    if (call.test(t)) {
      t = t.replace(call, (_, a, b, d) =>
        `${a}${out(c.now)}${b}${out(shortOf(c.now))}${d}${out(c.nowGround)}`)
      edits++
    }
  }
  result.set(p, t)
  if (t !== before && !dry) writeFileSync(p, t)
}

for (const p of ['src/game/newgame.ts', 'src/game/schedule.ts']) {
  let t = readFileSync(p, 'utf8')
  const before = t
  for (const c of COMPS) {
    // only where the comp's own id is on the same line, so the name appearing
    // in prose somewhere else is left alone
    // NO .test() ON A /g REGEX BEFORE .replace(). test() advances lastIndex on a
    // global pattern, which is how the Champions Cup default parameter in
    // schedule.ts survived the first run: the guard consumed the only match and
    // the replace then found nothing. Replace, then compare.
    const one = new RegExp(`(id: '${c.id}',[^\\n]{0,100}?)name: ${lit(c.was)}`, 'g')
    const afterName = t.replace(one, (_, h) => `${h}name: ${out(c.now)}`)
    if (afterName !== t) { t = afterName; edits++ }
    const sh = new RegExp(`(id: '${c.id}',[^\\n]{0,160}?)short: ${lit(c.wasShort)}`, 'g')
    t = t.replace(sh, (_, h) => `${h}short: ${out(c.nowShort)}`)
  }
  result.set(p, t)
  if (t !== before && !dry) writeFileSync(p, t)
}

// verify against the table rather than reporting a number and hoping
{
  const all = [...result.values()].join('\n').replace(/\\'/g, "'")
  // a row whose old name IS its new name was never going to change - Bishop's
  // Stortford is its own city - and reporting it as a miss is noise
  const there = (v) => all.includes(`'${v}'`) || all.includes(`"${v}"`)
  for (const c of CLUBS) {
    if (c.was !== c.now && there(c.was)) missed.push(`club ${c.id}: ${c.was}`)
    if (c.wasGround !== c.nowGround && there(c.wasGround)) missed.push(`ground ${c.id}: ${c.wasGround}`)
  }
  for (const c of COMPS) {
    if (c.was !== c.now && there(c.was)) missed.push(`comp ${c.id}: ${c.was}`)
  }
}

console.log(`${dry ? '[dry] ' : ''}${edits} rename edit(s); ${missed.length} still present`)
for (const m of missed) console.log(`  STILL THERE  ${m}`)
if (missed.length && !dry) process.exit(1)
