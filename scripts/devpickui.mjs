// ---- DEVELOPMENT FOCUS, PERSONAL PLANS AND MENTORING, ON SCREEN (1.8.0) ----
//
// Owner: "development focus and personal plans - they need to be more so I can
// select any player who reaches the criteria", and "Club/Mentoring should be
// moved into team report. We need to rethink how we select these and the
// impact this has."
//
// The node probes (devpickprobe.ts, mentorimpact.ts) hold the rules. This holds
// the screens, in a real career:
//
//   a man the old Training screen could not show (outside the ten for focus,
//     the twelve for plans) is found by the search, picked, and takes;
//   the free places are printed, and a full book says so on the row;
//   the Training screen's Club tab signposts mentoring to the Team Report,
//     which opens on its Mentoring tab; a young player is chosen, every
//     eligible mentor is listed with position, leadership, caps and what he
//     teaches (never the fit or a forecast: round 4 made a pairing a gamble
//     for its first month), and a tap makes the pairing;
//   all three survive a reload (the picks used to reach the disk only with the
//     next week's autosave);
//   nothing spills sideways at 412 or 360 wide.
//
// Screenshots go to $SHOTS for a human look.
// Run: npm run build && node scripts/devpickui.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'
const SHOTS = process.env.SHOTS ?? '/tmp/devpick'
mkdirSync(SHOTS, { recursive: true })
const PORT = 4271
const server = await startPreview(String(PORT), 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => {
  let a = 20260927
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
})
const errors = []
page.on('pageerror', e => errors.push(String(e)))
let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const G = fn => page.evaluate(fn)
const noSideScroll = async label => {
  const w = await G(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth }))
  ok(w.doc <= w.vw + 1, `${label}: no sideways scroll (${w.doc} in ${w.vw})`)
}
const go = (screen, param) => page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [screen, param])

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

  // ---- development focus ----
  await go('training')
  await page.waitForSelector('[data-dev-row]')
  // the man the old chips could not show: qualifies, outside the ten biggest gaps
  const pick = await G(() => {
    const g = window.rugbyStore.getState().game
    const sq = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean)
    const u27 = sq.filter(p => p.age <= 26)
    const top10 = new Set([...u27].sort((a, b) => b.pa - b.ca - (a.pa - a.ca)).slice(0, 10).map(p => p.id))
    const hidden = u27.filter(p => p.ca < p.pa && !top10.has(p.id))
    const p = hidden[hidden.length - 1]
    return { id: p.id, name: p.name, eligible: u27.filter(p => p.ca < p.pa).length }
  })
  const rows0 = await page.locator('[data-dev-row]').count()
  console.log(`  ${pick.eligible} qualify for focus; ${rows0} rows listed; picking ${pick.name}, outside the old ten`)
  ok(rows0 >= pick.eligible && rows0 > 10, `every qualifying man is listed, not ten (${rows0})`)
  ok(await page.locator('.section-title', { hasText: '3 of 3 places free' }).count() > 0, 'the title says how many places are free')
  await page.screenshot({ path: `${SHOTS}/focus-412.png` })
  await page.fill('input[aria-label="Search by name"]', pick.name.split(' ').slice(-1)[0])
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${SHOTS}/focus-search-412.png` })
  await page.locator(`[data-dev-row="${pick.id}"] button`).click()
  await page.waitForTimeout(200)
  ok(await G(() => window.rugbyStore.getState().game.devFocus.slice()) .then(ids => ids.includes(pick.id)), `${pick.name} is on development focus`)
  ok(await page.locator('.section-title', { hasText: '2 of 3 places free' }).count() > 0, 'and the free places count down')
  await page.fill('input[aria-label="Search by name"]', '')
  // fill the book, then try a fourth: refused on the row, nobody dropped
  const more = await G(() => {
    const g = window.rugbyStore.getState().game
    const sq = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean)
    return sq.filter(p => p.age <= 26 && p.ca < p.pa && !g.devFocus.includes(p.id)).slice(0, 3).map(p => p.id)
  })
  await page.locator(`[data-dev-row="${more[0]}"] button`).click()
  await page.locator(`[data-dev-row="${more[1]}"] button`).click()
  await page.locator(`[data-dev-row="${more[2]}"] button`).click()
  await page.waitForTimeout(150)
  const focusNow = await G(() => window.rugbyStore.getState().game.devFocus.slice())
  ok(focusNow.length === 3 && focusNow.includes(pick.id) && !focusNow.includes(more[2]), 'a fourth pick is refused and the first man keeps his place')
  ok(await page.locator(`[data-dev-row="${more[2]}"]`, { hasText: 'All 3 places are taken' }).count() === 1, 'and the refusal is printed on the row that was tapped')
  await page.screenshot({ path: `${SHOTS}/focus-full-412.png` })
  await page.locator('[data-dev-row]').first().evaluate(el => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `${SHOTS}/focus-chosen-412.png` })
  await noSideScroll('development focus')

  // ---- personal plans ----
  await page.locator('.tab-bar button', { hasText: 'Personal Plans' }).click()
  await page.waitForTimeout(150)
  const deep = await G(() => {
    const g = window.rugbyStore.getState().game
    const sq = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean).filter(p => !p.acad)
    const top12 = new Set([...sq].sort((a, b) => b.ca - a.ca).slice(0, 12).map(p => p.id))
    const hidden = sq.filter(p => !top12.has(p.id))
    const p = hidden[hidden.length - 1]
    return { id: p.id, name: p.name, n: sq.length }
  })
  const rowsP = await page.locator('[data-dev-row]').count()
  ok(rowsP >= deep.n, `every senior-squad man is listed for plans (${rowsP} rows, ${deep.n} qualify)`)
  await page.locator(`[data-dev-row="${deep.id}"] select`).selectOption('defence')
  await page.waitForTimeout(150)
  ok(await G(() => (window.rugbyStore.getState().game.plans ?? []).map(x => `${x.id}:${x.plan}`)).then(a => a.includes(`${deep.id}:defence`)),
    `${deep.name}, outside the old twelve, is on the Defence plan`)
  await page.locator(`[data-dev-row="${deep.id}"]`).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/plans-412.png` })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${SHOTS}/plans-top-412.png` })
  await page.locator('button', { hasText: /^Show \d+ who do not qualify$/ }).click().catch(() => {})
  await page.waitForTimeout(150)
  const acadRow = await page.locator('[data-dev-row]', { hasText: 'Academy scholar' }).count()
  ok(acadRow > 0, `the men who do not qualify can be shown, each with why (${acadRow} academy rows)`)
  await noSideScroll('personal plans')

  // ---- mentoring: the signpost, the Team Report, the pairing ----
  await page.locator('.tab-bar button', { hasText: 'Club' }).first().click()
  await page.waitForSelector('[data-go-mentoring]')
  await page.screenshot({ path: `${SHOTS}/training-club-412.png` })
  await page.click('[data-go-mentoring]')
  await page.waitForSelector('[data-kid]')
  ok(await G(() => window.rugbyStore.getState().nav.at(-1)?.screen) === 'report', 'the signpost opens the Team Report')
  ok(await page.locator('.tab-bar button.active', { hasText: 'Mentoring' }).count() === 1, 'on its Mentoring tab')
  await page.screenshot({ path: `${SHOTS}/mentoring-empty-412.png`, fullPage: true })
  const kid = await page.locator('[data-kid]').first().getAttribute('data-kid')
  await page.click(`[data-kid="${kid}"]`)
  await page.waitForSelector('[data-mentor]')
  const nMentors = await page.locator('[data-mentor]').count()
  const nSeniors = await G(() => {
    const g = window.rugbyStore.getState().game
    return g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => p && !p.acad && p.age >= 28).length
  })
  ok(nMentors === nSeniors, `every senior of 28 or more is offered as a mentor (${nMentors} of ${nSeniors})`)
  const firstCard = await page.locator('[data-mentor]').first().innerText()
  ok(/Leadership \d+/.test(firstCard) && /caps/.test(firstCard) && /(Same position|Same unit|Different unit)/.test(firstCard),
    'each mentor shows his leadership, caps and position link')
  // A GAMBLE (owner, round 4): no fit, no reason, no forecast at pairing time
  ok(!/Inseparable|Working well|Coming along|Polite, no more|Not taking|A waste of|Expected over a season/.test(await page.locator('[data-mentor]').allInnerTexts().then(x => x.join(' '))),
    'and nothing about how the pairing would go')
  await page.screenshot({ path: `${SHOTS}/mentoring-pick-412.png` })
  const mentor = await page.locator('[data-mentor]').first().getAttribute('data-mentor')
  await page.locator(`[data-mentor="${mentor}"] button`).click()
  await page.waitForSelector('[data-pair]')
  const pairs = await G(() => (window.rugbyStore.getState().game.mentors ?? []).map(m => ({ ...m })))
  ok(pairs.length === 1 && String(pairs[0].kid) === kid && String(pairs[0].senior) === mentor && pairs[0].since != null,
    'the pairing is made from the Team Report, with its ledger open')
  ok(/Too early to tell/.test(await page.locator('[data-pair]').first().innerText()), 'and its card says only that it is too early to tell')
  await page.screenshot({ path: `${SHOTS}/mentoring-paired-412.png`, fullPage: true })
  await noSideScroll('mentoring')

  // ---- a reload keeps all three ----
  await page.waitForTimeout(900) // the save queue's idle window
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  if (!(await page.locator('.bottom-nav').count())) {
    const cont = page.locator('button', { hasText: /^Continue/ }).first()
    if (await cont.count()) await cont.click()
  }
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })
  const back = await G(() => {
    const g = window.rugbyStore.getState().game
    return { focus: g.devFocus.slice(), plans: (g.plans ?? []).map(x => `${x.id}:${x.plan}`), mentors: (g.mentors ?? []).map(m => `${m.senior}>${m.kid}`) }
  })
  ok(back.focus.includes(pick.id), 'after a reload the development focus is still there')
  ok(back.plans.includes(`${deep.id}:defence`), 'and the personal plan')
  ok(back.mentors.includes(`${mentor}>${kid}`), 'and the mentoring pairing')

  // ---- 360 wide ----
  await page.setViewportSize({ width: 360, height: 780 })
  await go('report', 'mentoring')
  await page.waitForSelector('[data-pair]')
  await page.screenshot({ path: `${SHOTS}/mentoring-paired-360.png`, fullPage: true })
  await noSideScroll('mentoring at 360')
  await page.click('[data-kid]')
  await page.waitForSelector('[data-mentor]')
  await page.screenshot({ path: `${SHOTS}/mentoring-pick-360.png` })
  await noSideScroll('mentor list at 360')
  await go('training')
  await page.waitForSelector('[data-dev-row]')
  await page.screenshot({ path: `${SHOTS}/focus-360.png` })
  await noSideScroll('development focus at 360')
  await page.locator('.tab-bar button', { hasText: 'Personal Plans' }).click()
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${SHOTS}/plans-360.png` })
  await noSideScroll('personal plans at 360')
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
console.log(fails ? `\nDEV PICK UI FAILED (${fails})` : '\nDEV PICK UI PASSED: any qualifying man can be picked, mentoring lives on the Team Report, and all of it survives a reload')
process.exit(fails ? 1 : 0)
