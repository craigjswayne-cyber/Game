// Can you reach the whole team sheet mid-match, on a real phone?
//
// Two reports now, from two different phones. The first: "when she tried to make
// subs in game she couldn't scroll" - the two columns each kept their own
// scroller in portrait, so the bench was there and unreachable. The second, a
// screenshot at the 60' break with the list starting at shirt 3 and no heading
// above it: "Mid Match it blocks off the top players to sub."
//
// subsprobe.mjs was written for the first report and it checks the BOTTOM of the
// sheet - the last bench row visible, no nested scrollers. It never once looked
// at the TOP. A probe that only checks the end of a list cannot see a list whose
// beginning is missing, and that is exactly the second report.
//
// So this one holds the whole sheet to account, at both entry points the game
// offers (half-time and the 60' break) and at the height a phone actually has:
//
//   - all fifteen shirts are in the sheet, 1 through 15, none missing
//   - shirt 1 is inside the sheet's visible box the moment the sheet opens,
//     with no scrolling asked of anybody
//   - the heading is visible at the same moment, because it names the casualty
//   - shirt 1 can be tapped and arms for substitution: "the top players" are
//     not blocked off
//   - and the bench is still reachable, so fixing the top does not lose the end
import { chromium } from 'playwright-core'
import { done, startPreview } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const server = await startPreview(4193, 2500)

// UNBUFFERED, ON PURPOSE. Piped to a file, node buffers stdout in blocks, so the
// two runs of this probe that were killed by a timeout left a log containing the
// single word "Terminated" and nothing else - three sweeps' worth of findings lost
// because the process never got to flush. writeSync to fd 1 goes straight out, so
// a probe that dies half way still says what it had learned.
const say = s => writeSync(1, s + '\n')

let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok' : 'FAIL'} ${what}`); if (!cond) fails++ }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/**
 * @param label   what to print
 * @param height  the viewport height. 640 is the usable height of a 412x915
 *                phone once the browser chrome is on the screen, and it is the
 *                number that matters: the sheet fits at 915 and overflows at 640,
 *                so measuring at 915 is measuring a phone nobody owns.
 * @param stopAt  'HT' for half-time, 'BRK' for the 60' break
 */
