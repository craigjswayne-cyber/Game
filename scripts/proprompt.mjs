// Probe: the Pro Manager cards, in a real browser, against the real build
// (1.8.6, docs/pro-manager.md).
//
// scripts/profunnelprobe.ts holds the cadence as arithmetic. This holds what
// a player actually meets: the cards appear at a safe moment and nowhere
// else, quote the store's own price, say "% OFF" only when it is true, and
// a purchase from one of them really makes the player Pro - or, cancelled,
// pending or refused, really does not.
//
// The store is the same injected bridge storeprobe and qa/purchasestate use
// (addInitScript, exactly how a shell attaches one), with an advert bridge
// beside it, because Pro Manager only has something to sell where adverts
// and the locked skins exist (store.ts proLocked).
//
//   A  declines the first card, plays, declines the one-time offer, and is
//      reminded at +10 and +20 competitive matches - friendlies do not count
//   B  accepts the first card: Pro at once, no further cards
//   C  declines, then takes the offer: the intro product is Pro
//   D  (the every-10 rhythm is A's tail here, and 60 matches in profunnelprobe)
//   E  cancels the sheet: stays free, and the cadence carries on
//   F  buys, reloads: still Pro, no cards
//   G  buys, reinstalls (fresh storage), restores: Pro again, intro or normal
//   H  a second career: Pro stays Pro; a free player's sees neither the first
//      card nor the offer again
//   +  intro product missing, the % OFF rule, a Pro owner, a pending sheet,
//      no card over a match, the tutorial or a modal, none on the web build
//
// It also saves the screenshots the owner asked for (each card at 360x800
// and 412x915, English and French) when SHOTS is set.
//
// Run: node scripts/proprompt.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync, writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const PORT = process.env.PORT ?? '4237'
const URL = `http://localhost:${PORT}/`
const SHOTS = process.env.SHOTS ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

const FRESH = { v: 1, firstPromptShown: false, firstOfferShown: false, firstOfferAccepted: false, firstOfferDeclined: false, played: 0, offerDueAt: 1, remindAt: 0, lastShownAt: -1, seen: [] }

/** A phone. `owns` is what the store account already holds; `prices` what the
 *  store lists (a sku left out is "not created in the console"); `answer`
 *  maps a sku to the sheet's ending ('owned' by default). `seed` presets the
 *  device ledger, `ent` the entitlement cache. */
async function phone({ billing = true, ads = true, owns = [], prices = { 'phase.supporter': '£1.99', 'phase.supporter.intro': '£1.19' }, micros = null, answer = {}, seed = null, ent = null, size = { width: 412, height: 780 }, lang = null } = {}) {
  const ctx = await browser.newContext({ viewport: size, locale: 'en-GB' })
  await ctx.addInitScript(([billing, ads, owns, prices, micros, answer, seed, ent, lang]) => {
    if (!sessionStorage.getItem('__booted')) {
      sessionStorage.setItem('__booted', '1')
      localStorage.setItem('rm-night', '1')
      if (seed) localStorage.setItem('rm-pro', JSON.stringify(seed))
      if (ent) localStorage.setItem('rm-ent', ent)
      if (lang) localStorage.setItem('rm-lang', lang)
    }
    if (billing) {
      const bought = new Set(JSON.parse(sessionStorage.getItem('__bought') ?? '[]'))
      const prod = (sku) => prices[sku] ? { sku, price: prices[sku], ...(micros?.[sku] ? { micros: micros[sku] } : {}) } : null
      globalThis.__buys = []
      globalThis.rmBilling = {
        details: async (sku) => prod(sku),
        detailsMany: async (skus) => skus.map(prod).filter(Boolean),
        buy: async (sku) => {
          globalThis.__buys.push(sku)
          const a = globalThis.__answer?.[sku] ?? answer[sku] ?? 'owned'
          if (a === 'owned') { bought.add(sku); sessionStorage.setItem('__bought', JSON.stringify([...bought])) }
          return a
        },
        reason: () => null,
        owned: async () => [...new Set([...owns, ...bought])],
        consume: async () => ({ ok: true }),
      }
    }
    if (ads) {
      globalThis.rmAds = {
        mount: (el, place) => { el.setAttribute('data-ad', place) },
        unmount: () => {},
        showRewarded: async () => 'skipped',
      }
    }
  }, [billing, ads, owns, prices, micros, answer, seed, ent, lang])
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  return { ctx, page, errs }
}

