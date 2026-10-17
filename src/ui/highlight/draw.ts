// The canvas's colours and the pitch drawn under the players.

import { kitGap } from '../kit'

export const PAD = 7          // in-goal metres drawn each end
export const FIELD_W = 100 + PAD * 2

/**
 * WHAT THE REFEREE WEARS (owner, 1.8.0): pink, orange when either side wears
 * pink, cyan when the kits use pink and orange, and never a colour either
 * side is wearing. A kit "wears" a colour when either of its two
 * colours is within REF_NEAR of it by kitGap (the summed channel distance the
 * away-kit rule uses), so a cerise or a coral counts as pink and a tangerine
 * or a deep gold as orange. If even cyan is near a kit (a side in all three),
 * he takes whichever of the three is furthest from every kit colour.
 */
const REF_NEAR = 150
export function refereeColour(kits: string[], [pink, orange, cyan]: [string, string, string]): string {
  const near = (c: string) => kits.some(k => kitGap(c, k) < REF_NEAR)
  const pick = !near(pink) ? pink : !near(orange) ? orange : cyan
  if (!near(pick)) return pick
  return [pink, orange, cyan].map(c => ({ c, gap: Math.min(...kits.map(k => kitGap(c, k))) }))
    .sort((a, b) => b.gap - a.gap)[0].c
}

/** is this a light colour, so the writing on it wants to be dark? */
export function isLight(bg: string): boolean {
  const h = bg.replace('#', '')
  if (h.length < 6) return false
  return (parseInt(h.slice(0, 2), 16) * 299 + parseInt(h.slice(2, 4), 16) * 587 + parseInt(h.slice(4, 6), 16) * 114) / 1000 > 150
}

/** A colour token's value, for the canvas (which cannot read var()). */
export function tokenColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** the canvas's colours, all from tokens.css */
export function readInk() {
  return {
    surround: tokenColor('--hl-surround'), grassA: tokenColor('--hl-grass-a'), grassB: tokenColor('--hl-grass-b'),
    ball: tokenColor('--hl-ball'), ballEdge: tokenColor('--hl-ball-edge'),
    white: tokenColor('--prop-ink'), dark: tokenColor('--prop-ink-dark'),
    refPink: tokenColor('--hl-ref-pink'), refOrange: tokenColor('--hl-ref-orange'), refCyan: tokenColor('--hl-ref-cyan'),
  }
}

/** A rugby pitch, side on: stripes, try lines, 22s, halfway, the dashed 10s,
 *  5s and 15s, and the posts. */
export function drawField(g: CanvasRenderingContext2D, w: number, h: number, ink: ReturnType<typeof readInk>) {
  const X = (x: number) => (x + PAD) / FIELD_W * w
  const Y = (y: number) => y / 70 * h
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? ink.grassB : ink.grassA
    g.fillRect(X(-PAD + i * (FIELD_W / 12)), 0, w / 12 + 1, h)
  }
  // the in-goals a shade darker
  g.fillStyle = 'rgba(0,0,0,.12)'
  g.fillRect(0, 0, X(0), h); g.fillRect(X(100), 0, w - X(100), h)
  g.strokeStyle = 'rgba(255,255,255,.82)'; g.lineWidth = 1.4
  const line = (x: number, dash: number[] = []) => { g.setLineDash(dash); g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), h); g.stroke() }
  line(0); line(100); line(22); line(78); line(50)
  line(40, [5, 5]); line(60, [5, 5]); line(5, [3, 5]); line(95, [3, 5])
  g.setLineDash([4, 6])
  for (const y of [5, 15, 55, 65]) { g.beginPath(); g.moveTo(X(0), Y(y)); g.lineTo(X(100), Y(y)); g.stroke() }
  g.setLineDash([])
  g.strokeRect(0.7, 0.7, w - 1.4, h - 1.4)
  // the posts: a crossbar on the try line and the two uprights, seen from
  // above. Real uprights are 5.6m apart; the bar is drawn 8m long, centred on
  // the 35m line (owner: a little longer, so it reads at a glance), and each
  // upright with its pad is about 0.6m across. The bar sits on the try line,
  // so a floor of 2px (a metre is about 3.5px on a phone) keeps it from
  // vanishing into the line under it.
  const m = Math.abs(Y(1) - Y(0))
  for (const x of [0, 100]) {
    g.lineWidth = Math.max(2, 0.3 * m); g.strokeStyle = ink.white
    g.beginPath(); g.moveTo(X(x), Y(31)); g.lineTo(X(x), Y(39)); g.stroke()
    for (const y of [31, 39]) { g.beginPath(); g.arc(X(x), Y(y), Math.max(2, 0.3 * m), 0, Math.PI * 2); g.fillStyle = ink.white; g.fill() }
  }
}
