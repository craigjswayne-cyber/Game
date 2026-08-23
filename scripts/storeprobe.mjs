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
const openPage = async ({ billing = false, ads = false, owns = [] } = {}) => {
  const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
  if (billing) {
    await page.addInitScript(([owned]) => {
      let bought = false
      globalThis.rmBilling = {
        details: async (sku) => ({ sku, price: '£2.99' }),
        buy: async () => { bought = true; return 'owned' },
        owned: async () => (bought ? ['phase.supporter'] : owned),
      }
    }, [owns])
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
    ok(!/Support the game/i.test(about), 'with no purchase door, because there is no store behind it')
    ok(await page.locator('a[href="./privacy.html"]').count() === 1, 'the privacy policy is one tap away')
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

  // ---- 2. a packaged build: the door, the purchase, the mark -------------
  say('\n--- 2. a bridge attached, as a wrapper injects one')
  {
    const page = await openPage({ billing: true })
    const errs = []
    page.on('pageerror', e => errs.push(e.message))
    await startCareer(page)
    await openAbout(page)
    ok(await page.locator('.content').innerText().then(t => /Support the game/i.test(t)),
      'the About page grows a Supporter card')
    await page.locator('.btn.gold', { hasText: 'Have a look' }).click()
    await page.waitForSelector('.content')
    const till = await page.locator('.content').innerText()
    ok(/£2\.99/.test(till), "the price shown is the store's own")
    ok(/no budget|no player|nothing/i.test(till), 'the page says what the money does not buy')

    await page.locator('.btn.gold', { hasText: '£2.99' }).click()
    await page.waitForTimeout(600)
    ok(await page.locator('.content').innerText().then(t => /Thank you/i.test(t)),
      'a completed purchase is acknowledged on screen')
    ok(await page.locator('.content').innerText().then(t => /already have this/i.test(t)),
      'and the page turns into a receipt')

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

  // ---- 3. a reinstall: the receipt is gone, the purchase is not ----------
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
