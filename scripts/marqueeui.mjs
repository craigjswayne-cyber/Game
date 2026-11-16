// Probe: changing a marquee player (1.9.14, player feedback: "Not sure if an
// issue or user error, but I can't change my Marquee Players"). Every career
// starts with both slots filled (cap.ts names the two biggest wages), and a
// player page with both taken showed nothing at all. Now: it says both are
// taken and offers the swap with either; the swap moves the slot; the Finances
// list opens the player; and outside the window the page says why.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const server = await startPreview(0, 3000)
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
const S = (f, a) => page.evaluate(f, a)

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await S(() => window.rugbyStore.getState().start('leicester', 'Marquee'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  const st = await S(() => { const g = window.rugbyStore.getState().game; const c = g.clubs[g.userClubId]; const other = c.players.map(id => g.players[id]).find(p => p && !p.acad && !(c.marquee ?? []).includes(p.id)); return { marquee: c.marquee ?? [], other: other?.id, week: g.week } })
  ok(st.marquee.length === 2, `a new career starts with both marquee slots filled (week ${st.week})`)
  await S(id => window.rugbyStore.getState().go('player', id), st.other)
  await page.waitForSelector('[data-marquee-swap]', { timeout: 5000 })
  const btns = page.locator('[data-marquee-swap] .btn')
  ok(await btns.count() === 2, 'a player page with both slots taken says so and offers a swap with either')
  await btns.first().click()
  await page.waitForTimeout(300)
  const after = await S(() => { const g = window.rugbyStore.getState().game; return g.clubs[g.userClubId].marquee })
  ok(after.includes(st.other) && !after.includes(st.marquee[0]) && after.length === 2, 'the swap puts this player in the first slot and takes the other out')
  ok(await page.locator('.btn:has-text("Marquee Player: tap to remove")').count() === 1, 'and the page now offers to remove him')
  // the Finances list opens the player
  await S(() => window.rugbyStore.getState().go('finances'))
  await page.locator('button:has-text("Cap & Squad"), button:has-text("Cap")').first().click({ timeout: 4000 })
  const row = page.locator('[data-marquee-row]').first()
  await row.waitFor({ timeout: 4000 })
  const rid = Number(await row.getAttribute('data-marquee-row'))
  await row.click()
  await page.waitForTimeout(400)
  const at = await S(() => window.rugbyStore.getState().nav?.at?.(-1) ?? window.rugbyStore.getState().screen)
  ok(JSON.stringify(at).includes(String(rid)) || JSON.stringify(at).includes('player'), `a marquee row on Finances opens the player (${JSON.stringify(at).slice(0, 60)})`)
  // outside the window: the page says why
  await S(() => { const s = window.rugbyStore.getState(); s.game.week = 14; window.rugbyStore.setState({ game: { ...s.game } }) })
  await S(id => window.rugbyStore.getState().go('player', id), st.marquee[0])
  await page.waitForTimeout(400)
  ok(await page.locator('text=named while the transfer window is open').count() >= 1, 'outside the window the player page says the list is locked and why')
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close(); server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nMARQUEE UI PROBE: ${fails} failures`); process.exit(1) }
console.log('\nMARQUEE UI PROBE PASSED: a full marquee list can be swapped, found from Finances, and says when it is locked')
done(0)
