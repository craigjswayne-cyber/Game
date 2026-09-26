// ---- THE MEN DO SOMETHING IN A MOMENT, ON THE REAL PITCH ----
//
// Owner, 26 Sep 2026: "1, 2, 3 & 5": tackles and rucks you can see, cards and
// substitutions on the pitch, the scrum pushing and the lineout lifting. The
// rules live in pitchactsprobe.ts; this plays a real match in a real browser and
// holds what a manager actually sees, with the animations frozen and stepped to
// exact moments (a screenshot takes about as long as the whole tackle):
//
//   1. a tackle takes the carrier and the tackler to ground, with a ring where
//      it is made
//   2. a contested scrum drives; the lineout jumper goes up in the lift
//   3. a man shown a yellow card stays on the pitch until the line that shows
//      it, then walks off with the card over him (he used to vanish one line
//      early, because the pitch read cards by minute)
//   4. the bench: a man replaced jogs off and his replacement jogs on, even
//      when the change comes on either side of a break, which is when the
//      bench mostly comes on (the pitch used to forget everything when it was
//      taken down for a break)
//   5. with reduced motion, none of it: every man is simply where he stands
//
// Run: node scripts/actsprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const PORT = 4263
const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** A career, a match, up to the first kick-off: seeded, so it is the same match
 *  every run. */
async function kickOff(reduced) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.addInitScript(() => {
    let a = 0x9e3779b9
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  })
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career'); await page.click('text=English Premier Division'); await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton'); await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Acts'); await page.click('.speech-tile >> text=Forward Dominance'); await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career'); await page.waitForSelector('.tut-box', { timeout: 20000 }); await page.click('.tut-close .btn')
  for (let t = 0; t < 10 && !(await page.locator('text=Kick Off ▸').count()); t++) { await page.click('.continue-btn'); await page.waitForTimeout(400) }
  await page.locator('text=Kick Off ▸').first().click(); await page.click('.talk-modal .speech-tile >> nth=0')
  try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  return { page, errs }
}

/** Play on the way live play does, one line at a time, until `stop` says so.
 *  The heartbeat is switched off first, so nothing moves unless this moves it. */
async function playUntil(page, stop) {
  return page.evaluate(async stop => {
    const S = () => window.rugbyStore.getState()
    window.__advance ??= S().advanceLive
    window.rugbyStore.setState({ advanceLive: () => {} })
    const until = new Function('lm', `return (${stop})(lm)`)
    for (let i = 0; i < 4000; i++) {
      const lm = S().liveMatch
      if (until(lm)) return true
      if (lm.ctx.seg === 3 && lm.cursor >= lm.ctx.events.length) return false
      if (lm.cursor >= lm.ctx.events.length && lm.ctx.awaiting) { S().startSecondHalf(); continue }
      if (lm.ctx.decision) { S().decide('posts'); continue }
      if (!lm.playing) S().matchCursor(lm.cursor, true)
      window.__advance()
      if (i % 40 === 0) await new Promise(r => setTimeout(r, 0))
    }
    return false
  }, stop.toString())
}

/** Show line i (the cursor one past it), playing, and freeze every animation at
 *  its start. Returns the beat, as the pitch was told it. */
async function reveal(page, i) {
  await page.evaluate(i => { window.rugbyStore.getState().matchCursor(i, false) }, i)
  await page.waitForTimeout(1200)
  await page.evaluate(async i => {
    window.rugbyStore.getState().matchCursor(i + 1, true)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    window.__anims = document.getAnimations()
    for (const a of window.__anims) a.pause()
  }, i)
}
/** What the pitch shows at t ms into the frozen beat. */
async function at(page, t) {
  return page.evaluate(t => {
    for (const a of window.__anims) { try { a.currentTime = t; a.pause() } catch { /* gone */ } }
    const dots = [...document.querySelectorAll('.pitch .pdot:not(.ghost)')]
    const cs = d => getComputedStyle(d)
    const box = el => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
    return {
      dots: dots.length,
      down: dots.filter(d => cs(d).scale.includes(' ')).length,
      lifted: dots.filter(d => { const s = cs(d).scale; return s !== 'none' && !s.includes(' ') && Number(s) > 1.3 }).length,
      moved: dots.filter(d => { const t = cs(d).translate; return t && t !== 'none' && Math.abs(parseFloat(t)) > 2 }).length,
      ring: document.querySelectorAll('.pitch .tackle-hit').length,
      ghosts: [...document.querySelectorAll('.pitch .pdot.ghost')].map(g => ({ ...box(g), o: Number(cs(g).opacity), card: !!g.querySelector('.cardchip') })),
      arriving: dots.filter(d => Number(cs(d).opacity) < 0.5).length,
      // the forwards (shirts 1 to 8, both sides): how far each is shifted
      // across the pitch by its own animation
      fwd: dots.filter(d => Number(d.firstChild?.textContent) <= 8).map(d => {
        const t = cs(d).translate
        return t && t !== 'none' ? parseFloat(t) : 0
      }),
    }
  }, t)
}
const tagOf = (e) => {
  const k = (e.k ?? '').replace(/_[fw]$/, '')
  if (e.fx === 'SCRUM') return /uncontested/.test(k) ? 'uscrum' : 'scrum'
  if (e.fx === 'LINEOUT') return 'lineout'
  if (e.type === 'YC') return 'yc'
  if (['comm.flav8', 'comm.flav12', 'comm.flav15', 'comm.flav23', 'comm.flavPac5', 'comm.flavGrass4', 'comm.flavDerby3', 'comm.flav5', 'comm.flav20', 'comm.flavWet5', 'comm.flavPac6'].includes(k) && !e.fx) return 'tackle'
  return null
}

