/**
 * ---- PASS 9: THE THING NOBODY HAD LOOKED AT ----
 *
 * The release audit's last pass asks two questions: what would a hostile
 * reviewer open first, and what part of this game has never been looked at by
 * anyone. For this game they have the same answer.
 *
 * The whole palette brief is "green means positive, red means loss". Red-green
 * colour deficiency affects about one man in twelve, and nobody had ever
 * checked what this interface looks like to them.
 *
 * The answer is mostly reassuring, which is what makes the exception worth
 * finding. Every other state indicator in the UI already carries a second
 * channel and does not depend on hue at all:
 *
 *   MoraleArrow  ▲ ► ▼        - the glyph is the state
 *   FormPill     "7.4"        - the number is the state
 *   CA delta     ▲ / ▼        - the glyph again
 *   Table W/L/D  "W 24-17"    - the letter
 *
 * FitRing did not. It is an eleven-pixel ring on the squad list - the screen a
 * manager looks at more than any other - and its three states (fit, carrying
 * something, unfit) were distinguished by nothing whatsoever except hue, with a
 * `title` tooltip that a phone cannot show. To a deuteranope the fit man and
 * the injured man were the same dot.
 *
 * This probe is the evidence rather than the opinion. It simulates the three
 * common dichromacies on the actual token colours and measures whether the
 * states survive, so the finding is a number and not a worry.
 *
 * Run: npx vite-node scripts/colourblind.ts
 */
import { readFileSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const css = readFileSync('src/ui/tokens.css', 'utf8')
/** Resolve a token to its hex, following one level of var() indirection. */
function tok(name: string): string {
  const direct = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (direct) return direct[1]
  const alias = css.match(new RegExp(`--${name}:\\s*var\\(--([a-z0-9-]+)\\)`))
  if (alias) return tok(alias[1])
  throw new Error(`token --${name} not found`)
}

const rgb = (hex: string): [number, number, number] =>
  [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

// sRGB <-> linear
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const unlin = (c: number) => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(v * 255)))
}

/** Viénot-Brettel-Mollon dichromacy simulation, in linear RGB. */
const MATS: Record<string, number[][]> = {
  deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  protanopia: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  tritanopia: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
}
function simulate(hex: string, kind: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(lin)
  const m = MATS[kind]
  return [
    unlin(m[0][0] * r + m[0][1] * g + m[0][2] * b),
    unlin(m[1][0] * r + m[1][1] * g + m[1][2] * b),
    unlin(m[2][0] * r + m[2][1] * g + m[2][2] * b),
  ]
}

/** Perceptual-ish distance. Crude but monotone, and enough to say "these two
 *  dots are now the same dot". */
function dist(a: [number, number, number], b: [number, number, number]): number {
  const rm = (a[0] + b[0]) / 2
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

// The three states of the squad list's fitness ring.
const STATES: [string, string][] = [
  ['fit', tok('text-positive')],
  ['carrying something', tok('gold')],
  ['unfit', tok('danger')],
]
console.log(`fitness ring states: ${STATES.map(([n, h]) => `${n} ${h}`).join(', ')}\n`)

// ---- the finding, measured ----
const SAME = 90 // below this, two dots read as the same dot at 11px
let worst = Infinity
let worstWhat = ''
for (const kind of Object.keys(MATS)) {
  for (let i = 0; i < STATES.length; i++) {
    for (let j = i + 1; j < STATES.length; j++) {
      const d = dist(simulate(STATES[i][1], kind), simulate(STATES[j][1], kind))
      console.log(`  ${kind.padEnd(13)} ${STATES[i][0]} vs ${STATES[j][0]}: ${d.toFixed(0)}`)
      if (d < worst) { worst = d; worstWhat = `${kind}, ${STATES[i][0]} vs ${STATES[j][0]}` }
    }
  }
}
console.log(`\nclosest pair anywhere: ${worst.toFixed(0)} (${worstWhat})\n`)

// This is the honest shape of the finding: the colours DO collapse, and that is
// fine, because colour is no longer the only channel. What must hold is that
// the component carries something else - so this asserts the fix, not the hue.
{
  const squad = readFileSync('src/ui/screens/Squad.tsx', 'utf8')
  const ring = squad.slice(squad.indexOf('function FitRing'), squad.indexOf('function MoraleArrow'))
  ok(/aria-label=/.test(ring),
    'the fitness ring names its state for a screen reader')
  ok(/conic-gradient|linear-gradient|data-fit/.test(ring),
    'and shows it with fill as well as hue, so it survives colour blindness')
  ok(worst < SAME,
    `(evidence) the three hues really do collapse under dichromacy - closest pair ${worst.toFixed(0)}, which is why the above matters`)
}

console.log(fails ? `COLOUR BLIND PROBE FAILED (${fails})` : 'COLOUR BLIND PROBE PASSED: no state is carried by hue alone')
if (fails) process.exit(1)
