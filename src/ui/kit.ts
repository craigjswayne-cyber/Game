// Kit colours on the match screen: which colour stands for each side.

/** #rgb as #rrggbb, anything else as it came. The build's CSS minifier
 *  writes #ffffff as #fff (Vite 8, 1.9.1), so a colour read back from a
 *  token can arrive short, and every measure here reads six digits. */
export function hex6(c: string): string {
  const m = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c.trim())
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : c
}

/** perceived brightness of a #rrggbb colour, 0-255 (a CSS variable reads as
 *  mid-grey: it is one of ours, and ours are never near-black) */
export function luma(c: string): number {
  const hex = hex6(c).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 128
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

/** how far apart two #rrggbb colours look, 0-765 (a CSS variable is far
 *  from everything: it is one of ours) */
export function kitGap(a: string, b: string): number {
  const x = hex6(a).replace('#', ''), y = hex6(b).replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(x) || !/^[0-9a-f]{6}$/i.test(y)) return 765
  let d = 0
  for (let i = 0; i < 6; i += 2) d += Math.abs(parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16))
  return d
}

/** The stand-in colours for a side whose own kit clashes: real colour
 *  values, read from tokens.css by the caller (--kit-spare-*), because the
 *  choice is made by measuring the distance between two colours. */
export interface Spares { white: string; slate: string; gold: string; ink: string; home: string; away: string }

/** the spares, from the tokens on the page, and the kit a side with no club
 *  colours wears (a national side, the Isles): --kit-home and --kit-away, the
 *  same the pitch draws them in */
export const pageSpares = (read: (name: string) => string): Spares => ({
  white: read('--kit-spare-white'), slate: read('--kit-spare-slate'), gold: read('--kit-spare-gold'), ink: read('--kit-spare-ink'),
  home: read('--kit-home'), away: read('--kit-away'),
})

/** THE AWAY KIT (owner, 27 Sep 2026: "Northampton vs Connacht - the colours
 *  are matching and you can't see on the in game stats"). Northampton are
 *  black and green, Connacht green and black: each side's readable colour was
 *  the same green. The home side keeps its colour; the away side takes its
 *  first colour, else its second, else white, slate or gold, whichever is
 *  readable and clear of the home colour. `dark` is the ground the colour
 *  sits on: the dark panel (a near-black kit vanishes there) or the grass
 *  (where black shirts read fine). Returns [fill, edge] for each side. */
export function kitColours(sp: Spares, home: string[] | undefined, away: string[] | undefined, dark = true): { home: [string, string | undefined]; away: [string, string | undefined] } {
  // an all-dark kit (Saracens: black and near-black) reads as slate on the panel
  const pick = (kit: string[]): [string, string | undefined] =>
    !dark || luma(kit[0]) >= 40 ? [kit[0], kit[1]]
      : kit[1] && luma(kit[1]) >= 40 ? [kit[1], kit[0]]
      : [sp.slate, kit[0]]
  // A SIDE WITH NO CLUB COLOURS WEARS THE MATCH KIT, NOT A CSS NAME (1.9.1 bug
  // hunt). Nations are not clubs, and these used to fall back to
  // 'var(--gold-fill)': a name no measure here can read, so a Test had both
  // sides in gold and the home lines white on gold at 1.75:1.
  const h: [string, string | undefined] = home?.length ? pick(home) : [sp.home, sp.white]
  if (!away?.length) away = [sp.away, sp.white]
  const CLEAR = 150
  const tries: [string, string | undefined][] = [pick(away), [away[0], away[1]], ...(away[1] ? [[away[1], away[0]] as [string, string]] : [])]
  for (const c of tries) if (kitGap(c[0], h[0]) >= CLEAR && !(dark && luma(c[0]) < 40)) return { home: h, away: c }
  const spare = (dark ? [sp.white, sp.slate, sp.gold] : [sp.white, sp.ink, sp.gold]).find(c => kitGap(c, h[0]) >= CLEAR) ?? sp.gold
  return { home: h, away: [spare, away[0]] }
}

/* ---- a kit as a reading surface (WCAG pass) ----------------------------
 * A commentary line about a side wears that side's shirt as its fill, with
 * white or dark ink picked by a brightness guess (luma > 140). The guess is
 * not the contrast ratio: Northampton's green took white at 4.17:1, under the
 * 4.5 a line of commentary owes (nightcontrast, mid try-flash). So the ink is
 * chosen by the real WCAG ratio, and when neither ink reaches 4.5 on the shirt
 * itself the fill is mixed a step at a time toward the far ink until it does.
 * Most kits come back untouched; a mid-tone one is a shade deeper (or paler)
 * behind its text. The inks are --prop-ink and --prop-ink-dark, held here as
 * channel triples so no hex lives outside tokens.css. */
const INK_LIGHT = [255, 255, 255] // --prop-ink
const INK_DARK = [29, 39, 51] // --prop-ink-dark
const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const relLum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const wcag = (a: number[], b: number[]) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/** the ink a kit fill takes, and the fill to paint so that ink reads at 4.5:1 */
export function kitInk(fill: string): { ink: string; fill: string } {
  fill = hex6(fill)
  const hex = fill.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return { ink: luma(fill) > 140 ? 'var(--prop-ink-dark)' : 'var(--prop-ink)', fill }
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
  const light = wcag(rgb, INK_LIGHT) >= wcag(rgb, INK_DARK)
  const ink = light ? INK_LIGHT : INK_DARK
  const inkVar = light ? 'var(--prop-ink)' : 'var(--prop-ink-dark)'
  if (wcag(rgb, ink) >= 4.5) return { ink: inkVar, fill }
  const far = light ? INK_DARK : INK_LIGHT
  const farVar = light ? 'var(--prop-ink-dark)' : 'var(--prop-ink)'
  let p = 95
  for (; p > 40; p -= 5) {
    const mix = rgb.map((c, i) => (c * p + far[i] * (100 - p)) / 100)
    if (wcag(mix, ink) >= 4.6) break
  }
  return { ink: inkVar, fill: `color-mix(in srgb, ${fill} ${p}%, ${farVar})` }
}
