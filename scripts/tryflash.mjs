// Probe: a try line flashes in its side's colours the other way round for
// about a second, then settles back to its own look, and nothing else does.
//
// Owner: "when a try is scored it should flash with inverted team colours for
// 1 second just to make it feel different - it should go back to normal in the
// commentary after."
//
// Holds, on the phone's feed at Fast (the pace where a line goes old before its
// second is up):
//   a try line gets .try-flash and, while it has it, wears the inverted pair:
//     its fill is the colour its text would have been, its text the fill
//   the class is gone and the line looks like itself again by ~1.2s
//   only one line flashes at a time, and only a TRY line
//   Skip to half time flashes nothing, however many tries it jumps over
//
// Run: npm run build && node scripts/tryflash.mjs
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4231', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
await page.addInitScript(() => {
  localStorage.setItem('phase.matchPrefs', JSON.stringify({ highlights: 'key', bigText: true, speed: 2 }))
})

const answer = async () => {
  for (const label of ['Take the Points', 'Kick for the Corner', 'Scrum']) {
    const b = page.locator(`button:has-text("${label}")`)
    if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(200); return true }
  }
  return false
}

try {
  await page.goto('http://localhost:4231/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Test Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off').count()) break
    for (const label of ['On to the Week', 'Next Story ▸', 'Get On With The Week']) {
      const b = page.locator(`text=${label}`)
      if (await b.count()) { await b.first().click(); await page.waitForTimeout(200) }
    }
    const rej = page.locator('.btn.danger >> text=Reject')
    if (await rej.count()) { await rej.first().click(); await page.waitForTimeout(200); continue }
    const cont = page.locator('.continue-btn')
    if (!(await cont.count())) break
    await cont.click()
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()
  try {
    await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    await page.click('.talk-modal .speech-tile >> text=Calm the nerves')
  } catch { /* no dressing room */ }
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* straight down the tunnel */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // a frame-by-frame watch inside the page: every line that carries
  // .try-flash, when it got it and lost it, and how it looked on the way
  await page.evaluate(() => {
    const W = (globalThis.__tf = { lines: {}, maxAtOnce: 0, nonTry: 0, stop: false })
    const t0 = performance.now()
    const frame = () => {
      const now = performance.now() - t0
      const on = [...document.querySelectorAll('.comm-line.try-flash')]
      W.maxAtOnce = Math.max(W.maxAtOnce, on.length)
      for (const el of on) {
        const k = el.dataset.k
        if (!el.classList.contains('big')) W.nonTry++
        const cs = getComputedStyle(el)
        const L = (W.lines[k] ??= { k, from: now, to: now, txt: el.textContent, inverted: null, fill: null })
        L.to = now
        if (L.inverted == null && now - L.from > 60) {
          // the pair it should wear, resolved by the browser
          const probe = document.createElement('div')
          probe.style.cssText = `background:${cs.getPropertyValue('--flash-bg')};color:${cs.getPropertyValue('--flash-fg')}`
          document.body.appendChild(probe)
          const want = getComputedStyle(probe)
          L.inverted = cs.backgroundColor === want.backgroundColor && cs.color === want.color
          L.want = [want.backgroundColor, want.color]
          L.got = [cs.backgroundColor, cs.color]
          probe.remove()
        }
      }
      // a line that has lost the class: what does it look like now
      for (const L of Object.values(W.lines)) {
        if (L.after || now - L.to < 300) continue
        const el = document.querySelector(`.comm-line[data-k="${L.k}"]`)
        if (!el) { L.after = 'gone'; continue }
        const cs = getComputedStyle(el)
        L.after = { flashing: el.classList.contains('try-flash'), bg: cs.backgroundColor, color: cs.color, anims: el.getAnimations().map(a => a.animationName) }
      }
      if (!W.stop) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })

  // watch play until two tries have flashed (or the first half runs out)
  for (let i = 0; i < 400; i++) {
    if (await answer()) continue
    const n = await page.evaluate(() => Object.values(globalThis.__tf.lines).filter(l => l.after).length)
    if (n >= 2) break
    if (await page.locator('text=Start Second Half').count()) break
    await page.waitForTimeout(250)
  }
  const W = await page.evaluate(() => globalThis.__tf)
  const lines = Object.values(W.lines)
  for (const L of lines) say(`      line ${L.k}: flashed ${Math.round(L.to - L.from)}ms, inverted ${L.inverted} ${JSON.stringify(L.got)} want ${JSON.stringify(L.want)}, after ${JSON.stringify(L.after)}`)
  ok(lines.length > 0, `a try line flashed (${lines.length})`)
  ok(lines.every(L => L.inverted), 'while flashing it wears its colours the other way round')
  ok(lines.every(L => L.to - L.from >= 700 && L.to - L.from <= 1400), 'the flash lasts about a second')
  ok(lines.every(L => L.after === 'gone' || (!L.after.flashing && !L.after.anims.includes('try-flash') && L.after.bg !== L.want[0])), 'and then the line is back to its own look')
  ok(W.maxAtOnce <= 1, `never more than one line flashing (${W.maxAtOnce})`)
  ok(W.nonTry === 0, 'only score lines flash')

  // ---- skipping flashes nothing ----
  const before = lines.length
  for (let i = 0; i < 60; i++) {
    if (await page.locator('text=Start Second Half').count()) break
    await answer()
    // skip only between flashes, so one already running does not count
    if (!(await page.locator('.comm-line.try-flash').count())) {
      const b = page.locator('.speed-controls [data-ctl=skip]:not([disabled])')
      if (await b.count()) await b.first().click().catch(() => {})
    }
    await page.waitForTimeout(400)
  }
  await page.waitForSelector('text=Start Second Half', { timeout: 25000 })
  const after = await page.evaluate(() => Object.keys(globalThis.__tf.lines).length)
  const scored = await page.evaluate(() => document.querySelector('.scoreboard')?.textContent)
  ok(after === before, `skipping to half time flashed nothing (${after - before} new, score ${scored?.replace(/\s+/g, ' ')})`)
  await page.click('text=▸ Start Second Half')
  await page.waitForSelector('.comm-line', { timeout: 5000 })
  await page.waitForTimeout(100)
  ok((await page.locator('.comm-line.try-flash').count()) === 0, 'coming back from half time does not replay old flashes')

  // ---- reduced motion: a still highlight, no animation ----
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let still = null
  for (let i = 0; i < 600 && !still; i++) {
    if (await answer()) continue
    if (await page.locator('text=Play the Final Quarter').count()) await page.click('text=▸ Play the Final Quarter')
    if (await page.locator('text=Continue to Results').count()) break
    still = await page.evaluate(() => {
      const el = document.querySelector('.comm-line.try-flash')
      if (!el) return null
      const cs = getComputedStyle(el)
      const probe = document.createElement('div')
      probe.style.cssText = `background:${cs.getPropertyValue('--flash-bg')};color:${cs.getPropertyValue('--flash-fg')}`
      document.body.appendChild(probe)
      const want = getComputedStyle(probe)
      const r = { anims: el.getAnimations().filter(a => a.animationName).length, inverted: cs.backgroundColor === want.backgroundColor && cs.color === want.color }
      probe.remove()
      return r
    })
    if (!still) await page.waitForTimeout(100)
  }
  ok(!!still && still.inverted && still.anims === 0, `with reduced motion a try is a still highlight (${JSON.stringify(still)})`)
  await page.evaluate(() => { globalThis.__tf.stop = true })
} catch (e) {
  say('PROBE THREW ' + String(e).slice(0, 400))
  fails++
}

say('')
say(fails === 0 ? 'TRY FLASH PASSED' : `TRY FLASH FAILED (${fails})`)
await browser.close()
server.stop?.()
done(fails)
