// Text size: the game's answer to px-fixed type on a phone.
//
// The release audit (Part 2.3) measured every one of the UI's font sizes in px
// behind a user-scalable=no viewport: OS text scaling did nothing, and there
// was no in-game path either. The fix is a zoom on the document root - chosen
// on the Settings page, persisted as rm-zoom, applied by App on boot - which
// scales type and controls while viewport-unit lengths (exempt from zoom by
// spec) keep the shell screen-sized.
//
// The control lived on the title screen until v1.2.3 and now lives only in
// Settings (owner: "remove text size from the main menu now we have it in
// settings"), so this walks into a career to find it. It keeps the same two
// class names it always had, .text-scale-row and .text-scale-btn, which is
// the whole point of them.
//
// What this holds:
//   1. The control exists on Settings (red on any build without it).
//   2. Choosing large actually renders larger: the label's box grows ~1.3x.
//   3. It survives a reload: the store boots the saved scale, not 1.
//   4. The game is PLAYABLE at 1.3: nothing scrolls sideways on Home, and the
//      bottom nav still ends inside the viewport.
//   5. And the title screen it LEFT carries no second copy of it.
//
// Run: node scripts/textscale.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4211, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

const overflow = () => page.evaluate(() => {
  const d = document.scrollingElement
  return d ? d.scrollWidth - d.clientWidth : 0
})
// Measured on the TEXT SIZE label, not the wordmark: the wordmark WRAPS at
// 1.3 (two lines become three), so its box grows by zoom times wrap and the
// first cut of this probe read x1.95 and called the zoom broken. A short
// single-line label's height is a pure zoom measure.
const labelHeight = () => page.evaluate(() => {
  const el = document.querySelector('.text-scale-row .muted')
  return el ? el.getBoundingClientRect().height : 0
})

/** Into a career and onto Settings, by the store handle rather than by
 *  clicking eight labels: this probe is about the zoom, not about the wizard,
 *  and textscale used to be measurable on the title screen in one hop. */
const toSettings = async () => {
  await page.evaluate(() => window.rugbyStore.getState().start('northampton', 'Bigtype'))
  await page.waitForTimeout(600)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  await page.evaluate(() => window.rugbyStore.getState().go('settings'))
  await page.waitForSelector('.text-scale-row', { timeout: 9000 })
}

try {
  await page.goto('http://localhost:4211/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })

  // ---- 0. the title screen has let it go ----
  ok(await page.locator('.text-scale-row').count() === 0,
    'the title screen carries no text size control any more')

  await toSettings()

  // ---- 1. the control exists ----
  const btns = await page.locator('.text-scale-row .text-scale-btn').count()
  ok(btns === 3, `Settings offers three text sizes (${btns})`)

  // ---- 2. large means larger ----
  const base = await labelHeight()
  ok(base > 0, `the label measures at default scale (${base.toFixed(1)}px)`)
  await page.locator('.text-scale-row .text-scale-btn').last().click()
  await page.waitForTimeout(150)
  const big = await labelHeight()
  const ratio = base > 0 ? big / base : 0
  ok(ratio > 1.2 && ratio < 1.4,
    `choosing large renders ~1.3x (label ${base.toFixed(1)}px to ${big.toFixed(1)}px, x${ratio.toFixed(2)})`)
  const stored = await page.evaluate(() => localStorage.getItem('rm-zoom'))
  ok(stored === '1.3', `the choice is persisted (rm-zoom=${stored})`)

  // ---- 3. it survives a reload ----
  await page.reload()
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.rugbyStore.getState().go('settings')).catch(() => {})
  await page.waitForSelector('.text-scale-row', { timeout: 15000 })
  const after = await labelHeight()
  ok(base > 0 && after / base > 1.2,
    `a reload boots at the saved scale, not at 1 (${after.toFixed(1)}px)`)
  ok((await overflow()) <= 1, `Settings holds its width at 1.3 (${await overflow()}px over)`)

  // ---- 4. the game is playable at 1.3 ----
  await page.evaluate(() => window.rugbyStore.getState().go('home'))
  await page.waitForSelector('.masthead', { timeout: 20000 })
  await page.waitForTimeout(400)
  ok((await overflow()) <= 1, `Home holds its width at 1.3 (${await overflow()}px over)`)
  const nav = await page.evaluate(() => {
    const el = document.querySelector('.bottom-nav')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { bottom: r.bottom, vh: window.innerHeight }
  })
  ok(!!nav && nav.bottom <= nav.vh + 1,
    `the bottom nav still ends inside the viewport (${nav ? `${nav.bottom.toFixed(0)} of ${nav.vh}` : 'missing'})`)
} catch (e) {
  say(`FAIL  probe crashed: ${e.message}`)
  fails++
} finally {
  await browser.close()
  await server.stop()
}

say(fails ? `TEXT SCALE FAILED (${fails})` : 'TEXT SCALE PASSED: bigger type, same game')
done(fails)