async function sweep(label, height, stopAt) {
  say(`\n=== ${label}: 412x${height}, ${stopAt === 'HT' ? 'half-time' : "the 60' break"} ===`)
  const page = await browser.newPage({ viewport: { width: 412, height } })
  await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
  try {
    await page.goto('http://localhost:4193/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })
    await page.click('text=New Career')
    await page.waitForSelector('text=Gallagher Premiership')
    await page.click('text=Gallagher Premiership')
    await page.waitForSelector('.club-tile')
    await page.click('.tile >> text=Northampton')
    await page.waitForSelector('text=Star Player')
    await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Reach')
    await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 })
    await page.click('.tut-close .btn')

    for (let tap = 0; tap < 10; tap++) {
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

    // Play forward until the touchline panel we want is on screen. Half-time
    // comes first; the break is one resume further on.
    const reachPanel = async want => {
      for (let i = 0; i < 120; i++) {
        // A TOUCHLINE CALL STOPS EVERYTHING, INCLUDING SKIP. The Skip button is
        // disabled while a penalty decision is unanswered ("The touchline call is
        // yours first"), so a loop that only presses Skip sits at the same minute
        // until it gives up - which is why this probe timed out twice without
        // ever reporting anything. Answer the call, then carry on.
        if (await page.locator('.btn', { hasText: 'Take the Points' }).count()) {
          await page.locator('.btn', { hasText: 'Take the Points' }).first().click().catch(() => {})
          await page.waitForTimeout(300)
          continue
        }
        const panel = page.locator('.ticker.panel-area .card h3')
        if (await panel.count()) {
          const t = (await panel.first().textContent()) ?? ''
          if (want === 'HT' && /Half-Time/.test(t)) return true
          if (want === 'BRK' && /break in play/.test(t)) return true
          // the wrong panel: resume and keep going
          const resume = page.locator('.ticker.panel-area .btn.gold')
          if (await resume.count()) { await resume.first().click(); await page.waitForTimeout(400); continue }
        }
        // any injury stop has to be answered before play goes on
        if (await page.locator('.squad-sheet').count()) {
          const first = page.locator('.squad-sheet .sheet-col >> nth=1').locator('.sheet-row').first()
          if (await first.count()) await first.click().catch(() => {})
          const done = page.locator('.squad-sheet .btn.gold')
          if (await done.count()) await done.first().click().catch(() => {})
          await page.waitForTimeout(300)
          continue
        }
        const skip = page.locator('.speed-controls .btn').nth(1)
        if (await skip.count()) await skip.click().catch(() => {})
        await page.waitForTimeout(500)
      }
      return false
    }
    ok(await reachPanel(stopAt), `the ${stopAt === 'HT' ? 'half-time' : 'break'} panel is reached`)

    // open the match-day squad the way a manager does
    const openBtn = page.locator('.ticker.panel-area button', { hasText: 'Match-Day Squad' })
    if (!(await openBtn.count())) { ok(false, 'the panel offers a way into the match-day squad'); return }
    await openBtn.first().click()
    await page.waitForSelector('.squad-sheet', { timeout: 5000 })
    await page.waitForTimeout(350)

    // ---- what the sheet holds, and where it holds it
    const geo = await page.evaluate(() => {
      const sheet = document.querySelector('.squad-sheet')
      const head = document.querySelector('.squad-sheet .sheet-head')
      const cols = [...document.querySelectorAll('.squad-sheet .sheet-col')]
      const xvCol = cols[0]
      const rows = xvCol ? [...xvCol.querySelectorAll('.sheet-row')] : []
      const box = e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) } }
      const sb = sheet ? box(sheet) : null
      const inSheet = e => {
        if (!sheet || !e) return false
        const r = e.getBoundingClientRect(), s = sheet.getBoundingClientRect()
        // its middle has to be inside the sheet's visible box AND on the screen
        const mid = r.top + r.height / 2
        return mid > s.top && mid < s.bottom && mid > 0 && mid < window.innerHeight
      }
      const shirts = rows.map(r => (r.querySelector('.sh-num')?.textContent ?? '').trim())
      const bench = cols[1] ? [...cols[1].querySelectorAll('.sheet-row')] : []
      return {
        sheet: sb,
        viewportH: window.innerHeight,
        scrollTop: sheet ? Math.round(sheet.scrollTop) : null,
        scrollH: sheet ? Math.round(sheet.scrollHeight) : null,
        headVisible: inSheet(head),
        headText: head?.textContent?.trim().slice(0, 40) ?? '',
        shirts,
        firstShirtVisible: rows.length ? inSheet(rows[0]) : false,
        firstShirtDisabled: rows.length ? rows[0].disabled === true : null,
        // a disabled shirt 1 is legitimate when the man is visibly OFF - in
        // the bin or injured, both flagged on the row. The sim runs while the
        // probe navigates, so whether shirt 1 is in the bin when the sheet
        // opens is a coin toss per run; one suite run failed exactly there.
        firstShirtFlagged: rows.length ? !!rows[0].querySelector('.sh-flag') : false,
        lastShirtVisible: rows.length ? inSheet(rows[rows.length - 1]) : false,
        benchCount: bench.length,
        // a nested scroller inside the sheet is the first report's bug
        innerScrollers: [...document.querySelectorAll('.squad-sheet *')]
          .filter(e => e.scrollHeight > e.clientHeight + 4 &&
            ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).length,
      }
    })
    say(`  sheet ${geo.sheet?.h}px tall at top ${geo.sheet?.top} in a ${geo.viewportH}px window, ` +
      `content ${geo.scrollH}px, scrolled to ${geo.scrollTop}`)
    say(`  head "${geo.headText}" visible: ${geo.headVisible}`)
    say(`  XV shirts in the sheet: [${geo.shirts.join(' ')}]`)
    say(`  bench rows: ${geo.benchCount}, inner scrollers: ${geo.innerScrollers}`)

    ok(geo.shirts.length === 15, `all fifteen shirts are in the sheet (found ${geo.shirts.length})`)
    ok(geo.shirts[0] === '1', `the list starts at shirt 1 (starts at ${geo.shirts[0]})`)
    ok(geo.scrollTop === 0, `the sheet opens at its top, not part-way down (scrollTop ${geo.scrollTop})`)
    ok(geo.headVisible, 'the heading is on screen when the sheet opens')
    ok(geo.firstShirtVisible, 'shirt 1 is on screen when the sheet opens, with no scrolling')
    ok(geo.firstShirtDisabled === false || geo.firstShirtFlagged,
      `shirt 1 is tappable or visibly off (${geo.firstShirtDisabled ? 'off, flagged' : 'tappable'}): the top of the sheet is not blocked off`)
    ok(geo.innerScrollers === 0, `the sheet is one scrolling page, not nested scrollers (${geo.innerScrollers})`)
    ok(geo.benchCount > 0, `the bench is in the sheet (${geo.benchCount} rows)`)

    // ---- and tapping shirt 1 actually arms him
    // the first ENABLED shirt: shirt 1 himself may legitimately be in the bin
    const row1 = page.locator('.squad-sheet .sheet-col').first().locator('.sheet-row:not([disabled])').first()
    await row1.click()
    await page.waitForTimeout(200)
    const armed = await page.evaluate(() => {
      const r = document.querySelector('.squad-sheet .sheet-col .sheet-row:not([disabled])')
      return { armed: !!r && r.className.includes('armed'), hint: document.querySelector('.sheet-hint')?.textContent?.trim().slice(0, 60) ?? '' }
    })
    say(`  after tapping shirt 1: armed ${armed.armed}, hint "${armed.hint}"`)
    ok(armed.armed, 'tapping shirt 1 arms him for replacement')

    // ---- the bench end still reachable after scrolling down
    await page.evaluate(() => {
      const s = document.querySelector('.squad-sheet')
      if (s) s.scrollTop = s.scrollHeight
    })
    await page.waitForTimeout(250)
    const tail = await page.evaluate(() => {
      const sheet = document.querySelector('.squad-sheet')
      const cols = [...document.querySelectorAll('.squad-sheet .sheet-col')]
      const bench = cols[1] ? [...cols[1].querySelectorAll('.sheet-row')] : []
      const last = bench[bench.length - 1]
      if (!sheet || !last) return { ok: false, headVisible: false }
      const r = last.getBoundingClientRect(), s = sheet.getBoundingClientRect()
      const head = document.querySelector('.squad-sheet .sheet-head')
      const hr = head?.getBoundingClientRect()
      // and the instruction, which used to scroll away with the list: "she could
      // see the team xv but couldnt see the text above it"
      const hint = document.querySelector('.squad-sheet .sheet-hint')
      const nr = hint?.getBoundingClientRect()
      const pinned = b => !!b && b.top >= s.top - 2 && b.bottom <= window.innerHeight
      return {
        ok: r.top >= s.top - 1 && r.bottom <= s.bottom + 1 && r.bottom <= window.innerHeight + 1,
        headVisible: pinned(hr),
        hintVisible: pinned(nr),
      }
    })
    ok(tail.ok, 'scrolled to the end, the last bench man is fully on screen')
    ok(tail.headVisible, 'and the sticky heading is still naming the casualty')
    ok(tail.hintVisible, 'and the line telling you what to tap next is still on screen')
  } finally {
    await page.close()
  }
}

try {
  // the height that matters first, and the entry point from the screenshot
  await sweep('the break, real phone height', 640, 'BRK')
  await sweep('half-time, real phone height', 640, 'HT')
  await sweep('the break, tall phone', 915, 'BRK')
} finally {
  await browser.close()
  server.stop()
}

if (fails) { say(`\nSUB REACH PROBE: ${fails} failures`); process.exit(1) }
say('\nSUB REACH PROBE PASSED')
done(0)
