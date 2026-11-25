// THE KIT EACH SIDE WEARS ON THE PITCH (round 9: "Leicester v Toulon are both red and cannot be told apart").
//
// Leicester's shirt is a dark green and Toulon's red. On the grass a dark green disc all but disappears, so
// what the eye picks out is its red rim: red against red. So the rule judges each kit by the colour it
// SHOWS on the grass (its fill when the fill stands off the grass, otherwise its trim), and the two fills
// themselves, by CIEDE2000 colour difference (a perceptual measure: equal numbers look equally far apart).
//
// The home side wears its own kit. The away side wears, in this order, the first that does not clash:
//   its own (first colour, second as trim); its second colour (first as trim); white, the panel ink, slate,
//   then gold (the --kit-spare-* tokens), each trimmed in its own first colour (or its second, when the first
//   is too near the neutral itself).
// The thresholds were set on every ordered pair of the game's 113 clubs (scripts/tmp/kitpairs.ts): at 25,
// navy against black (Bath v Exeter, 25.6) passed and should not; at 30 it changes. Judged this way, 1,724 of
// the 12,656 pairings could not be told apart with the kits the screen used before; after, 37, all Ealing
// at home (a dark green shirt that reads as its white trim): the away side goes to gold, 29.8 against the
// white trim, a gold disc against a dark one ringed in white.
import { hex6 } from '../kit'

/** the grass the discs are drawn on: the day ground's mown stripes, sampled from the art (47,113,0 and
 *  72,138,13), held as a channel triple as kit.ts holds its inks */
const GRASS = [60, 124, 8]
/** a fill this close to the grass reads as its trim */
export const GRASS_DE = 22
/** two kits this close (as seen, or fill to fill) cannot be told apart at disc size */
export const CLASH_DE = 30

type Rgb = number[]
const rgbOf = (c: string): Rgb | null => {
  const h = hex6(c).replace('#', '')
  return /^[0-9a-f]{6}$/i.test(h) ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : null
}
const lab = ([r, g, b]: Rgb): [number, number, number] => {
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const R = lin(r), G = lin(g), B = lin(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
/** CIEDE2000 between two colours as channel triples */
function de2000(p: Rgb, q: Rgb): number {
  const [L1, a1, b1] = lab(p), [L2, a2, b2] = lab(q)
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G)
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const h = (b: number, a: number) => { const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v }
  const h1p = h(b1, a1p), h2p = h(b2, a2p)
  const dL = L2 - L1, dC = C2p - C1p
  let dh = h2p - h1p
  if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh / 2 * rad)
  const Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2
  let hb = h1p + h2p
  if (C1p * C2p !== 0) hb = Math.abs(h1p - h2p) > 180 ? (hb < 360 ? hb + 360 : hb - 360) / 2 : hb / 2
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad)
  const SL = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T
  const RT = -2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad)
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}
/** CIEDE2000 between two #rrggbb colours (anything unreadable is far from everything) */
export function colourGap(a: string, b: string): number {
  const p = rgbOf(a), q = rgbOf(b)
  return p && q ? de2000(p, q) : 100
}

export type Kit = [string, string]
/** the colour a kit shows on the grass: its fill, or its trim when the fill melts into the grass */
export function seenOnGrass(k: Kit): string {
  const p = rgbOf(k[0])
  return p && de2000(p, GRASS) < GRASS_DE ? k[1] : k[0]
}
/** a shirt dark enough (CIELAB lightness) that at disc size the eye reads its rim */
export const DARK_L = 35
const lightness = (c: string) => { const p = rgbOf(c); return p ? lab(p)[0] : 50 }
/** how far apart two kits look on the pitch: the nearest of fill to fill, seen to seen, and (two dark
 *  shirts, two dark blobs told apart by their rims: Leicester's green and Munster's navy, both ringed in
 *  red) rim to rim. (Not a light shirt that melts into the grass against a dark one: Pau's green, seen as
 *  white rings, is clear of Bath's navy discs, though both are trimmed in white) */
export function kitDistance(h: Kit, a: Kit): number {
  const d = Math.min(colourGap(h[0], a[0]), colourGap(seenOnGrass(h), seenOnGrass(a)))
  return lightness(h[0]) < DARK_L && lightness(a[0]) < DARK_L ? Math.min(d, colourGap(h[1], a[1])) : d
}
export const clashes = (h: Kit, a: Kit) => kitDistance(h, a) < CLASH_DE

export interface Neutrals { white: string; ink: string; slate: string; gold: string; home: string; away: string }
export type Worn = { home: Kit; away: Kit; change: 'own' | 'second' | 'neutral' | 'nearest' }

/** the kits the two sides wear (club colours: [first, second, ...]; none for a side without a club kit) */
export function wornKits(nt: Neutrals, home: string[] | undefined, away: string[] | undefined): Worn {
  const h: Kit = home?.length ? [home[0], home[1] ?? nt.white] : [nt.home, nt.white]
  const a = away?.length ? away : [nt.away, nt.white]
  const trimFor = (n: string) => (colourGap(a[0], n) >= CLASH_DE || !a[1] ? a[0] : a[1])
  const tries: [Kit, Worn['change']][] = [
    [[a[0], a[1] ?? nt.white], 'own'],
    ...(a[1] ? [[[a[1], a[0]], 'second'] as [Kit, Worn['change']]] : []),
    ...[nt.white, nt.ink, nt.slate, nt.gold].map(n => [[n, trimFor(n)], 'neutral'] as [Kit, Worn['change']]),
  ]
  for (const [k, why] of tries) if (!clashes(h, k)) return { home: h, away: k, change: why }
  // (nothing clears: the furthest of them)
  let best = tries[0][0], bd = -1
  for (const [k] of tries) { const d = kitDistance(h, k); if (d > bd) { bd = d; best = k } }
  return { home: h, away: best, change: 'nearest' }
}
