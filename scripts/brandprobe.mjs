// PHASE: Rugby Manager, v1.0.1 - the name and the number on the tin.
//
// The game was renamed from FAB Rugby and released as v1.0.1 ("the new name
// of the game is called PHASE: Rugby Manager" / "export this as v.1.0.1").
// A rename is a string that regresses silently - a PWA manifest keeps the old
// name on somebody's home screen, a title screen keeps the old wordmark - so
// the brand is asserted on the rendered page and the served manifest. Red on
// any FAB-era tree by construction.
//
// Run: node scripts/brandprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
// the release number comes from package.json, so a version bump cannot
// silently diverge from what the title screen shows
import { readFileSync } from 'node:fs'
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const server = await startPreview('4197', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

try {
  await page.goto('http://localhost:4197/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  const t = await page.evaluate(async () => {
    const h1 = document.querySelector('.title-screen h1')
    const mf = await fetch('./manifest.webmanifest').then(r => r.json())
    const body = document.querySelector('.title-screen')?.textContent ?? ''
    return { title: document.title, h1: h1?.textContent ?? '', mfName: mf.name, mfShort: mf.short_name, body }
  })
  ok(t.title === 'PHASE: Rugby Manager', `the browser tab says PHASE: Rugby Manager (saw "${t.title}")`)
  ok(t.h1.includes('PHASE') && t.h1.includes('RUGBY MANAGER'), `the wordmark is PHASE / RUGBY MANAGER (saw "${t.h1}")`)
  ok(!t.h1.includes('FAB'), 'and the old name is gone from it')
  ok(t.mfName === 'PHASE: Rugby Manager' && t.mfShort === 'PHASE',
    `the PWA manifest carries the new name (saw "${t.mfName}" / "${t.mfShort}")`)
  ok(t.body.includes('v' + version), `the title screen shows the release, v${version}`)

  // ---- the home screen icon, which is the first impression ----------------
  //
  // Android never shows the icon you give it: the launcher crops it to a
  // circle, squircle or teardrop and guarantees only the middle 80%. An icon
  // that is merely pretty at 512x512 comes out clipped, and there is no way to
  // find that out from this repository except by measuring it.
  //
  // So measure it. Everything outside the safe circle must be flat brand
  // green - no artwork out there to lose - and the corners must be opaque,
  // because a maskable icon that does not bleed to the edge gets a grey card
  // drawn behind it instead.
  const icon = await page.evaluate(async () => {
    const mf = await fetch('./manifest.webmanifest').then(r => r.json())
    const m = (mf.icons ?? []).find(i => (i.purpose ?? '').split(/\s+/).includes('maskable'))
    if (!m) return { declared: false }
    const img = new Image()
    img.src = m.src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height)
    const at = (x, y) => { const i = (y * c.width + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]] }
    const mid = c.width / 2, safe = c.width * 0.4          // radius of the middle 80%
    const bg = at(2, 2)
    let strays = 0, clear = 0
    for (let y = 0; y < c.height; y += 4) {
      for (let x = 0; x < c.width; x += 4) {
        if (Math.hypot(x - mid, y - mid) <= safe) continue  // inside the guarantee
        const [r, g, b, a] = at(x, y)
        if (a < 250) clear++
        else if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 24) strays++
      }
    }
    return { declared: true, src: m.src, size: c.width, strays, clear,
             corners: [at(1, 1)[3], at(c.width - 2, 1)[3], at(1, c.height - 2)[3], at(c.width - 2, c.height - 2)[3]] }
  })
  ok(icon.declared, 'the manifest declares a maskable icon, so launchers stop cropping the logo')
  if (icon.declared) {
    ok(icon.size >= 512, `it is at least 512px (${icon.size})`)
    ok(icon.strays === 0, `no artwork sits outside the middle 80% a launcher guarantees (${icon.strays} stray pixels)`)
    ok(icon.clear === 0, `and it bleeds to the edge rather than letterboxing (${icon.clear} transparent)`)
    ok(icon.corners.every(a => a === 255), 'including the corners, which a squircle keeps and a circle does not')
  }
  console.log(fails ? `BRAND PROBE FAILED (${fails})` : `BRAND PROBE PASSED: PHASE: Rugby Manager, v${version}`)
  process.exitCode = fails ? 1 : 0
} catch (e) {
  console.error('BRAND PROBE FAILED:', String(e).slice(0, 300))
  process.exitCode = 1
} finally {
  await browser.close()
  server.stop()
}
