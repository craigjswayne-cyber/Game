// Probe: an agreed transfer shows on the player's profile (1.8.15).
//
// Owner: "If a transfer is happening it should be added to their profile."
// The walk: a new career, the window shut, a fee and terms agreed through
// the store for a man at another club; open his profile and hold it to
// account: the agreed-deal card names the club, the fee and the opening date,
// the fee buttons are gone, and Call the deal off ends it.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4187, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4187/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.click('.tile >> text=Northampton')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Deal')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // the window shut, a deal agreed through the store's own engine handle
  const deal = await page.evaluate(() => {
    const S = window.rugbyStore.getState(); const g = S.game
    g.week = 12
    g.clubs[g.userClubId].budget = 50_000_000
    const p = Object.values(g.players).find(x => x.clubId && x.clubId !== g.userClubId && !x.acad && !x.loanFrom && g.clubs[x.clubId]?.leagueId === 'champ' && x.age < 30 && x.joinedAt == null)
    S.touch(); S.go('player', p.id)
    return { id: p.id, name: p.name }
  })
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: /Offer asking price/ }).first().click()
  await page.waitForTimeout(300)
  // personal terms at the demand: the camp's own number
  await page.locator('button', { hasText: 'Agree terms' }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  const agreed = await page.evaluate(id => !!(window.rugbyStore.getState().game.pendingDeals ?? []).find(d => d.playerId === id), deal.id)
  ok(agreed, `the deal for ${deal.name} is agreed while the window is shut`)
  const card = await page.locator('[data-deal="buy"]').innerText().catch(() => '')
  ok(/Agreed: joins/.test(card) && /£/.test(card) && /Jan/.test(card), `his profile shows it: "${card.replace(/\s+/g, ' ').slice(0, 90)}"`)
  ok(await page.locator('button', { hasText: /Offer asking price/ }).count() === 0, 'and the fee buttons are gone')
  await page.locator('button', { hasText: 'Call the deal off' }).click()
  await page.waitForTimeout(300)
  const gone = await page.evaluate(id => !(window.rugbyStore.getState().game.pendingDeals ?? []).some(d => d.playerId === id), deal.id)
  ok(gone && await page.locator('[data-deal]').count() === 0, 'Call the deal off ends it and the card goes')
} catch (e) {
  say('FAIL  ' + String(e).slice(0, 300)); fails++
}
await browser.close()
server.stop()
say(fails ? `DEAL CARD UI FAILED (${fails})` : 'DEAL CARD UI PASSED: an agreed transfer is on the profile, and can be called off')
done(fails)
