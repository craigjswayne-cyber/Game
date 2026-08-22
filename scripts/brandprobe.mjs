// PHASE: Rugby Manager - the name and the number on the tin.
//
// The game was renamed from FAB Rugby and released as v1.0.1 ("the new name
// of the game is called PHASE: Rugby Manager" / "export this as v.1.0.1").
// A rename is a string that regresses silently - a PWA manifest keeps the old
// name on somebody's home screen, a title screen keeps the old wordmark - so
// the brand is asserted on the rendered page and the served manifest. Red on
// any FAB-era tree by construction.
//
// Run: node scripts/brandprobe.mjs   (needs a fresh npm run build)
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4197', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
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
  // READ THE NUMBER FROM package.json rather than hard-coding it here. This
  // line said 'v1.0.1' and had to be hand-edited the first time the release
  // moved, which is a probe that fails for being out of date rather than for
  // finding anything. The build stamp comes from package.json (vite.config.ts),
  // so the probe should ask the same source the game does.
  ok(t.body.includes(`v${VERSION}`), `the title screen shows the release, v${VERSION}`)
  console.log(fails ? `BRAND PROBE FAILED (${fails})` : `BRAND PROBE PASSED: PHASE: Rugby Manager, v${VERSION}`)
  process.exitCode = fails ? 1 : 0
} catch (e) {
  console.error('BRAND PROBE FAILED:', String(e).slice(0, 300))
  process.exitCode = 1
} finally {
  await browser.close()
  server.stop()
}
