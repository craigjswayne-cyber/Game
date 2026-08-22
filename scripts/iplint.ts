/**
 * ---- NO REAL MARK SHIPS ----
 *
 * The v1.0.2 tripwire, and the reason the rename is trustworthy rather than
 * merely done.
 *
 * IT SCANS THE BUILT BUNDLE, NOT THE SOURCE, and that distinction is the whole
 * value. Comments are stripped at build, so a source scan reports false alarms
 * on every explanatory note that names the thing it replaced; and a source scan
 * would miss a string assembled at runtime. dist/ is what a player downloads,
 * so dist/ is what gets checked.
 *
 * WHAT IS DELIBERATELY ALLOWED: real player names. ~1,600 of them ship by the
 * owner's decision (see docs/ip-rename-plan.md). This lint has nothing to say
 * about that; it guards the competition, club and ground marks that v1.0.2
 * renamed, so none of them can quietly come back in six months when somebody
 * writes a news story and reaches for the name they know.
 *
 * Run: npm run build && npx vite-node scripts/iplint.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CLUBS, COMPS } from './rename-map'

let fails = 0
const hits: string[] = []

if (!existsSync('dist')) {
  console.error('IP LINT: no dist/ - run npm run build first')
  process.exit(1)
}

/** Everything a player actually downloads. */
const files: string[] = []
const walk = (dir: string) => {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, n.name)
    if (n.isDirectory()) walk(p)
    else if (/\.(js|css|html|webmanifest|json)$/.test(n.name)) files.push(p)
  }
}
walk('dist')

const bundle = files.map(f => readFileSync(f, 'utf8')).join('\n')
console.log(`scanning ${files.length} shipped files, ${(bundle.length / 1e6).toFixed(2)}MB`)

/** Marks that must never appear. Club and ground names come from the rename
 *  table itself, so the guard can never drift from the thing it guards. */
const BANNED: [string, string][] = []
for (const c of COMPS) {
  if (c.was !== c.now) BANNED.push([c.was, `competition ${c.id}`])
  if (c.wasShort !== c.nowShort && c.wasShort.length >= 6) BANNED.push([c.wasShort, `competition ${c.id} (short)`])
}
for (const c of CLUBS) {
  if (c.was !== c.now) BANNED.push([c.was, `club ${c.id}`])
  if (c.wasGround !== c.nowGround && c.wasGround.length >= 6) BANNED.push([c.wasGround, `ground ${c.id}`])
}
// sponsors and governing-body marks that were never club or comp names
for (const extra of ['Gallagher', 'Investec', 'Vodacom', 'Emirates Lions', 'Hollywoodbets',
  'Guinness Six', 'Heineken', 'Ajinomoto', 'Mattioli Woods', 'StoneX', 'Kingspan', 'DHL Stadium']) {
  BANNED.push([extra, 'sponsor or governing mark'])
}

// A GUARD MUST NOT BAN ITS OWN ANSWER. Several replacement names legitimately
// contain a banned short - "European Nations Championship" contains
// "Championship" - so a bare substring ban would fail forever and teach
// everybody to ignore this lint. Any term that appears inside a name we
// deliberately ship is skipped.
const replacements = [...COMPS.map(c => c.now), ...COMPS.map(c => c.nowShort),
  ...CLUBS.map(c => c.now), ...CLUBS.map(c => c.nowGround)]
const isOurs = (term: string) => replacements.some(r => r.includes(term))

const seen = new Set<string>()
const skipped: string[] = []
for (const [term, why] of BANNED) {
  if (seen.has(term)) continue
  seen.add(term)
  if (isOurs(term)) { skipped.push(term); continue }
  if (bundle.includes(term)) { hits.push(`${term}  (${why})`); fails++ }
}

if (skipped.length) console.log(`(${skipped.length} generic term(s) skipped: they appear inside names we ship - ${skipped.join(', ')})`)
if (hits.length) {
  console.log('\nREAL MARKS FOUND IN THE SHIPPED BUILD:')
  for (const h of hits.sort()) console.log(`  ${h}`)
}
console.log(fails
  ? `\nIP LINT FAILED: ${fails} real mark(s) still ship`
  : `IP LINT PASSED: none of ${seen.size} guarded marks appear in the build`)
if (fails) process.exit(1)
