/**
 * AN OFFER IS A DECISION, NOT A DOOR YOU FALL THROUGH.
 *
 * Until v1.5.4 applying for a job and being wanted were the same click: the
 * roll succeeded inside applyForJob and the manager's desk moved before his
 * thumb left the screen (owner: "if you apply for the job you should have the
 * option to accept or reject the offer rather than just instantly going into
 * it"). A speculative application at a club you were curious about ended the
 * career you were building.
 *
 * So the club makes an OFFER and it waits on the Job Centre. This walks both
 * answers. The offer itself is staged through the store handle rather than
 * fished for with repeated applications, because whether a given board says
 * yes is a seeded roll and this probe is about what happens after it does.
 */
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'

const PORT = '4232'
let fails = 0
const say = (s) => console.log(s)
const ok = (c, what) => { say(`  ${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }

const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 780 } })
page.setDefaultTimeout(6000)
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

// The Jobs tab on the rail is only there while a manager is out of work; in a
// job it lives in the manager's menu, which is where a curious manager finds it.
const openJobs = async () => {
  await page.locator('.bottom-nav button', { hasText: '▸' }).nth(1).click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(300)
  await page.locator('.submenu-item', { hasText: 'Job Centre' }).click()
  await page.waitForSelector('.content')
  await page.waitForTimeout(400)
}
/** Put a vacancy and an offer from it on the table, at a club that is not ours. */
const stageOffer = () => page.evaluate(() => {
  const st = window.rugbyStore.getState()
  const g = st.game
  const target = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId)
  g.vacancies = [{ clubId: target.id, week: g.week }]
  g.jobOffer = { clubId: target.id, week: g.week }
  st.touch()
  return { id: target.id, name: target.name }
})
const desk = () => page.evaluate(() => {
  const g = window.rugbyStore.getState().game
  return { club: g.userClubId, offer: g.jobOffer?.clubId ?? null, vacancies: g.vacancies.length }
})

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('#root >> text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // ---- 1. turning it down leaves the desk where it is ----
  say('\n--- 1. no means no, and the club moves on')
  const first = await stageOffer()
  await openJobs()
  ok(await page.locator('.job-offer').count() === 1, `the offer from ${first.name} is on the Job Centre`)
  ok(await page.locator('.job-accept').count() === 1 && await page.locator('.job-decline').count() === 1,
    'with both answers on it')
  const beforeNo = await desk()
  await page.click('.job-decline')
  await page.waitForTimeout(400)
  const afterNo = await desk()
  ok(afterNo.club === beforeNo.club, `the desk did not move (${afterNo.club})`)
  ok(afterNo.offer === null, 'the offer is off the table')
  ok(afterNo.vacancies === 0, 'and the vacancy went with it - they appoint somebody else')
  ok(await page.locator('.job-offer').count() === 0, 'the card is gone from the page')

  // ---- 2. yes moves it ----
  say('\n--- 2. yes takes the job')
  const second = await stageOffer()
  await openJobs()
  ok(await page.locator('.job-offer').count() === 1, 'a second offer lands')
  await page.click('.job-accept')
  await page.waitForTimeout(600)
  const afterYes = await desk()
  ok(afterYes.club === second.id, `the desk moved to ${second.name} (${afterYes.club})`)
  ok(afterYes.offer === null, 'and the offer is cleared')
  ok(await page.locator('.job-offer').count() === 0, 'the card is gone')

  // ---- 3. an application no longer moves anything on its own ----
  say('\n--- 3. applying is an application, not an appointment')
  const club = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const target = Object.values(g.clubs).find(c => c.id !== g.userClubId)
    g.vacancies = [{ clubId: target.id, week: g.week }]
    g.jobOffer = null
    st.touch()
    return { id: target.id, before: g.userClubId }
  })
  await openJobs()
  await page.locator('.btn.gold', { hasText: /^Apply$/ }).first().click()
  await page.waitForTimeout(500)
  const after = await desk()
  ok(after.club === club.before,
    `the desk is still where it was the instant Apply was pressed (${after.club})`)
} catch (err) {
  say(`  FAIL  PROBE THREW: ${err.message.split('\n')[0]}`)
  fails++
}

await browser.close()
server.stop()
say(fails === 0
  ? '\nJOB OFFER PROBE PASSED: the offer waits for an answer, and both answers do what they say'
  : `\nJOB OFFER PROBE FAILED (${fails})`)
done(fails)
