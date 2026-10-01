// ---- THE COMMENTARY DOES NOT JUMP (round 5) ----
//
// Owner: "In-game commentary needs to be smoother as it flicks between
// stories. Like FM manager style."
//
// The phone's match screen used to show ONE commentary line at a time, keyed
// on the cursor, so every 640ms the box was torn down and rebuilt: the old line
// vanished in a frame, the new one faded in from nothing, the box changed
// height with the length of the sentence (one line, two lines, three) and the
// live stats under it lurched up and down by the difference, and a line about
// the other side swapped the whole box to the other club's colours in one
// frame. That is the flicker.
//
// This probe watches the real match screen at 390x844, frame by frame
// (requestAnimationFrame inside the page), at the Normal speed, and holds:
//
//   the stats panel under the commentary never moves (its top is fixed)
//   the commentary box keeps one height whatever the sentence
//   between two frames, no commentary line's top moves by more than a few
//     pixels unless it is the smooth slide (and a slide never exceeds one
//     line's height in total, spread over frames)
//   every line that leaves the screen fades or slides; nothing is replaced
//     in one frame (an old line is still there, dimmed, when the new one
//     arrives)
//   the beat is still 640ms at Normal (the line count over the window)
//   and with prefers-reduced-motion, nothing animates at all
//
// FEED_STRIP=<dir> also writes a frame strip of a line change to <dir>.
//
// Run: npm run build && node scripts/feedprobe.mjs
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const PORT = process.env.FEED_PORT ?? '4293'
const server = await startPreview(PORT, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

async function toMatch(reduced) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.addInitScript(() => {
    let a = 20261001
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  })
  await page.goto(`http://localhost:${PORT}/?motion=1`)
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
  // past the talk's reactions, so the stats are on the stage
  for (let i = 0; i < 40; i++) {
    const close = page.locator('.talk-react button').first()
    if (await close.count()) { await close.click().catch(() => {}); break }
    await page.waitForTimeout(100)
  }
  await page.waitForSelector('.live-stats', { timeout: 10000 })
  // the screen's own arrival (the motion layer's rise) settles first
  await page.waitForTimeout(700)
  return { ctx, page, errors }
}

/** Every frame for `ms`: where each commentary line is, how opaque, and where
 *  the stats start. */
async function watch(page, ms) {
  return page.evaluate(ms => new Promise(res => {
    const frames = []
    const t0 = performance.now()
    const step = () => {
      const now = performance.now()
      const box = document.querySelector('.comm-feed') ?? document.querySelector('.now-line')
      const stats = document.querySelector('.live-stats')
      const lines = [...document.querySelectorAll('.comm-feed .comm-line, .now-strip .now-line')].map(el => {
        const r = el.getBoundingClientRect()
        return { key: el.getAttribute('data-k') ?? el.textContent, top: r.top, h: r.height, op: +getComputedStyle(el).opacity }
      })
      const panel = !!document.querySelector('.panel-area')
      const clip = !!document.querySelector('.hl-clip')
      frames.push({ t: now - t0, boxH: box?.getBoundingClientRect().height ?? -1, statsTop: stats?.getBoundingClientRect().top ?? -1, lines, panel, clip,
        newest: document.querySelector('.comm-feed .comm-line.cur, .now-strip .now-line')?.textContent ?? '' })
      if (now - t0 < ms) requestAnimationFrame(step); else res(frames)
    }
    requestAnimationFrame(step)
  }), ms)
}

function analyse(frames, label) {
  // only frames of the running ticker (an interval or a decision swaps the
  // whole screen for a panel, on purpose, and a highlight takes the stage)
  const run = frames.filter(f => !f.panel && !f.clip && f.boxH > 0)
  let statsJump = 0, boxJump = 0, lineJump = 0, jumps = 0, popped = 0, changes = 0
  const boxHs = new Set()
  const dbg = (...m) => { if (process.env.FEED_DEBUG) console.log('   ', ...m) }
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1], b = run[i]
    if (a.statsTop > 0 && b.statsTop > 0) {
      const d = Math.abs(b.statsTop - a.statsTop)
      if (d > 0.5) dbg('stats moved', d.toFixed(2))
      statsJump = Math.max(statsJump, d)
    }
    boxJump = Math.max(boxJump, Math.abs(b.boxH - a.boxH))
    boxHs.add(Math.round(b.boxH))
    if (a.newest !== b.newest) {
      changes++
      // the line that was current must still be on screen in the next frame
      // (dimmed, sliding up), not swapped out in one frame
      if (a.lines.length && !b.lines.some(l => a.lines.some(m => m.key === l.key))) {
        popped++
        dbg('replaced', a.lines.map(l => l.key), b.lines.map(l => l.key))
      }
    }
    // A JUMP is a line covering a large part of the slide in ONE frame. The
    // slide itself moves every line by the new line's height over ~13
    // frames, so a frame's share of it is small; a snap is all of it at once.
    // A frame that took longer than one refresh is allowed its share.
    const rowH = Math.max(40, ...b.lines.map(l => l.h))
    const frames60 = Math.max(1, Math.round((b.t - a.t) / 16.7))
    const limit = Math.max(4, 0.3 * rowH * frames60)
    for (const l of b.lines) {
      const m = a.lines.find(x => x.key === l.key)
      if (!m) continue
      const d = Math.abs(l.top - m.top)
      lineJump = Math.max(lineJump, d / frames60)
      if (d > limit) { jumps++; dbg('jump', d.toFixed(1), 'px in', (b.t - a.t).toFixed(1), 'ms, row', l.key) }
    }
  }
  const secs = run.length ? (run[run.length - 1].t - run[0].t) / 1000 : 0
  console.log(`  [${label}] ${run.length} frames over ${secs.toFixed(1)}s, ${changes} line changes; stats moved ${statsJump.toFixed(1)}px, box height moved ${boxJump.toFixed(1)}px (${boxHs.size} heights), fastest line ${lineJump.toFixed(1)}px a frame, ${jumps} jumps, ${popped} lines replaced in one frame`)
  return { statsJump, boxJump, lineJump, jumps, popped, changes, secs, heights: boxHs.size }
}

