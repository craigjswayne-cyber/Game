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
  { name: 'galaxy-tab', w: 800, h: 1280 },
  { name: 'ipad-pro', w: 1024, h: 1366 },
  // an iPad on its side (1.8.0, iPad builds): the deck goes beside the pitch
  { name: 'ipad-pro-land', w: 1366, h: 1024 },
]
try {
  for (const d of TABLETS) {
    const page = await browser.newPage({ viewport: { width: d.w, height: d.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
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
      await page.waitForTimeout(6000)
      // a touchline call takes the pitch's place, as on a phone: answer it
      for (let k = 0; k < 3 && await page.locator('text=Take the Points').count(); k++) {
        await page.click('text=Take the Points')
        await page.waitForTimeout(2500)
      }
      const m = await page.evaluate(() => {
        const p = document.querySelector('.pitch')?.getBoundingClientRect()
        const k = document.querySelector('.tab-deck')?.getBoundingClientRect()
        return p ? { w: Math.round(p.width), h: Math.round(p.height), right: Math.round(p.right), deckLeft: k ? Math.round(k.left) : null } : null
      })
      if (d.w > d.h) {
        ok(m && m.h >= 400 && m.deckLeft != null && m.deckLeft >= m.right - 2 && m.right <= d.w + 1,
          `match on its side: a full-height pitch with the deck beside it (${JSON.stringify(m)})`)
      } else {
        ok(m && m.w >= d.w * 0.85 && m.right <= d.w + 1, `match: the pitch takes the width (${JSON.stringify(m)})`)
      }
      await page.screenshot({ path: `shots/tablet-${d.name}-match.png` })
    }
    await page.close()
  }

  for (const [name, opts] of [
    ['phone 412 touch', { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true }],
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
server.kill?.()
console.log(fails ? `\nTABLET PROBE FAILED (${fails})` : '\nTABLET PROBE PASSED: a tablet gets the whole glass, and a phone is left alone')
process.exit(fails ? 1 : 0)