try {
  // ------------------------------------------------------------ effects on
  {
    const { page, errs } = await kickOff(false)
    await playUntil(page, lm => lm.ctx.seg === 3 && lm.cursor >= lm.ctx.events.length)
    const evs = await page.evaluate(() => window.rugbyStore.getState().liveMatch.ctx.events.map(e => ({ k: e.k, type: e.type, fx: e.fx, playerId: e.playerId, min: e.min })))
    const first = tag => evs.findIndex((e, j) => j > 2 && tagOf(e) === tag)

    say('--- 1. the tackle')
    const ti = first('tackle')
    ok(ti > 0, `the match has a line carried into contact (${evs[ti]?.k})`)
    if (ti > 0) {
      await reveal(page, ti)
      const beat = 800 * 0.94
      // the hit, the catch: the tackle is at 0.62 or 0.86 of the beat; look
      // just after each
      const a = await at(page, 0.7 * beat), b = await at(page, 0.9 * beat)
      const down = Math.max(a.down, b.down)
      ok(down >= 2, `the carrier and the tackler go to ground (${down} men down)`)
      ok(a.ring === 1, 'with a ring where the tackle is made')
      const end = await at(page, 1400)
      ok(end.down === 0, 'and everybody is back on his feet when the beat is over')
    }

    say('--- 2. the scrum and the lineout')
    const si = first('scrum')
    ok(si > 0, `the match has a contested scrum (${evs[si]?.k})`)
    if (si > 0) {
      await reveal(page, si)
      const bind = await at(page, 100), drive = await at(page, 1100)
      // the idle jog is 2.5px either way at most: a drive is the whole pack
      // shoved one way, further than that
      const shoved = xs => Math.max(xs.filter(x => x >= 4).length, xs.filter(x => x <= -4).length)
      ok(shoved(drive.fwd) >= 12 && shoved(bind.fwd) < 4,
        `the packs drive: ${shoved(drive.fwd)} of ${drive.fwd.length} forwards shoved the same way at the end of it, ${shoved(bind.fwd)} at the bind`)
    }
    const li = first('lineout')
    ok(li > 0, `the match has a lineout (${evs[li]?.k})`)
    if (li > 0) {
      await reveal(page, li)
      const up = await at(page, 0.5 * 1200 * 0.94), down = await at(page, 1300)
      ok(up.lifted >= 1, `the jumper goes up in the lift (${up.lifted} lifted at the top)`)
      ok(down.lifted === 0, 'and comes back down')
    }

    say('--- 3. the yellow card')
    const yi = first('yc')
    ok(yi > 0, 'the match has a yellow card')
    if (yi > 0) {
      await reveal(page, yi - 1)
      const before = await at(page, 2000)
      await reveal(page, yi)
      const s0 = await at(page, 0), s1 = await at(page, 900), s2 = await at(page, 3000)
      ok(s0.dots === before.dots - 1, `he is on the pitch until the line that shows it (${before.dots} men, then ${s0.dots})`)
      const g0 = s0.ghosts.find(g => g.card), g1 = s1.ghosts.find(g => g.card)
      ok(!!g0 && g0.o > 0.9, 'and then walks off with the card held over him')
      ok(!!g0 && !!g1 && g1.y > g0.y + 20, `towards the touchline (${Math.round(g0?.y ?? 0)} -> ${Math.round(g1?.y ?? 0)})`)
      ok(!s2.ghosts.some(g => g.o > 0.05), 'and is gone when he gets there')
    }
    ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`)
    await page.close()
  }

  // ------------------------------------------------------------- the bench
  {
    say('--- 4. the bench')
    const { page, errs } = await kickOff(false)
    // live, to the first change of personnel, whichever side of a break it
    // falls: the pitch is up again by the time the next line is revealed
    const found = await page.evaluate(async () => {
      const S = () => window.rugbyStore.getState()
      window.__advance ??= S().advanceLive
      window.rugbyStore.setState({ advanceLive: () => {} })
      const on = () => { const c = S().liveMatch.ctx; return [...c.home.onPitch, ...c.away.onPitch] }
      for (let i = 0; i < 600; i++) {
        const lm = S().liveMatch
        if (lm.ctx.seg === 3 && lm.cursor >= lm.ctx.events.length) return null
        if (lm.cursor >= lm.ctx.events.length && lm.ctx.awaiting) {
          // a break: the pitch comes down for the panel, as it does in play
          await new Promise(r => setTimeout(r, 400))
          S().startSecondHalf(); continue
        }
        if (lm.ctx.decision) { S().decide('posts'); continue }
        if (!lm.playing) S().matchCursor(lm.cursor, true)
        const was = on(), cur = lm.cursor
        window.__advance()
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        // somebody on who was not on before AND somebody off: a replacement,
        // not a card, and not a sin-binned man coming back
        const now = on()
        const came = now.filter(id => !was.includes(id)), went = was.filter(id => !now.includes(id))
        if (came.length && went.length && S().liveMatch.cursor > cur && document.querySelector('.pitch')) {
          window.__anims = document.getAnimations()
          for (const a of window.__anims) a.pause()
          return { tick: S().liveMatch.ctx.tick, came: came.length, line: S().liveMatch.ctx.events[S().liveMatch.cursor - 1]?.k }
        }
        // give a changed pitch time to settle, as the real beat does
        await new Promise(r => setTimeout(r, 60))
      }
      return null
    })
    ok(!!found, `a replacement comes on in the match (${found?.came} at tick ${found?.tick}, ${found?.line})`)
    if (found) {
      const s0 = await at(page, 0), s1 = await at(page, 600)
      ok(s0.ghosts.length >= 1, `the man replaced is still there, leaving (${s0.ghosts.length})`)
      ok(s0.ghosts.length > 0 && s1.ghosts.every((g, i) => g.y > s0.ghosts[i].y), 'and heads for the touchline')
      ok(s0.arriving >= 1, `his replacement comes on from the bench (${s0.arriving} arriving)`)
      ok(s1.arriving === 0, 'and is on the field a moment later')
    }
    ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`)
    await page.close()
  }

  // ------------------------------------------------- a change at half time
  {
    say('--- 4b. a change at half time')
    const { page, errs } = await kickOff(false)
    await playUntil(page, lm => lm.ctx.awaiting === 'HT' && lm.cursor >= lm.ctx.events.length)
    // the half-time panel is up and the pitch is down: make the change a
    // manager makes there, then start the second half
    const swap = await page.evaluate(async () => {
      const S = () => window.rugbyStore.getState()
      const c = S().liveMatch.ctx
      const mine = c.userSideId === c.home.teamId ? c.home : c.away
      const out = mine.lineup.slice(0, 15).find(id => id != null && mine.onPitch.has(id))
      const inn = mine.lineup.slice(15).find(id => id != null && !mine.onPitch.has(id) && !S().game.players[id]?.injury)
      const msg = S().halfTimeSub(out, inn)
      await new Promise(r => setTimeout(r, 300))
      S().startSecondHalf()
      S().matchCursor(S().liveMatch.cursor, true)
      for (let i = 0; i < 20 && !document.querySelector('.pitch'); i++) await new Promise(r => setTimeout(r, 50))
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      window.__anims = document.getAnimations()
      for (const a of window.__anims) a.pause()
      return { out, inn, msg, on: mine.onPitch.has(inn) }
    })
    ok(swap.on, `the change is made at half time (${swap.msg})`)
    const s0 = await at(page, 0)
    ok(s0.ghosts.length >= 1, `when the pitch comes back up, the man taken off is still leaving it (${s0.ghosts.length})`)
    ok(s0.arriving >= 1, `and his replacement is coming on (${s0.arriving})`)
    ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`)
    await page.close()
  }

  // --------------------------------------------------------- reduced motion
  {
    say('--- 5. reduced motion')
    const { page } = await kickOff(true)
    await playUntil(page, lm => lm.ctx.seg === 3 && lm.cursor >= lm.ctx.events.length)
    const evs = await page.evaluate(() => window.rugbyStore.getState().liveMatch.ctx.events.map(e => ({ k: e.k, type: e.type, fx: e.fx })))
    let any = 0, seen = 0
    for (const tag of ['tackle', 'scrum', 'lineout', 'yc']) {
      const i = evs.findIndex((e, j) => j > 2 && tagOf(e) === tag)
      if (i < 0) continue
      seen++
      await reveal(page, i)
      const s = await at(page, 500)
      if (s.down || s.lifted || s.ring || s.ghosts.length) { any++; say(`       ${tag}: ${JSON.stringify(s)}`) }
    }
    ok(seen >= 3, `the same moments are in the match (${seen})`)
    ok(any === 0, 'and none of them is acted out: every man is where he stands')
    await page.close()
  }
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nACTS PROBE FAILED (${fails})` : '\nACTS PROBE PASSED: the tackle goes to ground, the scrum drives, the jumper goes up, and men walk off and jog on')
done(fails)
