// Does the new touchline furniture actually work?
//
// Feedback 9-2 and 9-4 replaced two dropdowns and a seven-button toolbar with a
// match-day squad sheet and a settings sheet. Neither is on the e2e path, and
// shipping UI that no test has ever clicked is how the last four device bugs got
// out. So this drives them: play to half-time, open the squad, make two changes,
// check the counter moves, and open the settings sheet and change the speed.
//
// AND IT MEASURES THE SHEET IN PORTRAIT, because it did not, and that is how the
// sheet shipped hanging off the side of a phone. It was built for a 300px-tall
// landscape screen, and this probe drove it at 844x390 - so two columns of player
// rows at 412px wide, with no side padding on the modal, was never once looked at.
// User screenshot: the numbers down the right-hand column were cut in half.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4195', 2500)

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
// PORTRAIT, because that is the orientation the game is played in and the one
// the sheet had never been opened in. It was driven at 844x390 for months.
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

// mirrors MAX_SUBS in game/matchEngine.ts, which a browser probe cannot import
const MAX_SUBS = 8
let fails = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok' : 'FAIL'} ${what}`); if (!cond) fails++ }

try {
  await page.goto('http://localhost:4195/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Subs')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')

  // Continue walks the week a day at a time now, so reaching kick-off is a
  // handful of taps rather than one. This probe still pressed it once and then
  // waited twenty seconds for a button that was several days away.
  for (let tap = 0; tap < 8; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 5000 })
  await page.click('.talk-modal .speech-tile >> nth=0')
  try {
    await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 })
    await page.click('text=▸ Take the Field')
  } catch { /* clean sheet */ }
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // ---- the control row: four buttons, and only one of them is a play glyph
  const ctrl = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('.speed-controls .btn')]
    return { n: bs.length, labels: bs.map(b => (b.textContent ?? '').trim()) }
  })
  console.log(`  control row: ${ctrl.n} buttons [${ctrl.labels.join(' | ')}]`)
  ok(ctrl.n === 4, 'the control row is four buttons, not seven')
  const plays = ctrl.labels.filter(l => l.includes('▶')).length
  ok(plays <= 1, `only one play glyph on the row (found ${plays})`)

  // ---- the settings sheet holds speed and sound
  await page.click('.speed-controls .btn >> nth=3')
  await page.waitForSelector('text=Match Settings', { timeout: 5000 })
  ok(await page.locator('text=Commentary speed').count() > 0, 'settings sheet has the speed control')
  ok(await page.locator('.modal .btn >> text=Fast').count() > 0, 'settings sheet has the Fast speed')
  await page.click('.modal .btn >> text=Fast')
  ok(await page.locator('.modal .btn.gold >> text=Fast').count() > 0, 'the chosen speed is marked')
  await page.click('.modal >> text=Back to the Match')
  await page.waitForTimeout(300)
  ok(await page.locator('text=Match Settings').count() === 0, 'settings sheet closes')

  // ---- half time: the squad sheet, several changes in one visit
  // Both Play and Skip are disabled while the match waits on a touchline call,
  // and the game is right to disable them: ctx.decision is a kickable penalty
  // and the DecisionPanel wants posts, corner or tap before anything restarts.
  // Clicking Skip blind failed about a third of runs and waiting for it to
  // re-enable waited forever, because nothing was going to answer the question.
  // So answer it - and in a loop, because a second penalty can arrive in the
  // seconds between answering the first and reaching the break.
  const settle = async () => {
    try {
      await page.locator('.btn').filter({ hasText: 'Take the Points' }).first().click({ timeout: 1500 })
      await page.waitForTimeout(300)
      return true
    } catch { return false }
  }
  // AN INJURY STOPS PLAY AND OPENS THE FORCED SQUAD SHEET (mustDecide): a
  // modal veil over the whole screen, and nothing restarts the match until a
  // replacement is named. This probe sat under it twice in one day - once as
  // "controls enabled, panels [], forty clicks all intercepted", once as a
  // half-time that never came after a successful Skip. It answered penalties
  // and never injuries.
  //
  // The cheapest legitimate answer is a positional swap: the sheet's own rule
  // is that a forced stop is satisfied by ANY change, a swap is free, and the
  // ledger the half-time assertions read stays at 8 of 8. Tap two on-pitch
  // men (stepping past a pair when the first tap armed the free-cover flow
  // instead of swapping), then go through the door the change has opened.
  const clearInjury = async () => {
    if (!(await page.locator('.sheet-casualty').count())) return false
    const gold = page.locator('.squad-sheet .btn.gold')
    const goldOpen = async () => await gold.isEnabled().catch(() => false)
    if (!(await goldOpen())) {
      const pitch = page.locator('.squad-sheet .sheet-col').nth(0).locator('.sheet-row:not([disabled])')
      const n = await pitch.count()
      for (let i = 0; i + 1 < n && !(await goldOpen()); i++) {
        // a leftover armed row makes the next tap a swap with the wrong man
        const armed = page.locator('.squad-sheet .sheet-row.armed')
        if (await armed.count()) await armed.first().click({ timeout: 800 }).catch(() => {})
        await pitch.nth(i).click({ timeout: 800 }).catch(() => {})
        await pitch.nth(i + 1).click({ timeout: 800 }).catch(() => {})
        await page.waitForTimeout(200)
      }
    }
    try { await gold.click({ timeout: 1500 }); return true } catch { return false }
  }
  // Press a control that a touchline call may have disabled: answer the call
  // and try again rather than waiting on a button nothing is going to enable.
  const press = async (loc, tries = 30) => {
    for (let i = 0; i < tries; i++) {
      try { await loc.click({ timeout: 1500 }); return true } catch { /* disabled */ }
      await settle()
      await page.waitForTimeout(300)
    }
    return false
  }
  const skip = page.locator('.speed-controls .btn').filter({ hasText: 'Skip' }).first()
  const atHalfTime = async () => await page.locator('text=Start Second Half').count() > 0
  let skipped = false
  for (let attempt = 0; attempt < 40 && !skipped; attempt++) {
    // Already there? Then do not press Skip. At an interval Skip means
    // leaveInterval(true) - it restarts and runs on to the *next* break - so a
    // blind press at half-time skipped the very thing being tested and left
    // the run waiting for a panel that was already gone.
    if (await atHalfTime()) { skipped = true; break }
    // PAUSE FIRST, THEN PRESS. While the match plays, React replaces the
    // control row's nodes on every tick, and under whole-suite CPU load a
    // click on a node that keeps detaching times out over and over. On the
    // failing run the fallback below then pressed Play at each interval -
    // which LEAVES the interval - and the match rolled through half-time,
    // the 60' break and on to full time with Skip never landed (the stuck
    // dump read "controls [⚙]": everything else unrenders once the match is
    // done). A paused match is a still tree, and a click on a still tree
    // lands. This is also just what a careful thumb does.
    await page.evaluate(() => {
      const st = window.rugbyStore.getState()
      if (st.liveMatch?.playing) st.matchCursor(st.liveMatch.cursor, false)
    }).catch(() => {})
    // the match cannot be skipped once it is over: name that state instead of
    // grinding the remaining attempts against buttons that no longer exist
    if (await page.evaluate(() => window.rugbyStore.getState().liveMatch?.done === true)) {
      console.log('  the match reached FULL TIME while Skip could not be pressed - probe flow failure')
      break
    }
    // AND CHECK AGAIN, NOW THAT NOTHING TICKS. The guard at the top of the
    // loop raced: between it and the click the match could tick INTO
    // half-time, where Skip means leaveInterval(true) - restart and run to
    // the SIXTY-minute break - so the press skipped the very panel being
    // tested and the wait below starved (caught under load, 25 Aug). Behind
    // the pause above the match is frozen, so check-then-act is finally
    // honest here.
    if (await atHalfTime()) { skipped = true; break }
    // a short timeout inside the loop, not a check-then-act: asking
    // isEnabled() and then clicking lost the race about one run in eight,
    // because a call can land in the milliseconds between the two
    try {
      await skip.click({ timeout: 1500 })
      skipped = true
      break
    } catch { /* disabled or unreachable: clear whatever is in the way, retry */ }
    // a penalty is pending: take the points and get on with it
    await settle()
    // or a man is down and the forced sheet is over everything
    await clearInjury()
    // Or the match is simply paused with a touchline panel open, which on a
    // 390px-tall landscape screen pushes the control row out of view - Skip is
    // enabled but nothing can reach it. Scroll to it, and if the button says
    // Play rather than Pause, press that instead: a moving match reaches the
    // break on its own.
    try { await skip.scrollIntoViewIfNeeded({ timeout: 1000 }) } catch { /* not laid out yet */ }
    const play = page.locator('.speed-controls .btn').first()
    if ((await play.textContent() ?? '').includes('▶')) {
      try { await play.click({ timeout: 1500 }) } catch { /* disabled too */ }
    }
    await page.waitForTimeout(400)
  }
  if (!skipped) {
    // if this ever fires, say what the screen actually looked like rather than
    // leaving the next reader to guess at a locator timeout
    const state = await page.evaluate(() => ({
      controls: [...document.querySelectorAll('.speed-controls .btn')]
        .map(b => `${(b.textContent ?? '').trim()}${b.disabled ? '(off)' : ''}`),
      panels: ['Start Second Half', 'Take the Points', 'Full Time', 'Match Review', 'Continue to Results']
        .filter(t => document.body.innerText.includes(t)),
      veil: document.querySelector('.modal-veil h3')?.textContent ?? null,
    }))
    console.log(`  stuck with controls [${state.controls.join(' | ')}] and panels [${state.panels.join(', ')}]${state.veil ? ` under a veil titled ${state.veil}` : ''}`)
  }
  ok(skipped, 'the match could be skipped to the break, answering any touchline call on the way')
  // a full half has to play out here: generous, because under whole-suite CPU
  // load 25s was not enough and the probe died as a false alarm (16D)
  // ...and it has to be a POLL, not a bare wait: a penalty or an injury
  // landing between Skip and the break pauses the match with a question open,
  // and a wait that answers nothing waits forever - the second of this
  // probe's two wedges in one day.
  for (let w = 0; w < 120; w++) {
    if (await atHalfTime()) break
    await settle()
    await clearInjury()
    // the skip loop pauses the match on purpose; if its press then failed to
    // restart anything, a frozen first half never reaches the break - nudge it
    await page.evaluate(() => {
      const st = window.rugbyStore.getState()
      const lm = st.liveMatch
      if (lm && !lm.playing && !lm.done && !lm.ctx.awaiting && !lm.ctx.decision) st.matchCursor(lm.cursor, true)
    }).catch(() => {})
    await page.waitForTimeout(700)
  }
  if (!(await atHalfTime())) {
    // say what IS on screen before the assert below turns it into a timeout
    const st = await page.evaluate(() => {
      const lm = window.rugbyStore.getState().liveMatch
      return {
        seg: lm?.ctx.seg, playing: lm?.playing, done: lm?.done,
        awaiting: lm?.ctx.awaiting ?? null, decision: !!lm?.ctx.decision,
        panels: ['Start Second Half', 'Play the Final Quarter', 'Take the Points', 'Continue to Results']
          .filter(t => document.body.innerText.includes(t)),
      }
    })
    console.log(`  never reached half-time: ${JSON.stringify(st)}`)
  }
  // 20s, not 8: the first half is driven in real ticks, and under a full
  // suite (a dozen probes sharing the box) 8s timed out once while the same
  // run passed three-for-three alone. Every sibling wait on a match
  // milestone in this file already allows 20s; this one was the outlier.
  await page.waitForSelector('text=Start Second Half', { timeout: 20000 })
  ok(await page.locator('text=Match-Day Squad').count() > 0, 'half-time offers the match-day squad')
  ok(await page.locator('select').count() === 0, 'the quick-sub dropdowns are gone')

  await page.click('text=Match-Day Squad')
  await page.waitForSelector('.squad-sheet', { timeout: 5000 })
  const rows = await page.locator('.sheet-col >> nth=0').locator('.sheet-row').count()
  ok(rows === 15, `the XV is listed in full (${rows} rows)`)
  // captured, not assumed: a first-half injury legitimately spends a bench man
  // before this sheet ever opens, so the row arithmetic below has to start
  // from the bench the sheet actually shows (16C: a fixed 8 read as a bug)
  const benchBefore = await page.locator('.sheet-col >> nth=1').locator('.sheet-row').count()
  ok(benchBefore > 0, `the bench is listed (${benchBefore} available)`)

  const subsLeft = async () => {
    const t = await page.locator('.sheet-head .meta').textContent()
    return parseInt(t ?? '0', 10)
  }
  const before = await subsLeft()
  // THE BENCH, not a number. Five was the old cap; union lets a side use all eight
  // and the user asked for that ("all 8 subs should be able to be used"). Asserting
  // the rule rather than the digit means the next change to the cap does not need a
  // probe edit, only a passing one.
  ok(before === MAX_SUBS, `the whole bench is available at half-time (${before} of ${MAX_SUBS})`)

  // FIVE changes without leaving the sheet, not two.
  //
  // Two was enough to prove several changes work in one visit, and two is below
  // every off-by-one this panel has had. The Done button counted a display list
  // capped at four entries, so the fifth change still read "4 changes made" and
  // this probe sailed past it (user: "when you make more than 4 substitution it
  // says you've made 4 subs"). Five crosses that cap; the cap was four.
  const CHANGES = 5
  for (let i = 0; i < CHANGES; i++) {
    // arm a man who is on, then take the first bench option offered
    await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').first().click()
    await page.waitForTimeout(150)
    ok(await page.locator('.sheet-row.armed').count() === 1, `change ${i + 1}: a man is armed`)
    await page.locator('.sheet-col >> nth=1').locator('.sheet-row:not([disabled])').first().click()
    await page.waitForTimeout(300)
    // The sheet surviving the change is the whole point. It did not, at first:
    // the new commentary line pushed events past the cursor, caughtUp went false
    // and the half-time panel unmounted mid-substitution.
    const stillOpen = await page.locator('.squad-sheet').count() > 0
    ok(stillOpen, `change ${i + 1}: the sheet is still open afterwards`)
    if (!stillOpen) break
  }
  // ---- Play at half-time restarts the match, so the resume button at the foot
  // of the panel is never the only way out (user: "the play buttons should
  // trigger the start second half. you shouldn't have to scroll"). It used to do
  // nothing: advanceLive returns early while ctx.awaiting is set, so Play set
  // playing true and the next tick set it back to false.
  const beforeExit = await subsLeft()
  ok(beforeExit === before - CHANGES,
    `${CHANGES} changes in one visit spent ${CHANGES} of the ${MAX_SUBS} (${before} -> ${beforeExit})`)

  // ---- the wrong tap can be taken back at the same stoppage (16B) ----
  const undoBtn = page.locator('text=Take back the last change')
  ok(await undoBtn.count() === 1, 'the last change offers an undo at the same stoppage')
  await undoBtn.click()
  await page.waitForTimeout(300)
  ok(await subsLeft() === before - CHANGES + 1,
    `taking it back refunds the replacement (${await subsLeft()} left)`)
  // make the change again so every count below stays honest
  await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').first().click()
  await page.waitForTimeout(150)
  await page.locator('.sheet-col >> nth=1').locator('.sheet-row:not([disabled])').first().click()
  await page.waitForTimeout(300)
  ok(await subsLeft() === before - CHANGES, 'and the change can be made again')

  // ---- two on-pitch taps swap shirts, free (16B) ----
  await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').nth(0).click()
  await page.waitForTimeout(150)
  await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])').nth(1).click()
  await page.waitForTimeout(300)
  ok((await page.locator('.sheet-log').first().textContent() ?? '').includes('swap positions'),
    'tapping a second man on the pitch swaps their positions')
  ok(await subsLeft() === before - CHANGES, 'and a positional switch costs no replacement')
  // every one of them reported, not four of them: the log used to trim itself
  const logged = await page.locator('.sheet-log').count()
  ok(logged >= CHANGES, `all ${CHANGES} changes are reported in the sheet (${logged} lines)`)
  // ---- CAN A THUMB ACTUALLY REACH THE BENCH? ----
  //
  // Reported from a real phone: "when she tried to make subs in game she
  // couldn't scroll", with a screenshot showing the On The Pitch list cut off at
  // shirt 7 and the bench cut off mid-row. Everything above passed while that was
  // true, because counting rows finds elements the eye cannot reach and clicking
  // the FIRST bench row never needs to scroll at all.
  //
  // In portrait the two columns stack, and each .sheet-col kept its own
  // overflow-y: auto - so 23 rows were split between two nested scrollers a few
  // hundred pixels tall, inside a .squad-sheet whose flex column stopped the modal
  // scrolling. Portrait now hands the scrolling back to the sheet.
  //
  // MEASURED AT THE HEIGHT A PHONE ACTUALLY HAS. The first cut of this check
  // asserted the sheet must scroll and failed on its own harness: at 412x915
  // the whole sheet FITS, so there is nothing to scroll and nothing wrong. The
  // reporter's screen is a tall Samsung with a browser bar at the top and a
  // navigation bar at the bottom, which is what makes the content overflow. So
  // the viewport is shortened here to reproduce that, because the bug only
  // exists when the sheet is taller than the room it has.
  await page.setViewportSize({ width: 412, height: 640 })
  await page.waitForTimeout(350)
  const reach = await page.evaluate(() => {
    const sheet = document.querySelector('.squad-sheet')
    const cols = [...document.querySelectorAll('.sheet-col')]
    const scrollable = el => el.scrollHeight - el.clientHeight > 4
    const rows = [...document.querySelectorAll('.sheet-col .sheet-row')]
    return {
      rows: rows.length,
      sheetScrolls: sheet ? scrollable(sheet) : false,
      innerScrollers: cols.filter(scrollable).length,
      range: sheet ? sheet.scrollHeight - sheet.clientHeight : 0,
    }
  })
  console.log(`  at 412x640: ${reach.rows} rows, sheet scrolls ${reach.sheetScrolls} (${reach.range}px), ${reach.innerScrollers} inner scroller(s)`)
  // The XV plus whoever is still sitting down. A flat ">= 20" was written when this
  // probe made two changes: every man who comes on leaves the bench column, so five
  // changes legitimately leaves 15 + 3, and the old number would have read as a
  // missing-rows bug. Derived, so the count of changes above can move again.
  const wantRows = 15 + (benchBefore - CHANGES)
  ok(reach.rows === wantRows,
    `the XV and the rest of the bench are in the sheet (${reach.rows} rows, wanted ${wantRows})`)
  // ONE scroller. Two nested ones is the bug, whatever the other numbers say.
  ok(reach.innerScrollers === 0,
    `the columns do not scroll independently in portrait (${reach.innerScrollers} do)`)
  ok(reach.sheetScrolls, 'on a short phone the sheet itself scrolls, so there is a way to the bench')

  // and prove it: scroll to the bottom and check the last bench man is on screen
  await page.evaluate(() => {
    const sheet = document.querySelector('.squad-sheet')
    if (sheet) sheet.scrollTop = sheet.scrollHeight
  })
  await page.waitForTimeout(250)
  const bottom = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.sheet-col .sheet-row')]
    const last = rows[rows.length - 1]
    if (!last) return { visible: false }
    const r = last.getBoundingClientRect()
    // and the head must still name the injured man: it is sticky for exactly
    // this reason, because his name used to scroll away and leave the manager
    // guessing who was hurt
    const head = document.querySelector('.sheet-head')
    const hr = head?.getBoundingClientRect()
    // AND THE INSTRUCTION. Reported from a real phone: "she could see the team xv
    // but couldnt see the text above it". The heading was sticky; the line that
    // says what to do next was not, so once the list was scrolled the sheet
    // stopped telling her whose replacement she was picking. The hint is the one
    // element that CHANGES when a man is armed, which makes it the one that must
    // not be off screen.
    const hint = document.querySelector('.sheet-hint')
    const nr = hint?.getBoundingClientRect()
    const on = b => !!b && b.top >= -1 && b.bottom <= window.innerHeight && b.height > 4
    return {
      visible: r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.height > 8,
      headVisible: on(hr),
      hintVisible: on(nr),
      hintTop: nr ? Math.round(nr.top) : null,
    }
  })
  ok(bottom.visible, 'scrolling to the bottom brings the last bench man into view')
  ok(bottom.headVisible, 'the sheet heading stays on screen while the list scrolls')
  ok(bottom.hintVisible, `and so does the line telling you what to tap next (top ${bottom.hintTop})`)
  await page.setViewportSize({ width: 412, height: 915 })
  await page.waitForTimeout(250)

  // NOTHING may hang off the side of the phone. This is the check that was missing:
  // the sheet is a two-column grid inside a modal with no side padding, which is
  // fine at 844px and ran off both edges at 412.
  const spill = await page.evaluate(() => {
    const W = window.innerWidth
    const out = []
    for (const el of document.querySelectorAll('.squad-sheet *')) {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      let sc = el.parentElement, scrolls = false
      while (sc && sc !== document.body) {
        const ox = getComputedStyle(sc).overflowX
        if (ox === 'auto' || ox === 'scroll') { scrolls = true; break }
        sc = sc.parentElement
      }
      if (scrolls) continue
      if (r.right > W + 1 || r.left < -1) out.push(`${el.className || el.tagName}@${Math.round(r.left)}..${Math.round(r.right)}`)
    }
    return out.slice(0, 5)
  })
  ok(spill.length === 0, `the sheet stays inside the phone (${spill.join(' ') || 'nothing past the edge'})`)
  // ONE COLUMN, measured as geometry rather than as a CSS string.
  //
  // This used to read gridTemplateColumns and count the spaces in it, which only
  // worked while the container was a grid. Portrait now makes it a block so the
  // sheet can scroll as one document, and the computed value stops resolving to
  // pixel widths: "minmax(0, 1fr)" splits into two words and the check reported
  // two columns for a layout that has one. Ask the boxes where they are instead.
  const stack = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('.sheet-col')]
    if (cols.length < 2) return { sideBySide: false, n: cols.length }
    const [a, b] = cols.map(c => c.getBoundingClientRect())
    return {
      n: cols.length,
      // side by side means they share vertical space and sit at different lefts
      sideBySide: Math.abs(a.left - b.left) > 8 && b.top < a.bottom - 8,
    }
  })
  ok(!stack.sideBySide, `and the two lists stack rather than sitting side by side (${stack.n} panels)`)

  // THE NUMBER ON THE BUTTON, past the point where the log stops growing
  const doneCap = (await page.locator('.squad-sheet .btn.gold').textContent() ?? '').trim()
  console.log(`  Done button reads "${doneCap}"`)
  ok(doneCap.includes(`${CHANGES} changes`),
    `the Done button counts every change, not the lines it can show (wanted "${CHANGES} changes")`)
  await page.click('.squad-sheet .btn.gold')
  await page.waitForTimeout(250)
  ok(await page.locator('.squad-sheet').count() === 0, 'the sheet closes')
  ok((await page.locator('text=Replacements').first().textContent() ?? '')
    .includes(`${MAX_SUBS - CHANGES} of ${MAX_SUBS}`),
    `the panel agrees ${MAX_SUBS - CHANGES} are left after ${CHANGES} changes`)

  // still at half-time: the control row must say what it will do, and do it
  const playCap = (await page.locator('.speed-controls .btn').first().textContent() ?? '').trim()
  console.log(`  half-time play button reads "${playCap}"`)
  ok(/Second Half/.test(playCap), 'at half-time the play button names the restart')
  ok(await press(page.locator('.speed-controls .btn').first()), 'the play button could be pressed, answering any touchline call first')
  await page.waitForTimeout(900)
  const resumed = await page.evaluate(() => (document.querySelector('.minute')?.textContent ?? '').trim())
  console.log(`  after pressing Play: "${resumed.slice(0, 40)}"`)
  ok(!/Half-Time/.test(resumed), 'Play restarted the match rather than doing nothing')
  // Not asserting the panel has gone: this probe set the speed to Fast earlier,
  // so within a second of restarting the game can legitimately reach a kickable
  // penalty or the 60' break, both of which put a panel back up. Leaving
  // half-time is the claim being tested.

  // the 60' break is the same state and must behave the same way
  if (/60' Break/.test(resumed)) {
    const brkCap = (await page.locator('.speed-controls .btn').first().textContent() ?? '').trim()
    console.log(`  60' break play button reads "${brkCap}"`)
    ok(/Final Quarter/.test(brkCap), "at the 60' break the play button names the restart")
    ok(await press(page.locator('.speed-controls .btn').first()), 'the play button could be pressed, answering any touchline call first')
    await page.waitForTimeout(900)
    const after60 = await page.evaluate(() => (document.querySelector('.minute')?.textContent ?? '').trim())
    ok(!/60' Break/.test(after60), "Play restarted the match from the 60' break")
  }
} catch (e) {
  console.error('SUBS PROBE stopped early:', e.message)
  fails++
}

console.log(fails ? `\nSUBS PROBE FAILED (${fails})` : '\nSUBS PROBE PASSED')
await browser.close()
server.stop()
process.exit(fails ? 1 : 0)
