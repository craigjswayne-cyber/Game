// Probe: nothing that returns a KEY is printed to a screen as a key.
//
// A player photographed his own Home screen and it read:
//
//     ○ objectives.youth   ◉ objectives.books (en bonne voie)
//
// ObjectiveDef carries an i18n key, and its own comment says so - "An i18n KEY,
// not the words. Screens run it through t()". Home.tsx did not. Finances.tsx,
// two screens away, did. The field was called `text`, which is what invited it,
// and it is called `textKey` now; this is the check that keeps it honest.
//
// The rule: a JSX expression that calls one of the key-returning accessors must
// have t(), tIn(), or a *_k variable around it. Nothing here understands
// TypeScript - it reads the JSX expression containers and looks at what is in
// them, which is enough for the shape of mistake this catches.
//
// Run: npx vite-node scripts/keyprobe.ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** ONLY EVER DECREASE. */
const BUDGET = 0

const say = (s: string) => console.log(s)
let fails = 0
const ok = (c: boolean, what: string) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

/** Accessors that hand back a key rather than words. Add to this list whenever
 *  a new one appears - the name should end in Key, and then it is obvious. */
const KEY_ACCESSORS = [/\.textKey\s*\(/, /\bposNounKey\s*\(/, /\bacadLeagueKey\s*\(/]

const files: string[] = []
const walk = (dir: string) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) files.push(p)
  }
}
walk('src/ui')

say('--- a key-returning accessor is never rendered raw')
const raw: string[] = []
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  src.split('\n').forEach((line, i) => {
    const code = line.split('//')[0]
    if (!KEY_ACCESSORS.some(rx => rx.test(code))) return
    // every JSX expression container on the line that holds the accessor
    for (const m of code.matchAll(/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
      const inner = m[1]
      if (!KEY_ACCESSORS.some(rx => rx.test(inner))) continue
      if (/\bt\s*\(|\btIn\s*\(/.test(inner)) continue
      raw.push(`${f}:${i + 1}  ${inner.trim().slice(0, 80)}`)
    }
  })
}
say(`  ${raw.length} raw render(s) of a key (budget ${BUDGET})`)
for (const r of raw.slice(0, 10)) say(`  ${r}`)
ok(raw.length <= BUDGET, `no screen prints a key where the words should be`)
if (raw.length < BUDGET) ok(false, `THE BUDGET IS STALE: ${raw.length} left but it says ${BUDGET}. Lower it`)

// ---- and every key those accessors can return actually exists -------------
say('\n--- and every objective key resolves in both languages')
const EN = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
const FR = JSON.parse(readFileSync('src/locales/fr.json', 'utf8'))
const objs = readFileSync('src/game/objectives.ts', 'utf8')
const keys = [...objs.matchAll(/textKey:[^\n]*'([\w.]+)'/g)].map(m => m[1])
const look = (d: Record<string, unknown>, k: string) =>
  k.split('.').reduce<unknown>((o, part) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[part] : undefined), d)
const missing = keys.filter(k => typeof look(EN, k) !== 'string' || typeof look(FR, k) !== 'string')
for (const m of missing) say(`  ${m}`)
ok(missing.length === 0, `${keys.length} objective keys, all of them in both languages`)

say(fails ? `\nKEY PROBE FAILED (${fails})` : '\nKEY PROBE PASSED: a key never reaches a screen as a key')
process.exitCode = fails ? 1 : 0
