// Probe: everything you are meant to tap is big enough to tap.
//
// Found in the studio audit, and there was no guard for it at all. Apple's HIG
// asks for 44pt, Android's for 48dp. `.btn.tiny` renders about 19px tall at 11px
// text with 3px padding, and it carries the inbox reader's older/newer arrows -
// the control a manager uses most often outside a match.
//
// TWO THINGS MAKE THIS HARDER THAN MEASURING A BOX:
//
//   The visual box is not the hit area. An invisible ::after can extend a small
//   button's reach without changing the layout, which is exactly the fix applied
//   to .btn.tiny. So this measures what the BROWSER would hit, by asking
//   elementFromPoint at the edges of the intended target area, rather than
//   reading getBoundingClientRect and calling it a day.
//
//   A pass is not "every element is 44px". Table rows, list items and text links
//   inside prose are legitimately smaller and always will be. The rule enforced
//   here is narrower and defensible: every BUTTON, and every element carrying a
//   click handler that looks like a control, must be reachable in a 44px square.
//
// This serves dist, like every browser probe here, so `npm run build` first or it
// grades the previous build and reports the bug you just fixed.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const MIN = 44

/**
 * The documented exceptions, and the reason each is one.
 *
 * A floor list is how a probe like this gets quietly neutered, so every entry
 * names a class rather than a screen, carries its geometry argument, and is a
 * floor rather than a skip - a chip that shrinks back to 28px still fails.
 * Anything NEW answers to MIN.
 */
const FLOOR = [
  { cls: 'preset-chip', min: 36, why: 'six across a 412px filter row, live chip rows above and below' },
  // measured for the first time when Roles became the Tactics screen's opening
  // tab (25B): the 15 chips sit on a pitch whose tightest pairs are ~41px apart
  // centre to centre vertically, so growing the hit area to 44px would overlap
  // the neighbour's and turn a tap into a coin flip between two shirts
  { cls: 'form-chip', min: 36, why: 'fifteen chips on one half-pitch; 44px hit areas would overlap the closest pairs' },
  // measured by scripts/geosweep.mjs on the mentoring picker, which is the first
  // harness ever to look at the Training screen: an ::after expander on a chip
  // in a 7px-gapped wrapping row buys ~3.5px, not 14, because every neighbour
  // has one too and they meet in the middle of the gap. Reach was 34px. So the
  // box carries the floor instead, and 36 is the same number the two chip
  // families above settled on for the same reason.
  { cls: 'chip', min: 36, why: 'wrapping rows with a 7px gap; a 44px expander steals the neighbouring chip taps' },
]

const server = await startPreview('4196', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 780 } })
page.setDefaultTimeout(6000)
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

/**
 * Every button on screen, with the hit area the browser would actually use.
 *
 * For each candidate: take the centre, then probe outward along both axes until
 * elementFromPoint stops returning the button (or something inside it). That is
 * the real reach, ::after and all.
 */
const measure = () => page.evaluate(({ MIN, FLOOR }) => {
  const out = []
  // The button, or something inside it - a ::after hit expander reports as the
  // originating element, so `el === hit` covers that. An ANCESTOR must not count:
  // the first version of this also accepted hit.contains(el), which meant every
  // pixel of empty parent padding around a button was counted as part of its
  // target, and a 28px chip in a 6px-gapped row measured 41px. Tapping a row's
  // padding does nothing, so it is not part of the target.
  const owns = (el, hit) => !!hit && (el === hit || el.contains(hit))
  // with a sheet open, only what is in the sheet can be tapped: the page under
  // the veil is covered on purpose and is measured on its own stage
  const sheet = document.querySelector('.modal-veil .modal')
  for (const el of document.querySelectorAll('button:not([disabled])')) {
    if (sheet && !sheet.contains(el)) continue
    if (el.getBoundingClientRect().height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue
    // Scroll it to the middle of the scroller first. The first version of this
    // probe measured wherever a button happened to be sitting, and reported a
    // 384x65 card on Home as having a 1x1 hit area - it was half below the fold,
    // so the centre point landed on the nav rail underneath. That is not a bug,
    // it is a probe measuring a button nobody would tap without scrolling to it.
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cx = Math.round(r.left + r.width / 2)
    const cy = Math.round(r.top + r.height / 2)
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue
    const reach = (dx, dy) => {
      let n = 0
      for (; n <= 40; n++) {
        const x = cx + dx * (n + 1), y = cy + dy * (n + 1)
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) break
        if (!owns(el, document.elementFromPoint(x, y))) break
      }
      return n
    }
    const w = reach(-1, 0) + reach(1, 0) + 1
    const h = reach(0, -1) + reach(0, 1) + 1
    const need = FLOOR.find(f => el.classList.contains(f.cls))?.min ?? MIN
    out.push({
      label: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 26)
        || el.getAttribute('aria-label') || el.getAttribute('title') || el.className.slice(0, 26),
      cls: typeof el.className === 'string' ? el.className.slice(0, 30) : '',
      box: `${Math.round(r.width)}x${Math.round(r.height)}`,
      hit: `${w}x${h}`,
      need,
      small: Math.min(w, h) < need,
      min: Math.min(w, h),
    })
  }
  return out
}, { MIN, FLOOR })

