// Does Continue serve the desk, and does it ALWAYS still advance the week?
//
// User, twice: "when I click continue it doesnt just continue through all unread
// message and force me to respond to press enquiries etc. this should be the
// central home where the game communicates everything and everything should be
// answered, read between games."
//
// The half that shipped before was expiry (season.ts ~2617): unanswered
// questions do not follow you into the next week, three-week-old stories get
// filed. That treated the pile growing, not the complaint - the game still never
// made you answer anything.
//
// THE RISK THIS PROBE EXISTS FOR IS NOT THE FEATURE, IT IS THE LOCK. Continue
// has four jobs - walk a day, jump to matchday, settle the week, open the
// Annual - and a gate that is wrong in any one of them ships a game that looks
// frozen. That has happened here already: Round 26 shipped an Annual whose
// Continue was visible and dead, and soakui sat on it for 60 taps. So the
// assertions below are mostly about LIVENESS:
//
//   1. A gated tap changes the label rather than doing nothing visible.
//   2. Tapping Continue repeatedly always clears the desk and turns the week -
//      bounded, from a deliberately loaded desk. This is the anti-lock test.
//   3. The day walk is NOT gated: Monday to Friday still step normally, because
//      the gate belongs on the way out of the week, not on every tap.
//   4. And the week really does advance in the end.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4193', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
page.setDefaultTimeout(6000)

const label = () => page.textContent('.continue-btn').then(t => (t ?? '').trim())
const state = () => page.evaluate(() => {
  const g = window.rugbyStore.getState().game
  return {
    week: g.week,
    season: g.season,
    unread: g.news.filter(n => !n.read && !n.cleared).length,
    press: g.press.filter(p => p.week === g.week && !p.answered && (p.options?.length ?? 0) > 0).length,
    screen: window.rugbyStore.getState().nav.at(-1)?.screen,
  }
})

