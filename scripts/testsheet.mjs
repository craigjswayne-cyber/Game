/**
 * ---- THE LAST SHEET BEFORE A TEST ----
 *
 * Owner, v1.1.15: "ready to lead in the international bit dimension wise is
 * too big for the screen".
 *
 * The fault that MEASURES, and the one this probe caught red against the old
 * build, is a gutter: .modal sets no horizontal padding, so anything a screen
 * does not wrap for itself runs flush to both edges of the glass. All three
 * lines of the Test sheet - heading, body, and the line under it - were
 * touching the phone at x=0. Its club twin has always wrapped its own content
 * in an 18px pad, which is why this only ever came up on the international
 * side.
 *
 * The sheet was also carrying the whole "how will you watch this one" block,
 * which took its content from 202px to 281px. That did not hide the buttons at
 * 412x915 - the height assertions below were green against the old build too -
 * but a sheet is capped at 80dvh and scrolls, so it is 79px of margin given
 * back on a shorter phone. Both assertions stay: the gutter is what regressed,
 * the height is what must not.
 *
 * The claims are what a thumb can tell: the sheet is not taller than itself,
 * both buttons are reachable without scrolling inside it, and the words are not
 * touching the edge of the screen. Measured at the largest text size the game
 * offers, because that is where a sheet runs out of room first.
 *
 * Getting there is the hard part - a Test needs a national job and a window -
 * so the walk takes the England job through the store and skips weeks until the
 * federation has a fixture, clearing the transfer desk as it goes so a bid
 * cannot stall the road.
 *
 * Run: node scripts/testsheet.mjs
 */
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview(4252, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })

