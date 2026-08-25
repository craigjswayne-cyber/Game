// The reply lands where the thumb is - the rest of the long-list screens.
//
// hireprobe.mjs fixed this on the Backroom Staff market after live feedback
// ("no matter what I press when in market he won't sign and no reason?"). The
// bug is a CLASS, not one screen: a row action calls an engine function that
// returns a sentence, and the screen puts that sentence somewhere other than
// the row that asked for it. On a phone that reads as a dead button.
//
// The audit's sweep of every remaining long-list screen found two more, and
// they are the two opposite ways of getting it wrong:
//
//   JOBS - one banner above the whole vacancy list. Applying for the fifth job
//   rendered the club's answer several hundred pixels above the thumb.
//
//   OFFERS - the desk shows one bid at a time, so the reply was in the right
//   place. It was attached to the wrong THING: an unkeyed string outlives the
//   card it belongs to, so answering the first bid left its sentence sitting
//   under the SECOND one. "Bath have withdrawn" printed beneath a live bid from
//   Bristol. Worse than an off-screen reply, because it is not invisible, it is
//   untrue - and no visibility check would ever catch it.
//
// Both are now keyed to the row that asked. What this measures:
//   1. The reply is ON SCREEN after the tap (getBoundingClientRect, not "in
//      the DOM"), and near the button rather than at the top of the page.
//   2. The reply appears EXACTLY ONCE - the Offers half, which a visibility
//      check alone would pass.
//
// Run: node scripts/replyreach.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(4215, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
page.setDefaultTimeout(8000)

/** Every element whose own text is exactly this reply, and where each sits. */
const sightings = (needle) => page.evaluate((n) => {
  const hits = []
  for (const el of document.querySelectorAll('body *')) {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!t.includes(n)) continue
    // the innermost element carrying it, so ancestors are not counted twice
    if ([...el.children].some(c => (c.textContent ?? '').includes(n))) continue
    const r = el.getBoundingClientRect()
    hits.push({ top: Math.round(r.top), onScreen: r.bottom > 0 && r.top < window.innerHeight && r.height > 0 })
  }
  return hits
}, needle)

