// House-style lint over the source tree: game text must never carry an em
// dash (standing rule) or mojibake from a bad encoding round-trip. En dashes
// are allowed here because the score convention (24–18) is deliberate; the
// runtime sweep in invariants.ts checks that en dashes only ever appear in
// that digit-to-digit context once the text is actually rendered.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let fails = 0
const flag = (file: string, line: number, why: string, text: string) => {
  fails++
  console.error(`${file}:${line} ${why}: ${text.trim().slice(0, 100)}`)
}

const scan = (file: string) => {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('—')) flag(file, i + 1, 'em dash', line)
    if (line.includes('―')) flag(file, i + 1, 'horizontal bar', line)
    if (line.includes('â€') || line.includes('�')) flag(file, i + 1, 'mojibake', line)
    // A club's possessive built with a bare apostrophe-s. Rugby club names are
    // overwhelmingly plural in form - Saracens, Harlequins, Crusaders, Ospreys,
    // Brumbies - so this produces "Crusaders's media team" for a large slice of
    // the league. Found live in the wire probe's sample output. model.poss()
    // handles both cases; .short is always a club, so it is safe to demand it.
    if (/\.short *(\?\?[^}]*)?\}.s/.test(line)) flag(file, i + 1, "club possessive - use poss()", line)
  })
}

const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx|html|css)$/.test(name)) scan(p)
  }
}

walk('src')
scan('index.html')

if (fails === 0) console.log('TEXT LINT PASSED (src + index.html clean)')
else { console.error(`TEXT LINT: ${fails} violations`); process.exit(1) }
