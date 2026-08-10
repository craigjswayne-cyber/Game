// Probe: reload the page mid-match and the match is still there.
//
// resumeprobe.ts proves the replay is exact. This proves the plumbing around it
// works in a browser: the record is written to IndexedDB at kick-off, kept up to
// date as the match runs, found again after a reload, and turned back into the
// same live match on the same screen - with the score, the clock and the line of
// commentary the manager was looking at.
//
// It was the first report of the batch, and the harshest one: "I was playing a
// game and I dragged my finger down and it restarted the game."
//
// Three things about driving a live match from a harness, all learned the hard
// way by writing this wrong first:
//
//   the match kicks off ALREADY PLAYING, so pressing play PAUSES it. The first
//   draft paused the game at 0' and then complained the game had no commentary.
//
//   during play there is no commentary list. One line shows at a time in
//   .now-strip; the .tick-event log only exists on the full-time page. Looking
//   for the log mid-match finds nothing and proves nothing.
//
//   the clock STOPS for a touchline call and for each interval, and waits for
//   the manager. A harness that only sleeps sits at 1' forever.
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'

const PORT = 4179
const server = await startPreview(PORT, 3000)

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 732 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 200)))

/** Everything on the match screen a manager would notice, as comparable values. */
const snapshot = () => page.evaluate(() => {
  const sb = document.querySelector('.scoreboard')
  const now = document.querySelector('.now-line')
  const body = document.body.textContent ?? ''
  return {
    onMatch: !!sb,
    score: (sb?.querySelector('.score')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    clock: (sb?.querySelector('.minute')?.textContent ?? '').split('·')[0].trim(),
    nowMin: now?.querySelector('.min')?.textContent?.trim() ?? '',
    nowTxt: now?.querySelector('.txt')?.textContent?.trim() ?? '',
    decision: body.includes('your call from the touchline'),
    // A SERIOUS INJURY STOPS THE CLOCK (feedback 9-3): the match-day squad opens
    // and will not close until somebody is named. This probe used to have no idea
    // that screen existed, so a match that produced a bad injury simply stopped -
    // and the failure read as "the match never reached the second half", which
    // sounds like a resume bug and is not one. It surfaced when the AI economy
    // changed which players AI clubs were carrying, and so which men got hurt.
    hurt: body.includes('Name his replacement before play restarts'),
    interval: /Start Second Half|Play the Final Quarter/.test(body),
    // IS IT PAUSED? The first control is Play/Pause and it carries a play glyph
    // only when the match is stopped. Read rather than assumed, because pressing
    // it while the match is running would pause the thing this probe is driving.
    paused: (document.querySelector('.speed-controls .btn')?.textContent ?? '').includes('\u25B6'),
    finished: !!document.querySelector('.ft-stamp') || body.includes('Continue to Results'),
  }
})

/** the number in a clock string, or -1 for a stopped clock */
const mins = s => { const m = /^(\d+)'/.exec(s.clock); return m ? Number(m[1]) : -1 }

/**
 * Keep the match moving: answer the touchline, come out of the intervals, and
 * stop when `wants` is satisfied. This is the manager's thumb, nothing more.
 */
const drive = async (wants, ms, what) => {
  let stop = Date.now() + ms
  let last = null
  // A TIMEOUT IS NOT A DIAGNOSIS. This probe has now failed three times in a full
  // suite run and passed every time on its own, and each failure read as "the match
  // never reached the second half" - which sounds like the resume bug this probe
  // exists to catch and was not. Twice it was a screen the walk did not know how to
  // clear; once it was simply a loaded machine, because a browser probe that starts
  // while the previous one's Chromium is still tearing down gets a fraction of the
  // CPU it expects.
  //
  // So the two are now told apart. If the clock has MOVED inside the window, the
  // match is fine and the machine is slow: extend once and say so. If it has not
  // moved at all, that is a genuine stall and the failure means something.
  //
  // AND THE MARK IS TAKEN ONCE PER WINDOW, which is the whole point and is not what
  // this did. `mark = mins(s)` sat at the bottom of the loop, so it was refreshed
  // every pass and the comparison at the timeout asked "did the clock move in the
  // last 250ms?" rather than "did it move during the window". A match ticking slower
  // than one game-minute per 250ms of wall clock - which is exactly what a loaded
  // machine produces - therefore reported STALLED while advancing normally. That is
  // the flake: it failed inside full suite runs and passed on its own, and the
  // detector built to tell slowness from a stall was itself measuring 250ms.
  let windowMark = null
  let extended = false
  for (;;) {
    const s = await snapshot()
    last = s
    if (wants(s)) return s
    if (windowMark === null) windowMark = mins(s)
    if (Date.now() > stop) {
      const moved = mins(s) !== windowMark
      if (moved && !extended) {
        extended = true
        windowMark = mins(s)
        stop = Date.now() + ms
        // console.log, not say(): `say` was never defined anywhere in this file, so
        // the one branch that exists to tell slowness from a stall threw a
        // ReferenceError the moment it fired and took the whole probe into its
        // catch as "the harness threw". A safety valve nobody had ever seen open.
        console.log(`  (still moving at ${s.clock}, machine is slow - one extension)`)
        continue
      }
      ok(false, moved
        ? `${what}: still progressing at ${s.clock} after two full windows, so this is slowness, not a stall`
        : `STALLED waiting for ${what} - the clock has not moved from ${s.clock || 'no match'} in a full window`)
      return s
    }
    if (s.hurt) {
      // Arm a man who is on, then take a bench option: the two taps subsprobe
      // uses, because a forced stop wants a real change and blind clicking on the
      // sheet got past one injury and stalled on the next.
      await page.locator('.sheet-col >> nth=0').locator('.sheet-row:not([disabled])')
        .first().click({ timeout: 3000 }).catch(() => {})
      await page.locator('.sheet-col >> nth=1').locator('.sheet-row:not([disabled])')
        .first().click({ timeout: 3000 }).catch(() => {})
      await page.locator('.btn', { hasText: /Back to the Match|Done|Close/ })
        .first().click({ timeout: 3000 }).catch(() => {})
    } else if (s.decision) {
      await page.locator('.btn', { hasText: 'Take the Points' }).first().click().catch(() => {})
    } else if (s.interval) {
      await page.locator('.btn', { hasText: /Start Second Half|Play the Final Quarter/ })
        .first().click().catch(() => {})
    } else if (s.paused) {
      // PRESS PLAY, because a resumed match comes back paused and that is correct:
      // store.resumeLiveMatch sets playing false on purpose, so a reload does not
      // drop you into a match already running away from you. This walker never
      // pressed it, so after the reload it sat waiting for a paused match to
      // advance on its own and reported a stall - at 26', 47', 48', 49', 52',
      // wherever the pause happened to land. That is the flake that has been
      // blamed on a loaded machine three times: the machine was slow, but the
      // reason nothing moved is that nobody had told it to start.
      await page.locator('.speed-controls .btn').first().click({ timeout: 2000 }).catch(() => {})
    }
    await page.waitForTimeout(250)
  }
}

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Reload')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 25000 })
  await page.click('.tut-close .btn')

  for (let tap = 0; tap < 10; tap++) {
    if (await page.locator('text=Kick Off ▸').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
  }
  await page.waitForSelector('text=Kick Off ▸', { timeout: 20000 })
  await page.locator('text=Kick Off ▸').first().click()
  await page.locator('.talk-modal').waitFor({ timeout: 6000 }).catch(() => {})
  await page.click('.talk-modal .speech-tile >> nth=1').catch(() => {})
  await page.locator('text=▸ Take the Field').click({ timeout: 3000 }).catch(() => {})
  await page.waitForSelector('.scoreboard', { timeout: 20000 })

  // Into the second half, past a touchline call and past half-time, so the
  // record has real commands in it and the replay has real work to do.
  const before = await drive(s => mins(s) >= 48, 90000, 'the match to reach the second half')
  console.log(`  running: ${before.clock}, ${before.score}, on screen "${before.nowTxt.slice(0, 46)}"`)
  ok(before.onMatch && mins(before) >= 48 && !!before.nowTxt,
    `a match is running in the second half with commentary on screen (${before.clock})`)

  // pause, so the clock is not mid-flight when we read it and then reload
  await page.locator('.speed-controls .btn').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const held = await snapshot()
  console.log(`  paused at: ${held.clock}, ${held.score}, "${held.nowTxt.slice(0, 46)}"`)

  // THE GESTURE THAT STARTED ALL THIS
  await page.reload({ waitUntil: 'domcontentloaded' })
  const after = await drive(s => s.onMatch && !!s.nowTxt, 40000, 'the match to come back after the reload')
  console.log(`  restored:  ${after.clock}, ${after.score}, "${after.nowTxt.slice(0, 46)}"`)

  ok(after.onMatch, 'the reload came back to the match, not to the week')
  // the score is the part nobody would forgive being wrong
  ok(after.score === held.score, `the score came back the same (${held.score} then ${after.score})`)
  ok(after.clock === held.clock, `the clock came back to the same minute (${held.clock} then ${after.clock})`)
  ok(after.nowMin === held.nowMin && after.nowTxt === held.nowTxt,
    'the line on screen is the same line, to the word')

  // and the match can still be finished from here
  const end = await drive(s => s.finished || !s.onMatch, 90000, 'the resumed match to reach full time')
  ok(end.finished, `the resumed match reached full time (${end.clock || 'off the match screen'})`)
  console.log(`  final score: ${end.score || '(gone)'}`)

  // leave the match the way the manager does
  await page.locator('.btn', { hasText: 'Continue to Results' }).first().click().catch(() => {})
  await page.waitForTimeout(1500)

  // the record must not outlive the match: another reload stays out of it
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  const post = await snapshot()
  ok(!post.onMatch, `a reload after full-time does not drag the finished match back${post.onMatch ? ` (back at ${post.clock})` : ''}`)
} catch (e) {
  ok(false, `the harness threw: ${String(e).split('\n')[0].slice(0, 180)}`)
} finally {
  await browser.close()
  server.stop()
}

if (errors.length) {
  console.error(`\nuncaught page errors (${errors.length}):`)
  for (const e of [...new Set(errors)]) console.error('  ' + e)
  fails += errors.length
}

if (fails) { console.error(`\nRELOAD PROBE: ${fails} failures`); process.exit(1) }
console.log('\nRELOAD PROBE PASSED: a live match survives a reload')
done(0)
