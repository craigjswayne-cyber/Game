// Resilience probe: the five ways the game used to fail badly.
//
// Every one of these is a thing the game did wrong that no other harness could
// see, because none of them sit on a happy path:
//   A1  a render throw wiped the app to a white rectangle with no way back
//   A2  the welcome dialog overflowed a short landscape phone and, once shut,
//       could never be opened again
//   A3  the portrait veil covered everything, so a phone with its rotation lock
//       on could not play at all
//   A4  a failed save was swallowed whole and the manager played on for hours
//   A5  the celebration overlay was written to but never rendered
//   A8  opening the game walked straight past the title screen, because the
//       reload bookmark was being honoured on a cold start too
//
// A 390px-tall viewport on purpose: that is the shape the user holds, and it is
// where the tutorial overflow bit.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = await startPreview('4177', 2500)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
// one context throughout: a second page would get its own storage partition and
// the IndexedDB half of this probe would be testing nothing
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

const shot = (name) => page.screenshot({ path: `${SHOTS}/res-${name}.png` })
const fails = []
const check = (ok, label) => {
  console.log(`  ${ok ? 'ok' : 'FAIL'} ${label}`)
  if (!ok) fails.push(label)
}

/** Errors this probe causes deliberately. The boundary logging the crash it
 *  caught and the store logging the write it could not make are both the fix
 *  working, so they are not failures. */
const EXPECTED = [
  'render crashed',            // the boundary reporting what it caught
  'save failed',              // the store reporting the write it could not make
  'The above error occurred', // react's own note about the boundary
  'QuotaExceededError',       // the write this probe breaks on purpose
  "reading 'players'",        // the render this probe breaks on purpose
]

/** The live game object, reached through the react tree.
 *
 *  The store is a module local inside a bundled chunk, so a page script cannot
 *  import it. What it can do is walk the fiber tree for the game state a
 *  component is already holding - it is the same mutable object the store hands
 *  out, so writing to it writes to the real save. A redraw still has to be
 *  triggered by an ordinary tap afterwards, which is honest: it is what happens
 *  when the engine mutates state during a week and the UI catches up. */
const REACH_GAME = `(() => {
  const root = document.getElementById('root')
  const key = Object.keys(root).find(k => k.startsWith('__reactContainer'))
  const seen = new Set()
  const stack = [root[key]]
  while (stack.length) {
    const f = stack.pop()
    if (!f || seen.has(f)) continue
    seen.add(f)
    let h = f.memoizedState
    let guard = 0
    while (h && guard++ < 60) {
      const v = h.memoizedState
      if (v && typeof v === 'object' && v.userClubId && v.clubs && v.players) return v
      h = h.next
    }
    if (f.child) stack.push(f.child)
    if (f.sibling) stack.push(f.sibling)
  }
  return null
})()`

/** Mutate the live game state, then tap something so react redraws. */
async function mutate(body) {
  const res = await page.evaluate(`(() => {
    const g = ${REACH_GAME}
    if (!g) return 'no game reachable'
    ;(${body})(g)
    return 'ok'
  })()`)
  return res
}

async function newCareer(name) {
  await page.goto('http://localhost:4177/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', name)
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
}

