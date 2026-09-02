/**
 * ---- WHAT THE TILL SHOWS, AND WHAT IT THANKS YOU FOR ----
 *
 * Two v1.2.3 changes that both live entirely in what a player SEES, which is
 * the kind that no engine probe can reach:
 *
 *   1. NO PRICE, ANYWHERE. "we said we would remove prices from being shown
 *      on the store and across the game - just a buy button. make sure this
 *      happens." moneyprobe holds the SOURCE to that rule (no screen may read
 *      skuPriceFrom, no dictionary may carry a priced label); this holds the
 *      rendered page to it, which is the thing the owner actually looked at.
 *
 *   2. THE SUPPORTERS CLUB. Support the game grants nothing on purpose, so
 *      until now the only acknowledgement was a line in the store that
 *      scrolled away. "on the manager profile a little section that has a
 *      crown emoji with PHASE supporters club - X donations. Thank you!"
 *
 * Its own reader, deliberately. The back page shipped in v1.2.2 with a
 * literal {n} on the owner's phone and a green suite behind it, because it
 * rendered through a path - state.backPage - that no probe walked. A feature
 * with its own render path needs its own reader.
 *
 * Run: node scripts/tillface.mjs   (needs a fresh npm run build)
 */
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4223', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`); if (!c) fails++ }
const say = (s) => console.log(s)

/** The figure the fake store below offers. The game must never print it.
 *
 *  Checking for "a currency symbol near digits" instead was the first cut of
 *  this, and it was wrong: the game is FULL of money that is not a price -
 *  board funding runs £10m to £130m, wages are quoted in £30.1k - and the
 *  scan reported all of it. What the owner asked to remove is the REAL-MONEY
 *  price, the one the store names. So the probe looks for exactly that string
 *  and nothing else, which no in-game figure can imitate.
 */
const OFFERED = '£2.99'