try {
  // ---- with motion ----
  {
    const { ctx, page, errors } = await toMatch(false)
    const frames = await watch(page, 9000)
    const r = analyse(frames, 'motion')
    ok(r.changes >= 6, `the ticker moved on (${r.changes} new lines in ${r.secs.toFixed(1)}s)`)
    // 640ms a line at Normal, plus the tension and set-piece holds: never
    // faster than the beat, and not much slower over a few seconds
    ok(r.changes <= Math.ceil(r.secs * 1000 / 640) + 1, `the beat is no faster than 640ms a line`)
    ok(r.statsJump <= 1, `the stats under the commentary stay put (largest move ${r.statsJump.toFixed(1)}px)`)
    ok(r.boxJump <= 1 && r.heights <= 1, `the commentary box keeps one height (${r.heights} heights)`)
    ok(r.jumps === 0, `no line jumps between frames: every move is a slice of the glide (fastest ${r.lineJump.toFixed(1)}px a frame)`)
    ok(r.popped === 0, `no line is replaced in one frame (${r.popped} were)`)

    if (process.env.FEED_STRIP) {
      mkdirSync(process.env.FEED_STRIP, { recursive: true })
      const name = process.env.FEED_NAME ?? 'commentary'
      // a strip across one line change: wait for a fresh line, then a frame
      // every 70ms
      const first = await page.evaluate(() => document.querySelector('.comm-feed .comm-line.cur, .now-strip .now-line')?.textContent ?? '')
      for (let i = 0; i < 40; i++) {
        const now = await page.evaluate(() => document.querySelector('.comm-feed .comm-line.cur, .now-strip .now-line')?.textContent ?? '')
        if (now !== first) break
        await page.waitForTimeout(15)
      }
      const shots = []
      const clipBox = await page.evaluate(() => {
        const a = document.querySelector('.now-strip')?.getBoundingClientRect()
        const b = document.querySelector('.live-stats')?.getBoundingClientRect()
        if (!a) return null; const y = Math.max(0, Math.round(a.top - 6)); return { x: 0, y, width: 390, height: Math.round(Math.min(844, b ? b.top + 90 : a.bottom + 10) - y) }
      })
      for (let i = 0; i < 8; i++) {
        shots.push((await page.screenshot(clipBox ? { clip: clipBox } : {})).toString('base64'))
        await page.waitForTimeout(70)
      }
      await page.screenshot({ path: `${process.env.FEED_STRIP}/${name}-screen.png` })
      const sp = await ctx.newPage()
      await sp.setViewportSize({ width: 4 * 400, height: Math.ceil(2 * ((clipBox?.height ?? 300) + 24)) })
      await sp.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,400px);font:12px sans-serif;color:#ccc">${shots.map((s, i) =>
        `<div style="padding:2px 5px"><div>+${i * 70}ms</div><img style="width:390px" src="data:image/png;base64,${s}"></div>`).join('')}</body>`)
      await sp.screenshot({ path: `${process.env.FEED_STRIP}/${name}-strip.png`, fullPage: true })
      console.log(`  strip written to ${process.env.FEED_STRIP}/${name}-strip.png`)
    }
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0].slice(0, 160) : ''}`)
    await ctx.close()
  }
  // ---- reduced motion: the same layout, no animation ----
  {
    const { ctx, page, errors } = await toMatch(true)
    const anim = await page.evaluate(() => [...document.querySelectorAll('.comm-feed, .comm-feed *, .now-strip, .now-strip *')]
      .map(el => getComputedStyle(el)).filter(s => (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.011)
        || s.transitionProperty !== 'all' && parseFloat(s.transitionDuration) > 0.011).length)
    ok(anim === 0, `with reduced motion nothing in the commentary animates (${anim} animated)`)
    const frames = await watch(page, 4000)
    const r = analyse(frames, 'reduced')
    ok(r.statsJump <= 1 && r.heights <= 1, 'and the layout is just as still')
    ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0].slice(0, 160) : ''}`)
    await ctx.close()
  }
} catch (e) {
  console.log(`FAIL  the walk broke: ${e.message}`); fails++
}
await browser.close()
server.stop()
console.log(fails ? `\nFEED PROBE FAILED (${fails})` : '\nFEED PROBE PASSED: the commentary eases in and never jumps')
done(fails)
