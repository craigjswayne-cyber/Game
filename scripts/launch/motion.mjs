// Trailer footage: real motion from the real build.
//
// The same showcase career as the stills (scripts/launch/showcase.ts), played
// by a script the way a manager plays it: taps on real buttons, scrolls through
// real screens, a real match at normal speed. Recorded with Chromium's
// screencast, which sends a frame whenever the screen changes, so a hold costs
// nothing and an animation is caught as it happens. No cursor, no browser
// chrome, no emulator frame: the page is the whole picture.
//
//   node scripts/launch/motion.mjs [beat,beat]
//
// Writes storeart/motion/<beat>.mp4 (800 x 1736, 30 fps) and
// storeart/motion/beats.json (length, tap times, the frame rate achieved).
import { chromium } from 'playwright-core'
import { startPreview } from '../lib/preview.mjs'
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const OUT = 'storeart/motion'
const SAVES = 'storeart/saves'
const ONLY = process.argv[2]?.split(',')
mkdirSync(OUT, { recursive: true })
const META = existsSync(`${OUT}/beats.json`) ? JSON.parse(readFileSync(`${OUT}/beats.json`, 'utf8')) : {}
const want = (b) => !ONLY || ONLY.includes(b)
const say = (s) => console.log(s)

const server = await startPreview('4252', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function open(tag, { zoom = '', speed = 1 } = {}) {
  const record = JSON.parse(readFileSync(`${SAVES}/${tag}.json`, 'utf8'))
  const page = await browser.newPage({ viewport: { width: 400, height: 868 }, deviceScaleFactor: 2, locale: 'en-GB' })
  page.setDefaultTimeout(15000)
  await page.addInitScript(([z, sp]) => {
    localStorage.setItem('rm-night', '1'); localStorage.setItem('rm-lang', 'en')
    if (z) localStorage.setItem('rm-zoom', z)
    localStorage.setItem('phase.matchPrefs', JSON.stringify({ highlights: 'key', bigText: true, speed: sp }))
  }, [zoom, speed])
  await page.goto('http://localhost:4252/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate((rec) => new Promise((res, rej) => {
    const req = indexedDB.open('rugby-manager', 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('saves')) req.result.createObjectStore('saves') }
    req.onsuccess = () => { const tx = req.result.transaction('saves', 'readwrite'); tx.objectStore('saves').put(rec, 'deep'); tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error) }
    req.onerror = () => rej(req.error)
  }), record)
  await page.reload()
  await page.waitForSelector('text=RUGBY')
  await page.click('text=Load Career')
  await page.click(`text=${record.state.managerName}`)
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })
  for (let i = 0; i < 4 && await page.locator('.celebrate-veil').count(); i++) {
    await page.locator('.celebrate-veil').click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(300)
  }
  if (await page.locator('.tut-close .btn').count()) await page.locator('.tut-close .btn').click()
  await page.waitForTimeout(500)
  return { page, record, cdp: await page.context().newCDPSession(page) }
}

/** A screencast recording. Frames arrive on change; the hold after the last
 *  frame is kept by stopping on the wall clock. */
