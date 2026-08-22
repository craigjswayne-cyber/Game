// The token nobody defines.
//
// The draw room shipped its tie rows as `background: var(--card, #fff)`. There is
// no --card in this stylesheet, so the fallback was painted every time: a white
// card in both themes, while the team names inside it followed --ink and turned
// pale at night. The names were there. You could not read them.
//
// Nothing catches that. The CSS is valid, the build is clean, the day screenshot
// looks right, and the night screenshot only looks wrong if somebody happens to
// take one of that screen. The bug is not the colour - it is the typo in the
// token name, and a typo in a var() name fails silently by design.
//
// So this reads the stylesheet, collects every token it defines and every token
// it reads, and reports any name that is read but never defined. A handful are
// legitimately set from JSX at render time (club colours, a sticky offset, a
// gradient angle), so those are looked for in the components before being
// reported. Anything left over is a name that resolves to nothing on a real
// phone.
//
// Static, no browser, runs in a blink. There is no reason not to run it.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CSS = 'src/ui/theme.css'
// The palette lives in tokens.css since the two-accent system; the theme
// file only READS tokens now. Harvest definitions from both, or every
// semantic token reads as dead (44 false positives, caught the first time
// this audit ran after the split).
const css = readFileSync(CSS, 'utf8') + '\n' + readFileSync('src/ui/tokens.css', 'utf8')

// A definition is `--name:` anywhere, not only at the start of a line: the theme
// has one-liners like `:root { --pick: #9fc2e8; }`, and the first cut of this
// harness anchored to ^ and reported two perfectly good tokens as missing. Reads
// are stripped out first so `var(--x, ...)` is never mistaken for a definition.
const noReads = css.replace(/var\(--[a-z0-9-]+/g, 'var(')
const defined = new Set([...noReads.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]))
// every var() read, with the line it sits on so a finding can be pointed at
const reads = new Map()
const lines = css.split('\n')
lines.forEach((line, i) => {
  for (const m of line.matchAll(/var\((--[a-z0-9-]+)/g)) {
    if (!reads.has(m[1])) reads.set(m[1], i + 1)
  }
})

/** Every .tsx under src/ui, so a token set inline can be found. */
function tsxFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p))
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}
const jsx = tsxFiles('src/ui').map(f => readFileSync(f, 'utf8')).join('\n')

const missing = []
for (const [token, line] of reads) {
  if (defined.has(token)) continue
  // set from a style prop? that is how club colours and measured offsets arrive
  if (jsx.includes(`'${token}'`) || jsx.includes(`"${token}"`) || jsx.includes(`${token}:`)) continue
  missing.push({ token, line })
}

for (const { token, line } of missing) {
  console.log(`  FAIL ${CSS}:${line} reads ${token}, which nothing defines and no component sets`)
  console.log(`       ${lines[line - 1].trim().slice(0, 110)}`)
}

// ---- and the unit that lies on a phone ----
//
// A second silent failure, from the same family: valid CSS, clean build, and a
// bug you can only see on a real handset.
//
// On mobile Chrome `vh` measures the LARGE viewport - the height the page would
// have if the browser chrome were hidden. So a bottom-anchored sheet at 94vh is
// taller than what the manager can actually see, and its top sits underneath the
// URL bar where nothing can scroll to it. Reported live: "you cant scroll up on
// the team and its half way down the page."
//
// A BROWSER PROBE CANNOT CATCH THIS. Playwright's viewport has no chrome, so vh
// and dvh are identical there, and shrinking the viewport shrinks both together -
// subreach.mjs measured that sheet at 412x640, found it opened at its top with
// shirt 1 on screen, and passed, because in a chromeless window it genuinely did.
// The only place the discrepancy exists is a device with browser furniture, so the
// only honest guard is to require the dvh companion in the stylesheet itself.
//
// Transforms are exempt: a confetti animation travelling 106vh is not a box that
// can clip its own top.
const vhFails = []
let inComment = false
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  // Comment lines are prose, not rules. Skipped because the first run of this
  // check reported the comment that explains the rule as a violation of it.
  const opens = line.lastIndexOf('/*'), closes = line.lastIndexOf('*/')
  const wasInComment = inComment
  if (opens > closes) inComment = true
  else if (closes > opens) inComment = false
  if (wasInComment || /^\s*(\/\*|\*)/.test(line)) continue
  if (!/\b\d+(\.\d+)?vh\b/.test(line)) continue
  if (/dvh/.test(line)) continue
  if (/transform|translate|@keyframes|^\s*(0%|100%|from|to)\b/.test(line)) continue
  // the pattern is two declarations, vh then dvh, so look at the next line too
  if (/dvh/.test(lines[i + 1] ?? '')) continue
  vhFails.push({ line: i + 1, text: line.trim().slice(0, 100) })
}
for (const f of vhFails) {
  console.log(`  FAIL ${CSS}:${f.line} sizes a box in vh with no dvh companion`)
  console.log(`       ${f.text}`)
}
console.log(`${vhFails.length ? vhFails.length : 'no'} viewport-height rule(s) without a dvh fallback`)

const inline = [...reads.keys()].filter(t => !defined.has(t)).length - missing.length
console.log(`${reads.size} tokens read, ${defined.size} defined in the theme, ${inline} set from a component`)
const fails = missing.length + vhFails.length
console.log(fails
  ? `\nCSS AUDIT FOUND ${missing.length} DEAD TOKEN(S) AND ${vhFails.length} vh RULE(S) WITHOUT dvh`
  : '\nCSS AUDIT PASSED: every token resolves, and every sized box measures the viewport you can see')
process.exit(fails ? 1 : 0)
