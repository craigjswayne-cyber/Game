// ---- EXPORT IN THE STORE SHELL (1.8.18) ----
//
// The store builds run inside a Capacitor WebView, which has no download
// handler: Export made a blob link, clicked it, nothing happened, and the
// screen said "Career exported - keep the file safe". The share button was
// hidden there too. This plays the shell: a page with Capacitor's Filesystem
// and Share plugins faked, and checks
//
//   - both buttons are offered, and both write the WHOLE save and open the sheet
//   - the file that was written reads back as the career that was exported
//   - "exported" is never said for a file that was not written
//   - a player backing out of the sheet is not told anything went wrong
//   - in a plain browser the old paths are untouched
//
// Run: node scripts/exportui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const PORT = '4293'
const server = await startPreview(PORT, 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/** mode: 'ok' writes and shares; 'cancel' writes, the player backs out;
 *  'nowrite' fails the write; null is a plain browser with no shell */
async function phone(mode) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, locale: 'en-GB' })
  await ctx.addInitScript((mode) => {
    localStorage.setItem('rm-night', '1')
    if (!mode) return
    globalThis.__files = {}
    globalThis.__shared = []
    const Filesystem = {
      writeFile: async ({ path, data }) => {
        if (mode === 'nowrite') throw new Error('disk full')
        globalThis.__writes = (globalThis.__writes ?? 0) + 1
        if (mode === 'slow') await new Promise(r => setTimeout(r, 600))
        globalThis.__files[path] = data
        return { uri: 'file:///cache/' + path }
      },
      appendFile: async ({ path, data }) => { globalThis.__files[path] += data },
    }
    const Share = {
      share: async (o) => {
        if (mode === 'cancel') throw new Error('Share canceled')
        globalThis.__shared.push(o)
        return {}
      },
    }
    globalThis.Capacitor = { Plugins: { Filesystem, Share }, isNativePlatform: () => true }
  }, mode)
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=New Career')
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.locator('.tut-box').or(page.locator('.bottom-nav')).first().waitFor()
  if (await page.locator('.tut-box').count()) await page.click('.tut-close .btn')
  await page.evaluate(() => window.rugbyStore.getState().go('saves'))
  await page.waitForSelector('text=Export Career')
  return { ctx, page, errs }
}

// the status line under "Autosave is on": the second .meta in the first card
const msg = (page) => page.locator('.card').first().locator('.meta').nth(1).innerText({ timeout: 1500 }).catch(() => '')

try {
  say('--- the shell: Export')
  {
    const { ctx, page, errs } = await phone('ok')
    ok(await page.locator('button', { hasText: 'Send a copy' }).count() === 1, 'Send a copy is offered in the shell')
    await page.click('button:has-text("Export Career")')
    await page.waitForTimeout(800)
    const r = await page.evaluate(() => ({ files: globalThis.__files, shared: globalThis.__shared, uid: window.rugbyStore.getState().game.userClubId, week: window.rugbyStore.getState().game.week }))
    const names = Object.keys(r.files)
    ok(names.length === 1 && /^phase-rugby-.*\.json$/.test(names[0]), `one save file written (${names[0]})`)
    const text = r.files[names[0]] ?? ''
    ok(text.length > 1_000_000, `the whole career went in, in pieces if need be (${(text.length / 1e6).toFixed(1)} MB)`)
    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* checked below */ }
    ok(parsed?.userClubId === r.uid && parsed?.week === r.week, 'and it reads back as the career on screen')
    ok(r.shared.length === 1 && r.shared[0].files?.[0] === 'file:///cache/' + names[0], 'the share sheet was opened on that file')
    ok(/Copy sent/.test(await msg(page)), 'and only then does the screen say it went')
    ok(errs.length === 0, 'no page errors')
    await ctx.close()
  }

  say('--- the shell: two quick taps')
  {
    const { ctx, page } = await phone('slow')
    await page.click('button:has-text("Export Career")')
    await page.click('button:has-text("Send a copy")', { force: true }).catch(() => {})
    await page.waitForTimeout(1800)
    const r = await page.evaluate(() => ({ writes: globalThis.__writes, shared: globalThis.__shared.length }))
    ok(r.writes === 1 && r.shared === 1, `a second tap while writing starts no second file (${r.writes} write, ${r.shared} share)`)
    await ctx.close()
  }

  say('--- the shell: the player backs out')
  {
    const { ctx, page } = await phone('cancel')
    const before = await msg(page)
    await page.click('button:has-text("Send a copy")')
    await page.waitForTimeout(800)
    const after = await msg(page)
    ok(after === before, 'backing out of the sheet says nothing at all')
    await ctx.close()
  }

  say('--- the shell: the write fails')
  {
    const { ctx, page } = await phone('nowrite')
    await page.click('button:has-text("Export Career")')
    await page.waitForTimeout(800)
    const m = await msg(page)
    ok(!/exported - keep the file safe/i.test(m), 'never "exported" for a file that was not written')
    ok(/could not be written/i.test(m), `the player is told it did not happen ("${m.slice(0, 60)}")`)
    await ctx.close()
  }

  say('--- a plain browser: the old paths stand')
  {
    const { ctx, page } = await phone(null)
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.click('button:has-text("Export Career")'),
    ])
    ok(!!dl && /\.json$/.test(dl.suggestedFilename()), 'Export still downloads a file in a browser')
    await ctx.close()
  }
} catch (e) {
  say('FAIL  threw: ' + String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
  fails++
}

await browser.close()
say(fails ? `EXPORT UI FAILED (${fails})` : 'EXPORT UI PASSED: in the shell a backup really leaves the phone, and nothing is called exported that was not')
done(fails)