try {
  await page.goto('http://localhost:4252/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Test Sheet')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(500)

  // the England job, taken by hand - this probe is about one sheet, not about
  // the road to the job, which countryprobe owns
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    st.game.natTeam = 'ENG'
    st.game.natConfidence = 60
    st.game.natRecord = { m: 0, w: 0, d: 0, l: 0 }
    st.touch()
  })
  await page.waitForTimeout(300)

  let reached = false
  for (let i = 0; i < 300 && !reached; i++) {
    reached = await page.evaluate(() => {
      const st = window.rugbyStore.getState()
      const g = st.game
      const test = g.fixtures.some(f => !f.played && f.week === g.week &&
        (f.homeId === g.natTeam || f.awayId === g.natTeam))
      if (test) return true
      // CLEAR THE DESK THE WAY A PLAYER DOES. continueWeek returns early on
      // every hold this release added - unread mail, an unanswered press
      // question, an unnamed Test squad - so a driver that only calls
      // continueWeek spins on the spot forever. None of those is what this
      // probe is about: it is about one sheet, three screens later.
      g.offers = []
      g.bids = []
      for (const n of g.news) { n.read = true; n.cleared = true }
      for (const q of g.press) if (!q.answered) q.answered = true
      // AND NAME THE SQUAD, because from v1.1.17 the coach's camp opens blank
      // and Continue is held until it is legal - which is the point of that
      // change and a wall to a driver that only knows Continue. This is what
      // natCallUp does, done directly: the screen it drives is the confirm
      // sheet, not the selection room.
      const camp = g.natSquads?.[g.natTeam]
      if (camp && camp.length < 23) {
        const spare = Object.values(g.players)
          .filter(p => p.nat === g.natTeam && p.clubId && !p.injury && !p.natSquad)
          .sort((a, b) => b.ca - a.ca)
          .slice(0, 23 - camp.length)
        for (const p of spare) { camp.push(p.id); p.natSquad = true }
      }
      try { st.instantResult() } catch { /* no match to play this week */ }
      try { st.continueWeek() } catch { /* already moved on */ }
      return false
    })
    await page.waitForTimeout(40)
    if (await page.locator('text=On to the Week').count()) { await page.click('text=On to the Week'); await page.waitForTimeout(80) }
    else if (await page.locator('text=Next Story ▸').count()) { await page.click('text=Next Story ▸'); await page.waitForTimeout(60) }
  }
  ok(reached, 'the walk reaches a Test week with the England job in hand')

  for (let i = 0; i < 80; i++) {
    // the desk fills again as the week walks, and every hold stops Continue -
    // keep it clear and the camp legal, then press on to the sheet
    await page.evaluate(() => {
      const st = window.rugbyStore.getState()
      const g = st.game
      for (const n of g.news) { n.read = true; n.cleared = true }
      for (const q of g.press) if (!q.answered) q.answered = true
      const camp = g.natSquads?.[g.natTeam]
      if (camp && camp.length < 23) {
        const spare = Object.values(g.players)
          .filter(p => p.nat === g.natTeam && p.clubId && !p.injury && !p.natSquad)
          .sort((a, b) => b.ca - a.ca)
          .slice(0, 23 - camp.length)
        for (const p of spare) { camp.push(p.id); p.natSquad = true }
      }
      st.touch()
    })
    if (await page.locator('text=YOUR TEST XV').count() &&
        await page.locator('button', { hasText: /Kick Off/i }).count()) break
    if (await page.locator('text=On to the Week').count()) { await page.click('text=On to the Week'); await page.waitForTimeout(150); continue }
    if (await page.locator('text=Next Story ▸').count()) { await page.click('text=Next Story ▸'); await page.waitForTimeout(100); continue }
    if (await page.locator('button', { hasText: /^Reject$/ }).count()) { await page.locator('button', { hasText: /^Reject$/ }).first().click(); await page.waitForTimeout(200); continue }
    if (await page.locator('text=Matchday ▸').count()) { await page.click('text=Matchday ▸'); await page.waitForTimeout(400); continue }
    if (await page.locator('text=Continue ▸').count()) { await page.click('text=Continue ▸'); await page.waitForTimeout(400); continue }
    await page.waitForTimeout(150)
  }
  ok(await page.locator('text=YOUR TEST XV').count() > 0, 'and lands on the Test team sheet')

  // HOW YOU WATCH IT IS A DECISION MADE ON THE PAGE, not one buried in the
  // sheet you press to start the match
  ok(await page.locator('text=How will you watch this one').count() > 0,
    'the viewing choice is on the page, where there is room for it')

  // the largest text size the game offers - a sheet runs out of room here first
  await page.evaluate(() => { document.documentElement.style.zoom = '1.3' })
  await page.locator('button', { hasText: /Kick Off/i }).first().click()
  await page.waitForTimeout(700)

  const m = await page.evaluate(() => {
    const el = document.querySelector('.modal')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const words = [...el.querySelectorAll('h3, .meta')].map(w => {
      const b = w.getBoundingClientRect()
      return { left: Math.round(b.left), right: Math.round(b.right) }
    })
    const field = [...el.querySelectorAll('button')].pop()
    const fb = field?.getBoundingClientRect()
    return {
      top: Math.round(r.top), height: Math.round(r.height),
      scrollH: el.scrollHeight, clientH: el.clientHeight,
      vw: innerWidth, vh: innerHeight,
      words,
      lastBtnBottom: fb ? Math.round(fb.bottom) : null,
    }
  })
  ok(!!m, 'pressing Kick Off opens the confirm sheet')
  if (m) {
    ok(m.scrollH <= m.clientH + 1,
      `the sheet is not taller than itself - nothing hides below its own fold (${m.scrollH} content in ${m.clientH})`)
    ok(m.lastBtnBottom != null && m.lastBtnBottom <= m.vh + 1,
      `Take the Field is on the screen without a scroll (bottom ${m.lastBtnBottom} of ${m.vh})`)
    // A GUTTER. Words touching the glass at x=0 is the other half of what the
    // owner saw, and it is invisible to every overflow test ever written.
    const flush = m.words.filter(w => w.left < 6 || w.right > m.vw - 6)
    ok(flush.length === 0,
      `and no line of it touches the edge of the screen (${flush.length} flush of ${m.words.length})`)
  }
} catch (e) {
  console.log(`FAIL  the walk itself broke: ${e}`)
  fails++
}

await browser.close()
server.kill?.()
console.log(fails === 0
  ? '\nTEST SHEET PASSED: the last sheet before a Test fits the phone it is read on'
  : `\nTEST SHEET FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
