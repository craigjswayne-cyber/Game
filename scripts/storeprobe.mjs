// Probe: the till, in a real browser, against the real build.
//
// moneyprobe.ts holds the logic. This holds the SHAPE OF THE PRODUCT, which is
// the part a unit test cannot see:
//
//   the build this repository deploys shows no purchase door and no ad frame -
//     not a disabled button, not an empty grey strip, nothing at all;
//   the legal surface a store reviewer looks for is reachable from inside the
//     game and works offline, because it ships with the app rather than living
//     on somebody's website;
//   with a bridge attached, as a packaged build has, the door appears, the
//     purchase completes, the mark lands on the title screen and it survives a
//     reload;
//   and an attached ad provider draws in the declared place and nowhere else.
//
// The bridge is injected with addInitScript, which is exactly how an iOS
// wrapper does it, so this is the real mechanism rather than a mock of it.
//
// Run: node scripts/storeprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4209', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** A page with, or without, a store attached before the app boots. */
const openPage = async ({ billing = false, ads = false, owns = [], deaf = false, refuse = false } = {}) => {
  const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
  if (billing) {
    await page.addInitScript(([owned, mute, refuse]) => {
      // the same shape a Play TWA's Digital Goods wrapper has (v1.1.0):
      // non-consumables stay owned once bought; a consumable stays in owned()
      // until the game consumes it, which is the recovery path under test
      const bought = new Set()
      let why = null
      globalThis.rmBilling = {
        // `mute` is a store that is REACHABLE BUT SILENT: the wrapper is
        // there, the products are not (not activated in the console, licence
        // testing not set up). It is the exact shape of the v1.1.6 fault, and
        // before v1.1.9 it was indistinguishable on screen from a working one.
        details: async (sku) => { if (mute) throw new Error('not available'); return { sku, price: '£2.99' } },
        // `refuse` is Play declining to open the sheet at all - an inactive
        // product, an account off the licence-testing list. The bridge reports
        // it as a refusal with the store's own words attached, and this checks
        // those words reach the screen.
        buy: async (sku) => {
          if (refuse) { why = 'AbortError: item unavailable'; return 'refused' }
          bought.add(sku); return 'owned'
        },
        reason: () => why,
        owned: async () => [...new Set([...owned, ...bought])],
        consume: async (sku) => { bought.delete(sku) },
      }
    }, [owns, deaf, refuse])
  }
  if (ads) {
    await page.addInitScript(() => {
      globalThis.rmAds = {
        mount: (el, place) => { el.setAttribute('data-ad', place); el.textContent = 'AD' },
        unmount: (el) => { el.textContent = '' },
      }
    })
  }
  return page
}

/** Career, quickly: the till only has doors once you are inside the game. */
const startCareer = async (page) => {
  await page.goto('http://localhost:4209/')
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
}

const openAbout = async (page) => {
  await page.locator('.bottom-nav button', { hasText: '▸' }).nth(1).click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(400)
  await page.locator('.submenu-item', { hasText: 'About' }).click()
  await page.waitForSelector('.content')
}

