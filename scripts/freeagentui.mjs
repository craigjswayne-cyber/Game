// Probe: free-agent talks (1.9.14, player feedback: "You currently can't
// negotiate with free agents on wages. Be good to add in!"). The Sign button
// opens talks; each length shows its own asking wage; a lowball is answered in
// the card and nothing is signed; meeting the asking signs on the chosen
// length and the page becomes his own.
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
  await S(() => window.rugbyStore.getState().start('bath', 'FreeAgent'))
  await page.waitForTimeout(700)
  await page.locator('.tut-close .btn').click({ timeout: 4000 }).catch(() => {})
  // a modest man let go by an AI club, so the cap and the budget have room
  const id = await S(() => {
    const g = window.rugbyStore.getState().game
    const p = Object.values(g.players).find(q => q.clubId && q.clubId !== g.userClubId && !q.acad && q.ca < 55 && q.age >= 24 && q.age <= 28)
    g.clubs[p.clubId].players = g.clubs[p.clubId].players.filter(x => x !== p.id)
    p.clubId = null; p.wage = 0
    return p.id
  })
  await S(pid => window.rugbyStore.getState().go('player', pid), id)
  await page.locator('[data-fa-open]').click({ timeout: 5000 })
  await page.waitForSelector('[data-fa-talks]', { timeout: 4000 })
  ok(await page.locator('[data-fa-term]').count() === 3, 'the talks offer one, two and three seasons')
  const asks = await page.locator('[data-fa-term] small').allTextContents()
  ok(new Set(asks).size >= 2, `each length shows its own asking wage (${asks.join(' | ')})`)
  ok(await page.locator('[data-fa-term="2"][aria-checked="true"]').count() === 1, 'a man of 24 to 28 starts on two seasons, his own choice')
  await page.waitForTimeout(600)
  const box = await page.locator('[data-fa-talks]').boundingBox()
  ok(box && box.y >= 0 && box.y < 844 - 120, `the talks scroll up to the thumb when opened (top at ${Math.round(box?.y ?? -1)})`)
  await page.screenshot({ path: process.env.FA_SHOT ?? '/dev/null' }).catch(() => {})
  // a lowball
  await page.locator('[data-fa-wage]').fill('100')
  await page.locator('[data-fa-offer]').click()
  await page.waitForSelector('[data-fa-outcome]', { timeout: 3000 })
  ok(await S(pid => window.rugbyStore.getState().game.players[pid].clubId === null, id), 'a lowball is answered in the card and nothing is signed')
  await page.locator('button:has-text("Keep talking")').click()
  // three seasons at the asking
  await page.locator('[data-fa-term="3"]').click()
  await page.locator('[data-fa-asking]').click()
  await page.waitForTimeout(400)
  const st = await S(pid => { const g = window.rugbyStore.getState().game; const p = g.players[pid]; return { club: p.clubId, mine: g.userClubId, ends: p.contractEnds, season: g.season } }, id)
  ok(st.club === st.mine && st.ends === st.season + 3, `signing at the asking on three seasons signs him to ${st.season + 3} (ends ${st.ends})`)
  ok(await page.locator('text=signs on a free transfer').count() >= 1, 'the page says he has signed, and for how long')
  ok(await page.locator('[data-fa-talks]').count() === 0 && await page.locator('h3:has-text("Contract talks with")').count() === 0, 'and no talks card is left open on his new page')
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close(); server.stop()
}
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`)
if (fails) { console.error(`\nFREE AGENT UI PROBE: ${fails} failures`); process.exit(1) }
console.log('\nFREE AGENT UI PROBE PASSED: free agents can be offered a wage and a length, and the answer is in the card')
done(0)
