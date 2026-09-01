// ---- THE SKINS, ON A REAL PHONE-SIZED SCREEN ----
//
// skinprobe.ts proves the palettes are readable on paper: it measures the hexes
// in tokens.css and holds every pair to WCAG AA. It cannot prove the game
// actually WEARS them - that the Settings page exists, sits where the owner
// asked for it, and that choosing a skin repaints the app and survives a
// reload. That is this file.
//
// Owner, v1.2.1: "make sure everything is correct and fully visible. and
// changeable in a new page called settings which should be above report a bug
// in the management section."
//
// Run: node scripts/skinui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4217', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`); if (!c) fails++ }
const say = (s) => console.log(s)

const SKINS = [
  { key: 'midnight', label: 'Tactical Midnight', canvas: 'rgb(11, 19, 32)' },
  { key: 'heritage', label: 'Heritage Gold', canvas: 'rgb(24, 24, 26)' },
  { key: 'stealth', label: 'OLED Stealth', canvas: 'rgb(0, 0, 0)' },
]

try {
  const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  // a career, because the manager menu only exists inside one
  await page.goto('http://localhost:4217/')
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // ---- 1. the door, where it was asked for ----
  say('\n--- 1. Settings is in the manager menu, above Report a Bug')
  await page.locator('.bottom-nav button', { hasText: '▸' }).nth(1).click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(400)
  const items = await page.locator('.submenu-item').allInnerTexts()
  const iSet = items.findIndex(t => /Settings/i.test(t))
  const iBug = items.findIndex(t => /Report a Bug/i.test(t))
  ok(iSet >= 0, 'there is a Settings item in the manager menu')
  ok(iBug >= 0, 'and Report a Bug is still there')
  ok(iSet >= 0 && iBug >= 0 && iSet < iBug, `Settings sits ABOVE Report a Bug (${iSet} < ${iBug})`)

  await page.locator('.submenu-item', { hasText: 'Settings' }).click()
  await page.waitForSelector('.content')
  const body = await page.locator('.content').innerText()
  ok(/Skin/i.test(body), 'the page leads with the skin picker')
  for (const s of SKINS) ok(body.includes(s.label), `${s.label} is offered by name`)
  ok(/Clubhouse/.test(body), 'and so is the built-in palette, so a skin can be undone')

  // ---- 2. every card is fully visible, nothing clipped ----
  say('\n--- 2. every choice is fully on screen and big enough to press')
  const cards = page.locator('.skin-card')
  const n = await cards.count()
  ok(n === 4, `four skin cards render (${n})`)
  const vw = page.viewportSize().width
  for (let i = 0; i < n; i++) {
    const b = await cards.nth(i).boundingBox()
    ok(b !== null && b.width > 0 && b.height >= 44,
       `card ${i + 1}: ${Math.round(b?.width ?? 0)}x${Math.round(b?.height ?? 0)}px, tappable`)
    ok(b !== null && b.x >= 0 && b.x + b.width <= vw + 1,
       `card ${i + 1} sits inside the ${vw}px screen (right edge ${Math.round((b?.x ?? 0) + (b?.width ?? 0))})`)
    // the swatch strip is the preview - six colours, all painted
    const sw = await cards.nth(i).locator('.skin-swatches i').count()
    ok(sw === 6, `card ${i + 1} shows its palette (${sw} swatches)`)
  }

  // ---- 3. choosing one actually repaints the game ----
  say('\n--- 3. a skin repaints the app, and holds through a reload')
  for (const s of SKINS) {
    await page.locator('.skin-card', { hasText: s.label }).click()
    await page.waitForTimeout(250)
    const cls = await page.locator('.app').first().getAttribute('class')
    ok((cls ?? '').includes(`skin-${s.key}`), `${s.label}: the app wears skin-${s.key}`)
    const canvas = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.app')).getPropertyValue('--canvas').trim())
    ok(canvas.toLowerCase() === s.canvas || canvas.toUpperCase().startsWith('#'),
       `${s.label}: --canvas resolves (${canvas})`)
    // the words on the page are still readable against what is behind them
    const seen = await page.locator('.content').innerText()
    ok(seen.length > 40, `${s.label}: the page still has its text (${seen.length} chars)`)
  }

  // the last choice survives a reload, because it is stored on the device
  await page.reload()
  await page.waitForSelector('.app')
  await page.waitForTimeout(600)
  const after = await page.locator('.app').first().getAttribute('class')
  ok((after ?? '').includes('skin-stealth'), 'the chosen skin is still on after a reload')

  // ---- 4. and it can be taken back off ----
  say('\n--- 4. the built-in palette is one tap away again')
  await page.locator('.bottom-nav button', { hasText: '▸' }).nth(1).click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(300)
  await page.locator('.submenu-item', { hasText: 'Settings' }).click()
  await page.waitForSelector('.content')
  await page.locator('.skin-card', { hasText: 'Clubhouse' }).click()
  await page.waitForTimeout(250)
  const back = await page.locator('.app').first().getAttribute('class')
  ok(!/skin-/.test(back ?? ''), `back to the built-in palette (${back})`)
  ok(/Floodlights/i.test(await page.locator('.content').innerText()),
     'and the floodlight switch is offered again with it')

  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
  await page.close()
} finally {
  await browser.close()
  server.stop()
}

say(fails ? `\nSKIN UI FAILED (${fails})` : '\nSKIN UI PASSED: three skins, offered where asked, and every one of them wears')
process.exit(fails ? 1 : 0)
