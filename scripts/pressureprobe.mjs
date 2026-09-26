// ---- THE PRESSURE NEEDLE STAYS ON THE PHONE ----
//
// Release audit, 1.7.1 (pass 4, every screen at the real dimensions). The
// scoreboard's pressure needle rides a .momo-track that is the whole bar wide
// and slides by translateX - on the compositor, which motionprobe holds it to.
// Nothing clipped the track, so as momentum swung towards one side the track's
// box ran up to 94% of a bar-width past the bar and out past the edge of the
// screen: the live match page grew to 451px on a 412px phone and could be
// dragged sideways mid-match. It came and went with the momentum, which is why
// no screenshot-at-a-moment harness ever caught it.
//
// This forces momentum to both extremes and measures the page each time.
//
// Run: node scripts/pressureprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(4262, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
try {
  for (const [w, h] of [[412, 915], [360, 740], [768, 1024]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
    await page.goto('http://localhost:4262/')
    await page.waitForSelector('text=RUGBY', { timeout: 20000 })
    await page.click('text=New Career'); await page.click('text=English Premier Division'); await page.waitForSelector('.club-tile')
    await page.click('.tile >> text=Northampton'); await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Pressure'); await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career'); await page.waitForSelector('.tut-box', { timeout: 20000 }); await page.click('.tut-close .btn')
    for (let t = 0; t < 10 && !(await page.locator('text=Kick Off ▸').count()); t++) { await page.click('.continue-btn'); await page.waitForTimeout(400) }
    await page.locator('text=Kick Off ▸').first().click(); await page.click('.talk-modal .speech-tile >> nth=0')
    try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
    await page.waitForSelector('.momo-track', { timeout: 20000 })
    for (const momo of [1, -1]) {
      const sw = await page.evaluate(async (m) => {
        const S = window.rugbyStore.getState()
        S.matchCursor(S.liveMatch.cursor, false)
        S.liveMatch.ctx.momo = m
        S.touch()
        await new Promise(r => setTimeout(r, 1200))     // the track's own transition
        return document.documentElement.scrollWidth
      }, momo)
      ok(sw <= w, `${w}x${h}, momentum ${momo > 0 ? 'all home' : 'all away'}: the page is ${sw}px on a ${w}px screen`)
    }
    await page.close()
  }
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}
say(fails ? `\nPRESSURE PROBE FAILED (${fails})` : '\nPRESSURE PROBE PASSED: the needle swings inside the bar, and the page never scrolls sideways')
done(fails)
