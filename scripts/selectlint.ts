/**
 * ---- EVERY DROPDOWN IS THE GAME'S OWN ----
 *
 * 1.8.8, the owner's screenshot from a phone: the Pinnacle federation picker
 * was a bare <select> with no class, so it drew in the platform's default
 * look, a pill with "Canada" pressed against its left edge. Every other
 * dropdown in the game wears .inline-input (padding, border, the theme's own
 * surface and ink, a 44px tap height). This holds that every <select> in the
 * UI source carries that class, so the next one cannot ship bare.
 *
 * Run: npx vite-node scripts/selectlint.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files: string[] = []
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.tsx')) files.push(p)
  }
}
walk('src/ui')

let n = 0
const bad: string[] = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // an opening tag with attributes, read up to the first '>' (an arrow in an
  // onChange can end it early, which is why className is checked, and every
  // select here names its class first). "<select>" in prose is not a tag.
  const re = /<select\s([^>]*)/g
  for (let m; (m = re.exec(src));) {
    n++
    const attrs = m[1]
    const line = src.slice(0, m.index).split('\n').length
    if (!/className="[^"]*\binline-input\b/.test(attrs)) bad.push(`${f}:${line}`)
  }
}
for (const b of bad) console.log(`FAIL  a <select> without .inline-input: ${b}`)
console.log(n > 10 ? `  ok  ${n} <select> elements found` : `FAIL  only ${n} <select> elements found: the scan is broken`)
if (bad.length || n <= 10) { console.log(`\nSELECT LINT FAILED (${bad.length})`); process.exit(1) }
console.log('\nSELECT LINT PASSED: every dropdown wears the game\'s own style')