try {
  // ---------- A2: the welcome dialog on a short screen ----------
  console.log('A2 the welcome dialog')
  await newCareer('Res Gaffer')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await shot('01-tutorial')

  const box = await page.evaluate(() => {
    const el = document.querySelector('.tut-box')
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, scrollH: el.scrollHeight, clientH: el.clientHeight, vh: window.innerHeight }
  })
  check(box.bottom <= box.vh + 1 && box.top >= -1,
    `the box is inside the viewport (${Math.round(box.top)} to ${Math.round(box.bottom)} of ${box.vh})`)
  check(box.scrollH > box.clientH,
    `and its content genuinely overflows, so the scroller is earning its keep (${box.scrollH} into ${box.clientH})`)

  const btn = page.locator('.tut-close .btn')
  await btn.scrollIntoViewIfNeeded()
  check(await btn.isVisible(), 'the close button can be scrolled to and seen')
  // a tap inside the box must NOT close it, or a scroll drag would dismiss it
  await page.click('.tut-box h3')
  check(await page.locator('.tut-box').count() === 1, 'a tap on the text does not dismiss it')
  await btn.click()
  await page.waitForSelector('.tut-box', { state: 'detached', timeout: 5000 })
  check(true, 'and the close button does')

  // ---------- A2 part two: it can be opened again ----------
  await page.click('.bottom-nav button[title="Manager"]')
  await page.waitForSelector('.submenu')
  await page.click('.submenu-item >> text=How to play')
  await page.waitForSelector('.tut-box', { timeout: 5000 })
  check(true, 'Manager > How to play brings it back after it was dismissed')
  await page.click('.tut-close .btn')
  await page.waitForSelector('.tut-box', { state: 'detached', timeout: 5000 })

  // ---------- A5: the celebration overlay ----------
  console.log('A5 the celebration overlay')
  const set = await mutate(`g => { g.celebration = { headline: 'CHAMPIONS OF ENGLAND', sub: 'English Premier Division winners', icon: '🏆' } }`)
  check(set === 'ok', `the celebration can be written to the live state (${set})`)
  await page.click('.bottom-nav button[title="Home"]')
  await page.waitForSelector('.celebrate-veil', { timeout: 5000 })
  check((await page.textContent('.celebrate-box')).includes('CHAMPIONS OF ENGLAND'),
    'and it renders the headline it was given')
  check(await page.locator('.confetti').count() === 26, 'with the confetti')
  await shot('02-celebration')
  await page.click('.celebrate-veil')
  await page.waitForSelector('.celebrate-veil', { state: 'detached', timeout: 5000 })
  check(true, 'and a tap clears it, so it cannot get stuck on screen')

  // ---------- A3: portrait is not walled off ----------
  //
  // This used to check that the "turn your phone sideways" veil covered the
  // screen and had a way out of it. The veil is gone: portrait is the tuned
  // orientation now, so the check is that nothing stands in front of it at all,
  // on a cold profile that has never been asked and never answered.
  console.log('A3 portrait is not walled off')
  await page.setViewportSize({ width: 412, height: 915 })
  await page.waitForTimeout(300)
  check(await page.locator('.rotate-veil').count() === 0, 'portrait raises no rotate wall')
  const covered = await page.evaluate(() => {
    // whatever sits at the middle of the screen should be the game, not a veil
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
    return !!el?.closest('.rotate-veil')
  })
  check(!covered, 'and nothing full-screen is sitting on top of the game')
  await shot('03-portrait')
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.dtable', { timeout: 8000 })
  check(true, 'and the game answers taps in portrait straight away')
  await shot('04-portrait-playing')
  await page.reload()
  await page.waitForSelector('.app', { timeout: 15000 })
  await page.waitForTimeout(600)
  check(await page.locator('.rotate-veil').count() === 0, 'and a reload in portrait still asks for nothing')
  await page.setViewportSize({ width: 844, height: 390 })

  // ---------- A6: the fat-thumb double tap on the assistant ----------
  //
  // Kicking off settles the entire week and lands on the round-up. A second tap
  // that arrives after the first has been honoured used to be free to run the
  // handler again - and by then the week had advanced, so it would find NEXT
  // week's fixture and play it with no preview, no selection and no team talk.
  // The store now refuses any kick-off that arrives when MatchDay is no longer
  // the screen on top. One tap, one match.
  console.log('A6 a double tap plays one match, not two')
  // the reload bookmark would otherwise drop us straight back into the career
  // above, and this block needs a career of its own from week one
  await page.evaluate(() => localStorage.removeItem('rm-where'))
  await newCareer('Twin Tap')
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })
  // the welcome box only shows once a profile, and A2 above already saw it off
  if (await page.locator('.tut-box').count()) {
    await page.click('.tut-close .btn').catch(() => {})
    await page.waitForTimeout(200)
  }

  const weekNow = async () => {
    const d = await page.textContent('.masthead .date').catch(() => '')
    const m = /WK\s*(\d+)/i.exec(d ?? '')
    return m ? Number(m[1]) : null
  }
  // walk the days until the masthead offers the match itself
  let reachedMatch = false
  for (let i = 0; i < 20; i++) {
    const label = (await page.textContent('.continue-btn').catch(() => '')) ?? ''
    if (/Matchday/i.test(label)) { reachedMatch = true; break }
    await page.click('.continue-btn').catch(() => {})
    await page.waitForTimeout(220)
  }
  check(reachedMatch, 'the week walks as far as a matchday')
  const weekBefore = await weekNow()
  await page.click('.continue-btn')          // into the pre-match hub
  await page.waitForTimeout(350)
  await page.click('.continue-btn')          // Kick Off: opens the dressing room
  await page.waitForSelector('.talk-modal', { timeout: 8000 })
  // hand it to the assistant so the match resolves in one go
  const chip = page.locator('.preset-chip', { hasText: 'Assistant' }).first()
  if (await chip.count()) { await chip.click(); await page.waitForTimeout(150) }
  // Two clicks dispatched in ONE task, which is the only way to reproduce this.
  // Playwright's dblclick does not: react commits between the two, the button
  // unmounts, and the second click lands on nothing - so a dblclick test passes
  // whether the guard is there or not, which is worse than no test at all
  // (measured: it passed with the guard deliberately removed). Dispatching both
  // synchronously is what a fat thumb does to a phone that is mid-frame.
  const twin = await page.evaluate(() => {
    const b = document.querySelector('.talk-modal .speech-tile')
    if (!b) return 'no speech tile'
    b.click()
    b.click()
    return 'both dispatched'
  })
  check(twin === 'both dispatched', `two clicks landed in one task (${twin})`)
  await page.waitForTimeout(1200)
  // the ready check only appears when the sheet has warnings on it; same trick
  const twin2 = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => /Let Him Take It|Take the Field/.test(x.innerText))
    if (!b) return 'no ready check'
    b.click()
    b.click()
    return 'both dispatched'
  })
  console.log(`  .. ready check: ${twin2}`)
  await page.waitForTimeout(1200)
  const weekAfter = await weekNow()
  check(weekBefore != null && weekAfter === weekBefore + 1,
    `two taps advanced exactly one week (${weekBefore} to ${weekAfter})`)
  const played = await page.evaluate(`(() => {
    const g = ${REACH_GAME}
    return g && g.mgr ? g.mgr.m : null
  })()`)
  check(played === 1, `and the manager's record shows one match played (${played})`)
  await shot('06-double-tap')
  // hand A4 the title screen it expects, with a save sitting behind it
  await page.evaluate(() => localStorage.removeItem('rm-where'))
  await page.goto('http://localhost:4177/')
  await page.waitForSelector('.continue-tile', { timeout: 15000 })

  // ---------- A4: a save that fails ----------
  console.log('A4 a failed save')
  await page.click('.continue-tile')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  // break IndexedDB under the store's feet, which is what a full disk does
  await page.evaluate(() => {
    window.__realOpen = indexedDB.open.bind(indexedDB)
    indexedDB.open = () => {
      const req = { onerror: null, onsuccess: null, onupgradeneeded: null, error: new Error('QuotaExceededError: no room for this save') }
      setTimeout(() => req.onerror && req.onerror(), 0)
      return req
    }
  })
  // Save / Load's explicit save, not Continue: week one is a match week, so
  // Continue goes to the dressing room rather than writing a save, and this is
  // the second place a failed write used to disappear (Saves.doSave awaited
  // saveGame with no catch, so it showed neither a success nor an error).
  await page.click('.bottom-nav button[title="Manager"]')
  await page.waitForSelector('.submenu')
  await page.click('.submenu-item >> text=Save / Load Game')
  await page.waitForSelector('text=Save Slots', { timeout: 8000 })
  await page.click('button >> text=💾 Save >> nth=0')
  await page.waitForSelector('.save-warn', { timeout: 20000 })
  check(/Could not save/.test(await page.textContent('.card') ?? ''), 'and the Saves screen says so where you asked for the save')
  const warn = await page.textContent('.save-warn')
  check(/Save failed/.test(warn), 'a rejected write raises a banner instead of vanishing')
  check(/no room for this save/.test(warn), 'and the banner says why')
  await shot('05-save-failed')
  // and it clears itself the moment a write lands again
  await page.evaluate(() => { indexedDB.open = window.__realOpen })
  await page.click('.save-warn >> text=Try again')
  await page.waitForSelector('.save-warn', { state: 'detached', timeout: 10000 })
  check(true, 'and a successful write clears it')

  // ---------- A7: the sacked manager still has a game ----------
  //
  // Found by the five-season playthrough, which lost its job in season five and
  // then reported all ten Hub screens as broken. They were not: the rail swaps
  // the Hub button for Jobs when there is no club, which is right. But nothing
  // had ever LOOKED at that rail, so this does - because being sacked is a state
  // a five-season career reaches by itself, not an edge case.
  console.log('A7 the sacked manager still has a game')
  const sacked = await mutate(g => { g.unemployed = true })
  check(sacked === 'ok', `the manager can be put out of work for the test (${sacked})`)
  await page.click('.bottom-nav button[title="Home"]').catch(() => {})
  await page.waitForTimeout(300)
  check(await page.locator('.bottom-nav button[title="Hub"]').count() === 0,
    'the Hub button goes, because there is no squad behind it')
  check(await page.locator('.bottom-nav button[title="Jobs"]').count() === 1,
    'and a Jobs button takes its place')
  const homeInk = (await page.textContent('.content').catch(() => '')) ?? ''
  check(homeInk.trim().length > 12, `Home still says something with no club (${homeInk.trim().length} chars)`)
  check(!/NaN|undefined|\[object Object\]|Infinity/.test(homeInk),
    'and it says it without a NaN or an undefined in it')
  await page.click('.bottom-nav button[title="Jobs"]')
  await page.waitForTimeout(300)
  const jobInk = (await page.textContent('.content').catch(() => '')) ?? ''
  check(jobInk.trim().length > 12, `the Job Centre renders (${jobInk.trim().length} chars)`)
  for (const group of ['Manager', 'World']) {
    await page.click(`.bottom-nav button[title="${group}"]`).catch(() => {})
    const items = await page.locator('.submenu-item').count()
    check(items > 0, `${group} still opens with ${items} item(s) for a manager with no club`)
    // The sub-menu closes on a tap outside it, not on Escape. Aiming a real
    // click at the veil is unreliable because the panel covers most of it and
    // swallows the pointer, so fire the veil's own handler - the same one a tap
    // reaches. Left open, it eats the next click at the rail and the failure
    // surfaces three blocks later as an unrelated timeout.
    await page.evaluate(() => document.querySelector('.submenu-veil')?.click())
    await page.waitForTimeout(200)
  }
  await shot('07-unemployed')
  await mutate(g => { g.unemployed = false })
  await page.click('.bottom-nav button[title="Home"]').catch(() => {})
  await page.waitForTimeout(250)

  // ---------- A1: the crash screen ----------
  console.log('A1 the crash screen')
  // point the save at a club that does not exist: App reads club.players on the
  // next render, which is the exact shape of a real data-integrity crash
  const broke = await mutate(`g => { g.userClubId = 'no-such-club' }`)
  check(broke === 'ok', `the state can be corrupted for the test (${broke})`)
  await page.click('.bottom-nav button[title="Home"]')
  await page.waitForSelector('.crash', { timeout: 8000 })
  check(true, 'a render throw shows the crash screen, not a white rectangle')
  check(/save is safe/i.test(await page.textContent('.crash-box')), 'and it says the save is safe, because it is')
  check((await page.textContent('.crash-err')).trim().length > 0, 'and it shows the error so it can be reported')
  await shot('06-crash')
  await page.click('.crash-btns >> text=Back to the title screen')
  await page.waitForSelector('text=RUGBY', { timeout: 8000 })
  check(await page.locator('.crash').count() === 0, 'Back to the title screen escapes it without a reload')
  // the copy on disk was never corrupted, so Continue picks up where it left off
  await page.click('.continue-tile')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  check(await page.locator('.crash').count() === 0, 'and the save it left behind loads clean')
  await shot('07-recovered')

  // ---------- A8: opening the game asks, refreshing does not ----------
  //
  // User: "when loading up it no longer waits for me to select if I want a new
  // game, load a game or continue with previous."
  //
  // He was right, and it was a fix eating its own feature. A reload should not
  // cost a manager his place, so the app bookmarks the screen he was on. But it
  // honoured that bookmark on a COLD START too, which walked straight past the
  // title screen - past New Career, past Load Career, and past the Continue tile
  // that exists precisely to make this one tap.
  //
  // The two cases are told apart by sessionStorage, which survives a refresh of
  // the same tab and is empty on a fresh launch. So both halves get checked here,
  // because fixing one by breaking the other is how this arrived in the first
  // place.
  console.log('A8 opening the game asks, refreshing does not')
  // a refresh, with the tab's session marker in place: straight back in
  await page.reload()
  await page.waitForTimeout(2500)
  check(await page.locator('.bottom-nav').count() === 1,
    'a refresh resumes the career rather than asking again')
  check(await page.locator('.continue-tile').count() === 0,
    'and does not show the title screen')

  // a cold launch: same storage, same save, but no session marker
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.waitForTimeout(2500)
  check(await page.locator('.continue-tile').count() === 1,
    'opening the game cold stops on the title screen, with Continue offered')
  const titleInk = (await page.textContent('.title-screen').catch(() => '')) ?? ''
  check(/New Career/.test(titleInk), 'and New Career is on it')
  check(/Load Career/.test(titleInk), 'and Load Career is on it')
  check(await page.locator('.bottom-nav').count() === 0,
    'and it has NOT walked into the save on its own')
  // and Continue is genuinely one tap back in
  await page.click('.continue-tile')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  check(true, 'and Continue takes one tap to get back in')

  const unexpected = errors.filter(e => !EXPECTED.some(x => e.includes(x)))
  check(unexpected.length === 0, `no unexpected console errors (${unexpected.slice(0, 2).join(' | ') || 'none'})`)

  console.log(fails.length
    ? `\nRESILIENCE PROBE FAILED: ${fails.length}\n${fails.map(f => ' - ' + f).join('\n')}`
    : '\nRESILIENCE PROBE PASSED')
} catch (e) {
  console.error('RESILIENCE PROBE ERROR:', e)
  fails.push(String(e))
} finally {
  await shot('99-final').catch(() => {})
  await browser.close()
  server.stop()
}
process.exit(fails.length ? 1 : 0)
