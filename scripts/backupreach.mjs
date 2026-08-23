// Probe: a career can actually be got off the phone it lives on.
//
// This is the one that matters most and is tested least. Careers live in this
// device's IndexedDB and nowhere else: no account, no cloud, nothing to restore
// from. WebKit clears the storage of a site it has not seen for about a week
// unless the game is installed to the home screen, and every phone eventually
// gets dropped, wiped or replaced. The whole insurance policy is one button.
//
// Two buttons, now. Export writes a file into Downloads - which is on the same
// device as the career it is meant to protect - and Send a copy hands it to the
// phone's own share sheet, which is where a cloud drive, a chat with yourself or
// an e-mail lives. So this checks both, and checks that the file handed over is
// a real save rather than an empty promise.
//
// Run: node scripts/backupreach.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4211', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

const startCareer = async (page) => {
  await page.goto('http://localhost:4211/')
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')
}

const openSaves = async (page) => {
  await page.click('.bottom-nav button[title="Manager"]')
  await page.click('.submenu-item >> text=Save / Load Game')
  await page.waitForSelector('text=Save Slots')
}

try {
  // ---- 1. a phone: the share sheet is there, and it gets a real save -------
  say('--- 1. a phone that can share files')
  {
    const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
    page.setDefaultTimeout(9000)
    // stand in for the OS share sheet, and record what it was handed. This is
    // the only way to see the file: a real sheet is native UI that Playwright
    // cannot open, and the thing worth testing is what we PASS to it.
    await page.addInitScript(() => {
      localStorage.setItem('rm-night', '1')
      globalThis.__shared = null
      navigator.canShare = (d) => !!d?.files?.length
      navigator.share = async (d) => {
        const f = d.files[0]
        globalThis.__shared = { name: f.name, type: f.type, text: await f.text() }
      }
    })
    await startCareer(page)
    await openSaves(page)

    const share = page.locator('.btn.gold', { hasText: 'Send a copy' })
    ok(await share.count() === 1, 'the Saves screen offers Send a copy')
    await share.click()
    await page.waitForTimeout(500)

    const shared = await page.evaluate(() => globalThis.__shared)
    ok(!!shared, 'the share sheet was handed something')
    if (shared) {
      ok(/^phase-rugby-.*\.json$/.test(shared.name), `the file is named for the career (${shared.name})`)
      ok(shared.name.includes('s1w'), 'and carries the season and week, so two backups never collide')
      ok(shared.type === 'application/json', 'with a type the receiving app will understand')
      let save = null
      try { save = JSON.parse(shared.text) } catch { /* reported below */ }
      ok(!!save, 'and the contents parse as JSON')
      if (save) {
        ok(!!save.clubs && !!save.players && !!save.userClubId && save.week != null,
          'and it is a real save, not an empty object')
        ok(Object.keys(save.players).length > 500,
          `with the whole world in it (${Object.keys(save.players ?? {}).length} players)`)
        // the import path checks exactly these four fields, so a file that
        // passes here is a file the game will take back
        ok(save.managerName === 'Gaffer', 'and it is THIS career, not a fresh one')
      }
    }
    ok(await page.locator('.card .meta', { hasText: /Copy sent/i }).count() > 0,
      'and the screen says so afterwards')
    await page.close()
  }

  // ---- 2. a browser that cannot share files: no dead button ---------------
  say('\n--- 2. a browser with no file sharing')
  {
    const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
    page.setDefaultTimeout(9000)
    await page.addInitScript(() => {
      localStorage.setItem('rm-night', '1')
      // what a desktop browser looks like: share exists, files are refused
      navigator.canShare = () => false
    })
    await startCareer(page)
    await openSaves(page)
    ok(await page.locator('.btn.gold', { hasText: 'Send a copy' }).count() === 0,
      'no share button is offered where the browser cannot take a file')
    ok(await page.locator('.btn', { hasText: 'Export Career' }).count() === 1,
      'and Export is still there, which is the fallback that always works')

    // and Export really produces a file
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      page.locator('.btn', { hasText: 'Export Career' }).click(),
    ])
    ok(!!download, 'Export writes a file to the device')
    if (download) ok(/^phase-rugby-.*\.json$/.test(download.suggestedFilename()),
      `named for the career (${download.suggestedFilename()})`)
    await page.close()
  }

  // ---- 3. a cancelled share is not a failure -----------------------------
  say('\n--- 3. the player backs out of the share sheet')
  {
    const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
    page.setDefaultTimeout(9000)
    await page.addInitScript(() => {
      localStorage.setItem('rm-night', '1')
      navigator.canShare = (d) => !!d?.files?.length
      navigator.share = async () => { const e = new Error('cancelled'); e.name = 'AbortError'; throw e }
    })
    await startCareer(page)
    await openSaves(page)
    await page.locator('.btn.gold', { hasText: 'Send a copy' }).click()
    await page.waitForTimeout(400)
    ok(await page.locator('.card .meta', { hasText: /did not go anywhere/i }).count() === 0,
      'backing out of the sheet is not reported as a failure')
    await page.close()
  }
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nBACKUP REACH FAILED (${fails})` : '\nBACKUP REACH PASSED: the career can leave the phone, and what leaves is the career')
done(fails)
