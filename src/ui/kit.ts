// Kit colours on the match screen: which colour stands for each side.

/** perceived brightness of a #rrggbb colour, 0-255 (a CSS variable reads as
 *  mid-grey: it is one of ours, and ours are never near-black) */
export function luma(c: string): number {
  const hex = c.replace('#', '')
  if (hex.length < 6) return 128
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

/** how far apart two #rrggbb colours look, 0-765 (a CSS variable is far
 *  from everything: it is one of ours) */
export function kitGap(a: string, b: string): number {
  const x = a.replace('#', ''), y = b.replace('#', '')
  if (x.length < 6 || y.length < 6) return 765
  let d = 0
  for (let i = 0; i < 6; i += 2) d += Math.abs(parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16))
  return d
}

/** The stand-in colours for a side whose own kit clashes: real colour
 *  values, read from tokens.css by the caller (--kit-spare-*), because the
 *  choice is made by measuring the distance between two colours. */
export interface Spares { white: string; slate: string; gold: string; ink: string }

/** the spares, from the tokens on the page */
export const pageSpares = (read: (name: string) => string): Spares => ({
  white: read('--kit-spare-white'), slate: read('--kit-spare-slate'), gold: read('--kit-spare-gold'), ink: read('--kit-spare-ink'),
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
  const h: [string, string | undefined] = home?.length ? pick(home) : ['var(--gold-fill)', 'var(--ramp-g9)']
  if (!away?.length) return { home: h, away: ['var(--ramp-n4)', undefined] }
  const CLEAR = 150
  const tries: [string, string | undefined][] = [pick(away), [away[0], away[1]], ...(away[1] ? [[away[1], away[0]] as [string, string]] : [])]
  for (const c of tries) if (kitGap(c[0], h[0]) >= CLEAR && !(dark && luma(c[0]) < 40)) return { home: h, away: c }
  const spare = (dark ? [sp.white, sp.slate, sp.gold] : [sp.white, sp.ink, sp.gold]).find(c => kitGap(c, h[0]) >= CLEAR) ?? sp.gold
  return { home: h, away: [spare, away[0]] }
}
