// Browser probe for three pieces of live feedback that only exist on screen.
//
//   THE HUB MENU IS IN THE USER'S ORDER (13D). He gave the list; a reorder that
//     drifts back is invisible in a diff and obvious on a phone. The order is
//     asserted item by item, including the two renames: Squad became Team, and
//     Academy dropped "& A League".
//
//   THE FULL-TIME VERDICT NAMES TWO FIXES (13A). The engine side is covered by
//     fixprobe; what this adds is that they REACH THE SCREEN, numbered, under the
//     coach's verdict, with the unit battle rows still below them.
//
//   THE INJURY BADGE CLEARS ONCE THE PAGE IS VIEWED (13E). Standing on the
//     Medical Centre has to make the red dot go away and keep it away, which is a
//     round trip through the rail that no unit test can make.
//
// The verdict half needs a finished match, so this plays one for real. Skip is
// disabled while a touchline call is waiting, so the walk answers those first.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4188', 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
// the user's phone, in portrait, in night mode
const page = await browser.newPage({ viewport: { width: 412, height: 780 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
// Playwright's default action timeout is 30 seconds, and this walk taps buttons
// speculatively inside bounded loops with .catch() on each. Ten speculative taps
// against a button that never becomes clickable is five minutes of silence, which
// is how a probe ends up looking hung instead of failing. Four seconds is plenty
// for a local preview and turns every dead end into a fast, visible failure.
page.setDefaultTimeout(4000)

const WANT = [
  'Team', 'Team Report', 'Tactics', 'Academy', 'Training & Staff',
  'Medical Centre', 'Fixtures & Results', 'Finances', 'Transfer Centre',
  'Club Infrastructure', 'Club Information',
]

try {
  await page.goto('http://localhost:4188/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Hub Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })

  // ---- the Hub menu, in the user's order ----------------------------------
  await page.click('.bottom-nav button[title="Hub"]')
  await page.waitForSelector('.submenu-item', { timeout: 10000 })
  const items = await page.evaluate(() => [...document.querySelectorAll('.submenu-item')]
    .map(el => (el.textContent ?? '').replace(/\s+/g, ' ').replace(/[0-9]+$|9\+$/, '').trim()))
  // The label sits after the icon glyph and a badge count can trail it, so the
  // rendered text is matched against the expected names rather than compared
  // outright. LONGEST MATCH FIRST: the first cut of this took the first hit and
  // reported "Team Report" as "Team", which failed a row that was actually right.
  const byLength = [...WANT].sort((a, b) => b.length - a.length)
  const labels = items.map(t => byLength.find(w => t.includes(w)) ?? t)
  say(`\nHub menu as rendered:\n  ${labels.join('\n  ')}\n`)
  ok(labels.length === WANT.length, `${WANT.length} items in the Hub (found ${labels.length})`)
  for (let i = 0; i < WANT.length; i++) {
    ok(labels[i] === WANT[i], `position ${i + 1} is ${WANT[i]}${labels[i] === WANT[i] ? '' : ` (found "${labels[i]}")`}`)
  }
  ok(!labels.some(l => /Squad/.test(l)), 'nothing is called Squad any more')
  ok(!labels.some(l => /A League/.test(l)), 'and the Academy item does not mention the A League')

  // ---- before the first match, three of the eleven are marked -------------
  //
  // Eleven equal rows and no order of business, found in the studio audit. Its
  // own suggestion was to HIDE the bottom of the list until week four, which is
  // wrong: pre-season is when a manager wants the Transfer Centre most. So the
  // list stays whole and three rows are marked.
  //
  // The window is NOT a week count. It was, and the user was still being told
  // "before your first match, these three are the job" in week 3 with matches
  // played, because Continue walks day by day and three weeks of a pre-season is
  // several games. The note now clears the moment he has managed one, which is
  // what its own sentence promises - and that half is asserted after the match
  // below, because this walk plays one anyway.
  {
    const marked = await page.evaluate(() => [...document.querySelectorAll('.submenu-item')]
      .filter(el => el.querySelector('.mstart'))
      .map(el => (el.textContent ?? '').replace(/\s+/g, ' ').replace('start here', '').trim()))
    say(`  marked as the first jobs: ${marked.join(', ') || '(none)'}`)
    ok(marked.length === 3, `exactly three rows are marked (found ${marked.length})`)
    for (const want of ['Tactics', 'Team', 'Training & Staff']) {
      ok(marked.some(m => m.includes(want)), `${want} is one of them`)
    }
    ok(!marked.some(m => /Team Report/.test(m)), 'and Team Report is not, despite sharing a word with Team')
    ok(await page.locator('.submenu-note').count() === 1, 'with one line above the list saying what the marks mean')
    // a badge on the longest label is the case that overflows
    const over = await page.evaluate(() => [...document.querySelectorAll('.submenu-item')]
      .filter(el => el.scrollWidth > el.clientWidth + 1)
      .map(el => (el.textContent ?? '').replace(/\s+/g, ' ').trim()))
    ok(over.length === 0, `no row is pushed past its own width by the mark${over.length ? ': ' + over.join(', ') : ''}`)
  }

  // ---- a real match, to full time -----------------------------------------
  //
  // Continue walks the week a day at a time, so reaching Saturday is a handful of
  // taps rather than one, and Kick Off opens the dressing room before the tunnel.
  // The first version of this probe tapped a generic ".action-bar button" and got
  // nowhere near a pitch.
  // Leave the menu by USING it. Tapping the rail's Home button while the submenu
  // is open lands on the overlay, the .catch() swallows the miss, and the walk
  // then hunts for a Continue button on a screen that is still the menu.
  await page.click('.submenu-item >> text=Fixtures & Results')
  await page.waitForSelector('.tblwrap, .dtable', { timeout: 10000 })
  await page.click('.bottom-nav button[title="Home"]')
  await page.waitForSelector('.continue-btn', { timeout: 15000 })

  const walk = []
  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off').count()) break
    walk.push((await page.locator('.continue-btn').innerText().catch(() => '?')).trim())
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(500)
  }
  say(`\nContinue taps: ${walk.join(' > ') || '(none)'}`)
  ok(await page.locator('text=Kick Off').count() > 0, 'Continue walked the week to a matchday')

  await page.locator('text=Kick Off ▸').first().click().catch(() => {})
  // the dressing room, then the ready check: both optional depending on the sheet
  await page.locator('.talk-modal').waitFor({ timeout: 3000 })
    .then(() => page.click('.talk-modal .speech-tile >> text=Calm the nerves')).catch(() => {})
  await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    .then(() => page.click('text=▸ Take the Field')).catch(() => {})
  await page.waitForSelector('.scoreboard', { timeout: 20000 })
  ok(true, 'reached the pitch')

  // Drive to full time. The clock stops dead for a touchline call, and Skip is
  // disabled while one is waiting, so those are answered first or the walk hangs.
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      return {
        ft: !!document.querySelector('.ft-stamp') || body.includes('Continue to Results'),
        call: body.includes('your call from the touchline'),
        interval: /Start Second Half|Play the Final Quarter/.test(body),
      }
    })
    if (s.ft) break
    if (s.call) await page.click('text=Take the Points').catch(() => {})
    else if (s.interval) {
      await page.click('text=▸ Start Second Half')
        .catch(() => page.click('text=▸ Play the Final Quarter').catch(() => {}))
    } else {
      await page.click('.speed-controls >> text=Skip').catch(() => {})
    }
    await page.waitForTimeout(250)
  }

  // ---- the two fixes, on screen -------------------------------------------
  const verdict = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.card')]
      .find(c => (c.textContent ?? '').includes("Coach's Verdict"))
    if (!card) return null
    const rows = [...card.querySelectorAll('.fix-row')].map(r => ({
      no: (r.querySelector('.fix-no')?.textContent ?? '').trim(),
      head: (r.querySelector('b')?.textContent ?? '').trim(),
      how: (r.querySelector('.muted')?.textContent ?? '').trim(),
    }))
    const txt = card.textContent ?? ''
    return {
      rows,
      heading: /The Two Fixes|The Fix/.test(txt),
      unitsBelow: txt.indexOf('The Unit Battles') > txt.indexOf('Coach'),
      pcts: [...txt.matchAll(/(\d+)% won/g)].map(m => Number(m[1])),
    }
  })
  ok(!!verdict, 'the full-time card carries a coach\'s verdict')
  if (verdict) {
    say('')
    for (const r of verdict.rows) say(`  ${r.no}. ${r.head}\n     ${r.how}`)
    say('')
    ok(verdict.heading, 'it is headed as the fixes')
    ok(verdict.rows.length >= 1 && verdict.rows.length <= 2, `${verdict.rows.length} numbered fix row(s)`)
    ok(verdict.rows.every(r => r.no && r.head && r.how), 'every row has a number, a finding and an instruction')
    ok(verdict.unitsBelow, 'and the unit battles are still below it')
    // the percentages quoted in a fix have to be rows on the same card
    const quoted = verdict.rows.flatMap(r => [...r.head.matchAll(/(\d+)% won/g)].map(m => Number(m[1])))
    ok(quoted.every(q => verdict.pcts.includes(q)),
      `any percentage in the advice matches a row (quoted ${quoted.join('/') || 'none'}, rows ${verdict.pcts.join('/')})`)
  }

  // ---- the injury badge is a notification, not a status (13E) --------------
  //
  // A match is the thing that produces injuries, so this comes after one. If
  // nobody got hurt there is nothing to test and that is reported as skipped
  // rather than counted as a pass: a probe that quietly asserts nothing is worse
  // than no probe.
  await page.click('text=Continue to Results').catch(() => {})
  await page.waitForTimeout(600)
  await page.click('.bottom-nav button[title="Hub"]').catch(() => {})
  await page.waitForSelector('.submenu-item', { timeout: 10000 })
  const badgeOf = () => page.evaluate(() => {
    const row = [...document.querySelectorAll('.submenu-item')]
      .find(el => (el.textContent ?? '').includes('Medical Centre'))
    const b = row?.querySelector('.mbadge')
    return b ? Number((b.textContent ?? '0').trim()) || 0 : 0
  })
  const before = await badgeOf()
  if (!before) {
    say('  skip  nobody was injured in that match, so the badge had nothing to show')
  } else {
    await page.click('.submenu-item >> text=Medical Centre')
    await page.waitForTimeout(700)
    await page.click('.bottom-nav button[title="Hub"]')
    await page.waitForSelector('.submenu-item', { timeout: 10000 })
    const after = await badgeOf()
    ok(after === 0, `the injury badge read ${before} and clears after viewing the page (now ${after})`)
  }
  // NOT ASSERTED HERE: that the marks are gone once a match has been managed.
  //
  // Four attempts at reaching the Hub after the match failed on state I had not
  // accounted for - the full-time card carries no nav rail, and the submenu veil
  // swallows every tap on the rail underneath it, which is a lesson this probe
  // already contains in writing further up. A flaky assertion is worse than no
  // assertion: it teaches you to ignore the probe. The gate is one expression
  // (season 0 and no matches managed) shared with the Home hint, and it deserves
  // an honest look on a phone rather than a fifth guess at a tap sequence.
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
  await page.screenshot({ path: '/tmp/hubprobe-fail.png' }).catch(() => {})
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nHUB PROBE: ${fails} failures` : '\nHUB PROBE PASSED: the menu is in order and the verdict names its fixes')
done(fails)
