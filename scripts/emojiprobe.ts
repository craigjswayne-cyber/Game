// Probe: no emoji anywhere a player can see.
//
// The owner, 27 Sep 2026: "across the game can we use icons instead of
// emojis. Feels like it cheapens the game." The menus, the news, the facility
// cards and the badges all draw stroke icons now (src/ui/glyphs.tsx). An emoji
// creeps back in silently: someone writes `subject: '🏆 Champions'` in a news
// template or pastes a warning sign into a locale string, the build is green,
// and a coloured blob sits in the middle of a dark typographic screen on every
// phone. So this reads every string the game can render and fails on one.
//
// What counts: pictographic emoji (U+1F000 and up) and the U+2600-U+27BF
// symbols that phones draw as colour emoji (warning sign, star, lightning,
// scales, sun, moon...). What does not:
//   - national flags (regional-indicator pairs, and the black flag with tag
//     characters that England, Scotland and Wales use): they are flags, not
//     decoration, and the Nat component shows them next to a nation's name;
//   - the typographic marks the UI uses as type: ★ ☆ in the Stars rating,
//     ✓ ticks, ✕ ✗ crosses (plus ▲ ▼ ● ○ · ½ →, which sit outside the range);
//   - comments: only string literals, template text and JSX text are read, so
//     a comment may quote the owner's emoji.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const ROOT = join(__dirname, '..')

// ---- TEMPORARY EXCEPTIONS ----
// These files and locale namespaces belong to tasks running in parallel with
// the icon pass (27 Sep 2026); each of those tasks strips its own emoji. The
// lead EMPTIES BOTH LISTS after merging them, and from then on this probe
// covers the whole game with no exceptions.
const TEMP_FILES = new Set([
  // the match engine and highlights, and finances: still being merged
  'src/game/matchEngine.ts', 'src/ui/HighlightClip.tsx', 'src/game/commercial.ts',
  'src/ui/screens/Finances.tsx',
])
const TEMP_NAMESPACES = new Set(['comm', 'hl', 'finances', 'till'])
// ---- END TEMPORARY EXCEPTIONS ----

// Not temporary: the nations table's flag fields. A flag is a flag, and two
// entries have no national flag to show - the touring Lions (a red disc) and
// flagOf's fallback for a code it does not know - so in nations.ts a string
// that is one pictograph and nothing else is read as a flag field. Anything
// longer in that file is still checked.
const FLAG_FILE = 'src/game/nations.ts'
const isLoneGlyph = (s: string) => [...s.replace(/\u{FE0F}/gu, '')].length === 1

/** typographic marks inside U+2600-U+27BF that render as text, not emoji */
const TYPOGRAPHIC = new Set(['★', '☆', '✓', '✕', '✗'])
const FLAGS = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0020}-\u{E007F}]+/gu
// plus the handful outside that block that phones also draw in colour (star,
// hourglass, watch, the big circle and squares, the play/fast-forward family),
// and anything at all followed by U+FE0F, the 'draw me as emoji' selector
const PICTO = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{2B1B}\u{2B1C}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{2934}\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]|.\u{FE0F}|\u{20E3}/gu

/** the emoji in a string, flags and typographic marks aside */
function emojiIn(s: string): string[] {
  const out: string[] = []
  for (const m of s.replace(FLAGS, '').matchAll(PICTO)) if (!TYPOGRAPHIC.has(m[0])) out.push(m[0])
  return out
}

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(f)) out.push(p)
  }
  return out
}

// ---- source: every string literal, template chunk and JSX text ----
const offenders: string[] = []
let files = 0
for (const path of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, path).replace(/\\/g, '/')
  if (TEMP_FILES.has(rel)) continue
  files++
  const src = readFileSync(path, 'utf8')
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      const hit = emojiIn(n.text)
      if (hit.length && !(rel === FLAG_FILE && isLoneGlyph(n.text))) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
        offenders.push(`${rel}:${line}  ${hit.join(' ')}  ${JSON.stringify(n.text.trim().slice(0, 70))}`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}
for (const o of offenders) console.log(`        ${o}`)
ok(offenders.length === 0, `no emoji in the strings of ${files} source files (${offenders.length} found)`)

// ---- locales: every value in every language ----
const locDir = join(ROOT, 'src/locales')
for (const f of readdirSync(locDir).filter(f => f.endsWith('.json'))) {
  const dict = JSON.parse(readFileSync(join(locDir, f), 'utf8')) as Record<string, unknown>
  const bad: string[] = []
  const leaves = (v: unknown, path: string) => {
    if (typeof v === 'string') { const hit = emojiIn(v); if (hit.length) bad.push(`${path}  ${hit.join(' ')}  ${JSON.stringify(v.slice(0, 70))}`) }
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k)
  }
  for (const [ns, v] of Object.entries(dict)) {
    if (ns === '_meta' || TEMP_NAMESPACES.has(ns)) continue
    leaves(v, ns)
  }
  for (const b of bad) console.log(`        ${f}: ${b}`)
  ok(bad.length === 0, `no emoji in ${f} (${bad.length} found)`)
}

// ---- the checker itself: a flag passes, an emoji does not ----
ok(emojiIn('🇫🇷 France 🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} England ★★☆ ✓').length === 0, 'flags and typographic marks are not flagged')
ok(emojiIn('\u26A0\uFE0F Warning').length >= 1 && emojiIn('\u{1F3C6} Champions').length === 1 && emojiIn('\u26A1').length === 1 && emojiIn('\u2B50').length === 1 && emojiIn('\u25B6\uFE0F').length === 1,
  'a warning sign, a trophy, a lightning bolt, a star emoji and an emoji play button are')

console.log(fails ? `EMOJI PROBE FAILED (${fails})` : 'EMOJI PROBE PASSED: icons, not emoji, everywhere a player looks')
process.exit(fails ? 1 : 0)
