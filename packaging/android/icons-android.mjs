// Draw the Android launcher icon and splash from the game's own icon.svg,
// into the generated project. Run by scaffold.sh; safe to run again.
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
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RES = 'android/app/src/main/res'
if (!existsSync(RES)) { console.error(`no ${RES}: run cap add android first`); process.exit(1) }
const svg = readFileSync('../../public/icon.svg', 'utf8')
const GREEN = '#0f7a43'   // the brand plate, same as the maskable PWA icon
const NIGHT = '#1a201e'   // the night ground, same as capacitor.config.json

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

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
  const dir = join(RES, `mipmap-${d}`)
  if (!existsSync(dir)) continue
  const plate = await draw(legacy, 0.84, GREEN)
  writeFileSync(join(dir, 'ic_launcher.png'), plate)
  writeFileSync(join(dir, 'ic_launcher_round.png'), plate)
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), await draw(fg, 0.6, null))
}
writeFileSync(join(RES, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${GREEN}</color>\n</resources>\n`)
// the template also ships a drawable of the same name; the colour resource is
// what the adaptive icon references, and both existing is a build error
const dupe = join(RES, 'drawable', 'ic_launcher_background.xml')
if (existsSync(dupe)) writeFileSync(dupe, `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="${GREEN}"/>\n</shape>\n`)

// splash: every drawable*/splash.png the template shipped, same pixel size,
// our picture. The PNG header carries width and height at bytes 16-24.
let splashes = 0
for (const dir of readdirSync(RES)) {
  const f = join(RES, dir, 'splash.png')
  if (!dir.startsWith('drawable') || !existsSync(f)) continue
  const head = readFileSync(f).subarray(16, 24)
  const w = head.readUInt32BE(0), h = head.readUInt32BE(4)
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const inner = Math.round(Math.min(w, h) * 0.34)
  await page.setContent(`<body style="margin:0"><div style="width:${w}px;height:${h}px;background:${NIGHT};display:flex;align-items:center;justify-content:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></div></body>`)
  writeFileSync(f, await page.screenshot({ omitBackground: false }))
  await page.close()
  splashes++
}
await browser.close()
console.log(`    launcher icons at ${Object.keys(DENSITIES).length} densities, ${splashes} splash sizes`)
void statSync
