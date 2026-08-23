// Turning a job down takes it off the pile.
//
// User: "on the available jobs list - when you reject it, remove it from the pile."
// It used to sink to the bottom at 55% opacity and stay there, on the reasoning that
// hiding it would put Reconsider out of reach. That reasoning was about hiding it
// OUTRIGHT, and it left a dead card in the middle of a list you are reading to find
// work. So the card leaves the list and one line at the foot brings it back.
//
// A card that only DIMS still passes a count of cards, which is why this probe counts
// what is in the list rather than checking a class - the previous behaviour would
// have passed any test that just looked for the club's name on the page.
//
// GETTING A VACANCY WITHOUT WAITING FOR A SACKING: resignJob() pushes your own club
// into state.vacancies the moment you walk out. So the probe resigns, which gives it
// a real vacancy in one tap rather than tapping Continue for the four or five weeks a
// natural sacking takes at 22% a week.
//
// Serves dist: run `npm run build` first or this grades the previous build.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4198', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

let fails = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

/** How many vacancy cards are in the list, and whose they are. */
const pile = () => page.evaluate(() => {
  // a vacancy card is one carrying an Apply button, which the resign block and the
  // header card do not have
  const cards = [...document.querySelectorAll('.card')].filter(c =>
    [...c.querySelectorAll('button')].some(b => /^(Apply|Applied)$/.test((b.textContent ?? '').trim())))
  return cards.map(c => (c.querySelector('h3')?.textContent ?? '').trim())
})

try {
  await page.goto('http://localhost:4198/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Jobs')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // ---- into the Job Centre. The submenu veil swallows taps meant for the rail
  // underneath it, so the rail button opens the group and the group item is what
  // gets clicked - never the rail again while the veil is up.
  const openJobs = async () => {
    await page.click('.bottom-nav button[title="Manager"]')
    await page.waitForSelector('.submenu', { timeout: 5000 })
    await page.click('.submenu >> text=Job Centre')
    await page.waitForSelector('text=Vacancies', { timeout: 5000 })
  }
  await openJobs()

  // ---- resign, which puts Northampton itself in the vacancy list
  await page.click('text=Resign from')
  await page.click('text=Confirm - walk away')
  await page.waitForTimeout(400)
  // unemployed now, so Jobs is on the bottom rail in its own right
  await page.click('.bottom-nav button[title="Jobs"]')
  await page.waitForSelector('text=Vacancies', { timeout: 5000 })

  const before = await pile()
  console.log(`  the pile: [${before.join(' | ')}]`)
  ok(before.length >= 1, `at least one vacancy to turn down (${before.length})`)
  if (!before.length) throw new Error('no vacancy to work with')
  const target = before[0]

  // The badge on the rail, which must agree with the list beside it. The class is
  // .dot inside .nbadge - the first cut of this guessed .badge/.cue, found nothing,
  // read 0 both times and passed on 0 === 0. A probe measuring nothing is worse than
  // no probe, so it asserts the element exists before it believes the number.
  const badge = () => page.evaluate(() => {
    const b = document.querySelector('.bottom-nav button[title="Jobs"] .nbadge .dot')
    return { found: !!b, n: b ? parseInt((b.textContent ?? '0').trim(), 10) || 0 : 0 }
  })
  const badgeBefore = await badge()
  ok(badgeBefore.found && badgeBefore.n === before.length,
    `the rail badge shows the pile before anything is turned down (badge ${badgeBefore.found ? badgeBefore.n : 'missing'}, pile ${before.length})`)

  // ---- turn the first one down
  await page.locator('.card', { hasText: target }).locator('text=Not interested').first().click()
  await page.waitForTimeout(350)
  const after = await pile()
  console.log(`  after turning down ${target}: [${after.join(' | ') || 'empty'}]`)
  ok(!after.includes(target), `${target} is off the pile, not just dimmed`)
  ok(after.length === before.length - 1, `the pile is one shorter (${before.length} -> ${after.length})`)
  // AND THE CONFIRMATION SAYS WHAT YOU DID. It said the opposite: passJob writes
  // v.passed onto the same object the click handler was reading, so the ternary after
  // the call reported the new value and turning a club down answered "Back on the
  // list: you would consider Northampton Saints after all." Found in a screenshot.
  ok(await page.locator('text=Turned down:').count() > 0
    && await page.locator('text=Back on the list').count() === 0,
    'the confirmation says you turned it down, not that you reconsidered')
  // THE BUTTON, not the words. Emptying the pile also renders "Nothing left that you
  // have not turned down", so a bare text= match found the empty-state sentence, and
  // the click that was meant to expand the section hit a paragraph and did nothing.
  const turnedLine = page.locator('button', { hasText: 'turned down' })
  ok(await turnedLine.count() === 1, 'and one line at the foot says how many were turned down')

  const badgeAfter = await badge()
  console.log(`  rail badge: ${badgeBefore.n} -> ${badgeAfter.found ? badgeAfter.n : 'gone'}`)
  // one vacancy turned down out of one leaves nothing to count, and the badge is not
  // rendered at all rather than rendered as a zero
  const expected = Math.max(0, before.length - 1)
  ok(expected === 0 ? !badgeAfter.found : badgeAfter.n === expected,
    `the rail badge counts the pile, not the vacancies (${badgeBefore.n} -> ${badgeAfter.found ? badgeAfter.n : 'no badge'}, wanted ${expected || 'no badge'})`)

  // ---- and it is reachable again, because a mistap must not cost you the job
  await turnedLine.first().click()
  await page.waitForTimeout(300)
  const shown = await pile()
  ok(shown.includes(target), `${target} is behind the turned-down line and can be read again`)
  await page.locator('.card', { hasText: target }).locator('text=Put it back on the list').first().click()
  await page.waitForTimeout(350)
  const restored = await pile()
  console.log(`  after putting it back: [${restored.join(' | ')}]`)
  ok(restored.includes(target), `${target} is back in the pile`)
  ok(restored.length === before.length, `and the pile is its original length again (${restored.length})`)
  // the other half of the inverted-message bug: this direction has to be right too
  ok(await page.locator('text=Back on the list').count() > 0
    && await page.locator('text=Turned down:').count() === 0,
    'and the confirmation now says it is back on the list')
} catch (e) {
  console.error('JOBS PROBE stopped early:', e.message)
  fails++
}

console.log(fails ? `\nJOBS PROBE FAILED (${fails})` : '\nJOBS PROBE PASSED')
await browser.close()
server.stop()
process.exit(fails ? 1 : 0)