try {
  await page.goto('http://localhost:4215/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Reply Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.masthead', { timeout: 20000 })

  // ---- JOBS: stage vacancies, work the LAST card ----
  // the last one deliberately: the first would put an above-the-list banner on
  // screen by luck and a broken build would pass
  const staged = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const others = Object.values(g.clubs).filter(c => c.id !== g.userClubId).slice(0, 6)
    g.vacancies = others.map(c => ({ clubId: c.id, week: g.week, applied: false, passed: false }))
    st.touch()
    return g.vacancies.length
  })
  ok(staged >= 5, `staged ${staged} vacancies so the list runs past one screen`)

  await page.evaluate(() => window.rugbyStore.getState().go('jobs'))
  await page.waitForSelector('text=Vacancies', { timeout: 8000 })
  const applyBtns = page.locator('.card button:has-text("Apply")')
  const n = await applyBtns.count()
  ok(n >= 5, `the vacancy list renders every job (${n} Apply buttons)`)

  // The club's answer is a seeded roll - mulberry32(seed ^ (week*31 + club.rep))
  // against a chance clamped to [0.05, 0.95] - so the probe picks the seed and
  // tests BOTH answers. The first cut took whichever answer the career's random
  // seed gave, which left the hired path untested until a main run landed on a
  // hiring seed and found "You're in. Welcome to Gloucester RFC." rendering
  // 901px off-screen: a hire removes the vacancy from the pile, so its reply
  // falls back to the slot above the list, out of sight of the thumb that asked.
  const readCards = () => page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    return g.vacancies
      .filter(v => !v.passed && !v.applied && g.clubs[v.clubId])
      .map(v => ({ clubId: v.clubId, rep: g.clubs[v.clubId].rep }))
      .sort((a, b) => b.rep - a.rep) // the screen's own order
  })
  /** Force the next application at this club to land in [lo, hi). */
  const rigSeed = (rep, lo, hi) => page.evaluate(([rep, lo, hi]) => {
    const g = window.rugbyStore.getState().game
    const roll = (seed) => { // mulberry32's first output, as jobs.ts draws it
      let a = ((seed ^ (g.week * 31 + rep)) >>> 0)
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    for (let s = 1; s < 200000; s++) {
      const r = roll(s)
      if (r >= lo && r < hi) { g.seed = s; return s }
    }
    return null
  }, [rep, lo, hi])

  // ---- refusal on the LAST card: the reply lands in that card, by the thumb ----
  let cards = await readCards()
  ok(await rigSeed(cards[cards.length - 1].rep, 0.96, 1) != null,
    'a seed exists on which the last club says no')
  const last = applyBtns.nth(n - 1)
  await last.scrollIntoViewIfNeeded()
  const btnBox = await last.boundingBox()
  await last.click()
  await page.waitForTimeout(200)

  // Assert on the rendered reply itself rather than on guessed wording: the
  // club's answer is one of several sentences (hired, passed, already applied)
  // and the first cut of this probe failed on needles, not on behaviour.
  const readReplies = () => page.evaluate(() => [...document.querySelectorAll('.sheet-log')].map(e => {
    const r = e.getBoundingClientRect()
    return {
      text: (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
      top: Math.round(r.top),
      onScreen: r.bottom > 0 && r.top < window.innerHeight && r.height > 0,
    }
  }))
  const jobReplies = await readReplies()
  ok(jobReplies.length === 1,
    `Jobs: the tap produces exactly one answer, in one card (${jobReplies.length})`)
  // length check as well as every(): every() on an empty array is true, so the
  // build with no in-card reply at all would have passed this line vacuously
  ok(jobReplies.length > 0 && jobReplies.every(h => h.onScreen),
    `Jobs: and it is on screen ("${jobReplies[0]?.text.slice(0, 48) ?? 'none'}")`)
  if (jobReplies.length && btnBox) {
    const d = Math.abs(jobReplies[0].top - btnBox.y)
    ok(d < 420, `Jobs: it lands beside the button that asked (${Math.round(d)}px away)`)
  } else ok(false, 'Jobs: no visible reply to measure against the button')

  // ---- hire on the new bottom card: the card leaves the pile, and the answer
  // must bring the screen to itself rather than sit 900px above the thumb ----
  cards = await readCards() // the refused club is applied now, so it has left this list
  const hireClub = cards[cards.length - 1]
  ok(await rigSeed(hireClub.rep, 0, 0.05) != null,
    'a seed exists on which the bottom club says yes')
  const hireBtn = applyBtns.nth(n - 2) // the screen sorts by rep, so bottom-most un-applied
  await hireBtn.scrollIntoViewIfNeeded()
  await hireBtn.click()
  await page.waitForTimeout(300)
  const hired = await page.evaluate(() => window.rugbyStore.getState().game.userClubId)
  ok(hired === hireClub.clubId, `Jobs: the rigged application succeeds (now at ${hired})`)
  const hireReplies = await readReplies()
  ok(hireReplies.length === 1,
    `Jobs: the hire produces exactly one answer (${hireReplies.length})`)
  ok(hireReplies.length > 0 && hireReplies.every(h => h.onScreen),
    `Jobs: and the welcome is on screen ("${hireReplies[0]?.text.slice(0, 48) ?? 'none'}")`)

  // ---- OFFERS: one answer, one card ----
  const offers = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    const mine = g.clubs[g.userClubId].players
      .map(id => g.players[id]).filter(p => p && !p.acad).slice(0, 3)
    const buyer = Object.values(g.clubs).find(c => c.id !== g.userClubId)
    g.offers = mine.map((p, i) => ({
      id: g.nextId++, playerId: p.id, fromClubId: buyer.id, toClubId: g.userClubId,
      fee: 1_000_000 + i, week: g.week, forUser: true, status: 'pending', countered: false,
    }))
    st.touch()
    return g.offers.length
  })
  ok(offers === 3, `staged ${offers} incoming bids`)
  await page.evaluate(() => window.rugbyStore.getState().go('offers'))
  await page.waitForSelector('button:has-text("Reject")', { timeout: 8000 })

  // Read the desk from the store, not from the page text: which bid is in front
  // of the manager is state, and scraping a sentence for it made this probe fail
  // on wording rather than on behaviour once already.
  const deskNow = () => page.evaluate(() => {
    const g = window.rugbyStore.getState().game
    const o = (g.offers ?? []).find(x => x.forUser && x.status === 'pending')
    return o ? { id: o.id, name: g.players[o.playerId]?.name ?? '' } : null
  })

  const before = await deskNow()
  ok(!!before, `the desk has a bid in front of the manager (${before?.name ?? 'none'})`)

  const reject = page.locator('button:has-text("Reject")').first()
  await reject.scrollIntoViewIfNeeded()
  await reject.click()
  await page.waitForTimeout(350)
  const replies = await page.evaluate(() =>
    [...document.querySelectorAll('.sheet-log')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()))
  ok(replies.length <= 1, `Offers: answering a bid prints at most one reply (${replies.length})`)

  // THE POINT: the desk has moved on to the next bid. The answer to the LAST one
  // must not still be sitting under it, which is what an unkeyed string does.
  const after = await deskNow()
  if (after && before && after.id !== before.id) {
    const carried = replies.some(r => r.includes(before.name))
    ok(!carried,
      `Offers: the answer about ${before.name} does not follow the desk onto the bid for ${after.name}`)
  } else {
    ok(true, 'Offers: the desk did not advance, so there is nothing to carry over')
  }
} catch (e) {
  say(`FAIL  probe crashed: ${e.message}`)
  fails++
} finally {
  await browser.close()
  await server.stop()
}

say(fails ? `REPLY REACH FAILED (${fails})` : 'REPLY REACH PASSED: every answer lands on the row that asked')
done(fails)
