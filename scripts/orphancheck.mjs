// EVERY HARNESS IS IN A LIST (1.9.1).
//
// A harness that is in no suite list never runs. 1.9.0 found twenty with a
// verdict sitting outside every list, three of them gone stale against the
// game; 1.9.1 found 47 more under scripts/qa and scripts/qa2 that nothing ran
// at all. This fails on any scripts/**/*.ts or *.mjs that suite.sh does not
// reach and that is not named below as a tool or a library.
//
// What counts as reached, read from scripts/suite.sh itself so the two cannot
// drift:
//   - a top-level scripts/*.ts: the engine loop globs them all
//   - a name in REPORTERS, LONG, SLOW, SMOKE or BROWSER
//   - a path suite.sh runs by name (the linters: cssaudit, this file)
//
// A NEW FILE goes in one of those lists in the commit that adds it. If it has
// no verdict (a screenshot run, a build step, a measurement for a person to
// read), it goes in TOOLS here, with a word on why.
//
// Run: node scripts/orphancheck.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SCRIPTS = join(ROOT, 'scripts')

// no verdict to give: screenshots, art, build steps, comparisons between builds
const TOOLS = new Set([
  'scripts/storeart.mjs',      // the store screenshots, feature graphic and icon
  'scripts/ipadshots.mjs',     // the iPad store screenshots
  'scripts/uiqa.mjs',          // photographs every screen for a person; measurements print, never fail
  'scripts/uiqa-peek.mjs',     // one screen of the above, for a quick look
  'scripts/onefile.mjs',       // folds dist-single into one HTML file (a build step)
  'scripts/titlebg.mjs',       // cuts the title background from the key art
  'scripts/browserperf.mjs',   // two builds side by side, for a release note
  'scripts/tools/voicepatch.mjs', // a one-off text rewriter run by hand
  'scripts/tools/probemod.mjs',   // the codemod that moved probes onto lib/probe (1.9.2)
])
// imported or spawned by harnesses, never run on their own
const LIBRARIES = new Set([
  'scripts/worldcheck.ts',
  'scripts/lib/preview.mjs',
  'scripts/lib/probe.ts',
  'scripts/lib/probe.mjs',
  'scripts/lib/bondstwin.ts',
  'scripts/lib/savegen.ts',
  'scripts/lib/frspace.mjs',
  'scripts/lib/inkscan.mjs',
  'scripts/lib/newsdump.mjs',
])

const suite = readFileSync(join(SCRIPTS, 'suite.sh'), 'utf8')
const listed = new Set()
for (const v of ['REPORTERS', 'LONG', 'SLOW', 'SMOKE', 'BROWSER']) {
  const m = suite.match(new RegExp(`^${v}="([^"]*)"`, 'm'))
  if (!m) { console.log(`FAIL  suite.sh has no ${v} list (has the file changed shape?)`); process.exit(1) }
  for (const n of m[1].split(/\s+/).filter(Boolean)) listed.add(n)
}
const named = new Set([...suite.matchAll(/scripts\/([\w.-]+\.(?:ts|mjs))/g)].map(m => `scripts/${m[1]}`))

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|mjs)$/.test(e)) out.push(relative(ROOT, p))
  }
  return out
}

const files = walk(SCRIPTS).sort()
const orphans = []
const stale = [...TOOLS, ...LIBRARIES].filter(f => !files.includes(f))
for (const f of files) {
  if (TOOLS.has(f) || LIBRARIES.has(f) || named.has(f)) continue
  const top = /^scripts\/[^/]+$/.test(f)
  const name = f.replace(/^scripts\//, '').replace(/\.(ts|mjs)$/, '')
  if (top && f.endsWith('.ts')) continue            // the engine loop's glob
  if (top && listed.has(name)) continue
  orphans.push(f)
}
// a name in a list with no file behind it is skipped silently by suite.sh
const missing = [...listed].filter(n => !files.includes(`scripts/${n}.ts`) && !files.includes(`scripts/${n}.mjs`))

for (const f of orphans) console.log(`FAIL  ${f} is in no suite list and is not a tool: add it to suite.sh, or to TOOLS here`)
for (const f of stale) console.log(`FAIL  ${f} is listed here but does not exist`)
for (const n of missing) console.log(`FAIL  suite.sh lists ${n} but there is no scripts/${n}.ts or .mjs`)
const bad = orphans.length + stale.length + missing.length
console.log(bad
  ? `\nORPHAN CHECK FAILED (${bad})`
  : `\nORPHAN CHECK PASSED: ${files.length} files, every one in a suite list, a tool or a library`)
process.exit(bad ? 1 : 0)
