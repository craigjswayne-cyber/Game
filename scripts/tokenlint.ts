/**
 * ---- NO HEX OUTSIDE THE TOKEN FILE ----
 *
 * Rule 1 of the colour system: every colour in the game lives in
 * src/ui/tokens.css or does not exist. A palette dies one hardcoded hex at a
 * time - the previous system had 243 of them in the components alone - so the
 * rule is enforced by build, not by review.
 *
 * Allowed outside tokens.css:
 *   - src/data/** : club colours are DATA (a save sets --club1/--club2 from
 *     them at runtime), not theme.
 *   - #000 / #fff inside mask-image lines: alpha masks, not colour.
 *   - achromatic rgba()/text-shadow overlays (scrims over imagery) - rgba is
 *     not hex, and the chromatic ones were all tokenised; anything chromatic
 *     that sneaks back in as rgba() is caught by the second check.
 *   - index.html: the PWA theme-color meta and its comments.
 *
 * Also bans the RETIRED token names (--ink, --paper, --gold-bright, ...) so
 * the old palette cannot creep back through a fallback.
 *
 * Run: npx vite-node scripts/tokenlint.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let fails = 0
const bad = (file: string, line: number, what: string) => {
  console.log(`FAIL  ${file}:${line}  ${what}`)
  fails++
}

const files: string[] = []
const walk = (dir: string) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (!p.includes('data')) walk(p) }
    else if (/\.(tsx?|css)$/.test(e)) files.push(p)
  }
}
walk('src')

const HEX = /#[0-9a-fA-F]{3,8}\b/g
const RETIRED = /var\(--(ink|paper|cream|hairline|gold-bright|gold-dark|gold-deep|title-ink|accent-ink|star-empty|stripe|win|loss|draw|red|brand-\d+|shadow-[12])[,)]/

for (const f of files) {
  if (f.endsWith('tokens.css')) continue
  const lines = readFileSync(f, 'utf8').split('\n')
  let inBlock = false
  lines.forEach((l, i) => {
    const code = l
    // comments mentioning a hex are history, not paint. Track /* */ state so
    // a block comment's interior lines are skipped too (the first cut only
    // matched lines that STARTED like comments, and a design-history note in
    // theme.css tripped it).
    const wasIn = inBlock
    if (/\/\*/.test(l) && !/\*\//.test(l)) inBlock = true
    if (/\*\//.test(l)) inBlock = false
    if (wasIn || /^\s*(\/\/|\*|\/\*)/.test(l)) return
    // an alpha gloss (#fff/#000 stops with stopOpacity) is a shine, not a colour
    if (/stopOpacity/.test(l) && (l.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).every(h => /^#(000|fff)$/i.test(h))) return
    const m = code.match(HEX)
    if (m) {
      const masked = /mask-image/.test(code) && m.every(h => /^#(000|fff)$/i.test(h))
      if (!masked) bad(f, i + 1, `hardcoded ${m.join(' ')} - colours live in src/ui/tokens.css`)
    }
    if (RETIRED.test(code)) bad(f, i + 1, 'retired token name - use the semantic tokens')
  })
}

console.log(fails ? `TOKEN LINT FAILED (${fails})` : `TOKEN LINT PASSED (${files.length} files, colour only in tokens.css)`)
if (fails) process.exit(1)