function recorder(cdp, name) {
  const dir = `${OUT}/${name}.frames`
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const frames = [], taps = []
  let t0 = 0
  const onFrame = async (f) => {
    const ts = f.metadata.timestamp
    if (!t0) t0 = ts
    const file = `${dir}/f${String(frames.length).padStart(5, '0')}.jpg`
    writeFileSync(file, Buffer.from(f.data, 'base64'))
    frames.push({ file, t: ts - t0 })
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  }
  return {
    async start() {
      cdp.on('Page.screencastFrame', onFrame)
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 800, maxHeight: 1736, everyNthFrame: 1 })
      const w = Date.now(); while (!t0 && Date.now() - w < 3000) await new Promise(r => setTimeout(r, 20))
      this.wall0 = Date.now() / 1000
    },
    tap() { taps.push(+(Date.now() / 1000 - this.wall0).toFixed(3)) },
    async stop() {
      const end = Date.now() / 1000 - this.wall0
      await cdp.send('Page.stopScreencast'); cdp.off('Page.screencastFrame', onFrame)
      if (!frames.length) throw new Error(`${name}: no frames`)
      // ffconcat with the real time each frame was on screen, then a steady 30 fps
      let list = 'ffconcat version 1.0\n'
      frames.forEach((f, i) => {
        const next = i + 1 < frames.length ? frames[i + 1].t : end
        list += `file '${f.file.split('/').pop()}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`
      })
      list += `file '${frames[frames.length - 1].file.split('/').pop()}'\n`
      writeFileSync(`${dir}/list.txt`, list)
      execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`,
        '-vf', 'scale=800:1736:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', `${OUT}/${name}.mp4`])
      const active = frames.filter((f, i) => i && f.t - frames[i - 1].t < 0.2)
      const fps = active.length > 1 ? active.length / active.reduce((a, f, i) => a + (f.t - frames[frames.indexOf(f) - 1].t), 0) : 0
      META[name] = { length: +end.toFixed(2), taps, frames: frames.length, motionFps: +fps.toFixed(1) }
      writeFileSync(`${OUT}/beats.json`, JSON.stringify(META, null, 2))
      rmSync(dir, { recursive: true, force: true })
      say(`  ok  ${name}: ${end.toFixed(1)} s, ${frames.length} frames, ~${fps.toFixed(0)} fps in motion, taps ${JSON.stringify(taps)}`)
    },
  }
}

const hold = (page, ms) => page.waitForTimeout(ms)

/** Smooth, eased scroll of the app's scroller, in the page's own frames. */
const glide = (page, to, ms) => page.evaluate(([to, ms]) => new Promise(res => {
  const el = document.querySelector('.content')
  if (!el) return res(null)
  const from = el.scrollTop, target = typeof to === 'number' && to <= 1 ? (el.scrollHeight - el.clientHeight) * to : to
  const t0 = performance.now()
  const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms)
    el.scrollTop = from + (target - from) * ease(k)
    k < 1 ? requestAnimationFrame(step) : res(null)
  }
  requestAnimationFrame(step)
}), [to, ms])

/** Scroll so an element sits a little below the top, smoothly. */
async function glideTo(page, selector, ms, pad = 90) {
  const y = await page.evaluate(([sel, pad]) => {
    const el = document.querySelector('.content')
    // 'text=...' finds the element whose own text holds the words
    let t = null
    if (sel.startsWith('text=')) {
      const want = sel.slice(5)
      const w = document.createTreeWalker(el ?? document.body, NodeFilter.SHOW_TEXT)
      while (w.nextNode()) if (w.currentNode.textContent.includes(want)) { t = w.currentNode.parentElement; break }
    } else t = document.querySelector(sel)
    if (!el || !t) return null
    return el.scrollTop + t.getBoundingClientRect().top - el.getBoundingClientRect().top - pad
  }, [selector, pad])
  if (y != null) await glide(page, Math.max(0, y) + 2, ms)
}

/** Click with a visible press: the real button, held for a beat like a thumb. */
async function press(page, rec, locator) {
  const box = await locator.boundingBox()
  rec.tap()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await hold(page, 110); await page.mouse.up()
}

/** Play the week forward until `stop` holds, answering what a manager must. */
async function advance(page, stop, tries = 90) {
  await page.evaluate(() => window.rugbyStore.getState().home())
  await hold(page, 400)
  for (let i = 0; i < tries; i++) {
    if (await stop()) return true
    if (await page.locator('text=Ready for a new season').count()) await page.locator('text=Ready for a new season').click().catch(() => {})
    else if (await page.locator('.content button.btn.ghost:has-text("“")').count()) await page.locator('.content button.btn.ghost:has-text("“")').nth(1).click().catch(() => {})
    else if (await page.locator('text=Skip the rest').count()) await page.locator('text=Skip the rest').click().catch(() => {})
    else if (await page.locator('.wire-body').count()) await page.locator('.btn-row .btn.gold').last().click().catch(() => {})
    else if (await page.locator('.continue-btn').count()) await page.locator('.continue-btn').click().catch(() => {})
    else return false
    await hold(page, 300)
    for (let j = 0; j < 3 && await page.locator('.celebrate-veil').count(); j++) await page.locator('.celebrate-veil').click({ position: { x: 5, y: 5 } }).catch(() => {})
  }
  return false
}

const pressQuestion = (page) => async () => (await page.locator('.content button.btn.ghost:has-text("“")').count()) > 0
  && (await page.locator('text=ASKS').count()) > 0

// ------------------------------------------------------------- session A
// s11w30: the press question, the rival line on match day, the match itself
if (['decision', 'rival', 'match', 'halftime', 'fulltime'].some(want)) {
  const { page, cdp } = await open('s11w30')
  if (!(await advance(page, pressQuestion(page)))) throw new Error('press question not reached')
  await glide(page, 0, 10)
  if (want('decision')) {
    const r = recorder(cdp, 'decision'); await r.start()
    await hold(page, 2600)
    await press(page, r, page.locator('.content button.btn.ghost:has-text("“")').nth(1))
    await hold(page, 2600)
    await r.stop()
  } else await page.locator('.content button.btn.ghost:has-text("“")').nth(1).click()
  // on to match day, answering the rest of the week as a manager would
  if (!(await advance(page, async () => (await page.locator('.mday-head').count()) > 0))) throw new Error('match day not reached')
  if (want('rival')) {
    const r = recorder(cdp, 'rival'); await r.start()
    await hold(page, 3200); await glide(page, 0.12, 1600); await hold(page, 1200)
    await r.stop()
  }
  // kick off; a talk if the room asks for one; the ready check
  await page.locator('.continue-btn').click(); await hold(page, 700)
  if (await page.locator('.talk-modal').count()) { await page.locator('.talk-modal .speech-tile').first().click(); await hold(page, 700) }
  if (await page.locator('.modal .btn.gold').count() && !(await page.locator('.live-wrap').count())) { await page.locator('.modal .btn.gold').click(); await hold(page, 700) }
  await page.waitForSelector('.live-wrap', { timeout: 15000 })
  const settle = async (rec) => {
    if (await page.locator('.sheet-row.armed').count()) { if (rec) rec.tap(); await page.locator('.sheet-row.armed').first().click().catch(() => {}) }
    const back = page.locator('button.btn.gold:has-text("Back to the Match"):not([disabled])')
    if (await back.count()) await back.first().click().catch(() => {})
  }
  const minute = async () => Number(((await page.locator('.scoreboard').textContent().catch(() => '')) ?? '').match(/(\d+)['’]/)?.[1] ?? 0)
  // the live match: from the opening exchanges through the first highlight clip
  if (want('match')) {
    const r = recorder(cdp, 'match'); await r.start()
    let seen = false, gone = 0
    for (let i = 0; i < 700; i++) {
      await settle(r)
      const clip = (await page.locator('.hl-clip').count()) > 0
      if (clip) seen = true
      if (seen && !clip && ++gone > 4) break
      if (!seen && i > 300) break
      await hold(page, 100)
    }
    await hold(page, 800)
    await r.stop()
  }
  // to half-time at speed: the skip control, as a manager in a hurry would
  for (let i = 0; i < 400 && !(await page.locator('text=Half-Time - the dressing room waits').count()); i++) {
    await settle()
    const skip = page.locator('.speed-controls .btn').nth(1)
    if ((await minute()) < 30 && await skip.count()) await skip.click().catch(() => {})
    await hold(page, 250)
  }
  if (want('halftime') && await page.locator('text=Half-Time - the dressing room waits').count()) {
    await glide(page, 0, 10)
    const r = recorder(cdp, 'halftime'); await r.start()
    await hold(page, 1800)
    await glideTo(page, 'text=Half-Time - the dressing room waits', 2400, 300)
    await hold(page, 1600)
    await r.stop()
  }
  // to full time, then the stamp and the verdict
  for (let i = 0; i < 120 && !(await page.locator('.ft-stamp').count()); i++) {
    await settle()
    const skip = page.locator('.speed-controls .btn').nth(1)
    if (await skip.count()) await skip.click().catch(() => {})
    else if (await page.locator('.panel-area .btn.gold').count()) await page.locator('.panel-area .btn.gold').first().click().catch(() => {})
    if (await page.locator('.ft-stamp').count()) break
    await hold(page, 500)
  }
  if (want('fulltime')) {
    // catch the stamp from its first frame: the recorder is already running
    const r = recorder(cdp, 'fulltime'); await r.start()
    await page.waitForSelector('.ft-stamp', { timeout: 30000 }).catch(() => {})
    await hold(page, 3400)
    await glideTo(page, 'text=What hurt you most', 2600, 170)
    await hold(page, 2600)
    await r.stop()
  }
  await page.close()
}

// ------------------------------------------------------------- session B
// s11w27: the bid, and a manager who wants more
if (want('bid')) {
  const { page, cdp } = await open('s11w27')
  await page.evaluate(() => { const st = window.rugbyStore.getState(); st.home(); st.go('offers') })
  await hold(page, 900)
  const r = recorder(cdp, 'bid'); await r.start()
  await hold(page, 2600)
  await press(page, r, page.locator('button:has-text("Demand More")').first())
  await hold(page, 2800)
  await r.stop()
  await page.close()
}

// ------------------------------------------------------------- session C
// s11w30, the game's Bigger text: the two stories, arrived at with the
// reader's own back arrow from the story before
async function story(name, re, direct = false) {
  const { page, cdp, record } = await open('s11w30', { zoom: '1.15' })
  const news = record.state.news
  const target = news.filter(n => re.test(n.subject)).pop()
  // the newer neighbour in the reader's order (newest first): ◀ steps to older
  const newer = news.filter(n => n.id > target.id && n.season === target.season).sort((a, b) => a.id - b.id)[0]
  await page.evaluate((id) => { const st = window.rugbyStore.getState(); st.home(); window.rugbyStore.setState({ inboxId: id }); st.go('inbox') }, direct ? target.id : newer.id)
  await hold(page, 900)
  const r = recorder(cdp, name); await r.start()
  await hold(page, 1300)
  // the reader's order is its own (unread first, then the recall window), so a
  // story it does not step onto from its neighbour is opened directly
  if (!direct) await press(page, r, page.locator('.reader-bar button').first())
  await hold(page, 300)
  const subj = await page.locator('.content').textContent()
  if (!re.test(subj.match(/(Word kept|Agents talk)[^\n]*/)?.[0] ?? '') && !subj.includes(target.subject)) {
    say(`  warn ${name}: the arrow did not land on "${target.subject}"`)
  }
  await hold(page, 4700)
  await r.stop()
  await page.close()
}
if (want('kept')) await story('kept', /^Word kept:/)
if (want('agents')) await story('agents', /^Agents talk:/, true)

// ------------------------------------------------------------- session D
// the final save: the legacy, the tactics board, home
if (['legacy', 'tactics', 'home'].some(want)) {
  const { page, cdp } = await open('final')
  if (want('home')) {
    await page.evaluate(() => window.rugbyStore.getState().home()); await hold(page, 700)
    const r = recorder(cdp, 'home'); await r.start()
    await hold(page, 1500); await glide(page, 0.35, 3000); await hold(page, 1200)
    await r.stop()
  }
  if (want('legacy')) {
    await page.evaluate(() => { const st = window.rugbyStore.getState(); st.home(); st.go('legacy') }); await hold(page, 900)
    const r = recorder(cdp, 'legacy'); await r.start()
    await hold(page, 1400); await glide(page, 0.5, 4200); await hold(page, 1400)
    await r.stop()
  }
  if (want('tactics')) {
    await page.evaluate(() => { const st = window.rugbyStore.getState(); st.home(); st.go('tactics') }); await hold(page, 900)
    const r = recorder(cdp, 'tactics'); await r.start()
    await hold(page, 1600)
    await press(page, r, page.locator('.form-pitch .form-chip').nth(9))
    await hold(page, 2600)
    await r.stop()
  }
  await page.close()
}

await browser.close()
server.stop()
say('MOTION: done')
process.exit(0)
