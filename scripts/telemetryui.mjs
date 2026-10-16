// ---- THE TEAM SHEET AS TELEMETRY, AND HOME WITH ONE THING ON TOP (1.9.0) ----
//
// Two screens changed shape in 1.9.0 and neither is on any other probe's path
// in the form it now has, so this drives both in a real browser at 412x915:
//
//   HOME: one hero card (the desk: what to decide, then the match) and the
//     rest as compact tiles in a two-column grid, every tile still a button,
//     and the gold attention edge on at most one of them.
//
//   THE MATCH MENU'S FIRST PANEL: all 23 of the manager's men in one table,
//     every row on the screen without scrolling AND the scoreboard still in
//     view above it; an energy bar on every row with a width from 0 to 100;
//     the 2px rule between the XV and the bench; a man the store puts in the
//     bin is flagged on his row; the opposition's 23 one tap away.
//
// It also saves the pictures the release notes describe, under
// shots/telemetry/: the panel in night and day and Home, at 412px.
//
// A match is driven the way subsprobe drives it: paused before any press, the
// store asked whether a press took, a kickable penalty answered with the
// points and an injury (the forced squad sheet over everything) answered with
// a free positional swap, as reloadprobe and subsprobe both learned to.
//
// Run: npm run build && node scripts/telemetryui.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { startPreview, done } from './lib/preview.mjs'

