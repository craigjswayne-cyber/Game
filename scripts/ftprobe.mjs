// Probe: the title reaches the foot of the screen, and at FULL TIME the way
// on is above the stats and nothing a manager taps is under an advert.
//
// Owner, 1.8.8 in the iOS Simulator, with a screenshot of an AdMob banner
// over the foot of the full-time screen: he could not scroll to "Continue to
// Results" and could not carry on with the game. "Ads should not impact or
// cover key buttons. Continue button should always be above match stats at
// end of game." And of the title screen: it did not reach the bottom.
//
// On a 393x852 phone:
//   the title screen's box runs to the bottom edge, and no advert room is
//     held on it (there is no slot there);
//   at full time, Continue to Results sits ABOVE the match stats and inside
//     the viewport without scrolling;
//   with --ad-inset forced to 60px (a banner's worth), the match column ends
//     above it: scrolled to the end, no button, link or dropdown has any part
//     in the bottom 60px, and Continue is still on screen.
//
// Run: node scripts/ftprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4233', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', e => errors.push(String(e.message ?? e)))
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const answer = async () => {
  for (const label of ['Take the Points', 'Kick for the Corner', 'Scrum']) {
    const b = page.locator(`button:has-text("${label}")`)
    if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(200); return true }
  }
  // an injury sheet: keep the man the assistant sent on
  const armed = page.locator('.sheet-row.armed')
  if (await armed.count()) { await armed.first().click().catch(() => {}); await page.waitForTimeout(150) }
  const gold = page.locator('.modal-veil .btn.gold:enabled')
  if (await gold.count()) { await gold.first().click().catch(() => {}); await page.waitForTimeout(200); return true }
  return false
}

try {
  // ---- the title ----
  await page.goto('http://localhost:4233/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.waitForTimeout(400)
  const title = await page.evaluate(() => {
    const t = document.querySelector('.title-screen').getBoundingClientRect()
    return { bottom: t.bottom, h: innerHeight, inset: getComputedStyle(document.documentElement).getPropertyValue('--ad-inset').trim() }
  })
  ok(Math.abs(title.bottom - title.h) < 1, `the title screen runs to the bottom edge (${Math.round(title.bottom)} of ${title.h})`)
  ok(title.inset === '0px', `and holds no advert room (--ad-inset ${title.inset})`)

  // ---- into a match ----
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'FT Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  for (let tap = 0; tap < 12; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    const rej = page.locator('.btn.danger >> text=Reject')
    if (await rej.count()) { await rej.first().click(); await page.waitForTimeout(200); continue }
    await page.click('.continue-btn'); await page.waitForTimeout(450)
  }
  await page.locator('text=Kick Off ▸').first().click()
  try { await page.locator('.talk-modal').waitFor({ timeout: 3000 }); await page.click('.talk-modal .speech-tile >> nth=0') } catch {}
  try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // ---- skip to full time ----
  for (let i = 0; i < 160; i++) {
    if (await page.locator('.ft-continue').count()) break
    if (await answer()) continue
    for (const label of ['▸ Start Second Half', '▸ Play the Final Quarter']) {
      const b = page.locator(`text=${label}`)
      if (await b.count()) await b.first().click().catch(() => {})
    }
    const s = page.locator('.speed-controls [data-ctl=skip]:not([disabled])')
    if (await s.count()) await s.first().click().catch(() => {})
    await page.waitForTimeout(400)
  }
  await page.waitForSelector('.ft-continue', { timeout: 25000 })
  await page.waitForTimeout(800)

  const ft = await page.evaluate(() => {
    const c = document.querySelector('.ft-continue').getBoundingClientRect()
    const stats = document.querySelector('.review-grid')?.getBoundingClientRect()
    return { top: c.top, bottom: c.bottom, h: innerHeight, statsTop: stats?.top ?? null, text: document.querySelector('.ft-continue').textContent }
  })
  ok(/^Continue to Results/.test(ft.text), `the full-time button reads Continue to Results ("${ft.text}")`)
  ok(ft.statsTop != null && ft.bottom <= ft.statsTop, `and sits above the match stats (button foot ${Math.round(ft.bottom)}, stats from ${Math.round(ft.statsTop)})`)
  ok(ft.top >= 0 && ft.bottom <= ft.h, `on screen without scrolling (${Math.round(ft.top)}-${Math.round(ft.bottom)} of ${ft.h})`)
  ok((await page.locator('button:has-text("Continue to Results")').count()) === 1, 'and there is exactly one of it')

  // ---- a banner's worth of room at the foot ----
  const BAND = 60
  await page.evaluate((b) => document.documentElement.style.setProperty('--ad-inset', `${b}px`), BAND)
  await page.waitForTimeout(200)
  const covered = async () => page.evaluate((b) => {
    const H = innerHeight
    const hits = []
    for (const e of document.querySelectorAll('button, a[href], select, input, [role=button]')) {
      const r = e.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const st = getComputedStyle(e)
      if (st.visibility === 'hidden' || st.display === 'none') continue
      // visible in the viewport and reaching into the band
      if (r.bottom > H - b + 0.5 && r.top < H) hits.push(`${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.top)}-${Math.round(r.bottom)}`)
    }
    return hits
  }, BAND)
  const wrap = await page.evaluate(() => { const r = document.querySelector('.live-wrap').getBoundingClientRect(); return { bottom: r.bottom, pad: getComputedStyle(document.querySelector('.live-wrap')).paddingBottom } })
  ok(parseFloat(wrap.pad) >= BAND, `the match column leaves the banner's room at its foot (padding-bottom ${wrap.pad})`)
  // scroll every scroller on the match screen to its end, then look
  await page.evaluate(() => { for (const e of document.querySelectorAll('.live-wrap, .live-wrap *')) if (e.scrollHeight > e.clientHeight + 1) e.scrollTop = e.scrollHeight })
  await page.waitForTimeout(300)
  const hits = await covered()
  ok(hits.length === 0, `scrolled to the end, nothing tappable is in the bottom ${BAND}px${hits.length ? `: ${hits.slice(0, 4).join(' ; ')}` : ''}`)
  // and back at the top, the way on is still clear of it
  await page.evaluate(() => { for (const e of document.querySelectorAll('.live-wrap, .live-wrap *')) if (e.scrollHeight > e.clientHeight + 1) e.scrollTop = 0 })
  await page.waitForTimeout(200)
  const c2 = await page.evaluate(() => document.querySelector('.ft-continue').getBoundingClientRect().bottom)
  ok(c2 <= 852 - BAND, `with the banner's room held, Continue is still clear of it (foot at ${Math.round(c2)})`)
  const hitsTop = await covered()
  ok(hitsTop.length === 0, `and at the top nothing tappable is under it either${hitsTop.length ? `: ${hitsTop.slice(0, 4).join(' ; ')}` : ''}`)

  // the button works
  await page.click('.ft-continue')
  await page.waitForTimeout(800)
  ok(await page.evaluate(() => !document.querySelector('.ft-continue')), 'and Continue to Results carries on with the game')
} catch (e) {
  ok(false, `walk broke: ${String(e.message ?? e).split('\n')[0]}`)
}
if (errors.length) ok(false, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 200)}`)
await browser.close()
await server.stop?.()
say(fails ? `\nFT PROBE FAILED (${fails})` : '\nFT PROBE PASSED: the title meets the floor, Continue comes before the stats, and no advert covers a button')
done(fails)