try {
  // ---- 1. the build people play: no till anywhere ------------------------
  say('--- 1. the web build, which is what this repository deploys')
  {
    const page = await openPage()
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    await startCareer(page)
    ok(await page.locator('.ad-slot').count() === 0, 'no ad frame is rendered on the dashboard')
    await openAbout(page)
    const about = await page.locator('.content').innerText()
    ok(/Unofficial/i.test(about), 'the About page states the game is unofficial and unaffiliated')
    ok(/collects nothing/i.test(about), 'and that it collects nothing')
    ok(!/The Store|Open the Store/i.test(about), 'with no store door, because there is no store behind it')
    ok(await page.locator('a[href="./privacy.html"]').count() === 1, 'the privacy policy is one tap away')

    // v1.1.0: the Boardroom shelf exists only behind a bridge - the free web
    // build's board tab is confidence and objectives, with not one store row
    await page.evaluate(() => window.rugbyStore.getState().go('finances'))
    await page.waitForSelector('.tab-bar')
    await page.locator('.tab-bar button', { hasText: 'The Board' }).click()
    await page.waitForTimeout(300)
    const board = await page.locator('.content').innerText()
    ok(!/Board resolutions|Buy -|Sugar Daddy|Charter/i.test(board),
      'the web build board tab sells nothing at all')
    ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)

    // the policy itself, served from the app's own origin
    const pol = await page.goto('http://localhost:4209/privacy.html')
    ok(pol.status() === 200, 'the privacy policy is served with the app (200)')
    const text = await page.locator('body').innerText()
    ok(/collects nothing about you/i.test(text), 'and says what the game actually does')
    ok(/phaserugbymanager@gmail\.com/.test(text), 'with a contact address on it')
    ok(/not affiliated with, endorsed by/i.test(text), 'and the names position stated in full')
    await page.close()
  }

  // ---- 2. a packaged build: the store, one row per product ---------------
  // Rewritten for the v1.1.4 store: compact rows, everything visible, and
  // the one honesty gate that matters - "Remove all ads" renders ONLY where
  // an ad provider actually exists, because selling the absence of ads in a
  // build that has none is the dishonesty v1.1.3 removed.
  say('\n--- 2. a bridge attached, as a wrapper injects one')
  {
    const page = await openPage({ billing: true })
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    await startCareer(page)
    await openAbout(page)
    ok(await page.locator('.content').innerText().then(t => /The Store/i.test(t)),
      'the About page grows a Store card')
    await page.locator('.btn.gold', { hasText: 'Open the Store' }).click()
    await page.waitForSelector('.content')
    const till = await page.locator('.content').innerText()
    ok(/£2\.99/.test(till), "the prices shown are the store's own")
    ok(!/named no products|guide prices/i.test(till),
      'and the shelf says nothing about its health, because there is nothing wrong with it')
    for (const row of ['Support the game', 'Full Fitness', 'The International Stage', 'The Estate', "The Owner's Charter", 'Board funding']) {
      ok(till.includes(row), `the ${row} row is on the shelf`)
    }
    ok(!/Remove all ads/i.test(till),
      'and NO Remove-all-ads row, because this build ships no ads to remove')
    ok(!/what it does not do/i.test(till), 'the essays are gone - each product is one line')

    // buy Support the game from its row: acknowledged, the row turns into a
    // receipt (v1.1.6: the Manager's License swapped for this thank-you)
    await page.locator('.card', { hasText: 'Support the game' }).locator('.btn.gold').click()
    await page.waitForTimeout(600)
    const after = await page.locator('.card', { hasText: 'Support the game' }).innerText()
    ok(/Yours/.test(after), 'a completed purchase turns the row into a receipt')
    ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
    await page.close()
  }

  // ---- 2a. ads attached as well: the removal exists, and works -----------
  say('\n--- 2a. an ad provider attached: Remove all ads appears, and marks the title')
  {
    const page = await openPage({ billing: true, ads: true })
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    await startCareer(page)
    await openAbout(page)
    await page.locator('.btn.gold', { hasText: 'Open the Store' }).click()
    await page.waitForSelector('.content')
    ok(await page.locator('.content').innerText().then(t => /Remove all ads/i.test(t)),
      'with ads in the build, the removal is on the shelf')
    await page.locator('.card', { hasText: 'Remove all ads' }).locator('.btn.gold').click()
    await page.waitForTimeout(600)
    ok(await page.locator('.card', { hasText: 'Remove all ads' }).innerText().then(t => /Yours/.test(t)),
      'the purchase completes and the row is a receipt')

    // the mark, on the screen it was promised on
    await page.locator('.bottom-nav button', { hasText: '▸' }).nth(1).click()
    await page.waitForSelector('.submenu')
    await page.waitForTimeout(400)
    await page.locator('.submenu-item', { hasText: 'Main Menu' }).click()
    await page.waitForSelector('.title-screen')
    ok(await page.locator('.supporter-mark').count() === 1, 'the title screen carries the supporter mark')

    // and it survives the app being closed
    await page.reload()
    await page.waitForSelector('.title-screen', { timeout: 15000 })
    ok(await page.locator('.supporter-mark').count() === 1, 'which is still there after a reload')
    ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
    await page.close()
  }

  // ---- 2b. board funding sells at the STORE (v1.1.5), and the figure on the
  // row is the fixed figure that lands; the Boardroom keeps the Charter desk
  say('\n--- 2b. board funding at the store, the Charter desk in the Boardroom')
  {
    const page = await openPage({ billing: true })
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    await startCareer(page)
    await page.evaluate(() => window.rugbyStore.getState().go('supporter'))
    await page.waitForSelector('text=Board funding')
    ok(await page.locator('text=The Sugar Daddy').count() === 1, 'the four resolutions render on the store shelf')

    const before = await page.evaluate(() => {
      const g = window.rugbyStore.getState().game
      const c = g.clubs[g.userClubId]
      return { budget: c.budget, balance: c.balance, news: g.news.length }
    })
    // the small injection: the owner's fixed £10m, every club alike
    const want = 10_000_000
    // the tier label sits two divs below its flex row, and the buy button is
    // that row's only gold button
    await page.locator('text=Board Injection (Small)').locator('xpath=../..').locator('.btn.gold').click()
    await page.waitForSelector('text=The funds have landed')
    const after = await page.evaluate(() => {
      const g = window.rugbyStore.getState().game
      const c = g.clubs[g.userClubId]
      return { budget: c.budget, balance: c.balance, news: g.news.length, wageBoost: g.wageBoost, injected: g.injectedThisSeason }
    })
    ok(after.budget === before.budget + want && after.balance === before.balance + want,
      `the row's figure is the figure that lands (${want.toLocaleString('en-GB')})`)
    ok(after.wageBoost === 0.10 && after.injected === want, 'with the doubled wage allowance and the objectives ledger written')
    ok(after.news === before.news + 1, 'and the board letter goes in the inbox')
    const owed = await page.evaluate(() => globalThis.rmBilling.owned())
    ok(!owed.includes('phase.inject.s'), 'the purchase is consumed only after the career kept it')

    // the Boardroom no longer sells funding, and still signs the Charter
    await page.evaluate(() => window.rugbyStore.getState().go('finances'))
    await page.waitForSelector('.tab-bar')
    await page.locator('.tab-bar button', { hasText: 'The Board' }).click()
    await page.waitForSelector('text=Board resolutions')
    ok(await page.locator('text=Board Injection (Small)').count() === 0,
      'the Boardroom sells no injections any more - the store does')
    await page.locator('.card', { hasText: "The Owner's Charter" }).locator('.btn.gold').click()
    await page.waitForSelector('text=The Charter is yours')
    await page.locator('button', { hasText: 'Sign the Charter for this save' }).click()
    await page.locator('button', { hasText: 'Sign it - there is no way back' }).click()
    await page.waitForSelector('text=The wage law no longer applies')
    const chartered = await page.evaluate(() => {
      const g = window.rugbyStore.getState().game
      return { uncapped: g.uncapped === true, news: g.news.some(n => n.k === 'news.charter') }
    })
    ok(chartered.uncapped && chartered.news, 'the save is uncapped and the ownership letter filed')
    ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
    await page.close()
  }

  // ---- 2c. the Editor is GONE, and stays gone -----------------------------
  // v1.1.0 sold an In-Game Editor here and this section bought and used it.
  // Removed on the owner's call (27 Aug, v1.1.3) before any store ever sold
  // one. The assertion flips: even with a till open and money on the table,
  // no Editor shelf renders and Game Status carries no Editor door - a
  // regression that quietly re-adds the product should fail loudly.
  say('\n--- 2c. the Editor stays removed, even with the till open')
  {
    const page = await openPage({ billing: true })
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    await startCareer(page)
    await openAbout(page)
    await page.locator('.btn.gold', { hasText: 'Open the Store' }).click()
    await page.waitForSelector('.content')
    ok(await page.locator('text=In-Game Editor').count() === 0,
      'the shop shelf offers no Editor')
    await page.evaluate(() => window.rugbyStore.getState().go('saves'))
    await page.waitForSelector('.content')
    ok(await page.locator('text=Open the Editor').count() === 0,
      'and Game Status has no Editor door')
    ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
    await page.close()
  }

  // ---- 3. a reinstall: the receipt is gone, the purchase is not ----------

  // ---- 2d. a store that is there but will not price anything -------------
  //
  // Owner, on v1.1.6: two screenshots, "Nothing was charged" and "There is no
  // store attached to this build". The shelf had looked completely normal
  // right up to the tap, because monetise.ts falls back to catalogue prices
  // so no row stands priceless. Both things are right on their own and
  // together they hid the fault. v1.1.9 makes the build say which prices are
  // its own guesses, before a tap is spent on finding out.
  say('\n--- 2d. a bridge attached to a store that will not answer')
  {
    const page = await openPage({ billing: true, deaf: true })
    await startCareer(page)
    await openAbout(page)
    await page.locator('.btn.gold', { hasText: 'Open the Store' }).click()
    await page.waitForSelector('.content')
    await page.waitForTimeout(400)
    const till = await page.locator('.content').innerText()
    ok(/named no products/i.test(till), 'the shelf says out loud that the store named no products')
    ok(/guide prices/i.test(till), 'and that the figures on it are guides, not the store\'s')
    // v1.1.10: it must NOT tell somebody to install from the store when they
    // already did - the owner hit exactly that, on a Play build, twice
    ok(!/installed from the store/i.test(till),
      'and does not send a Play install back to the store it came from')
    ok(/£0\.99/.test(till), 'the rows still carry a price, so nothing stands blank')
    ok(!/£2\.99/.test(till), "and none of them is the store's, because it never gave one")
    await page.close()
  }


  // ---- 2e. a store that opens, prices, and then will not sell -------------
  //
  // Owner, on v1.1.9: "all show products - nothing is charged is still coming
  // up". Every ending that was not a clean purchase used to read "Nothing was
  // charged." - the line for somebody who pressed Back - so a store refusing
  // outright and a customer changing his mind were the same sentence. This
  // holds the shelf to naming a refusal, and to repeating the store's own
  // words for it.
  say('\n--- 2e. a store that prices happily and then refuses the sale')
  {
    const page = await openPage({ billing: true, refuse: true })
    await startCareer(page)
    await openAbout(page)
    await page.locator('.btn.gold', { hasText: 'Open the Store' }).click()
    await page.waitForSelector('.content')
    await page.locator('.btn.gold', { hasText: 'Buy' }).first().click()
    await page.waitForTimeout(600)
    const till = await page.locator('.content').innerText()
    ok(/would not open a purchase/i.test(till), 'the shelf says the store refused, not that you cancelled')
    ok(/not active yet|licence-testing/i.test(till), 'and names the two things worth checking')
    ok(/item unavailable/i.test(till), "with the store's own words carried through for diagnosis")
    await page.close()
  }

  say('\n--- 3. a new phone, or a reinstall')
  {
    const page = await openPage({ billing: true, owns: ['phase.supporter'] })
    await page.goto('http://localhost:4209/')
    await page.waitForSelector('.title-screen')
    // the boot restore runs without being asked (src/main.tsx)
    await page.waitForTimeout(900)
    ok(await page.locator('.supporter-mark').count() === 1,
      'the purchase is restored at boot, without anybody tapping anything')
    await page.close()
  }

  // ---- 4. advertising, where a provider is attached ----------------------
  say('\n--- 4. an ad provider, attached')
  {
    const page = await openPage({ ads: true })
    await startCareer(page)
    const slots = await page.locator('.ad-slot').count()
    ok(slots === 1, `the dashboard draws exactly one declared slot (${slots})`)
    ok(await page.getAttribute('.ad-slot', 'data-ad') === 'home-foot',
      'and it is the one the code declares, filled by the provider')
    // nowhere near a decision: the slot is the last thing on the page
    const box = await page.evaluate(() => {
      const ad = document.querySelector('.ad-slot')
      const cards = [...document.querySelectorAll('.card')]
      const last = cards[cards.length - 1]
      return { ad: ad?.getBoundingClientRect().top ?? 0, last: last?.getBoundingClientRect().top ?? 0 }
    })
    ok(box.ad >= box.last, 'below every card on the screen, not between them')
    await page.close()
  }

  // ---- 5. and a supporter never sees one --------------------------------
  say('\n--- 5. a supporter, with a provider attached')
  {
    const page = await openPage({ ads: true })
    await page.addInitScript(() => localStorage.setItem('rm-ent', 'supporter'))
    await startCareer(page)
    ok(await page.locator('.ad-slot').count() === 0, 'no slot is rendered at all for somebody who has paid')
    await page.close()
  }
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nSTORE PROBE FAILED (${fails})` : '\nSTORE PROBE PASSED: no till in the web build, a working one in a packaged build, and nothing in between')
done(fails)
