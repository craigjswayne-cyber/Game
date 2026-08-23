// Does the coach market tell you WHY he did not sign, where you can see it?
//
// User, live on a phone: "ive tried to hire a coach who is keen but no matter
// what I press when in market he won't sign and no reason? like if I have no
// money I should be told ive not got budget."
//
// The engine was never the problem. appointStaff returns a sentence for every
// outcome - signed, not interested, cannot cover the compensation - and it
// always has. The problem is WHERE that sentence goes: into a banner pinned to
// the top of the Backroom Staff panel, several role cards above the thumb that
// tapped Appoint. On a 412x915 phone scrolled down to the kicking coach the
// reply to your tap renders hundreds of pixels off the top of the screen, and
// the market list collapses in the same tick, so the page jumps and nothing you
// can see has changed. From the manager's chair that is a dead button.
//
// Three things are checked, all of them about the screen rather than the model:
//
//   1. AFFORDABILITY IS ON THE ROW, BEFORE THE TAP. A candidate whose
//      compensation the club cannot cover says so next to his name, and his
//      Appoint button is disabled. Nobody should have to tap a button to find
//      out it is dead.
//   2. THE REPLY LANDS WHERE THE THUMB IS. After tapping Appoint the outcome
//      sentence is inside the viewport and near the button, measured with
//      getBoundingClientRect rather than merely being present in the DOM.
//   3. THE SAME FOR THE BADGE COURSE, which used the identical banner.
//
// Every selector here is text or role based, so the probe runs unchanged
// against the build that has the bug - the failures it reports are about
// behaviour, not about markup that does not exist yet. It also deliberately
// works the LAST role card on the page: the first one would put the old banner
// on screen by luck and the broken build would pass.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4191', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
page.setDefaultTimeout(5000)

/**
 * The smallest element on the page whose text contains any of these phrases,
 * and where it sits relative to the phone's screen. Smallest, because the
 * <body> contains every phrase and would always measure as visible.
 */
const findSaid = (needles) => page.evaluate((ns) => {
  let best = null
  for (const el of document.querySelectorAll('body *')) {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ')
    if (!ns.some(n => t.includes(n))) continue
    if (!best || t.length < best.len) best = { el, len: t.length }
  }
  if (!best) return { found: false }
  const r = best.el.getBoundingClientRect()
  return {
    found: true,
    visible: r.bottom > 0 && r.top < window.innerHeight && r.height > 0,
    top: Math.round(r.top),
    text: (best.el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
  }
}, needles)

const setBalance = (n) => page.evaluate((v) => {
  const st = window.rugbyStore.getState()
  st.game.clubs[st.game.userClubId].balance = v
  st.touch()
}, n)

try {
  await page.goto('http://localhost:4191/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Hire Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Training & Staff')
  await page.click('.tab-bar >> text=Staff')
  await page.waitForSelector('button:has-text("Market"), button:has-text("Candidates")', { timeout: 10000 })

  // ---- 1. the money is on the row, before the tap -------------------------
  //
  // Strip the club to a sum that covers nobody: every compensation figure in
  // the market is five figures or more, so a thousand pounds makes the whole
  // board unaffordable and the rows have to say so.
  await setBalance(1000)
  const markets = await page.$$('button:has-text("Market"), button:has-text("Candidates")')
  ok(markets.length >= 6, `the staff room lists its roles (${markets.length} markets found)`)
  const last = markets[markets.length - 1]
  await last.scrollIntoViewIfNeeded()
  await last.click()
  await page.waitForSelector('button:has-text("Appoint")', { timeout: 5000 })

  const blocked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Appoint')
    if (!btn) return null
    // the row is the nearest ancestor that also holds the candidate's wage line
    let row = btn.parentElement
    while (row && !/compensation/i.test(row.textContent ?? '')) row = row.parentElement
    return {
      text: (row?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      disabled: btn.disabled,
    }
  })
  say(`\n  candidate row with 1k in the bank:\n    "${blocked?.text}"\n`)
  ok(!!blocked && /you have|cannot cover|short of|not got|budget/i.test(blocked.text),
    'a candidate the club cannot pay for says so on his own row')
  ok(!!blocked?.disabled, 'and his Appoint button is dead rather than silently doing nothing')

  // ---- 2. the reply lands where the thumb is ------------------------------
  //
  // Money back, so the tap has a real outcome to report. The market may have
  // closed itself on the previous build, so it is reopened either way.
  await setBalance(5_000_000)
  if (!(await page.$('button:has-text("Appoint")'))) {
    const again = await page.$$('button:has-text("Market"), button:has-text("Candidates")')
    await again[again.length - 1].scrollIntoViewIfNeeded()
    await again[again.length - 1].click()
    await page.waitForSelector('button:has-text("Appoint")', { timeout: 5000 })
  }
  const hire = (await page.$$('button:has-text("Appoint")')).at(-1)
  await hire.scrollIntoViewIfNeeded()
  const tapAt = await hire.boundingBox()
  await hire.click()

  const reply = await findSaid(['is your new', 'stayed where he is', 'cannot cover', 'no longer available'])
  say(`  reply: found=${reply.found} visible=${reply.visible} top=${reply.top}px\n    "${reply.text}"`)
  ok(reply.found, 'the tap produces an outcome line')
  ok(!!reply.visible, 'and it is inside the viewport, not pinned to the top of the page')
  if (reply.found && tapAt) {
    ok(Math.abs(reply.top - tapAt.y) < 300,
      `the outcome sits near the button that was tapped (${Math.abs(Math.round(reply.top - tapAt.y))}px away)`)
  }

  // ---- 3. the badge course refuses the same way --------------------------
  //
  // The Assess button carries its fee on its face, so an unaffordable course is
  // the same trap: a live-looking button and a refusal rendered off-screen. It
  // is now dead, with the shortfall written under it on its own card.
  await setBalance(1000)
  const course = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].filter(b => /Assess/.test(b.textContent ?? '')).at(-1)
    if (!btn) return null
    const card = btn.closest('.card')
    return {
      disabled: btn.disabled,
      card: (card?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }
  })
  if (course) {
    say(`  assess card with 1k in the bank:\n    "${course.card}"\n`)
    ok(course.disabled, 'a course the club cannot pay for has a dead button')
    ok(/you have|budget|not there|money/i.test(course.card),
      'and the card says why, next to the coach it is about')
  } else {
    say('  (no coach eligible for a course in this staff room - skipped)')
  }

  say(fails ? `\nHIREPROBE FAILED (${fails})` : '\nHIREPROBE PASSED')
} catch (e) {
  say(`\nHIREPROBE ERROR: ${e.message}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}
done(fails)