const check = async (name) => {
  await page.waitForTimeout(320)
  const all = await measure()
  const bad = all.filter(b => b.small)
  say(`\n${name}: ${all.length} buttons, ${bad.length} short of target`)
  for (const b of bad.slice(0, 20)) {
    say(`    ${String(b.min).padStart(3)}px of ${b.need}  box ${b.box.padEnd(9)} hit ${b.hit.padEnd(9)} "${b.label}"  .${b.cls}`)
  }
  ok(bad.length === 0, `${name}: every button reaches ${MIN}px, or its documented floor`)
  return bad.length
}

try {
  await page.goto('http://localhost:4196/')
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Tap Size')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box')
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  await check('Home')

  // the inbox reader, which is where the offending arrows live
  await page.click('.bottom-nav button[title="News"]').catch(() => {})
  await page.waitForTimeout(400)
  await check('Inbox reader')

  // and the densest screens
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.dtable')
  await check('Team')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Tactics')
  await page.waitForSelector('.tab-bar')
  await check('Tactics')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Finances')
  await page.waitForTimeout(400)
  await check('Finances')

  // THE TREATMENT ROOM WITH SOMEBODY IN IT (release audit 1.7.1). The walk
  // above reaches no screen where the Medical Centre's row controls exist -
  // nobody is hurt in week one - so the specialist, the physio favour, "play
  // through it", "sign a medical joker" and "rest instead" had never once been
  // measured, and all of them were ~20px tall in a wrapping row. Seeded here:
  // a hamstring near its end, a long knee, a knock carried, and two free
  // agents who can cover the long one so the joker picker has rows to measure.
  await page.evaluate(() => {
    const S = window.rugbyStore.getState(); const g = S.game
    const ids = g.clubs[g.userClubId].players.filter(id => !g.players[id].acad)
    const hurt = (id, dk, left, weeks) => { g.players[id].injury = { desc: 'Hamstring', dk, until: g.week + left, weeks, seen: true } }
    hurt(ids[0], 'injury.hamstring', 2, 4)
    hurt(ids[1], 'injury.kneeLigament', 11, 12)
    hurt(ids[2], 'injury.calf', 1, 3)
    const pos = g.players[ids[1]].pos
    const other = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.players.some(id => g.players[id]?.pos === pos))
    for (const id of other.players.filter(id => g.players[id]?.pos === pos).slice(0, 2)) {
      other.players = other.players.filter(x => x !== id); g.players[id].clubId = null
    }
    S.touch(); S.go('medical')
  })
  await page.waitForSelector('text=Play through it')
  await page.locator('button', { hasText: 'Play through it' }).last().click()
  await check('Medical: treatment room and a knock carried')
  await page.locator('button', { hasText: 'Sign a medical joker' }).first().click()
  await page.waitForSelector('.modal')
  await check('Medical: the joker picker')
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
  await page.screenshot({ path: '/tmp/tapsize-fail.png' }).catch(() => {})
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nTAP SIZE: ${fails} failures` : `\nTAP SIZE PASSED: every button is big enough to tap`)
done(fails)
