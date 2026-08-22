// The second half of the v1.0.2 rename: real marks written into game PROSE.
//
// Run: node scripts/rename-prose.mjs [--dry]
//
// rename-apply.mjs renames the DATA - the club, ground and competition
// definitions. It cannot touch the other place these marks live: handbook
// answers, challenge descriptions, news bodies, screen labels and commentary
// lines, where somebody wrote "the Top 14" or "win the Champions Cup" into a
// sentence. scripts/iplint.ts found sixteen of them still in the shipped
// bundle after the data pass, which is exactly why that lint reads dist/ rather
// than trusting either of these scripts.
//
// ORDER MATTERS AND IS NOT ALPHABETICAL. Longest phrase first, always: replace
// "World Cup" before "Rugby World Cup" and you are left with "Rugby The World
// Championship". Every pair below is ordered so the specific case is consumed
// before the general one, and the list is checked for that at the bottom.
//
// COMMENTS ARE LEFT ALONE. A comment explaining why a name changed should keep
// saying the name it changed from, and comments do not ship.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dry = process.argv.includes('--dry')

/** [from, to] - longest first within each family. */
const PROSE = [
  ['European Challenge Cup', 'The Continental Shield'],
  ['Challenge Cup', 'Continental Shield'],
  ['Champions Cup', 'European Club Cup'],
  ['Rugby World Cup', 'World Championship'],
  ['World Cup', 'World Championship'],
  ['Six Nations', 'European Nations Championship'],
  ['Pacific Nations Cup', 'The Islands Cup'],
  ['Pacific Cup', 'Islands Cup'],
  ['National League One', 'English National Division'],
  ['National 1', 'National Div'],
  ['Japan League One', 'Japan Elite League'],
  ['League One', 'Elite League'],
  ['Premiership', 'Premier Division'],
  ['Top 14', 'Elite 14'],
  ['Cornish Pirates', 'Penzance'],
  ['Thomond Park', 'Limerick Park'],
  ['The Heineken West Derby', 'The West Country Derby'],
]

// the ordering invariant, asserted rather than assumed
for (let i = 0; i < PROSE.length; i++) {
  for (let j = i + 1; j < PROSE.length; j++) {
    if (PROSE[i][0].includes(PROSE[j][0]) === false && PROSE[j][0].includes(PROSE[i][0])) {
      console.error(`ORDER BUG: '${PROSE[j][0]}' contains '${PROSE[i][0]}' but comes after it`)
      process.exit(1)
    }
  }
}

const files = []
const walk = (d) => {
  for (const n of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, n.name)
    if (n.isDirectory()) walk(p)
    else if (/\.(ts|tsx|css)$/.test(n.name)) files.push(p)
  }
}
walk('src')

/** Split a line into code and trailing comment, crudely but safely: only treat
 *  '//' as a comment when it is not inside a string on that line. */
const codePart = (line) => {
  let q = null
  for (let i = 0; i < line.length - 1; i++) {
    const c = line[i]
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue }
    if (c === "'" || c === '"' || c === '`') { q = c; continue }
    if (c === '/' && line[i + 1] === '/') return [line.slice(0, i), line.slice(i)]
  }
  return [line, '']
}

let edits = 0
for (const p of files) {
  const lines = readFileSync(p, 'utf8').split('\n')
  let block = false, changed = false
  for (let i = 0; i < lines.length; i++) {
    const st = lines[i].trim()
    if (block) { if (st.includes('*/')) block = false; continue }
    if (st.startsWith('/*')) { if (!st.includes('*/')) block = true; continue }
    if (st.startsWith('//') || st.startsWith('*')) continue
    const [code, comment] = codePart(lines[i])
    let out = code
    for (const [from, to] of PROSE) out = out.split(from).join(to)
    if (out !== code) { lines[i] = out + comment; changed = true; edits++ }
  }
  if (changed && !dry) writeFileSync(p, lines.join('\n'))
}
console.log(`${dry ? '[dry] ' : ''}${edits} prose line(s) rewritten`)
