// The launch brand kit, in one place, read by every launch compositor.
//
// The palette is NOT a second palette: it is read from src/ui/tokens.css (the
// night block, which is the game's default look), so the marketing is the
// game's own colours and cannot drift from them. The mark is public/icon.svg's
// geometry, the same shape as BrandMark in src/ui/components.tsx.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const tokens = readFileSync('src/ui/tokens.css', 'utf8')
const night = tokens.slice(0, tokens.indexOf('/* ---------------- day'))
const tok = (name) => {
  const m = night.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!m) throw new Error(`token --${name} not found in the night block`)
  return m[1]
}

export const C = {
  canvas: tok('canvas'),
  surface1: tok('surface-1'),
  surface2: tok('surface-2'),
  border: tok('border'),
  borderStrong: tok('border-strong'),
  text: tok('text-primary'),
  text2: tok('text-secondary'),
  muted: tok('text-muted'),
  primary: tok('primary'),
  primaryPressed: tok('primary-pressed'),
  primaryTint: tok('primary-tint'),
  gold: tok('gold'),
  onPrimary: tok('on-primary'),
  // the icon's own disc: the day-mode action green, which is the badge colour
  // in public/icon.svg (#0f7a43) and the darker ring it sits on
  badge: '#0f7a43',
  ring: '#dbf6e6',
  keyline: '#17332a',
}

export const FONT_URL = 'file://' + resolve('src/ui/fonts/space-grotesk-latin.woff2')

export const fontFace = `@font-face { font-family: 'Space Grotesk'; font-weight: 300 700; src: url('${FONT_URL}') format('woff2'); }`

/** The ball mark, as an inline SVG. `disc` false draws the ball and ring only. */
export function mark(size, { disc = true, discColour = C.badge, square = false } = {}) {
  const bg = square
    ? `<rect width="64" height="64" fill="${discColour}"/>`
    : disc ? `<circle cx="32" cy="32" r="32" fill="${discColour}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  ${bg}
  <circle cx="32" cy="32" r="26" fill="none" stroke="${C.ring}" stroke-width="3.4"/>
  <g transform="rotate(-32 32 32)">
    <ellipse cx="32" cy="32" rx="16.2" ry="22.6" fill="${C.keyline}"/>
    <ellipse cx="32" cy="32" rx="13.6" ry="20.0" fill="#ffffff"/>
    <path d="M31.4 12.4 C24.4 18.6 22.0 25.8 22.6 33.6 C24.4 26.6 26.4 20.4 33.2 13.8 Z" fill="${C.keyline}"/>
    <path d="M32.6 51.6 C39.6 45.4 42.0 38.2 41.4 30.4 C39.6 37.4 37.6 43.6 30.8 50.2 Z" fill="${C.keyline}"/>
  </g>
</svg>`
}

/** Headline with the closing full stop in the action green: the one accent. */
export const head = (s) => s.split('|').join('<br>').replace(/\.$/, `<span class="dot">.</span>`)
