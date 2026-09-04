// Draw the Android launcher icon and splash from the game's own icon.svg,
// into packaging/android/res/, which is COMMITTED and which scaffold.sh copies
// over the generated project's res/ on every run. So this script runs only
// when the icon changes, on a machine with a browser; the owner's machine
// never needs one (the 4 Sep 2026 build on the owner's Mac had no Chromium at
// the path this script assumed, the step crashed, and the bundle went to Play
// with Capacitor's placeholder icon).
//
// Usage:  node icons-android.mjs            (needs android/ to exist once, for
//                                            the list of splash sizes)
//
// THREE PICTURES, NOT ONE RESIZE, for the same reason scripts/icons.mjs makes a
// separate maskable icon: Android crops the launcher icon to whatever shape the
// launcher is set to and guarantees only the middle 66% of an adaptive icon's
// foreground. So:
//
//   ic_launcher_foreground  the artwork, inset to 60% on a transparent 108dp
//                           canvas, so the ring clears every mask with room
//   ic_launcher_background  the brand green, as a colour resource
//   ic_launcher / _round    legacy icons for launchers older than API 26:
//                           the artwork on the green, edge to edge
//   splash                  the icon centred on the night ground, at every
//                           size Capacitor's template ships
//
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TEMPLATE = 'android/app/src/main/res'   // what Capacitor generated: the sizes
const RES = 'res'                              // where we write: committed
if (!existsSync(TEMPLATE)) { console.error(`no ${TEMPLATE}: run cap add android first`); process.exit(1) }
const svg = readFileSync('../../public/icon.svg', 'utf8')
const GREEN = '#0f7a43'   // the brand plate, same as the maskable PWA icon
const NIGHT = '#1a201e'   // the night ground, same as capacitor.config.json

/** a browser, from wherever this machine has one: an explicit path, the
 *  development container's Chromium, Playwright's own download, or the
 *  Chrome or Edge that is installed on a Mac or PC */
async function anyBrowser() {
  const tries = []
  if (process.env.PW_CHROMIUM) tries.push({ executablePath: process.env.PW_CHROMIUM })
  if (existsSync('/opt/pw-browsers/chromium')) tries.push({ executablePath: '/opt/pw-browsers/chromium' })
  tries.push({}, { channel: 'chrome' }, { channel: 'msedge' })
  let last
  for (const t of tries) { try { return await chromium.launch(t) } catch (e) { last = e } }
  throw new Error(`no browser found to draw the icons with (${last?.message?.split('\n')[0]}); set PW_CHROMIUM to one`)
}
const browser = await anyBrowser()
mkdirSync(RES, { recursive: true })

/** render the svg at `size`, inset to `frac` of the canvas, on `bg` (or transparent) */
async function draw(size, frac, bg) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const inner = Math.round(size * frac)
  await page.setContent(`<body style="margin:0"><div style="width:${size}px;height:${size}px;${bg ? `background:${bg};` : ''}display:flex;align-items:center;justify-content:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></div></body>`)
  const buf = await page.screenshot({ omitBackground: !bg })
  await page.close()
  return buf
}

// launcher icons per density: legacy size, adaptive foreground size (108dp)
const DENSITIES = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] }
for (const [d, [legacy, fg]] of Object.entries(DENSITIES)) {
  if (!existsSync(join(TEMPLATE, `mipmap-${d}`))) continue
  const dir = join(RES, `mipmap-${d}`)
  mkdirSync(dir, { recursive: true })
  const plate = await draw(legacy, 0.84, GREEN)
  writeFileSync(join(dir, 'ic_launcher.png'), plate)
  writeFileSync(join(dir, 'ic_launcher_round.png'), plate)
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), await draw(fg, 0.6, null))
}
mkdirSync(join(RES, 'values'), { recursive: true })
writeFileSync(join(RES, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${GREEN}</color>\n</resources>\n`)
// the template also ships a drawable of the same name; the colour resource is
// what the adaptive icon references, and both existing is a build error
const dupe = join(RES, 'drawable', 'ic_launcher_background.xml')
if (existsSync(join(TEMPLATE, 'drawable', 'ic_launcher_background.xml'))) { mkdirSync(join(RES, 'drawable'), { recursive: true }); writeFileSync(dupe, `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="${GREEN}"/>\n</shape>\n`) }

// splash: every drawable*/splash.png the template shipped, same pixel size,
// our picture. The PNG header carries width and height at bytes 16-24.
let splashes = 0
for (const dir of readdirSync(TEMPLATE)) {
  const f = join(TEMPLATE, dir, 'splash.png')
  if (!dir.startsWith('drawable') || !existsSync(f)) continue
  const head = readFileSync(f).subarray(16, 24)
  const w = head.readUInt32BE(0), h = head.readUInt32BE(4)
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const inner = Math.round(Math.min(w, h) * 0.34)
  await page.setContent(`<body style="margin:0"><div style="width:${w}px;height:${h}px;background:${NIGHT};display:flex;align-items:center;justify-content:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></div></body>`)
  mkdirSync(join(RES, dir), { recursive: true })
  writeFileSync(join(RES, dir, 'splash.png'), await page.screenshot({ omitBackground: false }))
  await page.close()
  splashes++
}
await browser.close()
console.log(`    ${RES}/: launcher icons at ${Object.keys(DENSITIES).length} densities, ${splashes} splash sizes - commit it`)
