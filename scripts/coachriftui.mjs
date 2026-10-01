// Coach rift on the screen (owner, round 4): the staff page says nothing about
// two coaches who have fallen out, the Training screen has no Club tab, and
// the falling-out reaches the manager as a story in the inbox.
//
//   SHOTS=/some/dir node scripts/coachriftui.mjs     (needs a fresh `npm run build`)
//
// Saves staff-tab, staff-training and staff-rift-news screenshots at 390x844.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'

const SHOTS = process.env.SHOTS ?? '/tmp/coachrift'
mkdirSync(SHOTS, { recursive: true })
const PORT = Number(process.env.PORT ?? 4393)
const server = await startPreview(String(PORT), 4000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.addInitScript(() => {
  let a = 20261001
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
const errors = []
page.on('pageerror', e => errors.push(String(e)))
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const G = fn => page.evaluate(fn)
const go = (screen, param) => page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [screen, param])
const touch = () => G(() => window.rugbyStore.getState().touch())

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career'); await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'S'); await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })

  await go('training')
  await page.waitForSelector('.tab-bar')
  const tabs = await page.locator('.tab-bar button').allInnerTexts()
  ok(!tabs.some(t => /^\s*club\s*$/i.test(t)), `the Training screen has no Club tab (${tabs.join(' / ')})`)
  await page.screenshot({ path: `${SHOTS}/staff-training.png` })

  await page.locator('.tab-bar button', { hasText: 'Staff' }).click()
  await page.waitForTimeout(200)
  // the inbox read first, so the unread badge does not count as a difference
  await G(() => { for (const n of window.rugbyStore.getState().game.news) n.read = true })
  await touch()
  await page.waitForTimeout(200)
  const calm = await G(() => document.querySelector('#root')?.innerText ?? document.body.innerText)
  ok(!/staff room|pulling the same way|disagree|click|clash/i.test(calm), 'the staff tab carries no staff-room card')

  // two real coaches fall out, exactly as the season would file it
  const pair = await G(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const roles = Object.keys(g.staffPeople ?? {}).filter(r => g.staffPeople[r])
    const [a, b] = roles
    const aName = g.staffPeople[a].name, bName = g.staffPeople[b].name
    const now = g.season * 48 + g.week
    g.staffRift = { clubId: g.userClubId, a, b, aName, bName, since: now, told: 1, next: now + 7 }
    const v = { a: aName, b: bName }
    g.news.push({
      id: g.nextId++, week: g.week, season: g.season, type: 'general', read: true,
      subject: 'Raised voices at training',
      body: `${aName} and ${bName} had a heated exchange in front of the squad on Tuesday. The session carried on, but the players heard every word.`,
      k: 'news.riftHeated', v,
    })
    return { aName, bName }
  })
  await touch()
  await page.waitForTimeout(200)
  const during = await G(() => document.querySelector('#root')?.innerText ?? document.body.innerText)
  if (during !== calm) {
    const A = calm.split('\n'), B = during.split('\n')
    console.log('  differs:', JSON.stringify(A.filter(x => !B.includes(x)).slice(0, 5)), '->', JSON.stringify(B.filter(x => !A.includes(x)).slice(0, 5)))
  }
  ok(during === calm, 'with two coaches at odds, the staff tab reads exactly as it did before')
  await page.screenshot({ path: `${SHOTS}/staff-tab.png` })
  await page.screenshot({ path: `${SHOTS}/staff-tab-full.png`, fullPage: true })

  await G(() => window.rugbyStore.getState().openInbox())
  await page.waitForTimeout(300)
  const inbox = await G(() => document.body.innerText)
  ok(inbox.includes(pair.aName) && inbox.includes(pair.bName), `the inbox story names both coaches (${pair.aName}, ${pair.bName})`)
  await page.screenshot({ path: `${SHOTS}/staff-rift-news.png` })
  const w = await G(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth }))
  ok(w.doc <= w.vw + 1, `no sideways scroll (${w.doc} in ${w.vw})`)
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 200)}`)
} finally {
  await browser.close()
  server.stop()
}
if (errors.length) {
  console.error(`\nuncaught page errors (${errors.length}):`)
  for (const e of [...new Set(errors)]) console.error('  ' + e)
  fails += errors.length
}
console.log(fails ? `\nCOACH RIFT UI FAILED (${fails})` : '\nCOACH RIFT UI PASSED: the staff page keeps the secret, the Club tab is gone, the news tells it')
process.exit(fails ? 1 : 0)
