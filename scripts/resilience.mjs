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
//
// A 390px-tall viewport on purpose: that is the shape the user holds, and it is
// where the tutorial overflow bit.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const SHOTS = process.env.SHOTS_DIR || 'shots'
mkdirSync(SHOTS, { recursive: true })

const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))

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
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
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
  const set = await mutate(`g => { g.celebration = { headline: 'CHAMPIONS OF ENGLAND', sub: 'Gallagher Premiership winners', icon: '🏆' } }`)
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

  // ---------- A3: the portrait wall ----------
  console.log('A3 the portrait wall')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForSelector('.rotate-veil', { state: 'visible', timeout: 5000 })
  check(true, 'portrait raises the rotate nudge')
  await shot('03-portrait')
  check(await page.evaluate(() => {
    const r = document.querySelector('.rotate-veil').getBoundingClientRect()
    return r.width >= window.innerWidth && r.height >= window.innerHeight
  }), 'and it covers the whole screen, which is why it needs a way out')
  await page.click('.rotate-veil >> text=Play anyway')
  await page.waitForSelector('.rotate-veil', { state: 'detached', timeout: 5000 })
  check(true, 'Play anyway dismisses it')
  await page.click('.bottom-nav button[title="Squad"]')
  await page.waitForSelector('.dtable', { timeout: 8000 })
  check(true, 'and the game underneath answers taps in portrait')
  await shot('04-portrait-playing')
  await page.reload()
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  check(await page.locator('.rotate-veil').count() === 0, 'and the choice survives a reload, so it is not a toll gate')
  await page.setViewportSize({ width: 844, height: 390 })

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
  server.kill()
}
process.exit(fails.length ? 1 : 0)
