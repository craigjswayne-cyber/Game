// Probe: the game still tells you things when the phone says "calm down".
//
// Twenty-five animations and no answer for prefers-reduced-motion, found in the
// studio audit. The fix is the standard recipe - collapse every duration - with
// two deliberate exceptions, and the exceptions are the whole reason this probe
// exists.
//
// The full-time stamp and the live event banner both END their keyframes at
// opacity 0 and hold it forwards, because that fade IS how they dismiss
// themselves; nothing unmounts them. So the two obvious implementations are both
// broken, in opposite directions:
//
//   animation-duration: .01ms  -> the stamp jumps straight to its last frame and
//                                is never seen. Full time passes in silence.
//   animation: none            -> the fill no longer applies, so the stamp sits
//                                over the pitch for the rest of the match.
//
// Neither is something a static CSS read would catch, and neither is something a
// person testing in day mode with motion enabled would ever see. Hence: play a
// real match with reduced motion emulated, and watch the stamp arrive and leave.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4192', 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({
  viewport: { width: 412, height: 780 },
  reducedMotion: 'reduce',
})
page.setDefaultTimeout(8000)
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errs = []
page.on('pageerror', e => errs.push(e.message))
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

/** animation-name / duration / opacity for a live element. */
const anim = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const cs = getComputedStyle(el)
  return { name: cs.animationName, dur: cs.animationDuration, opacity: Number(cs.opacity) }
}, sel)

try {
  await page.goto('http://localhost:4192/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Still Motion')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box')
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // walk to the first kick-off
  for (let i = 0; i < 40; i++) {
    if (await page.locator('text=Kick Off').count()) break
    if (await page.locator('text=On to the Week').count()) { await page.click('text=On to the Week'); continue }
    if (await page.locator('text=Next Story ▸').count()) { await page.click('text=Next Story ▸'); continue }
    await page.click('.continue-btn')
    await page.waitForTimeout(160)
  }
  await page.locator('text=Kick Off ▸').first().click()
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    await page.click('.talk-modal .speech-tile >> text=Calm the nerves')
  } catch { /* a talk was already given */ }
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* clean sheet, no ready check */ }
  await page.waitForSelector('.scoreboard', { timeout: 15000 })

  // the decoration IS off
  const score = await anim('.scoreboard .score')
  say(`  score pop under reduced motion: ${score?.name} ${score?.dur}`)
  ok(!!score && parseFloat(score.dur) < 0.01, 'the score pop is collapsed to nothing')

  // and the banner, which must keep its length, has swapped to the opacity hold
  const banner = await page.evaluate(() => {
    const host = document.querySelector('.pitch') ?? document.body
    const d = document.createElement('div')
    d.className = 'ev-banner'
    host.appendChild(d)
    const cs = getComputedStyle(d)
    const out = { name: cs.animationName, dur: cs.animationDuration }
    d.remove()
    return out
  })
  say(`  event banner under reduced motion: ${banner.name} ${banner.dur}`)
  ok(banner.name === 'rm-hold', 'the event banner keeps an animation rather than jumping to its hidden last frame')
  ok(parseFloat(banner.dur) > 1, 'and keeps its full length, so the try is still announced')

  // play it out
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Start Second Half', { timeout: 25000 })
  await page.click('text=▸ Start Second Half')
  await page.waitForTimeout(300)
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Play the Final Quarter', { timeout: 25000 })
  await page.click('text=▸ Play the Final Quarter')
  await page.waitForTimeout(300)
  await page.click('.speed-controls >> text=Skip')
  await page.waitForSelector('text=Continue to Results', { timeout: 25000 })

  // THE MOMENT. The stamp is mounted for as long as the match is done, so its
  // opacity is the only thing that says whether full time was announced at all.
  const early = await anim('.ft-stamp')
  say(`  full-time stamp at the whistle: ${early?.name} ${early?.dur} opacity ${early?.opacity}`)
  ok(!!early, 'the full-time stamp is on screen at all')
  ok(!!early && early.name === 'rm-hold', 'it holds rather than collapsing to its hidden frame')
  ok(!!early && early.opacity > 0.5, 'and it is visible when the whistle goes')

  await page.waitForTimeout(3200)
  const late = await anim('.ft-stamp')
  say(`  and 3.2s later: opacity ${late?.opacity}`)
  ok(!!late, 'the stamp is still mounted (nothing unmounts it - the fade is the dismissal)')
  ok(!!late && late.opacity < 0.05, 'it has faded out, so it is not parked over the pitch')

  // with motion allowed, the original animation is back
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const normal = await anim('.ft-stamp')
  say(`  with motion allowed: ${normal?.name} ${normal?.dur}`)
  ok(!!normal && normal.name === 'ftstamp', 'motion-allowed phones still get the real stamp animation')

  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
  await page.screenshot({ path: '/tmp/motionprobe-fail.png' }).catch(() => {})
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nMOTION PROBE FAILED (${fails})` : '\nMOTION PROBE PASSED: calm, and still says what happened')
done(fails)