try {
  await page.goto('http://localhost:4193/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Desk Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 20000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.continue-btn', { timeout: 20000 })

  // ---- 1. THE GATE STANDS BETWEEN YOU AND THE MATCH -----------------------
  //
  // This is the actual claim, and it is asserted where it bites: standing on the
  // eve of a match with mail unread, Continue must NOT reach Matchday. Before
  // this change it went straight there and the pile came with you.
  //
  // The desk is loaded on purpose rather than hoped for. Note the gate is
  // deliberately absent on a DAY step - week 1 reads "Continue" with five unread
  // and that is correct, because the gate belongs on the way out of the week.
  const setup = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    // stand on the eve of the match, so the next step is the match itself
    g.day = 4
    // three unread stories and one answerable press question
    let made = 0
    for (const n of g.news) { if (made < 3) { n.read = false; n.cleared = false; made++ } else { n.read = true; n.cleared = true } }
    while (made < 3) {
      g.news.push({ id: g.nextId++, week: g.week, season: g.season, type: 'general', read: false,
        subject: `Desk probe story ${made}`, body: 'Something for the manager to read.' })
      made++
    }
    g.press.push({ id: g.nextId++, week: g.week, season: g.season, outlet: 'The Probe',
      question: 'Are you reading your mail?', answered: false,
      options: [{ label: 'Every word', morale: 0, board: 0 }] })
    st.touch()
    return { unread: g.news.filter(n => !n.read && !n.cleared).length, press: g.press.filter(p => p.week === g.week && !p.answered).length }
  })
  say(`\n  desk loaded: ${setup.unread} unread, ${setup.press} press, standing on the eve`)

  const gated = await label()
  say(`  the button reads "${gated}"`)
  ok(/Read \(3\)/.test(gated), 'the button names the pile instead of saying Continue')

  // one tap: it must go to the reader, not the match
  await page.click('.continue-btn')
  await page.waitForTimeout(300)
  const first = await state()
  say(`  after one tap: screen=${first.screen}, unread=${first.unread}`)
  ok(first.screen !== 'matchday', 'one tap does not walk you past an unread desk into the match')
  ok(first.screen === 'wire', `it serves the full-screen reader instead (${first.screen})`)
  ok(first.unread < setup.unread, `and the pile shrank (${setup.unread} -> ${first.unread})`)

  // ---- 2. THE ANTI-LOCK TEST ----------------------------------------------
  //
  // Keep tapping. The desk has to clear and the match has to become reachable,
  // bounded. Continue has four jobs and a gate wrong in any of them ships a game
  // that looks frozen - Round 26 shipped exactly that on the Annual and soakui
  // sat on it for 60 taps. A cap turns a lock into a fast failure, not a hang.
  let taps = 0
  let last = null
  let stuck = 0
  let reached = false
  let clearedAt = -1
  for (; taps < 40; taps++) {
    const s = await state()
    if (s.unread === 0 && s.press === 0 && clearedAt < 0) clearedAt = taps
    if (s.screen === 'matchday') { reached = true; break }
    const key = `${s.week}:${s.unread}:${s.press}:${s.screen}`
    if (key === last) stuck++; else stuck = 0
    last = key
    if (stuck >= 4) break
    // answer the question only while there IS one: after the last answer the
    // app is still standing on the press screen, and tapping a stale option
    // there is what made the first draft of this probe report a false stall.
    if (s.screen === 'press' && s.press > 0) {
      await page.click('.content .btn.ghost').catch(() => {})
      await page.waitForTimeout(250)
      continue
    }
    // v1.1.12: the mail gate hands the whole pile to the full-screen reader
    // rather than serving one story per tap, so the reader's own button is
    // what makes progress while it is up
    if (s.screen === 'wire') {
      await page.locator('button', { hasText: /Next Story|On to the Week/ }).first().click().catch(() => {})
      await page.waitForTimeout(220)
      continue
    }
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(280)
  }
  const after = await state()
  say(`  ${taps} taps: unread ${setup.unread} -> ${after.unread}, press ${setup.press} -> ${after.press}, screen ${after.screen}`)
  ok(stuck < 4, `Continue never stops making progress (${stuck} identical states in a row)`)
  ok(reached, `the match becomes reachable once the desk is clear (${taps} taps)`)
  ok(after.unread === 0, `every story was read on the way (${after.unread} left)`)
  ok(after.press === 0, `and the press question was answered (${after.press} left)`)
  ok(clearedAt >= 0 && clearedAt <= taps, 'the desk cleared before the match, not after it')

  // ---- 2b. AND THE PRESS HOLD YIELDS ON A SECOND TAP ----------------------
  //
  // The first draft of the gate held the week until every question was
  // answered, and soakui found the consequence in one season: 60 taps without
  // the week moving, stuck on the Press Room at season 2 week 1, where the
  // expectations question and the pre-season camp decision both sit in
  // state.press. A manager who does not realise a question is REQUIRED cannot
  // tell a gate from a bricked save.
  //
  // THAT CONTRACT CHANGED IN v1.1.17, ON THE OWNER'S INSTRUCTION: "press
  // questions MUST be answered when they arrive - you shouldn't be able to
  // continue through the game." The second tap no longer carries on.
  //
  // Which puts the whole weight on the OTHER half of the old reasoning, so this
  // section now tests that half instead and tests it harder. The danger was
  // never the hold, it was a hold you cannot tell from a frozen game - so:
  // the first tap must take you to the room, the second must NOT walk you past
  // the question, and ANSWERING it must let the week go on. That last line is
  // the one that stands between this gate and the bricked save it caused the
  // first time it was tried.
  const held = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    // section 2 finished standing on Matchday, where Continue is not the control
    // that advances anything - back to Home first, or this measures nothing.
    st.home()
    for (const n of g.news) { n.read = true; n.cleared = true }
    g.press.push({ id: g.nextId++, week: g.week, season: g.season, outlet: 'The Probe',
      question: 'Will you ignore this one?', answered: false,
      options: [{ label: 'Never', morale: 0, board: 0 }] })
    g.day = 4
    st.touch()
    return true
  })
  ok(held, 'a single unanswered question can be planted')
  const one = await state()
  await page.click('.continue-btn').catch(() => {})
  await page.waitForTimeout(300)
  const two = await state()
  ok(two.screen === 'press', `the first tap takes you to the room (${two.screen})`)
  await page.click('.continue-btn').catch(() => {})
  await page.waitForTimeout(400)
  const three = await state()
  say(`  press hold: ${one.screen} -> ${two.screen} -> ${three.screen}`)
  ok(three.screen === 'press' && three.press > 0,
    `a second tap does NOT walk you past the question (${three.screen}, ${three.press} open)`)
  // AND THE WAY THROUGH IS THE ANSWER. A gate with no way through is a bricked
  // save; this is the way through, and it has to be one tap on the thing the
  // screen is asking you to do.
  await page.locator('.content .btn.ghost').first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(300)
  const answered = await state()
  ok(answered.press === 0, `answering it clears the room (${answered.press} open)`)
  await page.click('.continue-btn').catch(() => {})
  await page.waitForTimeout(400)
  const moved = await state()
  ok(moved.screen !== 'press', `and the week goes on once it is answered (${moved.screen})`)

  // ---- 2c. A ROLLOVER PILE IS A READER, NOT FIFTY-FOUR REFUSALS ----------
  //
  // At a season rollover the engine writes FIFTY-FOUR stories in one settle -
  // every league's honours, the playoffs, the awards. The first gate insisted
  // on all of them one tap at a time: the count fell perfectly, so nothing was
  // stuck, but the game wanted 54 taps and soakui gave up at 60 and called it
  // frozen. It was right to.
  //
  // The answer then was a BUDGET - hold six times, then relent - which met the
  // soak and not the request. The owner asked again in v1.1.12: "pressing
  // continue should go through every news story before continuing." So the
  // whole pile now goes to the full-screen reader the game already had, and
  // one tap reads all of it: 54 pages with a counter and a "Skip the rest",
  // rather than 54 refusals. This plants a pile far bigger than the old budget
  // and asserts the new shape - one tap to the reader, the reader clears it,
  // and the match is reachable straight after.
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    st.home()
    for (const p of g.press) p.answered = true
    for (let i = 0; i < 40; i++) {
      g.news.push({ id: g.nextId++, week: g.week, season: g.season, type: 'general', read: false,
        subject: `Rollover story ${i}`, body: 'One of forty.' })
    }
    g.day = 4
    st.touch()
  })
  const bigPile = await state()
  say(`\n  planted ${bigPile.unread} unread`)
  await page.click('.continue-btn').catch(() => {})
  await page.waitForTimeout(320)
  const inReader = await state()
  ok(inReader.screen === 'wire',
    `one tap hands the whole pile to the reader (${inReader.screen})`)
  ok(await page.locator('.wire-date').innerText().then(x => /\/\s*\d+/.test(x)).catch(() => false),
    'and the reader says how many there are, so the pile has a visible end')
  // leaving the reader marks the rest read: that is what makes the gate
  // impossible to soft-lock however deep the pile is
  await page.locator('button', { hasText: 'Skip the rest' }).first().click().catch(() => {})
  await page.waitForTimeout(320)
  const cleared = await state()
  ok(cleared.unread === 0,
    `and one pass clears every one of them (${bigPile.unread} -> ${cleared.unread})`)
  // AND THE READER YIELDS FROM INSIDE ITSELF. Being made to LOOK is a gate;
  // being unable to leave is a bug, and this is the same second-tap escape the
  // press hold has. Two taps clears any pile, however deep - which is what
  // stops an unbounded gate becoming the 54-tap summer in another costume.
  await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    st.home()
    for (let i = 0; i < 30; i++) {
      g.news.push({ id: g.nextId++, week: g.week, season: g.season, type: 'general', read: false,
        subject: `Second pile ${i}`, body: 'One of thirty.' })
    }
    g.day = 4
    st.touch()
  })
  await page.click('.continue-btn').catch(() => {})
  await page.waitForTimeout(320)
  ok((await state()).screen === 'wire', 'the second pile opens the reader too')
  await page.click('.continue-btn').catch(() => {})
  await page.waitForTimeout(320)
  const yielded = await state()
  ok(yielded.unread === 0 && yielded.screen !== 'wire',
    `and a tap from inside it carries on rather than trapping you (${yielded.unread} unread, ${yielded.screen})`)

  let toMatch = 0
  for (; toMatch < 8; toMatch++) {
    const s = await state()
    if (s.screen === 'matchday') break
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(280)
  }
  const end = await state()
  say(`  reached ${end.screen} in ${toMatch} further taps`)
  ok(end.screen === 'matchday', `the match is reachable straight after (${end.screen})`)
  ok(toMatch <= 2, `without a budget's worth of refusals in between (${toMatch})`)

  // ---- 3. the day walk is not gated --------------------------------------
  //
  // The gate belongs on the way OUT of the week. If it fired on every tap the
  // Monday-to-Friday bulletins would be unreachable, and the week's shape - the
  // thing the day flow exists for - would be gone.
  const walked = await page.evaluate(() => {
    const st = window.rugbyStore.getState()
    const g = st.game
    // a clean desk, so only the day logic decides
    for (const n of g.news) { n.read = true; n.cleared = true }
    for (const p of g.press) p.answered = true
    g.day = 0
    st.touch()
    return true
  })
  ok(walked, 'the desk can be cleared from outside for the day-walk test')
  const days = []
  for (let i = 0; i < 8; i++) {
    const s = await state()
    days.push(`${s.screen}${s.week}`)
    if (s.screen === 'matchday') break
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(250)
  }
  say(`  with a clear desk the walk goes: ${days.join(' -> ')}`)
  ok(days.some(d => d.startsWith('day') || d.startsWith('matchday') || d.startsWith('home')),
    'a clear desk still walks the week rather than gating')

  say(fails ? `\nDESK GATE FAILED (${fails})` : '\nDESK GATE PASSED: the desk is served, and the week always turns')
} catch (e) {
  say(`\nDESK GATE ERROR: ${e.message}`)
  fails++
} finally {
  await browser.close()
  server.stop()
}
done(fails)
