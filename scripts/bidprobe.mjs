// Does the haggle panel fit on the phone?
//
// User, from a 412px screen: "the reduce or plus 500 go off the screen and
// dont fit in the box". The bid stepper is five items on one flex row - two
// minus buttons, the amount, two plus buttons - with no wrap and no shrink,
// so on a narrow phone the -500k and +500k escape both edges of the card.
//
// WHY NOTHING CAUGHT IT. geosweep walks all 32 routed screens at three widths
// and asserts nothing overflows sideways, and it passes. This panel is not a
// screen: it only exists after you open a player you do not own and tap
// "Haggle a different fee", so the sweep never opened it. That is the general
// lesson worth keeping - a layout probe that only visits ROUTES cannot see a
// panel that lives behind a button.
//
// So this walks to it and measures the real thing: every element inside the
// bid card must sit within the card, and the document must not scroll
// sideways. Measured with getBoundingClientRect, at the narrowest phone the
// game supports.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4192', 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
// 360 is the narrowest phone the game claims to support; the user's is 412
const page = await browser.newPage({ viewport: { width: 360, height: 800 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
page.setDefaultTimeout(6000)

try {
  await page.goto('http://localhost:4192/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Bid Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })

  // a player at another club, so the bid flow is offered at all
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.waitForSelector('.dtable .name', { timeout: 10000 })
  await page.click('.dtable tr .name')
  await page.waitForSelector('text=Haggle a different fee', { timeout: 10000 })
  // give the money a chance of covering the ask, so the panel is fully live
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    st.game.clubs[st.game.userClubId].budget = 200_000_000
    st.game.clubs[st.game.userClubId].balance = 200_000_000
    st.touch()
  })
  await page.click('text=Haggle a different fee')
  await page.waitForSelector('button:has-text("+500k")', { timeout: 6000 })

  const fit = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('+500k'))
    const card = btn?.closest('.card')
    if (!card) return null
    const cr = card.getBoundingClientRect()
    const bad = []
    for (const el of card.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      // 1px of slack for subpixel rounding
      if (r.left < cr.left - 1 || r.right > cr.right + 1) {
        bad.push({
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24),
          left: Math.round(r.left), right: Math.round(r.right),
        })
      }
    }
    return {
      card: { left: Math.round(cr.left), right: Math.round(cr.right) },
      vw: window.innerWidth,
      docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bad: bad.slice(0, 8),
    }
  })

  if (!fit) {
    ok(false, 'the haggle panel opened')
  } else {
    say(`\n  viewport ${fit.vw}px · card spans ${fit.card.left}..${fit.card.right}`)
    for (const b of fit.bad) say(`    escapes: "${b.text}" at ${b.left}..${b.right}`)
    say('')
    ok(fit.bad.length === 0, `every control in the bid panel sits inside the card (${fit.bad.length} escaping)`)
    ok(fit.docScroll <= 1, `the page does not scroll sideways (${fit.docScroll}px of overflow)`)
  }

  say(fails ? `\nBID PROBE FAILED (${fails})` : '\nBID PROBE PASSED: the stepper fits the phone')
} catch (e) {
  say(`\nBID PROBE ERROR: ${e.message}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}
done(fails)
