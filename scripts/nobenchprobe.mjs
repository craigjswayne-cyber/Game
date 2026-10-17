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
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto(server.origin + '/')
await page.click('text=New Career'); await page.click('text=English Premier Division')
await page.click('.tile >> text=Leicester'); await page.click('.action-bar >> text=Confirm')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'T'); await page.click('.action-bar >> text=Confirm')
await page.click('text=▸ Start Career')
await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor({ timeout: 20000 })
if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn')
for (let i = 0; i < 15 && !(await page.locator('text=Kick Off ▸').count()); i++) { await page.evaluate(() => { const s = window.rugbyStore; s.setState({ lastAdvanceAt: 0 }); for (const q of s.getState().game.press) q.answered = true; s.getState().continueWeek() }); await page.waitForTimeout(600) }
await page.locator('text=Kick Off ▸').first().click()
try { await page.locator('.talk-modal').waitFor({ timeout: 3000 }); await page.click('.talk-modal .speech-tile >> nth=0') } catch {}
try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
await page.waitForSelector('.scoreboard', { timeout: 20000 })
await page.waitForTimeout(1500)
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
ok(state.waiting === 0, 'with nobody to send on, the side plays on a man short and the match stops waiting')
ok(state.closeable, 'and the sheet can be closed')
await page.locator('.squad-sheet .btn.gold').click({ timeout: 3000 }).catch(() => {})
await page.waitForTimeout(500)
ok(await page.locator('.squad-sheet').count() === 0, 'closing it goes back to the match')
await browser.close(); server.stop()
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs[0] : ''}`)
done('NO BENCH PROBE', 'an injury with an empty bench never stops the match', { exit: true })
