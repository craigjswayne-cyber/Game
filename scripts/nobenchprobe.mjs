// Probe: an injury the match waits on, with nobody left on the bench to send on
// (1.9.1 bug hunt).
//
// The wait (injWait) opens when the bench has a man for the shirt, but a
// head-injury check in the same minute can take that man. The squad sheet then
// had no row to tap and no way to close, and the match stood still. With an
// empty bench the side plays on a man short, as the sheet says: this stages
// exactly that and checks the sheet answers it and lets the match go on.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { ok, done } from './lib/probe.mjs'

const server = await startPreview()
const say = (m) => console.log(m)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const errs = []
// A CLEAN KICK-OFF, OR ANOTHER CAREER (1.9.12). A new career draws a new match
// every run, and now and then the match has an injury of its own inside the
// first two minutes. Then there are two men down, not one: the staged wait
// was answered and the sheet said so, but the probe counted the match's own
// wait as "still waiting" (Release check on 2e46874 and the Gate on 44a25ae;
// one run in thirty to sixty on a busy box, the diagnostics naming the second
// man). The game is right: the second injury gets its own sheet when the
// ticker reaches it. So the probe stages only on a match with nobody down
// and no sheet open, on a fresh profile each try, and judges its own wait.
let page = null
for (let attempt = 1; attempt <= 5; attempt++) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } })
  page = await context.newPage()
  page.on('pageerror', e => errs.push(e.message))
  await page.goto(server.origin + '/')
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.click('.tile >> text=Leicester'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'T'); await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor({ timeout: 20000 })
  if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn')
  for (let i = 0; i < 15 && !(await page.locator('text="Kick Off"').count()); i++) { await page.evaluate(() => { const s = window.rugbyStore; s.setState({ lastAdvanceAt: 0 }); for (const q of s.getState().game.press) q.answered = true; s.getState().continueWeek() }); await page.waitForTimeout(600) }
  await page.locator('text="Kick Off"').first().click()
  try { await page.locator('.talk-modal').waitFor({ timeout: 3000 }); await page.click('.talk-modal .speech-tile >> nth=0') } catch {}
  try { await page.locator('text="Take the Field"').waitFor({ timeout: 2500 }); await page.click('text="Take the Field"') } catch {}
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  await page.waitForTimeout(1500)
  const clean = await page.evaluate(() => {
    const c = window.rugbyStore.getState().liveMatch?.ctx
    return !!c && !(c.injWait ?? []).length && !document.querySelector('.squad-sheet')
  })
  if (clean) break
  say(`  try ${attempt}: the match had an injury of its own before the staging; a fresh career`)
  await context.close()
  page = null
}
if (!page) { ok(false, 'five careers in a row had an injury inside the first two minutes'); await browser.close(); server.stop(); done('NO BENCH PROBE', '', { exit: true }) }
// stage: one of ours down, nobody left on the bench, the match waiting
const staged = await page.evaluate(() => {
  const s = window.rugbyStore, st = s.getState(), lm = st.liveMatch, ctx = lm.ctx, g = st.game
  const side = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const hurtId = side.lineup[10]
  const p = g.players[hurtId]
  p.injury = { desc: 'hamstring', dk: 'injury.warmup', until: g.week + 3, weeks: 3 }
  for (let i = 15; i < side.lineup.length; i++) side.lineup[i] = null
  side.onPitch.delete(hurtId); side.short += 1
  ;(ctx.injWait ??= []).push({ home: side === ctx.home, hurtId, at: Math.max(0, lm.cursor - 4), min: 10 })
  s.setState({ liveMatch: { ...lm, cursor: Math.max(0, lm.cursor - 3), playing: true }, tick: st.tick + 1 })
  return p.name
})
say(`  staged: ${staged} down, nobody on the bench`)
await page.waitForSelector('.squad-sheet', { timeout: 10000 }).catch(() => {})
ok(await page.locator('.squad-sheet').count() > 0, 'the squad sheet opens for the injury')
await page.waitForTimeout(800)
const state = await page.evaluate(() => ({
  waiting: (window.rugbyStore.getState().liveMatch?.ctx.injWait ?? []).length,
  closeable: !document.querySelector('.squad-sheet .btn.gold')?.disabled,
}))
if (state.waiting !== 0 || !state.closeable) {
  // what the match held, in the probe's own output and on a FAIL line so
  // suite.sh carries it into the CI log
  const d = await page.evaluate(() => { const st = window.rugbyStore.getState(), lm = st.liveMatch, c = lm.ctx, g = st.game
    return { waits: (c.injWait ?? []).map(w => ({ name: g.players[w.hurtId]?.name, at: w.at, min: w.min })), cursor: lm.cursor, events: c.events.length, tick: c.tick,
      sheet: (document.querySelector('.squad-sheet')?.innerText ?? '').slice(0, 140).replace(/\n/g, ' | '),
      gold: [...document.querySelectorAll('.squad-sheet .btn.gold')].map(b => b.innerText + (b.disabled ? ' (disabled)' : '')) } })
  console.log('FAIL NOBENCH detail: ' + JSON.stringify(d))
}
ok(state.waiting === 0, 'with nobody to send on, the side plays on a man short and the match stops waiting')
ok(state.closeable, 'and the sheet can be closed')
await page.locator('.squad-sheet .btn.gold').click({ timeout: 3000 }).catch(() => {})
await page.waitForTimeout(500)
ok(await page.locator('.squad-sheet').count() === 0, 'closing it goes back to the match')
await browser.close(); server.stop()
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
done('NO BENCH PROBE', 'an injury with an empty bench never stops the match', { exit: true })
