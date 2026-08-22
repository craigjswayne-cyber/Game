/**
 * ---- THE STORE SHELL TELLS THE TRUTH ----
 *
 * The release audit's finding (docs/release-readiness.md, Parts 1.2, 2.2, 2.6):
 * the files OUTSIDE src/ had drifted from the game inside them. The manifest
 * declared landscape for a portrait-tuned game and App.tsx still carried a
 * landscape hard-lock; the splash and status bar wore the retired blue; the
 * manifest description advertised the IP problem; the apple-touch-icon was the
 * wrong size. None of it was policed, because textlint stops at src/ +
 * index.html prose and tokenlint stops at src/ hex.
 *
 * This is the missing lint. It reads the night ground straight out of
 * tokens.css, so a future palette change fails here until the shell follows.
 *
 * Run: npx vite-node scripts/shelllint.ts
 */
import { readFileSync, existsSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// the night ground, from the one file allowed to say it
const tokens = readFileSync('src/ui/tokens.css', 'utf8')
const canvas = tokens.match(/--canvas:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? ''
ok(!!canvas, `tokens.css names the night ground (${canvas})`)

// ---- the manifest ----
const mf = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
ok(mf.name === 'PHASE: Rugby Manager' && mf.short_name === 'PHASE',
  'manifest still carries the brand')
ok(mf.orientation !== 'landscape',
  `manifest does not force landscape onto a portrait-tuned game (orientation: ${mf.orientation})`)
ok(mf.theme_color === canvas && mf.background_color === canvas,
  `the splash screen wears the night ground, not a retired palette (${mf.theme_color}/${mf.background_color})`)
ok(!/real (clubs|players|names)/i.test(mf.description ?? ''),
  'the manifest description does not advertise real-world IP')

// ---- index.html ----
const html = readFileSync('index.html', 'utf8')
const themeMeta = html.match(/name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/)?.[1] ?? ''
ok(themeMeta === canvas, `the status bar wears the night ground (${themeMeta})`)
ok(/rel="apple-touch-icon"\s+sizes="180x180"\s+href="\.\/icon-180\.png"/.test(html),
  'apple-touch-icon is the 180x180 Apple asks for')

// ---- the icon itself: a real 180x180 PNG, not just a promise ----
{
  ok(existsSync('public/icon-180.png'), 'public/icon-180.png exists')
  if (existsSync('public/icon-180.png')) {
    const png = readFileSync('public/icon-180.png')
    const w = png.readUInt32BE(16)
    const h = png.readUInt32BE(20)
    ok(png.readUInt32BE(0) === 0x89504e47 && w === 180 && h === 180,
      `and it really is a 180x180 PNG (${w}x${h})`)
  }
}

// ---- no orientation lock may ever come back ----
{
  const app = readFileSync('src/ui/App.tsx', 'utf8')
  // matches lock('landscape') and lock?.('landscape') but not this probe's own
  // documentation of the removal
  const locked = /\.lock\??\.?\(\s*['"]landscape['"]/.test(app)
  ok(!locked, 'App.tsx carries no landscape hard-lock')
}

console.log(fails ? `SHELL LINT FAILED (${fails})` : 'SHELL LINT PASSED: the shell matches the game inside it')
if (fails) process.exit(1)
