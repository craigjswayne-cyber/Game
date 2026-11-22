// Probe: every page of the career carries exactly one banner for a manager
// who is not Pro, and none for one who is (owner, 22 Nov 2026, 1.9.17: "add
// the ad slot to all pages outside of games and setup for non pro players").
//
// Fifteen pages had a slot of their own; the shell's FloorAd covers the rest.
// The seam is the same as floorad.mjs: globalThis.rmAds is stubbed and counts
// what is mounted and taken down, because the question is only "is one slot
// live on this page". Two pages are held to NONE on purpose: the shop that
// sells the adverts' removal, and the press room while a question waits.
//
// Run: node scripts/everypagead.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { ok, done } from './lib/probe.mjs'

const PAGES = ['home', 'inbox', 'offers', 'squad', 'tactics', 'fixtures', 'tables', 'transfers', 'training',
  'scouting', 'finances', 'club', 'press', 'nations', 'history', 'legacy', 'handbook', 'settings', 'bug', 'about',
  'jobs', 'wire', 'medical', 'report', 'profile', 'saves', 'annual', 'dreamteam', 'agency', 'country', 'infra', 'academy']

const server = await startPreview(0, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.addInitScript(() => {
  globalThis.__live = new Map()
  globalThis.rmAds = { mount(el, place) { globalThis.__live.set(el, place) }, unmount(el) { globalThis.__live.delete(el) } }
})
const live = () => page.evaluate(() => [...globalThis.__live].filter(([el]) => el.isConnected).map(([, p]) => p))
const go = async (s) => { await page.evaluate(s => window.rugbyStore.getState().go(s), s); await page.waitForTimeout(450) }

try {
  await page.goto(`${server.origin}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  ok((await live()).length === 0, 'the menu before a career carries no banner')
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  ok((await live()).length === 0, 'and neither does setting one up')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Every Page')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text="Start Career"')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  const bad = []
  for (const s of PAGES) {
    await go(s)
    const on = await page.evaluate(() => document.querySelector('main.content')?.dataset.screen)
    const l = await live()
    const waiting = s === 'press' && await page.evaluate(() => !!document.querySelector('[data-no-ad]'))
    const want = waiting ? 0 : 1
    if (on !== s || l.length !== want) bad.push(`${s}${on !== s ? ` (landed on ${on})` : ''}: ${l.length} [${l.join(',')}]`)
  }
  ok(bad.length === 0, `each of the ${PAGES.length} career pages carries exactly one banner${bad.length ? `: ${bad.join(' | ')}` : ''}`)

  // a page that changes under the same shell: Tactics has its own slot on the
  // Roles tab only, and the shell's covers the others
  await go('tactics')
  const tabs = await page.locator('.tab-bar button').count()
  const perTab = []
  for (let i = 0; i < tabs; i++) {
    await page.locator('.tab-bar button').nth(i).click()
    await page.waitForTimeout(350)
    perTab.push((await live()).length)
  }
  ok(perTab.length > 1 && perTab.every(n => n === 1), `and every Tactics tab holds one, never two (${perTab.join(',')})`)

  // Pro: none, anywhere, the moment it is owned
  await page.evaluate(() => { localStorage.setItem('rm-ent', 'phase.supporter'); window.rugbyStore.getState().claimSupporter() })
  await page.waitForTimeout(300)
  ok((await live()).length === 0, 'buying Pro takes the banner down on the page it was bought from')
  const proBad = []
  for (const s of ['home', 'squad', 'tactics', 'inbox', 'profile', 'training']) {
    await go(s)
    const l = await live()
    if (l.length) proBad.push(`${s}: ${l.join(',')}`)
  }
  ok(proBad.length === 0, `a Pro manager sees none on any page${proBad.length ? ` (${proBad.join(' | ')})` : ''}`)
  ok(errs.length === 0, `no page errors (${errs.join(' | ') || 'none'})`)
} catch (e) {
  ok(false, `the walk finished (${e.message.split('\n')[0]})`)
}
await browser.close()
await server.close?.()
done('EVERY PAGE AD PROBE', 'one banner on every page of the career, none in a match, in setup or for Pro', { exit: true, blank: false })