async function startCareer(page) {
  await page.goto(URL)
  await page.locator('text=New Career').or(page.locator('.bottom-nav')).first().waitFor()
  // a device with a career reopens it, and the reopening can land a moment
  // after the title first paints - on a slow CI runner well after the 1.2s
  // this used to wait (1.8.8 run 37355664315: the career opened over the
  // title and "New Career" was gone). So step back to the title until the
  // title has held for a whole second. Held means the TITLE is the screen:
  // toTitle() keeps a loaded career in memory, so "no career loaded" never
  // came true on a device with a save and the loop always ran its full ten
  // seconds (1.8.10 audit). Bounded at 40 samples either way.
  for (let held = 0, i = 0; held < 4 && i < 40; i++) {
    await page.waitForTimeout(250)
    const onTitle = await page.evaluate(() => window.rugbyStore.getState().nav.at(-1)?.screen === 'menu')
    if (!onTitle) { await page.evaluate(() => window.rugbyStore.getState().toTitle()); held = 0 } else held++
  }
  await page.waitForSelector('text=RUGBY')
  await page.evaluate(() => window.rugbyStore.getState().setLang('en'))
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
  await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor({ timeout: 20000 })
  // the tutorial is a modal: no card may open over it
  if (await page.locator('.tut-box').count()) {
    await page.waitForTimeout(1600)
    ok(await page.locator('.pro-card').count() === 0, 'no card opens over the tutorial')
    await page.click('.tut-close .btn')
  }
  await page.waitForSelector('.bottom-nav')
}

const ledger = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rm-pro') ?? 'null'))
const ent = (page) => page.evaluate(() => (localStorage.getItem('rm-ent') ?? '').split(',').filter(Boolean))
const card = async (page, ms = 2600) => {
  try { await page.waitForSelector('.pro-card', { timeout: ms }) } catch { return null }
  return page.locator('.pro-card').getAttribute('data-pro')
}
const cardText = (page) => page.locator('.pro-card').innerText()
const tap = async (page, label) => { await page.locator('.pro-card button', { hasText: label }).first().click(); await page.waitForTimeout(250) }
const home = (page) => page.evaluate(() => window.rugbyStore.getState().home())

/** Drive the store to the end of the manager's next match and land on Home
 *  - the full-time round-up dismissed. Returns the competition id, or 'card'
 *  if a card opened on the way (at a safe moment the drive passed through). */
