// Round 4 tidy (owner): screenshots and checks for the five requests at a
// phone's portrait size. Game Time and Contracts carry no footnote, the depth
// chart is on the Team Report, the bug page scrolls to its send button at
// 390x844 and 360x640, and World has Jobs while Competitions does not.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const PORT = process.env.PORT ?? '5341'
const OUT = process.env.OUT ?? null
const server = await startPreview(PORT, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${m}`); if (!c) fails++ }

const open = async (w, h) => {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  p.setDefaultTimeout(9000)
  await p.addInitScript(() => { localStorage.setItem('rm-night', '1'); localStorage.setItem('rm-lang', 'en') })
  await p.goto(`http://localhost:${PORT}/`)
  await p.waitForSelector('text=RUGBY', { timeout: 20000 })
  await p.evaluate(() => window.rugbyStore.getState().start('leicester', 'Tidy Probe'))
  await p.waitForTimeout(700)
  await p.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  return p
}
const go = (p, s) => p.evaluate(sc => window.rugbyStore.getState().go(sc), s)
const toBottom = p => p.evaluate(() => { const m = document.querySelector('main.content'); m.scrollTop = m.scrollHeight })
const shot = async (p, name) => { if (OUT) await p.screenshot({ path: `${OUT}/tidy-${name}.png` }) }
const tabs = p => p.locator('.content .tab-bar button').allInnerTexts()

try {
  const p = await open(390, 844)
  await go(p, 'squad'); await p.waitForTimeout(400)
  const st = await tabs(p)
  ok(!st.some(x => /depth/i.test(x)), `Team tabs have no Depth (${st.join(', ')})`)
  for (const [name, label] of [['gametime', 'Game Time'], ['contracts', 'Contracts']]) {
    await p.locator('.content .tab-bar button', { hasText: label }).click()
    await p.waitForTimeout(400)
    await toBottom(p); await p.waitForTimeout(200)
    const foot = await p.evaluate(() => [...document.querySelectorAll('main.content > .meta')].map(e => e.textContent))
    ok(foot.length === 0, `${label}: no explainer under the table`)
    await shot(p, name)
  }
  await go(p, 'report'); await p.waitForTimeout(400)
  const rt = await tabs(p)
  ok(rt.some(x => /depth/i.test(x)), `Team Report has a Depth tab (${rt.join(', ')})`)
  await p.locator('.content .tab-bar button', { hasText: 'Depth' }).click()
  await p.waitForTimeout(400)
  ok(await p.locator('.depth-chart .depth-row').count() >= 10, 'Team Report shows the depth chart')
  await shot(p, 'report-depth')
  await go(p, 'tables'); await p.waitForTimeout(400)
  const ct = await tabs(p)
  ok(!ct.some(x => /^(manager|jobs)$/i.test(x.trim())), `Competitions has no Manager or Jobs tab (${ct.join(', ')})`)
  await p.locator('.bottom-nav button[data-group="world"]').click()
  await p.waitForSelector('.submenu')
  await p.waitForTimeout(600) // let the sheet finish sliding in before the picture
  const wi = await p.locator('.submenu-item').allInnerTexts()
  ok(wi.some(x => /job/i.test(x)), `World menu lists Jobs (${wi.map(x => x.trim()).join(' | ')})`)
  await shot(p, 'world-menu')
  await p.locator('.submenu-item', { hasText: 'Job' }).click()
  await p.waitForTimeout(400)
  ok(await p.evaluate(() => document.querySelector('main.content').dataset.screen) === 'jobs', 'World > Jobs opens the job centre')
  await p.locator('.bottom-nav button[data-group="manager"]').click()
  await p.waitForSelector('.submenu')
  const mi = await p.locator('.submenu-item').allInnerTexts()
  ok(mi.some(x => /legacy/i.test(x)), 'Legacy is still on the manager menu')
  await p.locator('.submenu-veil').click({ position: { x: 5, y: 5 } })
  await p.close()

  for (const [w, h] of [[390, 844], [360, 640]]) {
    const q = await open(w, h)
    await go(q, 'bug'); await q.waitForTimeout(500)
    const m = await q.evaluate(() => { const el = document.querySelector('main.content'); return { sh: el.scrollHeight, ch: el.clientHeight } })
    // scroll by TOUCH, the way a phone does, from the middle of the page.
    // A wheel scrolled this page all along; a finger did not, because the
    // page sat in a second .content box nested inside the real one, and that
    // inner box (overflow auto, overscroll contain) took the drag and would
    // not hand it on.
    // (raw touch events: Input.synthesizeScrollGesture scrolls nothing in
    // headless Chromium, so a probe built on it passes and fails at random)
    const cdp = await q.context().newCDPSession(q)
    const x = Math.round(w / 2), y0 = Math.round(h * 0.7)
    for (let i = 0; i < 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
      for (let j = 1; j <= 10; j++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - j * Math.round(h * 0.04) }] })
        await q.waitForTimeout(16)
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await q.waitForTimeout(120)
    }
    await q.waitForTimeout(300)
    const nav = await q.locator('.bottom-nav').boundingBox()
    const reach = await q.evaluate(() => {
      const el = document.querySelector('main.content')
      return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth }
    })
    ok(reach.top >= reach.max - 2, `${w}x${h} bug page scrolls to its foot (${reach.top}/${reach.max}, content ${m.sh} in ${m.ch})`)
    const last = await q.locator('main.content .btn').last().boundingBox()
    ok(!!last && last.y + last.height <= nav.y + 1, `${w}x${h} last button reachable above the nav (${last && Math.round(last.y + last.height)} vs ${Math.round(nav.y)})`)
    ok(reach.doc <= 1, `${w}x${h} no sideways scroll`)
    if (w === 390) await shot(q, 'bug-bottom')
    await q.close()
  }
} catch (e) {
  console.log(`FAIL  walk broke: ${e}`)
  fails++
}
await browser.close()
server.stop()
console.log(fails === 0 ? '\nTIDY PASSED' : `\nTIDY FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