const PORT = 4281
const server = await startPreview(PORT, 2500)
const SHOTS = 'shots/telemetry'
mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => { if (localStorage.getItem('rm-night') == null) localStorage.setItem('rm-night', '1') })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const settle = async () => {
  try {
    await page.locator('.btn').filter({ hasText: 'Take the Points' }).first().click({ timeout: 1200 })
    await page.waitForTimeout(300)
    return true
  } catch { return false }
}
// AN INJURY STOPS PLAY AND OPENS THE FORCED SQUAD SHEET: answered with a free
// positional swap, which the sheet accepts as the change a stop demands
const clearInjury = async () => {
  if (!(await page.locator('.sheet-casualty').count())) return false
  const gold = page.locator('.squad-sheet .btn.gold')
  const goldOpen = async () => await gold.isEnabled().catch(() => false)
  if (!(await goldOpen())) {
    const pitch = page.locator('.squad-sheet .sheet-col').nth(0).locator('.sheet-row:not([disabled])')
    const n = await pitch.count()
    for (let i = 0; i + 1 < n && !(await goldOpen()); i++) {
      const armed = page.locator('.squad-sheet .sheet-row.armed')
      if (await armed.count()) await armed.first().click({ timeout: 800 }).catch(() => {})
      await pitch.nth(i).click({ timeout: 800 }).catch(() => {})
      await pitch.nth(i + 1).click({ timeout: 800 }).catch(() => {})
      await page.waitForTimeout(200)
    }
  }
  try { await gold.click({ timeout: 1500 }); return true } catch { return false }
}

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Tele'); await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await page.waitForTimeout(400)

  // ---- HOME
  const home = await page.evaluate(() => {
    const hero = document.querySelector('[data-home-hero]')
    const tiles = [...document.querySelectorAll('.home-tiles .home-tile')]
    const r = el => el.getBoundingClientRect()
    const grid = document.querySelector('.home-tiles')
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0
    const gold = [...document.querySelectorAll('.content .card, .content .home-tile, .content [data-home-hero]')]
      .filter(el => getComputedStyle(el).borderLeftWidth === '4px' && el.classList.contains('attn'))
    return {
      hero: !!hero,
      heroH: hero ? r(hero).height : 0,
      heroTop: hero ? r(hero).top : 0,
      tileTop: tiles.length ? Math.min(...tiles.map(t => r(t).top)) : 0,
      n: tiles.length,
      buttons: tiles.filter(t => t.tagName === 'BUTTON').length,
      maxH: tiles.length ? Math.max(...tiles.map(t => r(t).height)) : 0,
      medH: tiles.length ? tiles.map(t => r(t).height).sort((a, b) => a - b)[tiles.length >> 1] : 0,
      minH: tiles.length ? Math.min(...tiles.map(t => r(t).height)) : 0,
      cols,
      attn: gold.length,
      continueBtn: !!document.querySelector('.continue-btn'),
      dash: document.querySelectorAll('.dash-panel').length,
      widgets: document.querySelectorAll('.hub-widget[data-w]').length,
    }
  })
  ok(home.hero, 'Home has one hero card ([data-home-hero])')
  ok(home.hero && home.heroTop < home.tileTop, `the hero sits above the tiles (hero ${Math.round(home.heroTop)}px, tiles ${Math.round(home.tileTop)}px)`)
  ok(home.n >= 4, `the rest of Home is compact tiles (${home.n})`)
  ok(home.n > 0 && home.buttons === home.n, `every tile is a button (${home.buttons} of ${home.n})`)
  // compact, measured as a typical tile and a ceiling: the fixtures panel
  // carries five lines (two results, three to come) and is the tallest
  ok(home.n > 0 && home.medH <= 80 && home.maxH <= 120, `the tiles are compact: median ${Math.round(home.medH)}px, tallest ${Math.round(home.maxH)}px, shortest ${Math.round(home.minH)}px`)
  ok(home.hero && home.heroH > home.maxH, `the hero is the biggest thing on Home (${Math.round(home.heroH)}px against ${Math.round(home.maxH)}px)`)
  ok(home.minH >= 44, `every tile meets the 44px tap rule (${Math.round(home.minH)}px)`)
  ok(home.cols === 2, `two columns of tiles on a phone (${home.cols})`)
  ok(home.attn <= 1, `the gold attention edge is on at most one thing (${home.attn})`)
  ok(home.continueBtn && home.dash >= 2 && home.widgets === 3, `Continue, the dash panels and the three widgets are all still there (${home.dash} panels, ${home.widgets} widgets)`)
  await page.screenshot({ path: `${SHOTS}/home-night-412.png`, fullPage: true })

  // ---- TO THE MATCH
  for (let tap = 0; tap < 8; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn'); await page.waitForTimeout(450)
  }
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 5000 }); await page.click('.talk-modal .speech-tile >> nth=0')
  try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // skip to half time, so the bars have drained and the bench has moved
  const atHT = () => page.evaluate(() => window.rugbyStore.getState().liveMatch?.ctx?.awaiting === 'HT').catch(() => false)
  const skip = page.locator('.speed-controls [data-ctl=skip]').first()
  let ht = false
  for (let attempt = 0; attempt < 60 && !ht; attempt++) {
    if (await atHT()) { ht = true; break }
    await page.evaluate(() => { const st = window.rugbyStore.getState(); if (st.liveMatch?.playing) st.matchCursor(st.liveMatch.cursor, false) }).catch(() => {})
    if (await atHT()) { ht = true; break }
    try {
      await skip.click({ timeout: 1500 })
      ht = await page.waitForFunction(() => window.rugbyStore.getState().liveMatch?.ctx?.awaiting === 'HT', { timeout: 2500 }).then(() => true).catch(() => false)
      if (ht) break
    } catch { /* a call or a casualty is in the way */ }
    await settle()
    await clearInjury()
    const awaiting = await page.evaluate(() => window.rugbyStore.getState().liveMatch?.ctx?.awaiting ?? null).catch(() => null)
    if (awaiting === 'HT') { ht = true; break }
    if (!awaiting) {
      const play = page.locator('.speed-controls [data-ctl=play]').first()
      if (await play.getAttribute('data-playing').catch(() => null) === 'false') await play.click({ timeout: 1500 }).catch(() => {})
    }
    await page.waitForTimeout(400)
  }
  // a half-time with the panel still revealing its last lines: let the
  // cursor reach the break so the screen is still
  for (let w = 0; w < 60; w++) {
    if (await page.locator('text=Start Second Half').count()) break
    await settle(); await clearInjury(); await page.waitForTimeout(500)
  }
  ok(ht, 'the match reached half time')

  // ---- THE TELEMETRY PANEL
  await page.click('[data-ctl=menu]')
  await page.waitForSelector('.tele', { timeout: 5000 })
  await page.waitForTimeout(500) // the bars grow in
  const read = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tele tbody tr')]
    const vh = window.innerHeight
    const sb = document.querySelector('.scoreboard')?.getBoundingClientRect()
    const modal = document.querySelector('.mpanels')?.getBoundingClientRect()
    const body = document.querySelector('.mp-body')
    const bars = rows.map(r => {
      const i = r.querySelector('.tele-bar i')
      return i ? Number(i.getAttribute('data-e')) : NaN
    })
    const widths = rows.map(r => {
      const bar = r.querySelector('.tele-bar'), i = r.querySelector('.tele-bar i')
      return bar && i ? i.getBoundingClientRect().width / bar.getBoundingClientRect().width * 100 : NaN
    })
    const div = rows[15]
    return {
      n: rows.length,
      rowH: rows.map(r => r.getBoundingClientRect().height),
      lastBottom: rows.length ? rows[rows.length - 1].getBoundingClientRect().bottom : 0,
      firstTop: rows.length ? rows[0].getBoundingClientRect().top : 0,
      vh,
      sbTop: sb?.top ?? -1, sbBottom: sb?.bottom ?? -1,
      modalTop: modal?.top ?? -1, modalBottom: modal?.bottom ?? -1,
      scrolls: body ? body.scrollHeight > body.clientHeight + 1 : true,
      bars, widths,
      divider: div ? getComputedStyle(div.querySelector('td')).borderTopWidth : '',
      team: document.querySelector('.tele-team')?.textContent ?? '',
      binnedRows: rows.filter(r => r.querySelector('.tele-yc')).map(r => r.getAttribute('data-pid')),
      offRows: rows.filter(r => r.classList.contains('off')).length,
    }
  })
  const s = await read()
  ok(s.n === 23, `23 rows (${s.n})`)
  ok(s.rowH.every(h => h >= 23 && h <= 25.5), `every row is 24px (${Math.min(...s.rowH).toFixed(1)} to ${Math.max(...s.rowH).toFixed(1)})`)
  ok(!s.scrolls && s.lastBottom <= s.vh && s.firstTop >= 0, `all 23 on screen with no scrolling (rows ${Math.round(s.firstTop)} to ${Math.round(s.lastBottom)} of ${s.vh})`)
  ok(s.sbTop >= 0 && s.sbBottom <= s.modalTop, `the scoreboard is still in view above the panel (scoreboard ends ${Math.round(s.sbBottom)}px, panel starts ${Math.round(s.modalTop)}px)`)
  ok(s.bars.every(e => Number.isFinite(e) && e >= 0 && e <= 100), `an energy figure from 0 to 100 on every row (${Math.min(...s.bars)} to ${Math.max(...s.bars)})`)
  ok(s.widths.every((w, i) => Number.isFinite(w) && Math.abs(w - s.bars[i]) < 3), 'every bar is as wide as the number says')
  ok(s.bars.some(e => e < 100), 'the bars have drained by half time')
  ok(s.divider === '2px', `the 2px rule between the XV and the bench (${s.divider || 'none'})`)
  await page.screenshot({ path: `${SHOTS}/telemetry-night-412.png` })

  // ---- A MAN IN THE BIN
  const pid = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const lm = st.liveMatch
    const ctx = lm.ctx
    const mine = ctx.home.teamId === st.game.userClubId ? ctx.home : ctx.away
    const id = mine.lineup.slice(0, 15).find(x => x != null && mine.onPitch.has(x))
    mine.yellowUntil.set(id, ctx.lastMin + 10)
    mine.binned.add(id)
    mine.onPitch.delete(id)
    window.rugbyStore.setState({ liveMatch: { ...lm }, tick: st.tick + 1 })
    return String(id)
  })
  await page.waitForTimeout(300)
  const b = await read()
  // THE BIN AS THE MATCH HAS IT (1.9.1). This asked for exactly one flagged
  // row, so it failed whenever the match itself had already sent somebody to
  // the bin by half time (nightly 16 Oct: rows 259 and 298, the planted man
  // and a real yellow). Every flagged row must be a man the store has binned.
  const binnedNow = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const ctx = st.liveMatch.ctx
    const pick = (s) => [...s.binned].map(String)
    const mine = ctx.home.teamId === st.game.userClubId ? ctx.home : ctx.away
    const opp = mine === ctx.home ? ctx.away : ctx.home
    return { mine: pick(mine), opp: pick(opp) }
  })
  ok(b.binnedRows.includes(pid) && b.binnedRows.every(r => binnedNow.mine.includes(r)) && b.binnedRows.length === binnedNow.mine.length,
    `the binned man is flagged on his row, and only the binned are (${b.binnedRows.join(',') || 'none'} of ${binnedNow.mine.join(',')})`)
  await page.screenshot({ path: `${SHOTS}/telemetry-binned-night-412.png` })

  // ---- THE OTHER SIDE
  const before = s.team
  const tog = page.locator('.tele-toggle')
  ok(await tog.count() === 1, 'a toggle for the opposition')
  const tb = await tog.boundingBox()
  ok(tb && tb.height >= 44 && tb.width >= 44, `the toggle meets the 44px tap rule (${tb ? `${Math.round(tb.width)}x${Math.round(tb.height)}` : '-'})`)
  await tog.click()
  await page.waitForTimeout(300)
  const o = await read()
  ok(o.n === 23 && o.team !== before && o.binnedRows.length === binnedNow.opp.length && o.binnedRows.every(r => binnedNow.opp.includes(r)),
    `the opposition's 23 (${o.team}, from ${before}), flagged only where the match binned them (${o.binnedRows.join(',') || 'none'})`)
  await tog.click()
  await page.waitForTimeout(200)

  // ---- DAY
  await page.evaluate(() => window.rugbyStore.getState().toggleNight())
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/telemetry-day-412.png` })
  await page.evaluate(() => window.rugbyStore.getState().toggleNight())

  // the panel still closes and hands back the match
  await page.click('.mpanels .btn.gold.block')
  ok(await page.locator('.mpanels').count() === 0, 'Back to the match closes the panel')
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
} catch (e) {
  console.log(`FAIL  the walk broke: ${e.message.split('\n')[0]}`); fails++
}
await browser.close()
server.stop()
console.log(fails ? `\nTELEMETRY UI FAILED (${fails})` : '\nTELEMETRY UI PASSED: 23 on one screen under the scoreboard, and Home has one thing on top')
done(fails)
