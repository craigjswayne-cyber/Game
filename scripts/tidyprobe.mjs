// ---- THE TIDY-UP ROUND (1.8.0, owner 27 Sep 2026) ----
//
// Four notes from one message, held here:
//
//   news        "Leave the name where players can click through but remove the
//               bottom section": the card under a story is one tappable line
//   roles       "make it so the shirts have a way to stand out on the dark
//               pitch": every shirt is rimmed, every name sits on a label
//   commentary  "should be the colour of who is being talked about": a line
//               about a side is filled with that side's first colour
//   stats       "Check the alignment of names ... Tackle count should be in
//               there for each player": names start in one column in both
//               tables, and every man has a tackle count that adds up to no
//               more than the side's count on the stats panel
//
// Screenshots go to $SHOTS (default /tmp/tidy) for a human look.
// Run: npm run build && node scripts/tidyprobe.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'
const SHOTS = process.env.SHOTS ?? '/tmp/tidy'
mkdirSync(SHOTS, { recursive: true })
const server = await startPreview('4261', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => {
  let a = 20260927
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const clear = async () => {
  if (await page.locator('text=Take the Points').count()) await page.click('text=Take the Points')
  if (await page.locator('.sheet-row.armed').count()) { await page.locator('.sheet-row.armed').first().click(); await page.waitForTimeout(150) }
  const sheet = page.locator('.modal-veil .btn.gold:enabled').first()
  if (await sheet.count() && !(await page.locator('.mpanels').count())) await sheet.click()
}
try {
  await page.goto('http://localhost:4261/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'S'); await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })

  // ---- news ----
  await page.click('.bottom-nav button[title="News"]')
  await page.waitForSelector('.reader')
  const card = await page.evaluate(() => {
    const c = document.querySelector('.ctx-card')
    return c && { tag: c.tagName, rows: !!c.querySelector('dl, .ctx-rows'), h: c.getBoundingClientRect().height, name: c.querySelector('b')?.textContent }
  })
  ok(card && card.tag === 'BUTTON', `the story's card is one tappable line (${card?.tag})`)
  ok(card && !card.rows && card.h < 60, `no bottom section: ${Math.round(card?.h ?? 0)}px tall, named ${card?.name}`)
  await page.screenshot({ path: `${SHOTS}/news.png` })
  const before = await page.evaluate(() => window.rugbyStore.getState().nav.at(-1)?.screen)
  await page.click('.ctx-card')
  await page.waitForTimeout(300)
  const after = await page.evaluate(() => window.rugbyStore.getState().nav.at(-1)?.screen)
  ok(after && after !== before && (after === 'club' || after === 'player'), `tapping the name opens ${after}`)

  // ---- roles ----
  await page.evaluate(() => window.rugbyStore.getState().go('tactics'))
  await page.waitForSelector('.form-chip')
  const chips = await page.evaluate(() => [...document.querySelectorAll('.form-chip')].map(c => ({
    rim: getComputedStyle(c.querySelector('.fc-kit')).filter,
    label: getComputedStyle(c.querySelector('.fc-name')).backgroundColor,
  })))
  ok(chips.length === 15, `fifteen shirts on the pitch (${chips.length})`)
  ok(chips.every(c => /rgba\(255, 255, 255, 0\.95\)/.test(c.rim)), 'every shirt has a light rim round its outline')
  ok(chips.every(c => c.label !== 'rgba(0, 0, 0, 0)'), 'every name sits on a dark label')
  await page.locator('.form-pitch, .form-chip >> nth=0').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/roles.png` })

  // ---- match ----
  await page.click('.bottom-nav button[title="Home"]').catch(() => {})
  for (let k = 0; k < 8; k++) { if (await page.locator('text=Kick Off ▸').count()) break; await page.click('.continue-btn'); await page.waitForTimeout(450) }
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 5000 }); await page.click('.talk-modal .speech-tile >> nth=0')
  try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  const kits = await page.evaluate(() => {
    const s = window.rugbyStore.getState()
    const fx = s.liveMatch.ctx.fx
    // a near-black first colour gives way to the second (MatchDay lineStyle)
    const luma = h => { const n = parseInt(h.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 }
    const fill = c => luma(c[0]) < 40 && c[1] && luma(c[1]) > luma(c[0]) ? c[1] : c[0]
    return { [fx.homeId]: fill(s.game.clubs[fx.homeId].colors), [fx.awayId]: fill(s.game.clubs[fx.awayId].colors) }
  })
  const hex = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})` }
  let team = 0, plain = 0, wrong = 0
  for (let k = 0; k < 40; k++) {
    const r = await page.evaluate(() => {
      const s = window.rugbyStore.getState()
      const live = s.liveMatch
      const e = live.ctx.events[live.cursor - 1]
      const el = document.querySelector('.now-line')
      // a try line flashes inverted for its first second (1.8.12): read it settled
      if (el && el.classList.contains('try-flash')) return null
      return el && e ? { teamId: e.teamId, bg: getComputedStyle(el).backgroundColor } : null
    })
    if (r) {
      if (r.teamId) { team++; if (r.bg !== hex(kits[r.teamId])) wrong++ } else plain++
    }
    await clear()
    await page.waitForTimeout(350)
  }
  ok(team >= 8 && wrong === 0, `a line about a side wears that side's colour (${team} lines, ${wrong} wrong, ${plain} about nobody)`)
  await page.screenshot({ path: `${SHOTS}/commentary.png` })

  // ---- stats ----
  await page.click('.speed-controls .btn >> nth=0')
  await page.waitForTimeout(300)
  await clear()
  await page.click('[aria-label="Match menu"]')
  await page.waitForSelector('.mpanels')
  await page.click('.mp-dots button[aria-label="Who did what"]')
  await page.waitForSelector('.mp-grid')
  const st = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('.mpanels .mp-grid')]
    return tables.map(tb => {
      const head = tb.querySelector('th.mp-team').getBoundingClientRect().left + parseFloat(getComputedStyle(tb.querySelector('th.mp-team')).paddingLeft)
      const shirt = tb.querySelector('td.shirt').getBoundingClientRect().left + parseFloat(getComputedStyle(tb.querySelector('td.shirt')).paddingLeft)
      const names = [...tb.querySelectorAll('td.nm')].map(td => Math.round(td.getBoundingClientRect().left))
      const heads = [...tb.querySelectorAll('thead th')].map(th => th.textContent)
      return { head: Math.round(head), shirt: Math.round(shirt), names, heads }
    })
  })
  ok(st.length === 2, 'two tables, home and away')
  for (const [k, tb] of st.entries()) {
    ok(new Set(tb.names).size === 1, `${k ? 'away' : 'home'}: all fifteen names start in one column (${[...new Set(tb.names)].join(',')})`)
    ok(Math.abs(tb.head - tb.shirt) <= 2, `${k ? 'away' : 'home'}: the club name lines up with the first column (${tb.head} / ${tb.shirt})`)
    ok(tb.heads.includes('Tkl'), `${k ? 'away' : 'home'}: a Tkl column (${tb.heads.join(' ')})`)
  }
  const cells = await page.evaluate(() => [...document.querySelectorAll('.mpanels .mp-grid')].map(tb => {
    const heads = [...tb.querySelectorAll('thead th')].map(th => th.textContent)
    const col = heads.indexOf('Tkl') + 1 // the first header spans two columns
    return [...tb.querySelectorAll('tbody tr')].map(tr => Number(tr.children[col].textContent))
  }))
  const min = await page.evaluate(() => window.rugbyStore.getState().liveMatch.ctx.lastMin)
  for (const [k, c] of cells.entries()) {
    const sum = c.reduce((a, b) => a + b, 0)
    ok(c.length === 15 && c.every(n => Number.isInteger(n) && n >= 0), `${k ? 'away' : 'home'}: every man has a tackle count (${c.join(' ')})`)
    ok(min < 5 || sum > 0, `${k ? 'away' : 'home'}: ${sum} tackles by minute ${min}`)
    // the side's count is at most 3.6 a minute (matchStats) with a strong
    // defence's lean on it: the column can never run past that
    ok(sum <= Math.ceil(min * 3.6 * 1.1) + 8, `${k ? 'away' : 'home'}: no more than a side could make in ${min} minutes`)
  }
  await page.screenshot({ path: `${SHOTS}/stats.png` })
} catch (e) {
  console.error(`FAIL  stopped early: ${e.message.split('\n')[0]}`)
  fails++
}
await browser.close(); server.stop()
console.log(fails ? `\nTIDY PROBE FAILED (${fails})` : '\nTIDY PROBE PASSED: the news card, the shirts, the coloured commentary and the tackle column')
process.exit(fails ? 1 : 0)
