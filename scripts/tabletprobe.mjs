// ---- TABLET MODE (1.8.0) ----
//
// Owner, 26 Sep 2026: "I want to add in tablet mode. So it can be played on
// tablet too". Before this a tablet showed the phone column: 560px in the
// middle of the glass, dark bars either side, type sized for a phone. The
// promises, on four real tablet geometries with a touch screen:
//
//   .app.tablet is on, and the app uses the whole width (no bars)
//   the type steps up (the root zoom is above 1)
//   nothing runs off the right edge on Home, the inbox, Squad or Transfers
//   Home lays its cards out in more than one column
//   the inbox shows the message list beside the letter, and a tap opens one
//   a phone and a desktop browser are left exactly as they were
//
// 1.8.1, the owner's headline: an upright tablet still showed "a phone-width
// column with dark bars either side" whenever it did not report a coarse
// pointer (a trackpad case, a stylus, a browser emulating the size). Upright
// the pointer is no longer asked, so the portrait sizes run a second time with
// no touch at all, and a 600px seven-inch tablet (under the 700px tablet line)
// must still fill its glass with the plain phone layout.
//
// Screenshots go to shots/tablet-*.png.
// Run: npm run build && node scripts/tabletprobe.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4249', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
mkdirSync('shots', { recursive: true })

async function career(page) {
  await page.goto('http://localhost:4249/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Tablet')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
}
const overflow = page => page.evaluate(() => {
  const sc = document.querySelector('.content')
  const out = []
  for (const el of document.querySelectorAll('.content *')) {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || !(el.textContent ?? '').trim() || el.querySelector('*')) continue
    let inScroller = false
    for (let a = el.parentElement; a && a !== sc; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 1) { inScroller = true; break }
    }
    if (!inScroller && r.right > innerWidth + 1) out.push(el.textContent.trim().slice(0, 24))
  }
  return out.slice(0, 4)
})

