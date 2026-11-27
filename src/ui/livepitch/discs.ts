// THE MEN AS KIT, NOT DOTS (polish round, 27 Nov 2026: "the players are plain numbered discs and that is what still
// looks cheap"). No new art: each side's disc is drawn once into an offscreen sprite in its club's own pattern
// (hoops, stripes, quarters, halves, a sash, a yoke, flanks: src/game/kits.ts, worn as kitclash.ts allows), lit from
// the top left with a darker rim on the shadow side, and its numbers drawn once each with an outline that holds on
// any colour under them. A frame then lays images down: a soft shadow (two fainter ones under the floodlights), the
// body (squashed a little along the way he is running), the number upright, and a small notch on the rim the way he
// faces. The frame does no gradients, no text layout and no pattern paths.
import type { Pattern } from './kitclash'

export interface DiscKit { fill: string; trim: string; rim: string; pattern: Pattern; ink: string; edge: string }
export type Variant = 'plain' | 'has' | 'scorer'

/** the sprite is drawn this much bigger than the disc, so a man drawn larger (a jumper, the carrier) stays sharp */
export const OVER = 1.3

/** clip-and-fill the club's pattern into the unit circle (the context is already scaled to the disc's radius) */
function pattern(g: CanvasRenderingContext2D, p: Pattern, c: string) {
  g.fillStyle = c
  switch (p) {
    case 'hoops': g.fillRect(-1, -0.66, 2, 0.32); g.fillRect(-1, 0.02, 2, 0.32); g.fillRect(-1, 0.7, 2, 0.3); break
    case 'stripes': g.fillRect(-0.62, -1, 0.3, 2); g.fillRect(0.12, -1, 0.3, 2); break
    case 'quarters': g.fillRect(0, -1, 1, 1); g.fillRect(-1, 0, 1, 1); break
    case 'halves': g.fillRect(0, -1, 1, 2); break
    case 'sash': g.beginPath(); g.moveTo(-1, -0.55); g.lineTo(-0.45, -1); g.lineTo(1, 0.55); g.lineTo(0.45, 1); g.closePath(); g.fill(); break
    case 'yoke': g.fillRect(-1, -1, 2, 0.62); break
    case 'flank': g.fillRect(-1, -1, 0.42, 2); g.fillRect(0.58, -1, 0.42, 2); break
    default: break
  }
}

const mk = (w: number) => { const c = document.createElement('canvas'); c.width = w; c.height = w; return c }

/** THE BODY: pattern, light, rim (side colour, white for the man on the ball, gold for a try scorer), shadow-side
 *  rim. `rpx` is the disc's radius in device pixels at its largest; `rimPx` the rim's width there */
export function bodySprite(k: DiscKit, v: Variant, rpx: number, rimPx: number, rimOf: { white: string; gold: string }): HTMLCanvasElement {
  const pad = Math.ceil(rimPx + rpx * 0.12 + 3), w = Math.ceil(rpx * 2 + pad * 2), c = mk(w), g = c.getContext('2d')!
  g.translate(w / 2, w / 2)
  g.save(); g.scale(rpx, rpx)
  g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.clip()
  g.fillStyle = k.fill; g.fillRect(-1, -1, 2, 2)
  pattern(g, k.pattern, k.trim)
  // the light from above and to the left; the far side of him in shade
  const lt = g.createRadialGradient(-0.38, -0.48, 0.05, 0, 0, 1.08)
  lt.addColorStop(0, 'rgba(255,255,255,.34)'); lt.addColorStop(0.5, 'rgba(255,255,255,0)'); lt.addColorStop(1, 'rgba(0,0,0,.34)')
  g.fillStyle = lt; g.fillRect(-1, -1, 2, 2)
  g.restore()
  const rw = v === 'plain' ? rimPx : rimPx * 1.3
  g.lineWidth = rw; g.strokeStyle = v === 'has' ? rimOf.white : v === 'scorer' ? rimOf.gold : k.rim
  g.beginPath(); g.arc(0, 0, rpx, 0, Math.PI * 2); g.stroke()
  // a fine dark line outside the rim: the disc is cut clean against the grass at any kit colour
  g.lineWidth = Math.max(1, rpx * 0.06); g.strokeStyle = 'rgba(0,0,0,.42)'
  g.beginPath(); g.arc(0, 0, rpx + rw / 2 + g.lineWidth / 2, 0, Math.PI * 2); g.stroke()
  // a sheen on the lit edge (top left), as a shirt catches the light
  g.lineWidth = rw * 0.45; g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineCap = 'round'
  g.beginPath(); g.arc(0, 0, rpx - rw * 0.9, Math.PI * 1.08, Math.PI * 1.45); g.stroke()
  // the rim darker on the shadow side (bottom right), so the disc reads as round
  g.lineWidth = rw * 0.75; g.strokeStyle = 'rgba(0,0,0,.34)'; g.lineCap = 'round'
  g.beginPath(); g.arc(0, 0, rpx - rw * 0.12, Math.PI * 0.02, Math.PI * 0.78); g.stroke()
  return c
}

/** THE NUMBER, upright, in a weight that reads at phone size, with an outline that holds over any band of the pattern */
export function numberSprite(k: DiscKit, num: string, rpx: number): HTMLCanvasElement {
  const w = Math.ceil(rpx * 2.4), c = mk(w), g = c.getContext('2d')!
  const two = num.length > 1, fs = rpx * (two ? 1.2 : 1.36)
  g.translate(w / 2, w / 2 + fs * 0.04)
  if (two) g.scale(0.86, 1)
  g.font = `800 ${fs}px system-ui, -apple-system, 'Segoe UI', sans-serif`
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
  g.lineWidth = fs * 0.2; g.strokeStyle = k.edge; g.strokeText(num, 0, 0)
  g.fillStyle = k.ink; g.fillText(num, 0, 0)
  return c
}

/** a soft shadow on the grass, unit size: an ellipse with a blurred edge */
export function shadowSprite(rpx: number): HTMLCanvasElement {
  const w = Math.ceil(rpx * 3.4), c = mk(w), g = c.getContext('2d')!
  // (the shape is drawn off the canvas and only its blurred shadow falls on it: no filter needed)
  g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = rpx * 0.45; g.shadowOffsetX = w * 2
  g.beginPath(); g.ellipse(w / 2 - w * 2, w / 2, rpx * 1.05, rpx * 0.8, 0, 0, Math.PI * 2); g.fillStyle = '#000'; g.fill()
  return c
}

/** the WCAG contrast ratio between two #rrggbb colours (for the legibility measure) */
export function contrast(a: string, b: string): number {
  const L = (c: string) => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c)
    if (!m) return 0.5
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(parseInt(m[1], 16)) + 0.7152 * f(parseInt(m[2], 16)) + 0.0722 * f(parseInt(m[3], 16))
  }
  const x = L(a), y = L(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