async function playOne(page) {
  const out = await page.evaluate(async () => {
    const s = window.rugbyStore
    for (let guard = 0; guard < 600; guard++) {
      if (document.querySelector('.pro-card')) return 'card'
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
    const st = s.getState(); const unread = st.game.news.filter(n => !n.read).slice(-3).map(n => n.k)
    return 'stuck:' + st.nav[st.nav.length - 1]?.screen + ' wk' + st.game.week + ' ' + JSON.stringify(unread) + ' gate ' + JSON.stringify(st.game.inboxGate ?? null)
  })
  if (out !== 'card') await home(page)
  return out
}

try {
  // ---- A ------------------------------------------------------------------
  say('--- A: declines the first card, declines the offer, reminded at +10 and +20')
  {
    const { ctx, page, errs } = await phone()
    await startCareer(page)
    const shown = [] // { kind, played, comp }
    let comps = 0, friendlies = 0
    let k = await card(page)
    if (k) shown.push({ kind: k, played: (await ledger(page)).played })
    for (let i = 0; i < 70 && comps < 22; i++) {
      if (k) {
        const text = await cardText(page)
        if (k === 'first') {
          ok(/PRO MANAGER/.test(text) && /£1\.99/.test(text), 'the first card names Pro Manager and the store\'s own price')
          ok(/No adverts/.test(text) && /Three skins/.test(text) && /independent game/.test(text), 'and its three real benefits')
          ok(/later from the Store/.test(text), 'and says Pro can be bought later from the Store')
          const b = await page.locator('.pro-card .pro-btn').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, t: e.textContent } }))
          ok(b.length === 2 && b.every(x => x.h >= 40) && Math.abs(b[0].w - b[1].w) < 1,
            `Become Pro and Continue Free are the same size, both 40px or more (${b.map(x => `${x.t} ${Math.round(x.w)}x${Math.round(x.h)}`).join(', ')})`)
        }
        if (k === 'offer') {
          ok(/ONE-TIME OFFER/.test(text) && /£1\.19/.test(text) && /40% OFF/.test(text) && /Usually £1\.99/.test(text),
            'the offer is labelled one-time, at the store\'s intro price, 40% OFF (true for £1.19 on £1.99)')
          ok(await page.locator('.pro-card').getAttribute('data-sku') === 'phase.supporter.intro', 'and it sells the intro product')
        }
        if (k === 'reminder') ok(!/ONE-TIME/.test(text) && /£1\.99/.test(text), 'a reminder is the light card at the normal price')
        await tap(page, 'Continue Free')
        ok(await page.locator('.pro-card').count() === 0, `Continue Free closes the ${k} card in one tap`)
        // one card per flow: nothing else on this Home
        ok(await card(page, 1500) === null, `nothing follows the ${k} card in the same flow`)
      }
      const comp = await playOne(page)
      if (comp === 'card') { k = await card(page, 500); shown.push({ kind: k, played: (await ledger(page)).played, during: true }); continue }
      if (comp === 'fr') friendlies++; else if (comp !== 'none' && !String(comp).startsWith('stuck')) comps++
      if (String(comp).startsWith('stuck')) { ok(false, 'the drive got stuck ' + comp); break }
      k = await card(page)
      if (k) shown.push({ kind: k, played: (await ledger(page)).played, comp })
    }
    const f = await ledger(page)
    say(`  ${comps} competitive and ${friendlies} friendlies played; cards: ${shown.map(s => `${s.kind}@${s.played}`).join(', ')}`)
    ok(f.played === comps, `the device counted the ${comps} competitive matches and none of the ${friendlies} friendlies (${f.played})`)
    ok(shown.filter(s => s.kind === 'first').length === 1 && shown[0].kind === 'first' && shown[0].played === 0,
      'the first card came once, before any competitive match')
    ok(shown.filter(s => s.kind === 'offer').length === 1 && shown[1]?.kind === 'offer' && shown[1].played === 1,
      'the offer came once, after the first competitive match')
    const rem = shown.filter(s => s.kind === 'reminder').map(s => s.played)
    ok(JSON.stringify(rem) === JSON.stringify([11, 21]), `reminders after 10 and 20 further competitive matches (at ${rem.join(', ')})`)
    ok(f.firstPromptShown && f.firstOfferShown && f.firstOfferDeclined && !f.firstOfferAccepted, 'the ledger records it all')
    ok(!(await ent(page)).length, 'and the player is still free')

    // ---- H, free: a second career on the same phone ----
    say('--- H (free): a second career sees neither the first card nor the offer')
    await startCareer(page)
    let again = await card(page)
    for (let i = 0; i < 4 && !again; i++) { const c = await playOne(page); again = c === 'card' ? 'card' : await card(page) }
    ok(again === null, `no first card and no offer in the second career (${again})`)
    const f2 = await ledger(page)
    ok(f2.firstPromptShown && f2.firstOfferShown && f2.played > f.played, 'the device ledger carried straight on')
    ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
    await ctx.close()
  }

  // ---- B, F, H(pro) -------------------------------------------------------
  say('--- B: accepts the first card; F: reloads; H: second career')
  {
    const { ctx, page, errs } = await phone({ seed: { ...FRESH, played: 1 } })
    await startCareer(page)
    ok(await card(page) === 'first', 'the first card is shown')
    ok(await page.evaluate(() => document.querySelector('.app').className.includes('skin-')) === false, 'free: the default skin')
    await tap(page, 'Become Pro')
    await page.waitForSelector('.pro-card >> text=Thank you')
    ok((await ent(page)).includes('phase.supporter'), 'the purchase wrote Pro Manager')
    ok(await page.evaluate(() => window.rugbyStore.getState().supporter) === true, 'the UI knows at once')
    await tap(page, 'Continue')
    await page.evaluate(() => window.rugbyStore.getState().setSkin('midnight'))
    await page.waitForTimeout(200)
    ok(await page.evaluate(() => document.querySelector('.app').className.includes('skin-midnight')), 'a Pro-only skin now paints')
    let n = 0
    for (let i = 0; i < 3; i++) { const c = await playOne(page); if (c === 'card' || await card(page, 1800)) n++ }
    ok(n === 0, 'three more matches, no card')
    await page.evaluate(() => window.rugbyStore.getState().go('supporter'))
    await page.waitForSelector('.card >> text=Pro Manager')
    ok(/Yours/.test(await page.locator('.card', { hasText: 'Pro Manager' }).first().innerText()), 'the Store row reads Yours')
    // F
    await page.reload()
    await page.locator('text=New Career').or(page.locator('.bottom-nav')).first().waitFor()
    if (!(await page.locator('.bottom-nav').count())) { await page.click('text=Continue').catch(() => {}); await page.waitForSelector('.bottom-nav') }
    ok((await ent(page)).includes('phase.supporter'), 'F: after a reload, still Pro')
    const c = await playOne(page)
    ok(c !== 'card' && await card(page) === null, 'F: and no card after a match')
    // H, Pro
    await startCareer(page)
    let any = await card(page)
    for (let i = 0; i < 2 && !any; i++) { const x = await playOne(page); any = x === 'card' ? 'card' : await card(page) }
    ok(any === null && (await ent(page)).includes('phase.supporter'), 'H: a second career is still Pro, and sees no card')
    ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
    await ctx.close()
  }

  // ---- C ------------------------------------------------------------------
  say('--- C: declines, then takes the one-time offer')
  {
    const { ctx, page, errs } = await phone({ seed: { ...FRESH, firstPromptShown: true, played: 1, lastShownAt: 0 } })
    await startCareer(page)
    ok(await card(page) === 'offer', 'the offer')
    await tap(page, 'Become Pro')
    await page.waitForSelector('.pro-card >> text=Thank you')
    const e = await ent(page)
    ok(e.includes('phase.supporter.intro') && !e.includes('phase.supporter'), `the intro product was bought (${e.join(',')})`)
    ok(await page.evaluate(() => window.rugbyStore.getState().supporter), 'and it is Pro Manager')
    const f = await ledger(page)
    ok(f.firstOfferAccepted && !f.firstOfferDeclined, 'the ledger says accepted')
    await tap(page, 'Continue')
    let n = 0
    for (let i = 0; i < 2; i++) { const c = await playOne(page); if (c === 'card' || await card(page, 1800)) n++ }
    ok(n === 0, 'no more cards')
    await page.evaluate(() => window.rugbyStore.getState().go('supporter'))
    await page.waitForSelector('.card >> text=Pro Manager')
    ok(/Yours/.test(await page.locator('.card', { hasText: 'Pro Manager' }).first().innerText()), 'the Store row reads Yours for the intro receipt')
    ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
    await ctx.close()
  }

  // ---- E, pending ----------------------------------------------------------
  say('--- E: cancels the sheet, stays free, the cadence carries on; a pending sheet stays free')
  {
    const { ctx, page, errs } = await phone({ answer: { 'phase.supporter': 'cancelled', 'phase.supporter.intro': 'pending' }, seed: { ...FRESH, played: 1 } })
    await startCareer(page)
    ok(await card(page) === 'first', 'the first card')
    await tap(page, 'Become Pro')
    await page.waitForSelector('.pro-card >> text=Nothing was charged')
    ok(!(await ent(page)).length && !(await page.evaluate(() => window.rugbyStore.getState().supporter)), 'cancelled: nothing granted')
    await tap(page, 'Continue Free')
    let c = await playOne(page)
    while (c === 'fr') c = await playOne(page)
    // a purchase message was on screen moments ago: the card defers...
    ok(c !== 'card' && await card(page, 1500) === null, 'right after a purchase ended, the next card waits')
    // ...and is not lost: it opens at the next safe moment after the pause
    await page.waitForTimeout(29000)
    await page.evaluate(() => window.rugbyStore.getState().go('fixtures'))
    await home(page)
    const k = await card(page, 4000)
    ok(k === 'offer', `the offer still follows the next competitive match (${k})`)
    await tap(page, 'Become Pro')
    await page.waitForSelector('.pro-card .pro-msg')
    ok(!(await ent(page)).length, 'pending: stays free until the store confirms')
    await tap(page, 'Continue Free')
    ok((await ledger(page)).firstOfferDeclined, 'Continue Free after it declines the offer')
    ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
    await ctx.close()
  }

  // ---- G -------------------------------------------------------------------
  say('--- G: a reinstall restores Pro, from either product')
  for (const sku of ['phase.supporter.intro', 'phase.supporter']) {
    const { ctx, page } = await phone({ owns: [sku], seed: { ...FRESH, played: 1 } })
    await page.goto(URL)
    await page.waitForSelector('text=RUGBY')
    await page.waitForTimeout(1500)
    ok((await ent(page)).includes(sku) && await page.evaluate(() => window.rugbyStore.getState().supporter),
      `${sku} comes back at boot and is Pro`)
    await startCareer(page)
    ok(await card(page) === null, `and a restored Pro owner sees no card even with one due (${sku})`)
    await ctx.close()
  }

  // ---- the intro product is missing --------------------------------------
  say('--- the store does not list phase.supporter.intro yet')
  {
    const { ctx, page } = await phone({ prices: { 'phase.supporter': '£1.99' }, seed: { ...FRESH, firstPromptShown: true, played: 1, lastShownAt: 0 } })
    await startCareer(page)
    ok(await card(page) === 'offer', 'the offer slot still shows a card')
    const text = await cardText(page)
    ok(/£1\.99/.test(text) && !/ONE-TIME|OFF|Usually/.test(text), 'at the normal price, with no one-time or discount wording')
    ok(await page.locator('.pro-card').getAttribute('data-sku') === 'phase.supporter', 'selling the normal product')
    await tap(page, 'Continue Free')
    const f = await ledger(page)
    ok(!f.firstOfferShown && !f.firstOfferDeclined && f.offerDueAt === 11, 'and the one-time offer is not spent')
    await ctx.close()
  }

  // ---- the percentage is only printed when true ---------------------------
  say('--- % OFF only when the prices make it true')
  for (const [intro, micros, want] of [
    // 40% since 1.8.9 (owner): the old 25% offer now prints no percentage
    ['£1.49', { 'phase.supporter': 1990000, 'phase.supporter.intro': 1490000 }, null],
    ['£1.19', { 'phase.supporter': 1990000, 'phase.supporter.intro': 1190000 }, '40% OFF'],
    ['£0.99', null, null],
  ]) {
    const { ctx, page } = await phone({ prices: { 'phase.supporter': '£1.99', 'phase.supporter.intro': intro }, micros, seed: { ...FRESH, firstPromptShown: true, played: 1, lastShownAt: 0 } })
    await startCareer(page)
    await card(page)
    const text = await cardText(page)
    ok(text.includes(intro) && (want ? text.includes(want) : !/% OFF/.test(text)),
      `${intro} on £1.99: ${want ? `prints ${want}` : 'the intro price and no percentage'}`)
    await ctx.close()
  }

  // ---- never at the wrong moment -----------------------------------------
  say('--- never during a match, over a modal, on the web, or for a Pro owner')
  {
    const due = { ...FRESH, firstPromptShown: true, played: 1, lastShownAt: 0 }
    // during a match: kick off live, wait on the match screen
    const { ctx, page } = await phone({ seed: { ...FRESH, firstPromptShown: true, firstOfferShown: true, played: 0, remindAt: 50, lastShownAt: 0 } })
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
    // make a card due only now, with the match preview (team selection) up
    await page.evaluate((d) => localStorage.setItem('rm-pro', JSON.stringify(d)), due)
    await page.evaluate(() => window.rugbyStore.setState(s => ({ tick: s.tick + 1 })))
    await page.waitForTimeout(2200)
    ok(await page.locator('.pro-card').count() === 0, 'no card on the match preview and team selection')
    await page.evaluate(() => window.rugbyStore.getState().kickOff())
    await page.waitForTimeout(2500)
    ok(await page.evaluate(() => !!window.rugbyStore.getState().liveMatch) && await page.locator('.pro-card').count() === 0, 'no card during a live match')
    await ctx.close()
  }
  {
    const due = { ...FRESH, firstPromptShown: true, played: 1, lastShownAt: 0 }
    const { ctx, page } = await phone({ seed: { ...FRESH, firstPromptShown: true, firstOfferShown: true, played: 0, remindAt: 50, lastShownAt: 0 } })
    await startCareer(page)
    // play through to the full-time round-up and stay there; the card is
    // made due only on the match screen, so nothing opens on the way
    await page.evaluate(async (d) => {
      const s = window.rugbyStore
      for (let g = 0; g < 300; g++) {
        const st = s.getState(); const screen = st.nav[st.nav.length - 1]?.screen
        for (const q of st.game.press) q.answered = true
        s.setState({ lastAdvanceAt: 0 })
        if (screen === 'matchday') { localStorage.setItem('rm-pro', JSON.stringify(d)); st.instantResult(); return }
        st.continueWeek()
        await new Promise(r => setTimeout(r, 5))
      }
    }, due)
    const top = await page.evaluate(() => { const n = window.rugbyStore.getState().nav; return n[n.length - 1].screen })
    ok(top === 'results' && await card(page, 2200) === null, `no card on the full-time round-up (${top})`)
    // a menu open over the screen, then back to Home underneath it
    await page.locator('.bottom-nav button[data-group]').first().click()
    await page.waitForSelector('.submenu-veil')
    await home(page)
    await page.waitForTimeout(2200)
    ok(await page.locator('.pro-card').count() === 0, 'nor over an open menu')
    await page.evaluate(() => document.querySelector('.submenu-veil')?.click())
    const opened = await card(page, 4000)
    if (opened !== 'offer') say('  state: ' + JSON.stringify(await page.evaluate(() => {
      const st = window.rugbyStore.getState()
      return { screen: st.nav[st.nav.length - 1].screen, live: !!st.liveMatch, tut: st.tut, resuming: st.resuming,
        sacked: !!st.game.sacked, cel: !!st.game.celebration, annual: !!st.game.annual,
        overlays: [...document.querySelectorAll('.modal-veil, .tut-veil, .celebrate-veil, .sack-veil, .submenu-veil, .intro')].map(e => e.className),
        pro: localStorage.getItem('rm-pro'), ent: localStorage.getItem('rm-ent') }
    })))
    ok(opened === 'offer', 'and it opens once the menu is closed, at the next safe moment')
    await ctx.close()
  }
  {
    const { ctx, page } = await phone({ billing: false, seed: { ...FRESH, played: 1 } })
    await startCareer(page)
    ok(await card(page) === null, 'the web build (no store bridge) never shows a card')
    await ctx.close()
  }
  {
    const { ctx, page } = await phone({ ads: false, seed: { ...FRESH, played: 1 } })
    await startCareer(page)
    ok(await card(page) === null, 'nor a shell whose skins are not locked behind Pro (no advert bridge): nothing to sell')
    await ctx.close()
  }
  {
    const { ctx, page } = await phone({ ent: 'phase.supporter', seed: { ...FRESH, played: 1 } })
    await startCareer(page)
    ok(await card(page) === null, 'a Pro owner never sees a card, even with one due')
    await ctx.close()
  }

  // ---- screenshots ---------------------------------------------------------
  if (SHOTS) {
    say('--- screenshots')
    const seeds = {
      first: { ...FRESH, played: 1 },
      offer: { ...FRESH, firstPromptShown: true, played: 1, lastShownAt: 0 },
      reminder: { ...FRESH, firstPromptShown: true, firstOfferShown: true, firstOfferDeclined: true, played: 11, remindAt: 11, lastShownAt: 1 },
    }
    for (const lang of ['en', 'fr']) {
      for (const size of [{ width: 360, height: 800 }, { width: 412, height: 915 }]) {
        for (const [kind, seed] of Object.entries(seeds)) {
          const { ctx, page } = await phone({ seed, size })
          await startCareer(page)
          if (lang !== 'en') {
            // stop the card opening in English, then switch and let it come
            await page.evaluate(() => window.rugbyStore.getState().go('settings'))
            await page.evaluate((l) => window.rugbyStore.getState().setLang(l), lang)
            await home(page)
          }
          const k = await card(page, 4000)
          await page.waitForTimeout(300)
          const fit = await page.evaluate(() => {
            const r = document.querySelector('.pro-card').getBoundingClientRect()
            return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth
          })
          ok(k === kind && fit, `${lang} ${size.width}x${size.height} ${kind}: shown, inside the screen, no sideways scroll`)
          await page.screenshot({ path: `${SHOTS}/pro-${kind}-${lang}-${size.width}x${size.height}.png` })
          await ctx.close()
        }
      }
    }
  }
} catch (e) {
  fails++
  say('FAIL  threw: ' + String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
} finally {
  await browser.close()
  server.stop()
}
say(fails ? `PRO PROMPT: ${fails} FAIL` : 'PRO PROMPT PASSED')
process.exit(fails ? 1 : 0)
