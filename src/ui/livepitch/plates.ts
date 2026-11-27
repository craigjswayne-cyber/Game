// WHERE A PLATE GOES (polish round, 27 Nov 2026). Owner, 19 Nov: "any pop up like a yellow card or try should be
// smaller, centralised and down the bottom of the pitch". Seen in v11: a TRY plate in the middle of the pitch over the
// 22 (it had jumped to the far side because the ball was low on the screen), and a penalty try's plate shown in two
// places in turn. Every plate on the pitch (a score, a card, a knock-on, a turnover, a phase count) now goes through
// placePlate: small, centred, at the foot of the panel (the near stand, below the touchline the men can stand on), one
// at a time, and never over the ball or a man within 3 m of it. It keeps the place it was given while that place is
// clear; only if play comes under it does it move along the foot, and only as a last resort to the top.

export type Pt = { x: number; y: number }
/** a plate's box on screen, left and top in CSS pixels */
export interface Box { x: number; y: number; w: number; h: number }
/** something the plate must not cover: a circle on screen */
export interface Disc { x: number; y: number; r: number }

/** the men that count as "the play": the ball and every man within this many metres of it */
export const PLAY_M = 3
/** the gap kept from the panel's edge and from a man (CSS pixels) */
const EDGE = 4, GAP = 2

/** the circles the plate must keep off: the ball (as drawn) and the men within PLAY_M of it (as drawn) */
export function playDiscs(ball: Pt & { r: number }, ballField: Pt, men: (Pt & { r: number; fx: number; fy: number })[]): Disc[] {
  const out: Disc[] = [{ x: ball.x, y: ball.y, r: ball.r }]
  for (const m of men) if (Math.hypot(m.fx - ballField.x, m.fy - ballField.y) <= PLAY_M) out.push({ x: m.x, y: m.y, r: m.r })
  return out
}

const hits = (b: Box, d: Disc[]) => d.some(c => {
  const nx = Math.max(b.x, Math.min(c.x, b.x + b.w)), ny = Math.max(b.y, Math.min(c.y, b.y + b.h))
  return Math.hypot(c.x - nx, c.y - ny) < c.r + GAP
})

/** the places a plate may take in a panel w x h, best first: the foot, centred; along the foot either side; the top */
export function plateSpots(w: number, h: number, pw: number, ph: number): Box[] {
  const y = h - EDGE - ph, lo = EDGE, hi = Math.max(EDGE, w - EDGE - pw), mid = (w - pw) / 2
  const xs = [mid, mid - w * 0.22, mid + w * 0.22, mid - w * 0.36, mid + w * 0.36, lo, hi].map(x => Math.max(lo, Math.min(hi, x)))
  const out: Box[] = xs.map(x => ({ x, y, w: pw, h: ph }))
  // (the top as a last resort, under the label that sits on the far stand's roof)
  out.push({ x: Math.max(lo, mid), y: 30, w: pw, h: ph })
  return out
}

/** THE ONE PLACEMENT. `prev`: where the plate already is (kept while it is clear). Returns where it goes now. */
export function placePlate(w: number, h: number, pw: number, ph: number, play: Disc[], prev?: Box | null, men?: Disc[]): Box {
  // (overseer, 27 Nov 03:10: a plate lay over two men away from the ball. A place clear of every man is taken first;
  // only when there is none, one clear of the play)
  const all = men ? play.concat(men) : play
  if (prev && prev.w === pw && prev.h === ph && !hits(prev, all)) return prev
  const spots = plateSpots(w, h, pw, ph)
  for (const s of spots) if (!hits(s, all)) return s
  if (prev && prev.w === pw && prev.h === ph && !hits(prev, play)) return prev
  for (const s of spots) if (!hits(s, play)) return s
  // (nowhere clear: the foot, centred, as the owner asked)
  return spots[0]
}

/** does a plate's box cover any of the play (for the tests) */
export const covers = (b: Box, play: Disc[]) => hits(b, play)

/** THE PHONE'S PITCH as the match screen draws it, for the tests: the painted ground in a 4:3 panel w wide (LivePitch
 *  size(): the picture cropped to 1248 x 936 from (100, 75); the left try line at x 280, the far touchline at y 318,
 *  8.87 and 7.17 picture pixels to the metre, as the painted grounds are measured in LivePitch GROUNDS) */
export function phoneView(w: number) {
  const h = w * 0.75, k = Math.min(w / 1248, h / 936), ox = (w - 1248 * k) / 2 - 100 * k, oy = (h - 936 * k) / 2 - 75 * k
  return { w, h, sc: 8.87 * k, sx: (x: number) => ox + (280 + x * 8.87) * k, sy: (y: number) => oy + (318 + y * 7.17) * k }
}
