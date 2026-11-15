// Probe: the news and press floors carry a banner (owner, 1.8.3, with
// screenshots of the empty space under a news story and a quiet press room),
// and since 1.8.7 every Finances tab does too ("On the bottom of all
// financial tabs"). Also holds the news reader's top bar to two tidy rows on
// a phone (owner, 1.8.7: "Formating has gone out here?").
//
// Same seam as matchad.mjs: globalThis.rmAds is stubbed and records every
// mount, because the question is only "did the game mount a slot here, with
// this place". The press room mounts one only while no question is waiting.
//
// Run: node scripts/floorad.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'
import { ok, done } from './lib/probe.mjs'

const server = await startPreview(0, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
await page.addInitScript(() => {
  globalThis.__mounts = []
  globalThis.rmAds = { mount(_el, place) { globalThis.__mounts.push(place) }, unmount() {} }
})
const mounted = (place) => page.evaluate(p => globalThis.__mounts.includes(p), place)

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Floor Test')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  await page.click('.bottom-nav >> text=News')
  await page.waitForTimeout(500)
  ok(await mounted('news-foot'), 'the news screen mounts a banner (news-foot)')

  // the reader bar on a phone: arrows and position on one row, the actions
  // on the next, sharing it in equal halves
  {
    const g = await page.evaluate(() => {
      const r = (el) => el && el.getBoundingClientRect()
      const bar = document.querySelector('.reader-bar')
      const btns = [...bar.querySelectorAll(':scope > .btn')].map(r)
      const pos = r(bar.querySelector('.reader-pos'))
      const acts = [...bar.querySelectorAll('.reader-acts > *')].map(r)
      return { btns, pos, acts, barW: r(bar).width, scrollW: document.documentElement.scrollWidth, vw: innerWidth }
    })
    const [older, newer] = g.btns
    ok(older && newer && Math.abs(older.top - newer.top) < 2 && Math.abs(g.pos.top - older.top) < 30,
      'the arrows and the position share the first row')
    ok(newer && newer.right > g.barW - 30, 'the newer arrow holds the right-hand end of it')
    ok(g.acts.length > 0 && g.acts.every(a => a.top > older.bottom - 1), `the actions sit on their own row (${g.acts.length})`)
    ok(g.acts.length < 2 || Math.abs(g.acts[0].width - g.acts[1].width) < 2, 'and share it in equal halves')
    ok(g.scrollW <= g.vw, 'no sideways scroll')
  }

  await page.click('.bottom-nav >> text=Manager')
  await page.waitForTimeout(300)
  await page.locator('text=Press Room').first().click()
  await page.waitForTimeout(500)
  const waiting = await page.locator('.press-outlet').count()
  const press = await mounted('press-foot')
  ok(waiting ? !press : press, waiting
    ? `the press room holds its banner while ${waiting} question(s) wait`
    : 'a quiet press room mounts a banner (press-foot)')

  // every Finances tab
  await page.click('.bottom-nav >> text=Hub')
  await page.waitForTimeout(300)
  await page.locator('text=Finances').first().click()
  await page.waitForTimeout(400)
  for (const tab of ['Finances', 'Commercial', 'Cap & Squad', 'The Board']) {
    const b = page.locator(`.tab-bar button:has-text("${tab}")`)
    if (!(await b.count())) { ok(false, `no ${tab} tab found`); continue }
    await b.first().click()
    await page.waitForTimeout(300)
    ok(await page.locator('.ad-slot').count() === 1, `the ${tab} tab carries a banner at its foot`)
  }
  ok(await mounted('finance-foot'), 'mounted as finance-foot')

  // the Fixtures screen's three tabs (owner, 1.9.13: "the bottom of the new
  // Stats tab, the bottom of the League table, the bottom of the Fixtures list")
  await page.evaluate(() => window.rugbyStore.getState().go('fixtures'))
  await page.waitForTimeout(400)
  for (const [tab, place] of [['Fixtures', 'fixtures-foot'], ['Table', 'table-foot'], ['Stats', 'stats-foot']]) {
    await page.locator(`main.content .tab-bar button:has-text("${tab}")`).first().click()
    await page.waitForTimeout(300)
    ok(await page.locator('.ad-slot').count() === 1, `the ${tab} tab carries one banner`)
    ok(await mounted(place), `mounted as ${place}`)
    const last = await page.evaluate(() => {
      const main = document.querySelector('main.content')
      const slot = main?.querySelector('.ad-slot')
      if (!main || !slot) return false
      // nothing but the spacer below it: the banner is the floor, not between rows
      const after = [...main.querySelectorAll('button, table, .card')].filter(el => slot.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      return after.length === 0
    })
    ok(last, `and it sits below everything on the ${tab} tab`)
  }
} catch (e) {
  ok(false, `walk broke: ${String(e.message ?? e).split('\n')[0]}`)
}
await browser.close()
await server.stop?.()
done('FLOOR AD PROBE', 'the news, press, finance and fixtures floors carry a banner, never beside a question', { exit: true, blank: false })
