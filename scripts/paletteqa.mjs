// The charcoal-and-green contract.
//
// The floodlit theme was rebuilt to the user's palette ("looking to bring the
// game colours up to the level"): charcoal surfaces, one green, and the green
// RATIONED - actions, selected states, ratings, form, positive numbers - with
// a #247a32-to-#42b94f gradient reserved for the primary action. A palette is
// exactly the kind of thing that drifts back one hex at a time, so this pins
// the eight anchor values and the two structural promises (secondary buttons
// stay charcoal, the hero gradient exists) to the rendered page, not to the
// stylesheet. Red on the navy-and-gold tree by construction: every anchor
// below was a different colour there.
//
// Run: node scripts/paletteqa.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4193', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const hex = (h) => {
  const n = h.replace('#', '')
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`
}

try {
  await page.goto('http://localhost:4193/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })

  // ---- the anchor tokens, resolved on the live night subtree ----
  const tokens = await page.evaluate(() => {
    const el = document.querySelector('.app.night') ?? document.querySelector('.app')
    const cs = getComputedStyle(el)
    const get = (t) => cs.getPropertyValue(t).trim()
    return {
      night: el.classList.contains('night'),
      cream: get('--cream'), paper: get('--paper'), gold: get('--gold'),
      goldDark: get('--gold-dark'), titleInk: get('--title-ink'),
      inkSoft: get('--ink-soft'), hairline: get('--hairline'), win: get('--win'),
    }
  })
  ok(tokens.night, 'the app is in floodlit mode for the measurement')
  ok(tokens.cream === '#181a19', `page background is the charcoal #181a19 (saw ${tokens.cream})`)
  ok(tokens.paper === '#222624', `cards are #222624 (saw ${tokens.paper})`)
  ok(tokens.gold === '#42b94f', `the accent token carries the action green #42b94f (saw ${tokens.gold})`)
  ok(tokens.goldDark === '#247a32', `pressed/secondary green is #247a32 (saw ${tokens.goldDark})`)
  ok(tokens.titleInk === '#f4f6f4', `headings are #f4f6f4 (saw ${tokens.titleInk})`)
  ok(tokens.inkSoft === '#9ba29d', `body text is #9ba29d (saw ${tokens.inkSoft})`)
  ok(tokens.hairline === '#3a403c', `borders are #3a403c (saw ${tokens.hairline})`)
  ok(tokens.win === '#42b94f', `a win pip is the same green as an action (saw ${tokens.win})`)

  // ---- walk into a save so real chrome is on screen ----
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Palette QA')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.masthead', { timeout: 20000 })
  await page.waitForTimeout(600)

  // ---- the hero gradient is the primary action, and only the primary action ----
  const chrome = await page.evaluate(() => {
    const bg = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      return { image: cs.backgroundImage, color: cs.backgroundColor, ink: cs.color }
    }
    return {
      continueBtn: bg('.continue-btn'),
      masthead: bg('.masthead'),
      nav: bg('.bottom-nav'),
    }
  })
  const GREEN_HI = '66, 185, 79' // #42b94f
  const GREEN_LO = '36, 122, 50' // #247a32
  ok(!!chrome.continueBtn && chrome.continueBtn.image.includes(GREEN_HI) && chrome.continueBtn.image.includes(GREEN_LO),
    'Continue wears the hero gradient, #42b94f into #247a32')
  ok(!!chrome.masthead && !chrome.masthead.image.includes(GREEN_HI),
    'the masthead stays charcoal - the chrome does not flood green')
  ok(!!chrome.nav && !chrome.nav.image.includes(GREEN_HI),
    'and so does the bottom nav')

  // ---- selected state is green, resting state is not ----
  const nav = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.bottom-nav button')]
    const active = btns.find(b => b.classList.contains('active'))
    const idle = btns.find(b => !b.classList.contains('active'))
    return {
      active: active ? getComputedStyle(active).color : null,
      idle: idle ? getComputedStyle(idle).color : null,
    }
  })
  ok(nav.active === hex('66d773'), `the active nav icon is the bright green (saw ${nav.active})`)
  ok(nav.idle !== nav.active && nav.idle !== hex('66d773'),
    'a resting nav icon is not green - selection is what green MEANS')

  console.log(fails ? `PALETTE QA FAILED (${fails})` : 'PALETTE QA PASSED: charcoal dominates, green is rationed')
  process.exitCode = fails ? 1 : 0
} catch (e) {
  console.error('PALETTE QA FAILED:', String(e).slice(0, 400))
  process.exitCode = 1
} finally {
  await browser.close()
  server.stop()
}
