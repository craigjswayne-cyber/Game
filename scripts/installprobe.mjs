// Probe: the career-durability cue appears where it matters and nowhere else.
//
// The bug this guards against is not a crash, it is a lost career. WebKit caps
// script-writable storage for a site it has not seen in about a week, a save
// lives in IndexedDB, and one of this game's two regular players is on an
// iPhone. So the cue has to reach an iPhone in a browser tab. It also has to
// stay away from a phone where the game is already installed, because a warning
// about a problem you do not have is the fastest way to teach someone to ignore
// warnings.
//
// Four states, and the difference between them is browser detection rather than
// game state, which is exactly the kind of thing that gets written once and
// never checked again.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

const server = await startPreview('4193', 3000)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/**
 * Start a career and report what the cue is doing.
 *
 * @param {{ua?: string, standalone?: boolean, offerInstall?: boolean}} opts
 */
async function run(label, opts) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 780 },
    userAgent: opts.ua,
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  await page.addInitScript(([standalone, offer]) => {
    localStorage.setItem('rm-night', '1')
    if (standalone) Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
    // Chromium in a headless container never fires beforeinstallprompt (no
    // manifest install criteria), so the one-tap path has to be handed in.
    if (offer) {
      setTimeout(() => {
        const e = new Event('beforeinstallprompt')
        e.prompt = () => Promise.resolve()
        e.userChoice = Promise.resolve({ outcome: 'dismissed' })
        window.dispatchEvent(e)
      }, 40)
    }
  }, [!!opts.standalone, !!opts.offerInstall])

  await page.goto('http://localhost:4193/')
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Bath')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Install Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box')
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')
  await page.waitForTimeout(300)

  const state = await page.evaluate(() => {
    const cue = document.querySelector('.install-cue')
    return {
      shown: !!cue,
      text: cue ? (cue.textContent ?? '').replace(/\s+/g, ' ').trim() : '',
      buttons: cue ? [...cue.querySelectorAll('button')].map(b => b.textContent.trim()) : [],
    }
  })
  say(`\n${label}: cue ${state.shown ? 'SHOWN' : 'hidden'}${state.buttons.length ? ' · ' + state.buttons.join(' / ') : ''}`)
  return { page, ctx, ...state }
}

try {
  // 1. an iPhone in a Safari tab: the case that can actually lose a career
  {
    const r = await run('iPhone, Safari tab', { ua: IPHONE })
    ok(r.shown, 'the cue reaches an iPhone in a browser tab')
    ok(/Add to Home Screen/i.test(r.text), 'and gives the real Safari route rather than a button iOS cannot honour')
    ok(!r.buttons.some(b => /Install/i.test(b)), 'no Install button on iOS, where no such prompt exists')
    ok(r.buttons.some(b => /Export/i.test(b)), 'and it points at the export either way')

    // waved away, and it stays away for this browser
    await r.page.click('.install-cue >> text=Not now')
    await r.page.waitForTimeout(150)
    ok(await r.page.locator('.install-cue').count() === 0, 'Not now clears it')
    await r.page.reload()
    await r.page.waitForSelector('.bottom-nav')
    await r.page.waitForTimeout(300)
    ok(await r.page.locator('.install-cue').count() === 0, 'and it is still gone after a reload')
    await r.ctx.close()
  }

  // 2. the same iPhone, but the game is already on the home screen
  {
    const r = await run('iPhone, installed', { ua: IPHONE, standalone: true })
    ok(!r.shown, 'an installed app is never warned about a problem it does not have')
    await r.ctx.close()
  }

  // 3. Android with no install offer yet: nothing to say, so say nothing
  {
    const r = await run('Android, no prompt offered', { ua: ANDROID })
    ok(!r.shown, 'no cue on Android until the browser actually offers an install')
    await r.ctx.close()
  }

  // 4. Android once the browser offers one: the one-tap route
  {
    const r = await run('Android, prompt held', { ua: ANDROID, offerInstall: true })
    ok(r.shown, 'the held prompt brings the cue in, even though the screen had already rendered')
    ok(r.buttons.some(b => /Install/i.test(b)), 'and Android gets the one-tap Install button')
    await r.ctx.close()
  }
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nINSTALL PROBE FAILED (${fails})` : '\nINSTALL PROBE PASSED: the warning finds the phone that needs it')
done(fails)
