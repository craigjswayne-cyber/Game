// ---- THE HIGHLIGHT, IN THE MATCH (1.8.0) ----
//
// hlprobe measures the clips in node; this plays one on the real match screen.
// Highlights are off for automated browsers (MatchDay: navigator.webdriver)
// so the other probes can drive a match without waiting on clips; ?hl=1 turns
// them back on. On a seeded match it checks what the owner asked for:
//
//   the pitch comes on for a try, the whole pitch (dead-ball line to
//     dead-ball line, 114 by 70), and it does not move
//   nothing is written over the pitch (the "Can they make it?" and maul
//     captions came off in 1.8.0), and the verdict only comes once the ball
//     is down (the clip marks that moment with data-down)
//   the clip goes and the live stats come back
//   no crowd under the match: not one noise buffer is started on the match
//     screen, no bed and no roar (owner: it sounded like static, so it came
//     out entirely; the whistles are oscillators and stay)
//   no console errors
//
// Run: npm run build && node scripts/hlliveprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
const server = await startPreview('4262', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.addInitScript(() => {
  let a = 20260926
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
// every sound source the page starts, so the crowd's absence is checked
await page.addInitScript(() => {
  const log = window.__rmSources = []
  const bs = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (...a) { log.push({ kind: 'buffer', loop: this.loop, at: location.href }); return bs.apply(this, a) }
  const os = OscillatorNode.prototype.start
  OscillatorNode.prototype.start = function (...a) { log.push({ kind: 'osc' }); return os.apply(this, a) }
})
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
try {
  await page.goto('http://localhost:4262/?hl=1')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'S'); await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  for (let tap = 0; tap < 8; tap++) { if (await page.locator('text=Kick Off ▸').count()) break; await page.click('.continue-btn'); await page.waitForTimeout(450) }
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 5000 }); await page.click('.talk-modal .speech-tile >> nth=0')
  try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // wait for a clip, answering any touchline call on the way
  let seen = false
  for (let i = 0; i < 240 && !seen; i++) {
    if (await page.locator('text=Take the Points').count()) await page.click('text=Take the Points').catch(() => {})
    seen = await page.locator('.hl-clip').count() > 0
    if (!seen) await page.waitForTimeout(250)
  }
  ok(seen, 'the pitch comes on for a highlight')
  if (seen) {
    const box = await page.locator('.hl-clip').boundingBox()
    ok(box && Math.abs(box.width / box.height - 114 / 70) < 0.03, `the whole pitch, 114 by 70 (${box ? (box.width / box.height).toFixed(3) : '-'} against ${(114 / 70).toFixed(3)})`)
    // watch it: no caption at any point, and the verdict only with the ball down
    let caption = '', banner = '', early = false, sawDown = false
    for (let i = 0; i < 120; i++) {
      const s = await page.evaluate(() => ({
        cap: document.querySelector('.hl-caption')?.textContent ?? '',
        ban: document.querySelector('.hl-banner b')?.textContent ?? '',
        down: document.querySelector('.hl-clip')?.getAttribute('data-down') === '1',
        kind: document.querySelector('.hl-clip')?.className ?? '',
        on: !!document.querySelector('.hl-clip'),
      }))
      if (s.cap) caption = s.cap
      if (s.down) sawDown = true
      // a try or a no-try is called only once the ball is down
      if (s.ban && /\b(try|notry)\b/.test(s.kind) && !s.down && s.ban !== 'TMO CHECK') early = true
      if (s.ban) banner = s.ban
      if (!s.on) break
      await page.waitForTimeout(150)
    }
    ok(!caption, `nothing written over the pitch${caption ? ` ("${caption}")` : ''}`)
    ok(sawDown && !early, `the verdict comes only once the ball is down${early ? ' (it came before)' : ''}`)
    ok(/TRY|NO TRY|TMO|GOOD|WIDE|TURNOVER|TRY SAVER/.test(banner), `then the verdict ("${banner}")`)
    await page.waitForSelector('.live-stats', { timeout: 20000 }).catch(() => {})
    ok(await page.locator('.live-stats').count() > 0 && await page.locator('.hl-clip').count() === 0, 'the clip goes and the live stats come back')
  }
  const src = await page.evaluate(() => window.__rmSources ?? [])
  const bufs = src.filter(x => x.kind === 'buffer')
  ok(bufs.length === 0, `no crowd under the match: ${bufs.length} noise buffers started (${src.length - bufs.length} whistle and thud oscillators)`)
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0].slice(0, 160) : ''}`)
} catch (e) {
  console.log(`FAIL  the walk broke: ${e.message}`); fails++
}
await browser.close()
console.log(fails ? `\nHL LIVE PROBE FAILED (${fails})` : '\nHL LIVE PROBE PASSED: the highlight plays on the match screen')
done(fails)
