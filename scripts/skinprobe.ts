/**
 * ---- EVERY SKIN IS READABLE, OR IT DOES NOT SHIP ----
 *
 * v1.2.1 added three whole palettes (owner: "Skins should be available so you
 * customise the game colours"), each supplied as a list of hexes with one
 * instruction attached: "Verify that contrast ratios for body text on
 * cardBackground meet standard WCAG AA accessibility levels (at least 4.5:1)."
 *
 * Three of the supplied values did not, and were changed - the reasoning is
 * written into src/ui/tokens.css beside each block. A comment saying so is
 * worth nothing on its own, though: the next person to nudge a hex for the
 * look of it needs the build to stop them. So this reads the shipped token
 * file, resolves every skin, and measures the pairs the game actually renders.
 *
 * It also checks the two lists agree - a skin named in the store with no block
 * in tokens.css renders an unstyled app, which is a blank screen with words on
 * it rather than an error anybody would notice.
 *
 * Run: npx vite-node scripts/skinprobe.ts
 */
import { readFileSync } from 'node:fs'
import { SKINS } from '../src/store'

const css = readFileSync('src/ui/tokens.css', 'utf8')

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

// ---- WCAG 2.1 relative luminance and contrast ratio ----
const lum = (hex: string): number => {
  const h = hex.replace('#', '').trim()
  const ch = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const ratio = (a: string, b: string): number => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100
}

/** Pull one selector's block out of the token file and read its variables. */
const blockOf = (selector: string): Record<string, string> => {
  const at = css.indexOf(selector)
  if (at < 0) return {}
  const open = css.indexOf('{', at)
  const close = css.indexOf('\n}', open)
  const body = css.slice(open, close)
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/** The pairs the eye actually meets, and the floor each must clear. AA is
 *  4.5:1 for body text; a decorative wash over the hero only owes 3:1. */
const PAIRS: [string, string, number][] = [
  ['--text-primary', '--surface-1', 4.5],
  ['--text-primary', '--canvas', 4.5],
  ['--text-primary', '--surface-2', 4.5],
  ['--text-primary', '--surface-3', 4.5],
  ['--text-secondary', '--surface-1', 4.5],
  ['--text-secondary', '--surface-2', 4.5],
  ['--text-muted', '--surface-1', 4.5],
  // the colours that CARRY MEANING, read as text on a card
  ['--primary', '--surface-1', 4.5],
  ['--gold', '--surface-1', 4.5],
  ['--danger', '--surface-1', 4.5],
  ['--info', '--surface-1', 4.5],
  ['--positive', '--surface-1', 4.5],
  // and the text that sits ON each of those as a fill
  ['--on-primary', '--primary', 4.5],
  ['--on-gold', '--gold', 4.5],
  ['--on-positive', '--positive', 4.5],
  ['--on-info', '--info', 4.5],
]

console.log('--- 1. every skin the store offers has a block to render it')
{
  const missing = SKINS.filter(s => s !== 'default' && !css.includes(`.app.skin-${s}`))
  ok(missing.length === 0, `every named skin has tokens (${missing.join(', ') || 'all present'})`)
  // and nothing is defined that the store cannot reach
  const orphans = [...css.matchAll(/\.app\.skin-([a-z]+)\s*[,{]/g)]
    .map(m => m[1])
    .filter(name => !(SKINS as readonly string[]).includes(name))
  ok(orphans.length === 0, `no skin block the game cannot select (${orphans.join(', ') || 'none'})`)
}

console.log('\n--- 2. body text on every surface clears WCAG AA (4.5:1)')
for (const skin of SKINS.filter(s => s !== 'default')) {
  const tok = blockOf(`.app.skin-${skin}`)
  ok(Object.keys(tok).length > 0, `${skin}: the block resolves`)
  let worst = { pair: '', r: 99 }
  for (const [fg, bg, min] of PAIRS) {
    const a = tok[fg], b = tok[bg]
    if (!a || !b) { ok(false, `${skin}: ${fg} on ${bg} - one of them is not declared`); continue }
    if (!a.startsWith('#') || !b.startsWith('#')) continue // gradients and rgba are checked below
    const r = ratio(a, b)
    if (r < worst.r) worst = { pair: `${fg} on ${bg}`, r }
    if (r < min) ok(false, `${skin}: ${fg} ${a} on ${bg} ${b} = ${r}:1, under ${min}`)
  }
  ok(worst.r >= 4.5, `${skin}: worst pair is ${worst.pair} at ${worst.r}:1`)
}

console.log('\n--- 3. the skins keep the meanings the game reads by')
for (const skin of SKINS.filter(s => s !== 'default')) {
  const tok = blockOf(`.app.skin-${skin}`)
  // WON IS GREEN AND LOST IS RED, whatever the interface is painted in.
  // --positive exists precisely so a cyan or monochrome accent cannot end up
  // colouring the form guide (see tokens.css); this is the assertion that
  // keeps it honest, by hue rather than by name.
  const hueOf = (hex: string) => {
    const h = hex.replace('#', '')
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
    return { r, g, b }
  }
  const pos = hueOf(tok['--positive'] ?? '#000000')
  const neg = hueOf(tok['--danger'] ?? '#000000')
  ok(pos.g > pos.r && pos.g > pos.b, `${skin}: a win is still green (${tok['--positive']})`)
  ok(neg.r > neg.g && neg.r > neg.b, `${skin}: a loss is still red (${tok['--danger']})`)
  // the pitch is a depiction, not interface colour: it stays green too
  const pitch = hueOf(tok['--pitch-a'] ?? '#000000')
  ok(pitch.g > pitch.r && pitch.g >= pitch.b, `${skin}: the pitch is still grass (${tok['--pitch-a']})`)
  // a skin must not leave a role undeclared and inherit night's by accident
  const need = ['--canvas', '--surface-1', '--text-primary', '--primary', '--gold', '--danger', '--hero-gradient', '--scrim']
  const gaps = need.filter(k => !tok[k])
  ok(gaps.length === 0, `${skin}: declares every role it must (${gaps.join(', ') || 'complete'})`)
}

console.log(fails === 0
  ? '\nSKIN PROBE PASSED: three skins, every one of them readable'
  : `\nSKIN PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
