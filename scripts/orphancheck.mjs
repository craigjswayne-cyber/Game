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
  'scripts/lib/storefiles.ts',     // the store's source files, for probes that read it (1.9.1)
  'scripts/lib/bondstwin.ts',
  'scripts/lib/savegen.ts',
  'scripts/lib/frspace.mjs',
  'scripts/lib/inkscan.mjs',
  'scripts/lib/newsdump.mjs',
])

const suite = readFileSync(join(SCRIPTS, 'suite.sh'), 'utf8')
const listed = new Set()
for (const v of ['REPORTERS', 'LONG', 'SLOW', 'SMOKE', 'PRBROWSER', 'BROWSER']) {
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
// THE AREAS (1.9.2): suite.sh's AREA_<name> lists are what `suite.sh area`
// runs, and docs/testing.md's area table names the same probes. Each name
// must have a file (NAME.test is tests/NAME.test.ts), must not be a reporter
// (a reporter has no verdict, so it covers nothing), and the table row for
// the area must name exactly the list. Before this the table listed
// summertest and disttest, reporters, as coverage.
const reporters = new Set((suite.match(/^REPORTERS="([^"]*)"/m)?.[1] ?? '').split(/\s+/).filter(Boolean))
const areaNames = (suite.match(/^AREAS="([^"]*)"/m)?.[1] ?? '').split(/\s+/).filter(Boolean)
const areaFaults = []
if (!areaNames.length) areaFaults.push('suite.sh has no AREAS list')
const doc = readFileSync(join(ROOT, 'docs/testing.md'), 'utf8')
const docRows = new Map()
for (const m of doc.matchAll(/^\| \*\*[^*]+\*\* \(`(\w+)`\) \|(.*)\|\s*$/gm)) {
  docRows.set(m[1], new Set([...m[2].matchAll(/`([a-z0-9-]+(?:\.test)?)`/g)].map(x => x[1])))
}
for (const a of areaNames) {
  const m = suite.match(new RegExp(`^AREA_${a}="([^"]*)"`, 'm'))
  if (!m) { areaFaults.push(`suite.sh lists area ${a} but has no AREA_${a}`); continue }
  const list = new Set(m[1].split(/\s+/).filter(Boolean))
  for (const n of list) {
    const file = n.endsWith('.test') ? `tests/${n}.ts` : null
    if (file ? !statSync(join(ROOT, file), { throwIfNoEntry: false }) : !files.includes(`scripts/${n}.ts`) && !files.includes(`scripts/${n}.mjs`)) {
      areaFaults.push(`area ${a} lists ${n}, and there is no ${file ?? `scripts/${n}.ts or .mjs`}`)
    }
    if (reporters.has(n)) areaFaults.push(`area ${a} lists ${n}, a reporter with no verdict: it covers nothing`)
  }
  const row = docRows.get(a)
  if (!row) { areaFaults.push(`docs/testing.md has no area row for \`${a}\``); continue }
  for (const n of list) if (!row.has(n)) areaFaults.push(`docs/testing.md's ${a} row does not name ${n}, which suite.sh area ${a} runs`)
  for (const n of row) if (!list.has(n)) areaFaults.push(`docs/testing.md's ${a} row names ${n}, which is not in AREA_${a}`)
}
for (const a of docRows.keys()) if (!areaNames.includes(a)) areaFaults.push(`docs/testing.md has a row for ${a}, which is not in AREAS`)
for (const f of areaFaults) console.log(`FAIL  ${f}`)

const bad = orphans.length + stale.length + missing.length + areaFaults.length
console.log(bad
  ? `\nORPHAN CHECK FAILED (${bad})`
  : `\nORPHAN CHECK PASSED: ${files.length} files, every one in a suite list, a tool or a library; ${areaNames.length} areas agree with docs/testing.md`)
process.exit(bad ? 1 : 0)