try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  // A STORE THAT DOES NAME A PRICE, so the check below is adversarial rather
  // than vacuous. The free web build has no bridge at all, the shelf never
  // renders, and "no button carries a figure" passes because there are no
  // buttons - which is a green tick measuring nothing. This bridge is the
  // shape a Play TWA wrapper has AND it answers details() with a real
  // currency string, exactly the figure the old build printed on the button.
  // Nothing in the game may show it.
  await page.addInitScript(() => {
    const bought = new Set()
    globalThis.rmBilling = {
      details: async (sku) => ({ sku, price: '£2.99' }),
      buy: async (sku) => { bought.add(sku); return 'owned' },
      reason: () => null,
      owned: async () => [...bought],
      consume: async (sku) => { bought.delete(sku) },
    }
  })
  await page.goto('http://localhost:4223/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })

  // ---- 1. the supporters club ----
  say('\n--- 1. the supporters club, on the manager profile')
  await page.evaluate(() => localStorage.setItem('rm-tips', '5'))
  await page.evaluate(() => window.rugbyStore.getState().start('northampton', 'Gaffer'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  await page.evaluate(() => window.rugbyStore.getState().go('profile'))
  await page.waitForTimeout(500)
  const club = page.locator('.supporters-club')
  ok(await club.count() === 1, 'five donations put the supporters club on the profile')
  const text = await club.innerText()
  say(`  "${text.replace(/\n/g, ' | ')}"`)
  ok(text.includes('👑'), 'it wears the crown the owner asked for')
  ok(/PHASE Supporters Club/i.test(text), 'it is named')
  ok(/\b5 donations\b/.test(text), 'it counts them, and pluralises')
  ok(/Thank you/i.test(text), 'and it says thank you')
  ok(!/\{|profile\./.test(text), 'nothing on it is a raw key or an unfilled hole')

  // one donation is ONE donation - the count is a plural form, not an "s"
  await page.evaluate(() => localStorage.setItem('rm-tips', '1'))
  await page.evaluate(() => window.rugbyStore.getState().go('home'))
  await page.waitForTimeout(200)
  await page.evaluate(() => window.rugbyStore.getState().go('profile'))
  await page.waitForTimeout(400)
  ok(/\b1 donation\b/.test(await page.locator('.supporters-club').innerText()),
    'and a single donation reads as one, not as "1 donations"')

  // ---- 2. absent when there is nothing to thank ----
  say('\n--- 2. and it is silent when nobody has given anything')
  await page.evaluate(() => localStorage.setItem('rm-tips', '0'))
  await page.evaluate(() => window.rugbyStore.getState().go('home'))
  await page.waitForTimeout(200)
  await page.evaluate(() => window.rugbyStore.getState().go('profile'))
  await page.waitForTimeout(400)
  ok(await page.locator('.supporters-club').count() === 0,
    'no donations, no card - a panel thanking you for nothing is worse than none')

  // ---- 3. no price on any button the game draws ----
  say('\n--- 3. the store quotes nothing: the payment sheet does that')
  for (const [lang, where] of [['en', 'English'], ['fr', 'French'], ['ja', 'Japanese']]) {
    await page.evaluate(l => localStorage.setItem('rm-lang', l), lang)
    await page.reload()
    await page.waitForTimeout(1400)
    await page.evaluate(() => window.rugbyStore.getState().go('supporter')).catch(() => {})
    await page.waitForTimeout(700)
    const body = await page.locator('.content').innerText()
    const hit = body.split('\n').find(l => l.includes(OFFERED))
    ok(!hit, `${where}: the store's own ${OFFERED} reaches no row on the page${hit ? ` - "${hit.trim().slice(0, 60)}"` : ''}`)
    const btns = await page.locator('.btn.gold').allInnerTexts()
    // the shelf must actually be on screen, or the next line proves nothing
    ok(btns.length >= 4, `${where}: the shelf rendered with its buy buttons (${btns.length})`)
    const priced = btns.find(b => b.includes(OFFERED))
    ok(!priced, `${where}: and not one of them carries it either${priced ? ` - "${priced}"` : ''}`)
  }

  // ---- 4. the shelf is a door, and it says what it is for ----
  //
  // Owner, v1.2.5, relaying a friend: "this needs to be more obvious - and an
  // 'Upgrade your team' next to store". The card on Home was one gold word on
  // a dark strip, which reads as a heading rather than a button.
  say('\n--- 4. the Store card on Home says what it is for')
  await page.evaluate(() => localStorage.setItem('rm-lang', 'en'))
  await page.reload()
  await page.waitForTimeout(1400)
  await page.evaluate(() => window.rugbyStore.getState().go('home')).catch(() => {})
  await page.waitForTimeout(600)
  const card = page.locator('.store-card')
  ok(await card.count() === 1, 'the Store card is on Home with a bridge attached')
  const sub = await card.locator('.store-sub').innerText().catch(() => '')
  ok(/Upgrade your team/i.test(sub), `and it carries the line the owner asked for ("${sub.trim()}")`)
  const edge = await card.evaluate(el => getComputedStyle(el).borderTopWidth)
  ok(edge !== '0px', `and it is edged all the way round, not just on the left (${edge})`)

  // ---- 5. Full Fitness says when it is next available ----
  //
  // Owner, v1.2.5: "I used full fitness and then tried to buy it again before
  // a game week. Can we have a bit that visibly says available after next game
  // week". healAtGames set to the current games-played is exactly the state
  // after a heal: not ready until one more match has been played.
  say('\n--- 5. a spent Full Fitness says so before anybody taps it')
  await page.evaluate(() => {
    const st = window.rugbyStore.getState(); const g = st.game
    g.healAtGames = (g.mgr?.m ?? 0)   // healReady: mgrGames(state) > healAtGames -> false
    st.go('supporter'); st.touch()
  })
  await page.waitForTimeout(600)
  const healRow = page.locator('.card', { hasText: 'Full Fitness' })
  ok(await healRow.count() >= 1, 'the Full Fitness row is on the shelf')
  const next = await healRow.locator('.heal-next').innerText().catch(() => '')
  ok(/after your next match/i.test(next), `and it states when it returns ("${next.trim()}")`)
  ok(await healRow.locator('.btn.gold').first().isDisabled(), 'with its Buy button disabled rather than live and silent')
  // and the Medical Centre door says the same thing instead of vanishing
  await page.evaluate(() => window.rugbyStore.getState().go('medical'))
  await page.waitForTimeout(500)
  const med = await page.locator('.content').innerText()
  ok(/after your next match/i.test(med), 'the Medical Centre carries the same line instead of hiding the row')

  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs[0] : ''}`)
  await page.close()
} finally { await browser.close(); server.stop() }
say(fails ? `\nTILL FACE FAILED (${fails})` : '\nTILL FACE PASSED: the store quotes nothing, says what it is for, and Full Fitness says when it is back')
process.exit(fails ? 1 : 0)
