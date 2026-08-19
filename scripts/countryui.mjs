// Probe: the Club & Country screen exists, fits a portrait phone, and its
// controls do what the engine promised.
//
// The country desk needs a natTeam to render, so the natural walk of the
// sweep probes (geosweep, portraitqa, tapsize) never reaches it - the screen
// would ship with zero layout coverage on the exact device class every past
// clip was found on. This probe stages the Test job through the store handle
// and holds the screen to the house rules: no horizontal overflow at 412px,
// tables inside the viewport, and the shaping buttons wired to the engine.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4193, 2500)
const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })

try {
  await page.goto('http://localhost:4193/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Country')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // stage the Test job with an open window: Scotland, a tenure record, and
  // the federation's 26 already in camp
  const staged = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    g.natTeam = 'SCO'
    g.natConfidence = 63
    g.natRecord = { m: 5, w: 3, d: 0, l: 2 }
    // a finished tenure from years back - the profile must still show it
    g.natHistory = [{ nat: 'WAL', m: 14, w: 8, d: 1, l: 5 }]
    // an international comp's fixture list names the window weeks - park the
    // save inside one so the shaping buttons render
    const intl = g.fixtures.filter(f => ['aut', 'sn'].includes(f.compId))
    let windowed = false
    if (intl.length) {
      g.week = Math.min(...intl.map(f => f.week))
      windowed = true
    }
    const scots = Object.values(g.players)
      .filter(p => p.nat === 'SCO' && p.clubId && !p.injury && !p.onLoan)
      .sort((a, b) => b.ca - a.ca).slice(0, 26)
    g.natSquads['SCO'] = scots.map(p => p.id)
    for (const p of scots) p.natSquad = true
    st.touch()
    return { windowed, squad: scots.length }
  })
  say(`  staged: ${staged.squad} in camp, window ${staged.windowed ? 'open' : 'CLOSED (no intl comp this season)'}`)

  // the Home country card is the front door
  await page.waitForTimeout(400)
  const card = page.locator('.card', { hasText: 'Head coach' })
  ok(await card.count() > 0, 'Home carries the country desk card')
  await card.first().click()
  await page.waitForSelector('text=Union confidence', { timeout: 10000 })
  ok(true, 'the card opens the Club & Country screen')

  // the desk states its numbers
  const head = await page.locator('.card').first().innerText()
  ok(/World No\. \d+/.test(head), 'the header names the world ranking')
  ok(/Tests 3-0-2 under you/.test(head), 'and the tenure Test record')
  ok(/Union confidence 63/.test(head), 'and the union confidence')

  // both appointments, both doors out - two taps to leave, one to think again
  ok(await page.locator('text=Your Appointments').count() > 0, 'the appointments card is there')
  const stepBtns = page.locator('button', { hasText: 'Step down' })
  ok(await stepBtns.count() === 2, `both jobs carry a step-down button (${await stepBtns.count()})`)
  await stepBtns.first().click()
  await page.waitForTimeout(200)
  ok(await page.locator('button', { hasText: 'Confirm' }).count() > 0, 'stepping down asks for a second tap')

  // the house layout rules, on the screen the sweeps cannot reach
  const geo = await page.evaluate(() => {
    const doc = document.scrollingElement ?? document.documentElement
    const tables = [...document.querySelectorAll('.tblwrap table')].map(t => ({
      right: Math.round(t.getBoundingClientRect().right),
    }))
    return { scrollW: doc.scrollWidth, innerW: window.innerWidth, tables }
  })
  ok(geo.scrollW <= geo.innerW, `no horizontal overflow (${geo.scrollW} of ${geo.innerW})`)
  for (const t of geo.tables) {
    ok(t.right <= geo.innerW, `table fits the viewport (right edge ${t.right} of ${geo.innerW})`)
  }

  if (staged.windowed) {
    // the shaping controls are wired to the engine
    ok(await page.locator('text=/Test Squad · 26\\/26/').count() > 0, 'the squad counts 26 of 26')
    const dropBtn = page.locator('button', { hasText: 'Drop' }).first()
    ok(await dropBtn.count() > 0, 'the squad rows carry Drop buttons')
    await dropBtn.click()
    await page.waitForTimeout(300)
    ok(await page.locator('text=/Test Squad · 25\\/26/').count() > 0, 'a drop leaves 25 in camp')
    const sq = await page.evaluate(() => window.rugbyStore.getState().game.natSquads['SCO'].length)
    ok(sq === 25, `and the engine agrees (${sq})`)
    const callBtn = page.locator('button', { hasText: 'Call up' }).first()
    ok(await callBtn.count() > 0, 'the next men in carry Call up buttons')
    await callBtn.click()
    await page.waitForTimeout(300)
    ok(await page.locator('text=/Test Squad · 26\\/26/').count() > 0, 'the call-up refills the room')
  } else {
    say('  --  window staging unavailable this world: shaping buttons untested this run')
  }

  // the international record outlives the job, on the Manager Profile
  await page.evaluate(() => window.rugbyStore.getState().go('profile'))
  await page.waitForSelector('text=International Record', { timeout: 10000 })
  const recCard = await page.locator('.card', { hasText: 'International Record' }).innerText()
  ok(/Wales.*14 Tests.*8W 1D 5L/s.test(recCard), 'the closed Wales tenure is still on the CV')
  ok(/Scotland.*5 Tests.*3W 0D 2L.*current/s.test(recCard), 'and the live Scotland tenure sits beside it, marked current')
} catch (e) {
  say(`FAIL  ${e.message}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}

say(fails ? `\nCOUNTRY UI PROBE FAILED (${fails})` : '\nCOUNTRY UI PROBE PASSED: the desk renders, fits, and answers the hand')
done(fails)