const TABLETS = [
  { name: 'ipad-mini', w: 768, h: 1024 },
  { name: 'ipad-air', w: 820, h: 1180 },
  { name: 'ipad-pro-11', w: 834, h: 1194 },
  { name: 'galaxy-tab', w: 800, h: 1280 },
  { name: 'ipad-pro', w: 1024, h: 1366 },
  // an iPad on its side (1.8.0, iPad builds): the deck goes beside the pitch
  { name: 'ipad-pro-land', w: 1366, h: 1024 },
  // upright with a trackpad or a stylus: a fine pointer, still a tablet
  { name: 'ipad-mini-trackpad', w: 768, h: 1024, fine: true },
  { name: 'ipad-air-trackpad', w: 820, h: 1180, fine: true },
  { name: 'galaxy-tab-stylus', w: 800, h: 1280, fine: true },
]
try {
  for (const d of TABLETS) {
    const page = await browser.newPage(d.fine
      ? { viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1 }
      : { viewport: { width: d.w, height: d.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
    console.log(`\n--- ${d.name} ${d.w}x${d.h}`)
    await career(page)
    const shell = await page.evaluate(() => ({
      tablet: document.querySelector('.app')?.classList.contains('tablet'),
      w: Math.round(document.querySelector('.app').getBoundingClientRect().width),  // viewport px: Chrome reports rects after zoom
      zoom: parseFloat(document.documentElement.style.zoom) || 1,
    }))
    ok(shell.tablet, 'tablet mode is on')
    ok(Math.abs(shell.w - d.w) <= 2, `the app fills the width (${shell.w} of ${d.w})`)
    ok(shell.zoom > 1.1, `the type steps up (zoom ${shell.zoom})`)
    const cols = await page.evaluate(() => {
      const g = document.querySelector('.card-grid')
      return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0
    })
    ok(cols >= 2, `Home lays its cards out in columns (${cols})`)
    // "the home page is a bit disjointed": no card alone on half a row, and
    // every block on Home shares one right-hand edge
    const home = await page.evaluate(() => {
      const g = document.querySelector('.card-grid')
      const kids = g ? [...g.children] : []
      const gr = g?.getBoundingClientRect()
      const lone = kids.filter(k => { const b = k.getBoundingClientRect(); return !kids.some(o => o !== k && Math.abs(o.getBoundingClientRect().top - b.top) < 2) && b.width < (gr.width - 40) * 0.75 }).length
      const edges = [...document.querySelectorAll('.content > .card, .card-grid, .hub-row, .dash-row')].map(e => {
        const b = e.getBoundingClientRect(), cs = getComputedStyle(e)
        // a card's own edge; a grid's edge is where its cards stop
        return Math.round(e.classList.contains('card') ? b.right : b.right - parseFloat(cs.paddingRight))
      })
      return { lone, spread: Math.max(...edges) - Math.min(...edges) }
    })
    ok(home.lone === 0, `Home: no card sits alone on half a row (${home.lone})`)
    ok(home.spread <= 4, `Home: every block shares one right edge (spread ${home.spread}px)`)
    ok((await overflow(page)).length === 0, `Home: nothing past the right edge ${JSON.stringify(await overflow(page))}`)
    await page.screenshot({ path: `shots/tablet-${d.name}-home.png` })

    await page.click('.bottom-nav button[title="News"]')
    await page.waitForSelector('.reader', { timeout: 8000 })
    const inbox = await page.evaluate(() => {
      const l = document.querySelector('.inbox-list'), r = document.querySelector('.reader')
      if (!l || !r) return null
      const a = l.getBoundingClientRect(), b = r.getBoundingClientRect()
      return { shown: getComputedStyle(l).display !== 'none', beside: a.right <= b.left + 2 && a.top < b.bottom, items: l.querySelectorAll('.inbox-li').length }
    })
    ok(inbox?.shown && inbox.beside && inbox.items > 0, `the inbox list sits beside the letter (${JSON.stringify(inbox)})`)
    if (inbox?.items > 1) {
      const subj = await page.locator('.inbox-li').nth(1).locator('.subj').textContent()
      await page.locator('.inbox-li').nth(1).click()
      await page.waitForTimeout(200)
      const h = await page.locator('.reader h2').textContent()
      ok(h.trim() === subj.trim(), 'a tap on the list opens that story')
    }
    ok((await overflow(page)).length === 0, `inbox: nothing past the right edge ${JSON.stringify(await overflow(page))}`)
    await page.screenshot({ path: `shots/tablet-${d.name}-inbox.png` })

    for (const [item, sel, tag] of [['"Team"', '.xv-split', 'team'], ['Transfer Centre', '.filter-line', 'transfers']]) {
      await page.click('.bottom-nav button[title="Hub"]')
      await page.click(`.submenu-item >> text=${item}`)
      await page.waitForSelector(sel, { timeout: 8000 })
      await page.waitForTimeout(200)
      ok((await overflow(page)).length === 0, `${tag}: nothing past the right edge ${JSON.stringify(await overflow(page))}`)
      await page.screenshot({ path: `shots/tablet-${d.name}-${tag}.png` })
    }
    // the screens with the widest content upright: a table, a long list and a
    // letter must reach both edges of the glass, not sit in a phone column
    if (d.h > d.w) {
      for (const scr of ['tables', 'fixtures', 'finances', 'saves', 'settings', 'nations']) {
        await page.evaluate(s => window.rugbyStore.getState().go(s), scr)
        await page.waitForTimeout(250)
        const span = await page.evaluate(() => {
          const c = document.querySelector('.content')?.getBoundingClientRect()
          let widest = 0
          for (const el of document.querySelectorAll('.content .card, .content table, .content .tabs')) widest = Math.max(widest, el.getBoundingClientRect().width)
          return { content: Math.round(c?.width ?? 0), widest: Math.round(widest) }
        })
        ok(Math.abs(span.content - d.w) <= 2 && span.widest >= d.w * 0.85,
          `${scr}: uses the width upright (content ${span.content}, widest block ${span.widest} of ${d.w})`)
        ok((await overflow(page)).length === 0, `${scr}: nothing past the right edge ${JSON.stringify(await overflow(page))}`)
      }
      await page.screenshot({ path: `shots/tablet-${d.name}-nations.png` })
    }
    if (d.name === 'ipad-air' || d.name === 'ipad-pro' || d.name === 'ipad-pro-land') {
      // the match itself: the pitch takes the width, and nothing hangs off it
      await page.click('.bottom-nav button[title="Home"]').catch(() => {})
      for (let tap = 0; tap < 8; tap++) {
        if (await page.locator('text=Kick Off ▸').count()) break
        await page.click('.continue-btn')
        await page.waitForTimeout(450)
      }
      await page.locator('text=Kick Off ▸').first().click()
      await page.locator('.talk-modal').waitFor({ timeout: 5000 })
      await page.click('.talk-modal .speech-tile >> nth=0')
      try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch { /* clean sheet */ }
      await page.waitForSelector('.scoreboard', { timeout: 20000 })
      // TABLET ROUND (owner, 9 Oct 2026): "you can't see the commentary when it
      // shows the team and their mood unless you press Got it". The room's
      // reactions sit in the stats panel beside the feed, never over the deck,
      // and the commentary is on the glass from the first line.
      await page.waitForSelector('.talk-react', { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const room = await page.evaluate(() => {
        const r = document.querySelector('.talk-react'), f = document.querySelector('.tab-feed')?.getBoundingClientRect()
        return { react: !!r, inPanel: !!r?.closest('.tab-stats'), feedTop: Math.round(f?.top ?? 9e9), feedH: Math.round(f?.height ?? 0) }
      })
      ok(room.react && room.inPanel, `kick-off: the room's reactions sit in the stats panel (${JSON.stringify(room)})`)
      ok(room.feedH >= 200 && room.feedTop < d.h - 200, `kick-off: the commentary is on the glass beside them (${JSON.stringify(room)})`)
      if (room.react) await page.click('.talk-react .tr-head .btn')
      await page.waitForTimeout(4000)
      // a touchline call takes the pitch's place, as on a phone: answer it
      for (let k = 0; k < 3 && await page.locator('text=Take the Points').count(); k++) {
        await page.click('text=Take the Points')
        await page.waitForTimeout(2500)
      }
      // 1.8.0: no always-on pitch. The tablet deck is the stage between
      // highlights: the running feed beside the live stats, inside the screen
      const m = await page.evaluate(() => {
        const r = sel => { const b = document.querySelector(sel)?.getBoundingClientRect(); return b ? { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) } : null }
        return { deck: r('.tab-deck'), feed: r('.tab-feed'), stats: r('.tab-stats .live-stats'), rows: document.querySelectorAll('.tab-stats .ls-row').length }
      })
      ok(m.deck && m.feed && m.stats && m.deck.r <= d.w + 1 && m.deck.l >= -1,
        `match: the deck sits inside the screen (${JSON.stringify(m.deck)})`)
      ok(m.stats && m.stats.w >= 260 && m.rows >= 8, `match: the live stats beside the feed, every row there (${m.stats?.w}px, ${m.rows} rows)`)
      ok(m.feed && m.feed.w >= 260 && m.feed.h >= 120, `match: the running commentary has room to read (${JSON.stringify(m.feed)})`)
      // "can you use team logos": the crests head the stats, the names are
      // kept for a screen reader only
      const head = await page.evaluate(() => {
        const crests = [...document.querySelectorAll('.tab-stats .ls-crest')].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 20)
        const names = [...document.querySelectorAll('.tab-stats .ls-name')].filter(e => e.getBoundingClientRect().width > 2)
        return { crests: crests.length, names: names.length }
      })
      ok(head.crests === 2 && head.names === 0, `match: two crests over the stats, no names to collide (${JSON.stringify(head)})`)
      // "it doesn't fit on screen": a sheet is zoomed with the page, so its
      // height cap has to be divided back down or its top leaves the glass
      await page.click('.speed-controls [data-ctl="squad"]')
      await page.waitForSelector('.squad-sheet', { timeout: 5000 })
      await page.waitForTimeout(500)
      const sh = await page.evaluate(() => { const b = document.querySelector('.squad-sheet').getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } })
      ok(sh.top >= 0 && sh.bottom <= d.h + 1, `match: the squad sheet fits the glass, top to bottom (${JSON.stringify(sh)} of ${d.h})`)
      await page.screenshot({ path: `shots/tablet-${d.name}-sheet.png` })
      await page.keyboard.press('Escape').catch(() => {})
      await page.screenshot({ path: `shots/tablet-${d.name}-match.png` })
    }
    await page.close()
  }

  // a seven-inch tablet upright, 600px across: under the tablet line, so the
  // phone layout and no zoom, but no bars down the sides either
  {
    const page = await browser.newPage({ viewport: { width: 600, height: 960 }, hasTouch: true, isMobile: true })
    await page.goto('http://localhost:4249/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })
    const s = await page.evaluate(() => ({ tablet: document.querySelector('.app')?.classList.contains('tablet'), zoom: parseFloat(document.documentElement.style.zoom) || 1, w: Math.round(document.querySelector('.app').getBoundingClientRect().width) }))
    ok(!s.tablet && s.zoom === 1 && s.w >= 598, `small tablet 600x960: the phone layout, filling the glass (tablet ${s.tablet}, zoom ${s.zoom}, ${s.w}px)`)
    await page.close()
  }
  for (const [name, opts] of [
    ['phone 412 touch', { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true }],
    ['phone 430 no touch', { viewport: { width: 430, height: 932 } }],
    ['phone on its side 915x412 touch', { viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true }],
    ['desktop 1280x800 mouse', { viewport: { width: 1280, height: 800 } }],
  ]) {
    const page = await browser.newPage(opts)
    await page.goto('http://localhost:4249/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })
    const s = await page.evaluate(() => ({ tablet: document.querySelector('.app')?.classList.contains('tablet'), zoom: parseFloat(document.documentElement.style.zoom) || 1 }))
    ok(!s.tablet && s.zoom === 1, `${name}: left as it was (tablet ${s.tablet}, zoom ${s.zoom})`)
    await page.close()
  }
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close()
server.stop()
console.log(fails ? `\nTABLET PROBE FAILED (${fails})` : '\nTABLET PROBE PASSED: a tablet gets the whole glass, and a phone is left alone')
process.exit(fails ? 1 : 0)
