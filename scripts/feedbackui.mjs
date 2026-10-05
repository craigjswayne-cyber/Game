// Probe: the feedback report card, in a real browser, against the real build
// (game/usage.ts, ui/FeedbackPrompt.tsx).
//
// scripts/feedbackprobe.ts holds the counters and the report text. This holds
// what a player meets: the card comes once, on Home, after the first month of
// a career; never during a match and never in the same match flow as a Pro
// Manager card; it shows the whole report; Email is a mailto to the studio,
// Copy puts the report on the clipboard, Not now puts it away in one tap and
// it does not come back by itself; Report a Bug opens it again any time.
//
// Automated browsers do not get the automatic card (FeedbackPrompt.tsx, the
// same rule as the opening titles), so this asks for it with ?feedback=1. A
// store and an advert bridge are stubbed, as proprompt.mjs does, wherever a
// Pro card has to be able to fire.
//
//   A  the web build (no Pro): four in-game weeks in, the card; its contents, its
//      buttons, the clipboard, Not now, no return, the permanent row, Back
//   B  a Pro reminder is due when the month is up: the Pro card goes first,
//      the feedback card waits for the next match flow
//   C  due, but on the match preview and during a live match: no card; and
//      without ?feedback=1 an automated browser never gets one
//
// Run: node scripts/feedbackui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const PORT = process.env.PORT ?? '4281'
const BASE = `http://localhost:${PORT}/`
const ON = `${BASE}?feedback=1`

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function phone({ store = false, pro = null, use = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, locale: 'en-GB',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  await ctx.addInitScript(([store, pro, use]) => {
    if (!sessionStorage.getItem('__booted')) {
      sessionStorage.setItem('__booted', '1')
      localStorage.setItem('rm-night', '1')
      if (pro) localStorage.setItem('rm-pro', JSON.stringify(pro))
      if (use) localStorage.setItem('rm-use', JSON.stringify(use))
    }
    if (store) {
      const prices = { 'phase.supporter': '£1.99', 'phase.supporter.intro': '£1.49' }
      const prod = (sku) => prices[sku] ? { sku, price: prices[sku] } : null
      globalThis.rmBilling = {
        details: async (sku) => prod(sku),
        detailsMany: async (skus) => skus.map(prod).filter(Boolean),
        buy: async () => 'cancelled',
        reason: () => null,
        owned: async () => [],
        consume: async () => ({ ok: true }),
      }
      globalThis.rmAds = { mount: (el, place) => { el.setAttribute('data-ad', place) }, unmount: () => {}, showRewarded: async () => 'skipped' }
    }
  }, [store, pro, use])
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  return { ctx, page, errs }
}

async function startCareer(page, url = ON) {
  await page.goto(url)
  await page.locator('text=New Career').or(page.locator('.bottom-nav')).first().waitFor()
  await page.waitForTimeout(1200)
  if (await page.evaluate(() => !!window.rugbyStore.getState().game)) await page.evaluate(() => window.rugbyStore.getState().toTitle())
  await page.waitForSelector('text=RUGBY')
  await page.evaluate(() => window.rugbyStore.getState().setLang('en'))
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer Probe')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor({ timeout: 20000 })
  if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')
}

const use = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rm-use') ?? 'null'))
const fbCard = async (page, ms = 3500) => {
  try { await page.waitForSelector('.fb-card', { timeout: ms }); return true } catch { return false }
}
const proCard = async (page, ms = 3000) => {
  try { await page.waitForSelector('.pro-card', { timeout: ms }); return true } catch { return false }
}
const home = (page) => page.evaluate(() => window.rugbyStore.getState().home())
const both = (page) => page.evaluate(() => !!document.querySelector('.fb-card') && !!document.querySelector('.pro-card'))

/** Drive to the end of the manager's next match and land on Home. Returns
 *  the competition id, or 'card' if either card opened on the way. */
async function playOne(page) {
  const out = await page.evaluate(async () => {
    const s = window.rugbyStore
    for (let guard = 0; guard < 600; guard++) {
      if (document.querySelector('.fb-card, .pro-card')) return 'card'
      const st = s.getState()
      for (const o of st.game.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
      for (const q of st.game.press) q.answered = true
      s.setState({ lastAdvanceAt: 0 })
      const screen = st.nav[st.nav.length - 1]?.screen
      if (screen === 'annual') { st.game.annual = undefined; st.touch(); st.back(); continue }
      if (st.liveMatch || screen === 'matchday') {
        st.instantResult()
        const top = s.getState().nav[s.getState().nav.length - 1]
        return top?.screen === 'results' ? String(top.param).split(':')[0] : 'none'
      }
      st.continueWeek()
      await new Promise(r => setTimeout(r, 5))
    }
    return 'stuck'
  })
  if (out !== 'card') await home(page)
  return out
}

/** Play the rest of this in-game week, the manager's match included if it
 *  falls in it, and land on Home in the next. Returns the new week, or
 *  'card' if either card opened on the way. */
async function playWeek(page) {
  const out = await page.evaluate(async () => {
    const s = window.rugbyStore
    const from = `${s.getState().game.season}:${s.getState().game.week}`
    for (let guard = 0; guard < 300; guard++) {
      if (document.querySelector('.fb-card, .pro-card')) return 'card'
      const st = s.getState()
      if (`${st.game.season}:${st.game.week}` !== from) return st.game.week
      for (const o of st.game.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
      for (const q of st.game.press) q.answered = true
      s.setState({ lastAdvanceAt: 0 })
      const screen = st.nav[st.nav.length - 1]?.screen
      if (screen === 'annual') { st.game.annual = undefined; st.touch(); st.back(); continue }
      if (st.liveMatch || screen === 'matchday') { st.instantResult(); continue }
      st.continueWeek()
      await new Promise(r => setTimeout(r, 5))
    }
    return 'stuck'
  })
  if (out !== 'card') await home(page)
  return out
}

try {
  // ---- A ---------------------------------------------------------------------
  say('--- A: the web build, a month in')
  {
    const { ctx, page, errs } = await phone()
    await startCareer(page)
    ok(!(await fbCard(page, 2500)), 'no card at the start of a career')
    const start = await page.evaluate(() => window.rugbyStore.getState().game.week)
    let shownAt = null
    for (let i = 0; i < 8 && shownAt == null; i++) {
      const w = await playWeek(page)
      if (w === 'stuck') { ok(false, 'the drive got stuck'); break }
      if (w === 'card') { ok(false, 'a card opened mid-drive, off Home'); break }
      if (await fbCard(page)) shownAt = await page.evaluate(() => { const st = window.rugbyStore.getState(); return { week: st.game.week, screen: st.nav.at(-1).screen } })
      else ok(w - start < 4, `no card ${w - start} week${w - start === 1 ? '' : 's'} in`)
    }
    const u = await use(page)
    say(`  career began in week ${start}; card in week ${shownAt?.week} (${u?.weeks} weeks, ${u?.matches} competitive matches on the device)`)
    ok(!!shownAt && shownAt.screen === 'home', 'the card opens on Home')
    ok(shownAt && shownAt.week === start + 4 && u.weeks === 4, `four in-game weeks in, the first month (week ${shownAt?.week})`)
    ok(u.offered === true && u.offeredAt === u.matches, 'and the device ledger records it was offered, in this match flow')

    const text = await page.locator('.fb-card').innerText()
    const report = await page.locator('.fb-card .fb-report').textContent()
    ok(/Help shape the game/.test(text) && /Nothing is sent unless you send it/.test(text), 'it says plainly what it is and that nothing is sent')
    ok(/FEEDBACK REPORT/.test(report) && /SCREENS OPENED/.test(report) && /NEVER OPENED/.test(report) && /ACTIONS/.test(report), 'the whole report is on screen')
    ok(/platform\s+web/.test(report) && /weeks\s+4\n/.test(report) && /device\s+phone/.test(report) && /game\s+men's/.test(report), 'with the device lines')
    ok(!/Gaffer|Leicester|Tigers/.test(report), 'and no manager or club name in it')
    const href = await page.locator('.fb-card a.fb-btn').getAttribute('href')
    ok(href.startsWith('mailto:info@fwdsandbcks.com'), `Email is a mailto to the studio (${href.slice(0, 40)})`)
    ok(decodeURIComponent(href).includes('subject=PHASE: Rugby Manager - feedback report') && decodeURIComponent(href).includes('FEEDBACK REPORT'),
      'with the subject and the report filled in')
    const disc = await page.locator('.fb-card a.fb-discord').getAttribute('href')
    ok(/^https:\/\/discord\.gg\//.test(disc ?? '') && /#feedback/.test(text), 'the Discord #feedback line links the community server')
    const b = await page.locator('.fb-card .fb-btn').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, t: e.textContent.trim() } }))
    ok(b.length === 3 && b.every(x => x.h >= 44) && b.every(x => Math.abs(x.w - b[0].w) < 1) && b.every(x => Math.abs(x.h - b[0].h) < 1),
      `Email, Copy and Not now are the same size, 44px or more (${b.map(x => `${x.t} ${Math.round(x.w)}x${Math.round(x.h)}`).join(', ')})`)
    const fit = await page.evaluate(() => {
      const r = document.querySelector('.fb-card').getBoundingClientRect()
      const btns = [...document.querySelectorAll('.fb-card .fb-btn')].every(e => { const q = e.getBoundingClientRect(); return q.bottom <= innerHeight && q.top >= 0 })
      return { inside: r.left >= 0 && r.right <= innerWidth, side: document.documentElement.scrollWidth <= innerWidth, btns }
    })
    ok(fit.inside && fit.side, 'the card is inside the screen, no sideways scroll')
    ok(fit.btns, 'and all three buttons are on screen without scrolling')
    ok(!(await both(page)), 'no Pro card with it')

    await page.locator('.fb-card button', { hasText: 'Copy' }).click()
    await page.waitForSelector('.fb-card .pro-msg')
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    ok(clip === report, `Copy puts the whole report on the clipboard (${clip.length} chars)`)
    ok(/Copied/.test(await page.locator('.fb-card .pro-msg').innerText()), 'and says so')

    await page.locator('.fb-card button', { hasText: 'Not now' }).click()
    await page.waitForTimeout(250)
    ok(await page.locator('.fb-card').count() === 0, 'Not now closes it in one tap')
    await page.evaluate(() => window.rugbyStore.getState().go('fixtures'))
    await home(page)
    ok(!(await fbCard(page, 3000)), 'it does not come back on the next visit to Home')
    for (let i = 0; i < 2; i++) await playOne(page)
    ok(!(await fbCard(page, 3000)), 'nor after more matches')

    // the permanent row
    await page.evaluate(() => window.rugbyStore.getState().go('bug'))
    await page.waitForSelector('.fb-open')
    await page.locator('.fb-open').click()
    ok(await fbCard(page, 2000), 'Report a Bug opens it again any time')
    const report2 = await page.locator('.fb-card .fb-report').textContent()
    ok(/Report a bug \d/.test(report2) && /weeks\s+([5-9]|\d\d)\n/.test(report2), 'an updated report: the bug page and the later weeks counted')
    const side = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    ok(side, 'no sideways scroll on the bug page with the card open')
    await page.goBack()
    await page.waitForTimeout(300)
    const top = await page.evaluate(() => window.rugbyStore.getState().nav.at(-1).screen)
    ok(await page.locator('.fb-card').count() === 0 && top === 'bug', `Back puts the card away and stays on the page (${top})`)
    await page.locator('.fb-open').click()
    await page.locator('.fb-card button', { hasText: 'Not now' }).click()
    ok(await page.locator('.fb-card').count() === 0, 'and Not now closes it there too')
    ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
    await ctx.close()
  }

  // ---- B ---------------------------------------------------------------------
  say('--- B: a Pro reminder is due when the month is up: it goes first, the feedback card waits')
  {
    // a reminder already due (played 3, remindAt 3), and the month already up
    const pro = { v: 1, firstPromptShown: true, firstOfferShown: true, firstOfferAccepted: false, firstOfferDeclined: true, played: 3, offerDueAt: 1, remindAt: 3, lastShownAt: 1, seen: [] }
    const seed = { v: 1, screens: {}, acts: {}, matches: 3, weeks: 6, lastWeek: 'x', seasons: 1, lastSeason: 'x', seen: [], offered: false, offeredAt: -1 }
    const { ctx, page, errs } = await phone({ store: true, pro, use: seed })
    await startCareer(page)
    const p1 = await proCard(page, 4000)
    await page.waitForTimeout(2500)
    ok(p1 && await page.locator('.fb-card').count() === 0, 'a Pro reminder is due: the Pro card, and no feedback card with it')
    if (p1) await page.locator('.pro-card button', { hasText: 'Continue Free' }).click()
    await page.waitForTimeout(250)
    ok(!(await fbCard(page, 3500)), 'nor once the Pro card is put away: same match flow')
    await page.evaluate(() => window.rugbyStore.getState().go('fixtures'))
    await home(page)
    ok(!(await fbCard(page, 3000)), 'nor on the next visit to Home in that flow')
    const u = await use(page)
    ok(!u.offered, 'still due')
    let c = await playOne(page)
    while (c === 'fr') c = await playOne(page)
    const f2 = await fbCard(page, 4000)
    await page.waitForTimeout(1500)
    ok(f2 && await page.locator('.pro-card').count() === 0, `the next match flow (${c}): the feedback card, alone`)
    if (f2) await page.locator('.fb-card button', { hasText: 'Not now' }).click()
    await page.waitForTimeout(250)
    ok(!(await proCard(page, 3000)), 'and no Pro card follows it in that flow')
    ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
    await ctx.close()
  }

  // ---- C ---------------------------------------------------------------------
  say('--- C: never on the match preview or during a match; never for a harness that did not ask')
  {
    const { ctx, page } = await phone({ use: { v: 1, screens: {}, acts: {}, matches: 0, weeks: 0, lastWeek: '', seasons: 0, lastSeason: '', seen: [], offered: false, offeredAt: -1 } })
    await startCareer(page)
    await page.evaluate(async () => {
      const s = window.rugbyStore
      for (let g = 0; g < 300; g++) {
        const st = s.getState(); const screen = st.nav[st.nav.length - 1]?.screen
        if (screen === 'matchday') return
        for (const q of st.game.press) q.answered = true
        s.setState({ lastAdvanceAt: 0 }); st.continueWeek()
        await new Promise(r => setTimeout(r, 5))
      }
    })
    await page.evaluate(() => localStorage.setItem('rm-use', JSON.stringify({ v: 1, screens: {}, acts: {}, matches: 0, weeks: 4, lastWeek: 'x', seasons: 1, lastSeason: 'x', seen: [], offered: false, offeredAt: -1 })))
    await page.evaluate(() => window.rugbyStore.setState(s => ({ tick: s.tick + 1 })))
    ok(!(await fbCard(page, 3000)), 'due, but not on the match preview')
    await page.evaluate(() => window.rugbyStore.getState().kickOff())
    await page.waitForTimeout(3000)
    ok(await page.evaluate(() => !!window.rugbyStore.getState().liveMatch) && await page.locator('.fb-card').count() === 0, 'nor during a live match')
    await ctx.close()
  }
  {
    const { ctx, page } = await phone({ use: { v: 1, screens: {}, acts: {}, matches: 0, weeks: 4, lastWeek: 'x', seasons: 1, lastSeason: 'x', seen: [], offered: false, offeredAt: -1 } })
    await startCareer(page, BASE)
    ok(!(await fbCard(page, 3500)), 'an automated browser without ?feedback=1 never gets the automatic card')
    await ctx.close()
  }
} catch (e) {
  fails++
  say('FAIL  threw: ' + String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
} finally {
  await browser.close()
  server.stop()
}
say(fails ? `FEEDBACK UI: ${fails} FAIL` : 'FEEDBACK UI PASSED')
process.exit(fails ? 1 : 0)
