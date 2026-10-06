// Next unread must actually turn the page (round 25).
//
// From a screenshot reading "0 of 20 · 34 unread": with more than twenty
// stories pending, the unread queue served the OLDEST story - correctly - but
// the reader looked it up in its newest-twenty browse window, missed, and fell
// back to the same newest story on every tap while the unread count fell.
// Thirty-four taps of the same headline. The reader now renders the served
// story from the full recall list; this stages the backlog and taps.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4243, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4243/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Backlog')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })

  // a heavy backlog: 25 unread stories, distinct subjects, oldest first
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    for (let i = 0; i < 25; i++) {
      g.news.push({
        id: g.nextId++, week: g.week, season: g.season, type: 'general',
        subject: `Backlog story number ${i + 1}`, body: `Body ${i + 1}.`, read: false,
      })
    }
    st.touch()
  })

  // into the reader, then three taps of Next unread: each must turn the page
  await page.evaluate(() => window.rugbyStore.getState().openInbox())
  await page.waitForTimeout(400)
  const seen = []
  for (let tap = 0; tap < 3; tap++) {
    seen.push((await page.locator('.reader h2').innerText()).trim())
    await page.click('text=Next unread')
    await page.waitForTimeout(300)
  }
  seen.push((await page.locator('.reader h2').innerText()).trim())
  say(`  read in order: ${seen.join(' | ')}`)
  ok(new Set(seen).size === seen.length,
    'every tap of Next unread shows a DIFFERENT story, backlog or not')
  ok(seen.every(s => /Backlog story/.test(s) || s.length > 0),
    'and each is a real story, not an empty reader')

  // THE NEWS BUTTON (owner, 1.8.11: "When I tap the news button i should
  // always be able to skip through the news to see the next unread mail").
  // Scroll to the foot of the story, tap News: a different story, at its top.
  const long = 'A long paragraph. '.repeat(400)
  await page.evaluate(t => {
    const st = window.rugbyStore.getState(); const n = st.game.news.find(x => x.id === st.inboxId); n.body = t; delete n.k; st.touch()
  }, long)
  await page.waitForTimeout(300)
  await page.evaluate(() => { const m = document.querySelector('main.content'); m.scrollTop = m.scrollHeight })
  await page.waitForTimeout(200)
  const before = await page.evaluate(() => ({ id: window.rugbyStore.getState().inboxId, top: document.querySelector('main.content').scrollTop }))
  await page.click('.bottom-nav button[aria-label="News"]')
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => ({ id: window.rugbyStore.getState().inboxId, top: document.querySelector('main.content').scrollTop }))
  ok(before.top > 200 && after.id !== before.id && after.top === 0,
    `the News button serves the next unread story at its headline (scroll ${before.top} -> ${after.top})`)
  // and with everything read, the button still moves on rather than doing nothing
  await page.evaluate(() => { const st = window.rugbyStore.getState(); for (const n of st.game.news) n.read = true; st.touch() })
  const ids = new Set()
  for (let tap = 0; tap < 4; tap++) {
    await page.click('.bottom-nav button[aria-label="News"]')
    await page.waitForTimeout(250)
    ids.add(await page.evaluate(() => window.rugbyStore.getState().inboxId))
  }
  ok(ids.size === 4, `with nothing unread, each News tap still moves to another story (${ids.size} of 4 different)`)
} catch (e) {
  say(`FAIL  ${e.message.split('\n')[0]}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}

if (fails) { say(`\nBACKLOG PROBE FAILED (${fails})`); process.exit(1) }
say('\nBACKLOG PROBE PASSED: the queue turns its pages')
done(0)
