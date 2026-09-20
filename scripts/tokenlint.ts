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
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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

/* ==================================================================
   ---- THE INLINE-STYLE RATCHET (1.8.0) ----
   ==================================================================

   The colour rule above has held for a year because it is absolute: a hex
   outside tokens.css fails the build. The design system needs the same
   discipline for everything that is NOT colour - size, spacing, radius,
   elevation - and cannot have it the same way, because the game already
   contains 1,109 inline style objects and the rule would fail on its own
   first run.

   So it ratchets instead. Each file's count of the four properties below is
   recorded in scripts/qa/inline-baseline.json. A file may go DOWN and may
   never go up. New files start at zero and stay there.

   WHY THESE FOUR. They are the ones that fragment a design:

     fontSize      fourteen sizes in half-pixel steps is not a scale
     padding       the difference between a considered screen and a dense one
     borderRadius  6, 8, 10, 12 and 16 all shipped, with no rule
     boxShadow     elevation is surface lightness here, not shadow

   Deliberately NOT banned: colour properties (the hex rule above already
   owns those), width, height, flex, grid, transform and position. Those are
   layout decisions a screen is entitled to make, and a lint that fought them
   would be noise nobody reads.

   TO LOWER A BASELINE: migrate the screen, run with --update, commit the
   diff. The numbers falling is the migration's progress bar. */
const RATCHET = /\b(fontSize|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|borderRadius|boxShadow)\s*:/g
const BASELINE = 'scripts/qa/inline-baseline.json'
const counts: Record<string, number> = {}
for (const f of files) {
  if (!f.endsWith('.tsx')) continue
  const n = (readFileSync(f, 'utf8').match(RATCHET) ?? []).length
  if (n) counts[f] = n
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n')
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`baseline written: ${Object.keys(counts).length} files, ${total} inline style properties`)
} else {
  let base: Record<string, number> = {}
  try { base = JSON.parse(readFileSync(BASELINE, 'utf8')) } catch { /* first run */ }
  let moved = 0
  for (const [f, n] of Object.entries(counts)) {
    const was = base[f] ?? 0
    if (n > was) bad(f, 0, `${n} inline style properties, baseline is ${was} - use the tokens in src/ui/system.css (or run tokenlint --update if you have migrated this file)`)
    else if (n < was) moved += was - n
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const baseTotal = Object.values(base).reduce((a, b) => a + b, 0)
  console.log(`  inline styles: ${total} across ${Object.keys(counts).length} files (baseline ${baseTotal}${moved ? `, ${moved} migrated since` : ''})`)
}

console.log(fails ? `TOKEN LINT FAILED (${fails})` : `TOKEN LINT PASSED (${files.length} files, colour only in tokens.css)`)
if (fails) process.exit(1)
