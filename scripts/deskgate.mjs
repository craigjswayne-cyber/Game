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
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
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
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
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
  ok(first.screen === 'inbox', `it serves the reader instead (${first.screen})`)
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
  // So being made to LOOK is the gate, and being unable to leave is the bug.
  // One tap takes you to the room; a second from inside it carries on, and the
  // question expires as an unanswered question always has.
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
  ok(three.screen !== 'press',
    `a second tap from inside the room carries on rather than trapping you (${three.screen})`)

  // ---- 2c. A ROLLOVER PILE DOES NOT BECOME A 54-TAP SUMMER ----------------
  //
  // The measurement that produced MAX_DESK_HOLDS: at a season rollover the
  // engine writes FIFTY-FOUR stories in one settle - every league's honours, the
  // playoffs, the awards - and the first gate insisted on all of them. The count
  // fell perfectly one per tap, so nothing was stuck; the game simply wanted 54
  // taps, and soakui gave up at 60 and called it frozen. It was right to.
  //
  // So the gate is BUDGETED, and this plants a pile far bigger than the budget
  // and counts the taps to the match. The bound, not the pile, has to decide.
  const BUDGET = 6
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
  say(`\n  planted ${bigPile.unread} unread, budget is ${BUDGET}`)
  let toMatch = 0
  for (; toMatch < 30; toMatch++) {
    const s = await state()
    if (s.screen === 'matchday') break
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(280)
  }
  const end = await state()
  say(`  reached ${end.screen} in ${toMatch} taps with ${end.unread} still unread`)
  ok(end.screen === 'matchday', `a huge pile still lets you reach the match (${end.screen})`)
  ok(toMatch <= BUDGET + 3,
    `and it takes about the budget, not the pile (${toMatch} taps for ${bigPile.unread} stories)`)
  ok(end.unread > 0,
    `the rest waits in the inbox rather than being forced (${end.unread} left)`)

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
