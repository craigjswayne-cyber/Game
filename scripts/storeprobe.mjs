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
const openPage = async ({ billing = false, ads = false, owns = [], deaf = false, refuse = false, hang = null } = {}) => {
  const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
  if (billing) {
    await page.addInitScript(([owned, mute, refuse, hang]) => {
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
          // `hang` is a store that takes the tap and NEVER ANSWERS - the
          // shape of a wedged Digital Goods service. It is not a rejection,
          // so nothing catches it and no `finally` ever runs; this is what
          // killed the whole shelf in v1.2.0 and it is now a test.
          if (hang && sku === hang) return new Promise(() => {})
          if (refuse) { why = 'AbortError: item unavailable'; return 'refused' }
          bought.add(sku); return 'owned'
        },
        reason: () => why,
        owned: async () => [...new Set([...owned, ...bought])],
        consume: async (sku) => { bought.delete(sku) },
      }
    }, [owns, deaf, refuse, hang])
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
    // THE STORE'S OWN PRICE MUST NOT REACH THE SHELF (v1.2.3).
    //
    // This line asserted the opposite until now - that £2.99, the figure the
    // fake bridge above answers details() with, WAS printed on the row. That
    // was the v1.1.17 contract: show a price, but only ever one the store
    // itself named, never a figure of our own invention.
    //
    // The owner replaced that contract: "we said we would remove prices from
    // being shown on the store and across the game - just a buy button. make
    // sure this happens." So the assertion is inverted rather than deleted,
    // and it is STRICTER than what it replaces: before, a missing price was
    // a pass whenever the bridge stayed quiet; now a price is a failure even
    // when the bridge is shouting one. The payment sheet quotes the figure,
    // in the currency of whoever is holding the phone, and nothing else does.
    ok(!/£2\.99/.test(till), "the store's own price is not printed on the shelf")
    ok(!/not named its prices|has not answered|answered for \d+ of|named no products|guide prices/i.test(till),
      'and the shelf says nothing about its health, because there is nothing wrong with it')
    for (const row of ['Support the game', 'Full Fitness', 'The International Stage', 'The Estate', 'Remove the salary cap', 'Board funding']) {
      ok(till.includes(row), `the ${row} row is on the shelf`)
    }
    ok(!/Remove all ads/i.test(till),
      'and NO Remove-all-ads row, because this build ships no ads to remove')
    ok(!/what it does not do/i.test(till), 'the essays are gone - each product is one line')

    // buy Support the game from its row. v1.1.12: this is a TIP JAR now
    // (owner: "it should be repeatable at any point"), so the row does not
    // turn into a receipt - it thanks you and stays buyable, and the count
    // goes up every time.
    await page.locator('.card', { hasText: 'Support the game' }).locator('.btn.gold').click()
    await page.waitForTimeout(600)
    const after = await page.locator('.card', { hasText: 'Support the game' }).innerText()
    ok(/Thank you/i.test(after), 'a completed thank-you is acknowledged in words')
    ok(!/Yours/.test(after), 'and the row does NOT become a receipt - a tip jar takes more than one coin')
    await page.locator('.card', { hasText: 'Support the game' }).locator('.btn.gold').click()
    await page.waitForTimeout(600)
    ok(await page.locator('.card', { hasText: 'Support the game' }).innerText().then(x => /2/.test(x)),
      'and a second coin goes in, counted')
    ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
    await page.close()
  }

  // ---- 2c. ONE STUCK ROW IS ONE STUCK ROW ------------------------------
  // Owner, v1.2.1: "i clicked support the game and it made other options
  // unclickable, please check all payment options... I dont want issues with
  // payments." The shelf held ONE busy flag for every product, so any tap
  // disabled every other Buy button and the Restore button under them. A
  // purchase that resolves puts the flag back down; one that never answers
  // does not, and the whole store stays dead until the screen is left.
  //
  // The store here hangs on Support the game and answers normally for
  // everything else, which is the reported fault exactly.
  say('\n--- 2c. a purchase that never answers holds its own row and no other')
  {
    const page = await openPage({ billing: true, hang: 'phase.license' })
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    await startCareer(page)
    await openAbout(page)
    await page.locator('.btn.gold', { hasText: 'Open the Store' }).click()
    await page.waitForSelector('.content')

    const jar = page.locator('.card', { hasText: 'Support the game' }).locator('.btn.gold')
    const heal = page.locator('.card', { hasText: 'Full Fitness' }).locator('.btn.gold')
    await jar.click()
    await page.waitForTimeout(900) // long past any honest round trip

    ok(await jar.isDisabled(), 'the row that is waiting on the store holds its own button')
    // and it SAYS it is waiting. A dimmed "Buy" with no other sign is what the
    // owner read as "Buy function isnt working" on a slow Play service
    // (v1.2.3, live) - twelve seconds of grey, nothing to read.
    ok(/Asking the store/i.test(await jar.innerText()), `while it waits the button says so ("${(await jar.innerText()).trim()}")`)
    ok(/^Buy$/.test((await heal.innerText()).trim()), 'and a row that is NOT waiting still just says Buy')
    ok(await heal.isEnabled(), 'and every other row stays live while it waits')
    const restore = page.locator('.btn.ghost', { hasText: /Restore/i })
    ok(await restore.isEnabled(), 'so does Restore, which is how a stuck receipt gets rescued')

    // and it is not merely enabled-looking: it takes the money
    await heal.click()
    await page.waitForTimeout(900)
    const healRow = await page.locator('.card', { hasText: 'Full Fitness' }).innerText()
    ok(!/Nothing was charged|could not be reached/i.test(healRow),
       'a second product still sells while the first is stuck')
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

    // ---- AND THE ROW STILL LOOKS LIKE A ROW AFTERWARDS --------------------
    //
    // Owner, v1.1.12: "sugar daddy money formatting goes weird after
    // purchasing." The money was never wrong. The SOLD-OUT state was a
    // fifty-one character sentence in a `flexShrink: 0` chip, so the flex row
    // gave it everything and squeezed the title column to nothing: "The Sugar
    // Daddy" came out one word per line down the left of the card with the
    // sentence floating over it. It only ever appeared after a purchase, which
    // is exactly why it read as a consequence of buying - and why the first
    // fix went to the number formatter instead.
    //
    // So the claim is geometric, on the state that produced it: spend every
    // resolution, then measure that each title still has a column to live in.
    await page.evaluate(() => {
      const st = window.rugbyStore.getState(); const g = st.game
      g.injections = { s: 9, m: 9, l: 9, xl: 9 }
      st.touch()
    })
    await page.waitForTimeout(300)
    const rows = await page.evaluate(() => {
      const out = []
      for (const label of ['Board Injection (Small)', 'Board Injection (Medium)', 'Board Injection (Large)', 'The Sugar Daddy']) {
        const el = [...document.querySelectorAll('div')].find(d => d.textContent.trim() === label)
        if (!el) continue
        const card = el.closest('.card')
        out.push({
          label,
          w: Math.round(el.getBoundingClientRect().width),
          cardW: Math.round(card.getBoundingClientRect().width),
          h: Math.round(el.getBoundingClientRect().height),
        })
      }
      return out
    })
    console.log(`  sold-out rows: ${rows.map(r => `${r.label} ${r.w}/${r.cardW}px h${r.h}`).join(' | ')}`)
    ok(rows.length === 4, `all four resolutions still render when spent (${rows.length})`)
    ok(rows.every(r => r.w > r.cardW * 0.5),
      `every title keeps a column to live in${rows.filter(r => r.w <= r.cardW * 0.5).map(r => ` [${r.label} ${r.w}px]`).join('')}`)
    ok(rows.every(r => r.h < 60),
      `and none of them wraps into a tower${rows.filter(r => r.h >= 60).map(r => ` [${r.label} ${r.h}px tall]`).join('')}`)
    ok(await page.locator('text=The owners will not go to the well again').count() > 0,
      'with the sold-out line still said, just not in a chip that cannot shrink')

    // ---- WHAT YOU CAN STILL BUY IS AT THE TOP ------------------------------
    //
    // Owner, v1.1.13: "when you purchase anything in the store it should move
    // to the bottom of the store so the available products are at the top."
    // Three owned rows had collected up top - the International Stage, the
    // Estate and the Charter - pushing Board funding, the one thing still
    // buyable, below the fold on a phone.
    //
    // `done` is not "owned": a Charter you own but have not applied to this
    // career still has a button on it and stays up top. So the claim is about
    // the boundary, not about ownership - once the shelf is sorted, nothing
    // finished appears above anything unfinished.
    await page.evaluate(() => {
      const st = window.rugbyStore.getState(); const g = st.game
      g.uncapped = true       // Charter: owned and applied - nothing left to do
      g.estateMaxed = true    // Estate: same
      g.injections = { s: 9, m: 9, l: 9, xl: 9 }  // funding: spent for the season
      st.touch()
    })
    await page.waitForTimeout(300)
    const order = await page.evaluate(() => {
      const done = ['Remove the salary cap', 'The Estate', 'Board funding']
      const live = ['Support the game', 'Full Fitness']
      const tops = [...document.querySelectorAll('.card')]
      const at = (label) => {
        const i = tops.findIndex(c => c.textContent.includes(label))
        return { label, i }
      }
      return { done: done.map(at), live: live.map(at) }
    })
    console.log(`  shelf order: ${[...order.live, ...order.done].sort((a, b) => a.i - b.i).map(x => `${x.label}(${x.i})`).join(' < ')}`)
    const lastLive = Math.max(...order.live.map(x => x.i))
    const firstDone = Math.min(...order.done.map(x => x.i))
    ok(order.live.every(x => x.i >= 0) && order.done.every(x => x.i >= 0),
      'every row is still on the shelf after the sort')
    ok(firstDone > lastLive,
      `nothing finished sits above anything still buyable (last buyable ${lastLive}, first finished ${firstDone})`)
    // and put the career back, because the Boardroom section below signs the
    // Charter for real and cannot do it on a save this block already uncapped
    await page.evaluate(() => {
      const st = window.rugbyStore.getState(); const g = st.game
      g.uncapped = false
      g.estateMaxed = false
      g.injections = {}
      st.touch()
    })
    await page.waitForTimeout(200)

    // the Boardroom no longer sells funding, and still signs the Charter
    await page.evaluate(() => window.rugbyStore.getState().go('finances'))
    await page.waitForSelector('.tab-bar')
    await page.locator('.tab-bar button', { hasText: 'The Board' }).click()
    await page.waitForSelector('text=Board resolutions')
    ok(await page.locator('text=Board Injection (Small)').count() === 0,
      'the Boardroom sells no injections any more - the store does')
    await page.locator('.card', { hasText: 'Remove the salary cap' }).locator('.btn.gold').click()
    await page.waitForSelector('text=You own this')
    await page.locator('button', { hasText: 'Remove it on this save' }).click()
    await page.locator('button', { hasText: 'Remove it - there is no way back' }).click()
    await page.waitForSelector('text=The wage law no longer applies')
    const chartered = await page.evaluate(() => {
      const g = window.rugbyStore.getState().game
      return { uncapped: g.uncapped === true, news: g.news.some(n => n.k === 'news.charter') }
    })
    ok(chartered.uncapped && chartered.news, 'the save is uncapped and the ownership letter filed')
    ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
    await page.close()
  }

  // ---- 2d. the Editor is GONE, and stays gone -----------------------------
  // v1.1.0 sold an In-Game Editor here and this section bought and used it.
  // Removed on the owner's call (27 Aug, v1.1.3) before any store ever sold
  // one. The assertion flips: even with a till open and money on the table,
  // no Editor shelf renders and Game Status carries no Editor door - a
  // regression that quietly re-adds the product should fail loudly.
  say('\n--- 2d. the Editor stays removed, even with the till open')
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
    // v1.1.18: the banner stopped claiming "nothing here can be bought yet" -
    // the owner bought five things directly underneath that sentence.
    // v1.2.4: it stopped talking about PRICES too. The game shows none any
    // more, so "has not named its prices" described a symptom nobody could
    // see; the owner's own words were "why is it showing?". It now says the
    // one thing it knows - the store has not answered - and the one thing
    // that is still true: the store's own sheet opens before a penny moves.
    ok(/has not answered/i.test(till), 'the shelf says out loud that the store has not answered')
    ok(/sheet opens before anything is charged/i.test(till),
      'and promises what is still true: the sheet opens before a penny moves')
    ok(!/price/i.test(till), 'and says nothing about prices, because the game shows none')
    ok(!/nothing here can be bought/i.test(till),
      'and never claims the shelf is unbuyable - unanswered is all it actually knows')
    // v1.1.10: it must NOT tell somebody to install from the store when they
    // already did - the owner hit exactly that, on a Play build, twice
    ok(!/installed from the store/i.test(till),
      'and does not send a Play install back to the store it came from')
    // THE OPPOSITE CLAIM TO THE ONE THIS USED TO MAKE, and deliberately.
    //
    // v1.1.5 put a catalogue price on every button so no row stood blank, and
    // v1.1.14 took it off again, because the fallback told a lie with real
    // money behind it: the owner's shelf read "Buy - £0.99" while Play charged
    // £1.19, the same product with UK VAT on top of a tax-exclusive Console
    // price. Our figure and the store's figure looked identical on the row and
    // were not, and there is no way for a player to tell which he is reading.
    // So a price on a button meant the STORE named it, always - and from
    // v1.2.3 there is no price on a button at all, in any state of the world
    // ("just a buy button"). This assertion was written for the case where
    // the store stays silent and is now simply the rule everywhere; section 2
    // above holds the same line against a store that IS naming prices.
    // A REAL-MONEY price, not any pound sign: this shelf is full of the game's
    // own money - "+£25m to the transfer budget", "£10m to £130m" - and those
    // are the product, not the price of it. Every catalogue price is pounds and
    // pence (£0.99, £9.99), which is a shape the game's millions never take.
    const priced = till.match(/£\d+\.\d\d\b/g) ?? []
    ok(priced.length === 0,
      `and NOT ONE price is on the shelf, because every figure here would be ours rather than the store's (${priced.join(', ') || 'none'})`)
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
