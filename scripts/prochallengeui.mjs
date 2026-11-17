// Probe: Pro challenges (1.9.14). Owner, on a free player four seasons deep
// and winning 80%: give Pro a new goal, not a different engine. The new-career
// screen offers three Pro challenges (open on the web build, which has no
// till, as the Pro save slots are); one picked, the wizard runs as usual, the
// career starts under its rule with a letter saying so, and a deadline that
// passes ends the career on one screen with a new career or the menu.
// FA_SHOT=<dir> also writes screenshots.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const OUT = process.env.FA_SHOT
const server = await startPreview(0, 2500)
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
const shot = async n => { if (OUT) { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/pro_${n}.png` }) } }

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('[data-pro-challenges]', { timeout: 8000 })
  ok(await page.locator('[data-pro-challenges] [data-pro]').count() === 3, 'the new-career screen offers three Pro challenges')
  await page.locator('[data-pro-challenges]').scrollIntoViewIfNeeded(); await shot('wizard')
  await page.locator('[data-pro="firesale"]').click()
  await page.waitForSelector('[data-pro-picked]', { timeout: 3000 })
  ok(await page.locator('[data-pro="firesale"][aria-pressed="true"]').count() === 1, 'picking one marks it and asks for a club')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.click('.action-bar >> text=Confirm')
  await page.waitForSelector('[data-pro-banner]', { timeout: 4000 })
  ok(true, 'the profile step shows the challenge accepted')
  await shot('banner')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Pro Test')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.waitForTimeout(1500)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  const st = await page.evaluate(() => { const g = window.rugbyStore.getState().game; return { pro: g.proChallenge, letter: g.news.some(n => n.k === 'news.proStartSold'), club: g.userClubId } })
  ok(st.pro?.id === 'firesale' && st.pro?.clubId === st.club, `the career starts under Fire Sale (${JSON.stringify(st.pro)})`)
  ok(st.letter, 'with a letter naming who was sold')
  // the deadline passes
  await page.evaluate(() => { const st = window.rugbyStore.getState(); const g = st.game; g.unemployed = true; g.careerOver = { k: 'over.proFailed', v: { title_k: 'pro.firesale', n: 4 } }; st.touch() })
  await page.waitForSelector('[data-career-over]', { timeout: 3000 })
  ok((await page.locator('[data-career-over] h1').textContent()).length > 0, 'a passed deadline ends the career on one screen')
  ok(await page.locator('[data-co-new]').count() === 1 && await page.locator('[data-co-menu]').count() === 1, 'with a new career and the main menu as the only ways out')
  await shot('over')
  await page.locator('[data-co-menu]').click()
  await page.waitForSelector('text=New Career', { timeout: 4000 })
  ok(true, 'the main menu button leaves it')
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close(); server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nPRO CHALLENGE UI PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPRO CHALLENGE UI PROBE PASSED: three Pro challenges on the new-career screen, a career under one, and an end that is an end')
done(0)
