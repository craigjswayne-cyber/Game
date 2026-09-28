// A quick look at one screen for the UI QA sweep (see scripts/uiqa.mjs): keeps
// a career in a persistent browser profile so each look is a reload, not a new
// career. First run (or --fresh) starts one and plays a few weeks.
//
// Run: node scripts/uiqa-peek.mjs <outDir> <WxH> <night|day> <screen[:param]> [tabIndex] [js-to-eval]
import { chromium } from 'playwright-core'
import { mkdirSync, existsSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'

const [out, size = '412x915', theme = 'night', target = 'home', tab = '', js = ''] = process.argv.slice(2)
const [w, h] = size.split('x').map(Number)
const PROFILE = process.env.UIQA_PROFILE ?? '/tmp/uiqa-profile'
const fresh = !existsSync(PROFILE) || process.argv.includes('--fresh')
mkdirSync(out, { recursive: true })
const server = await startPreview('4393', 2200)
const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: '/opt/pw-browsers/chromium', viewport: { width: w, height: h } })
const page = ctx.pages()[0] ?? await ctx.newPage()
page.on('pageerror', e => console.log('pageerror', e.message))
try {
  await page.evaluate?.(() => {})
  await page.goto('http://localhost:4393/')
  await page.waitForTimeout(1500)
  const hasSave = await page.evaluate(async () => !!(await window.rugbyStore?.getState().resume?.()))
  if (fresh || !hasSave) {
    await page.evaluate(() => { localStorage.setItem('rm-lang', 'en'); localStorage.setItem('rm-intro', '0') })
    await page.goto('http://localhost:4393/')
    await page.waitForSelector('text=New Career', { timeout: 15000 })
    await page.click('text=New Career'); await page.click('text=English Premier Division')
    await page.waitForSelector('.club-tile'); await page.click('.tile >> text=Northampton')
    await page.waitForSelector('text=Star Player'); await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Sam Carter'); await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm'); await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 }); await page.click('.tut-close .btn')
    await page.evaluate(async () => {
      const S = window.rugbyStore; const start = S.getState().game.week
      for (let g = 0; g < 3000; g++) {
        const st = S.getState()
        if (st.game.week - start >= 8 && !st.liveMatch) break
        for (const o of st.game.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
        for (const n of st.game.news) n.read = true
        S.setState({ lastAdvanceAt: 0, wireQueue: [] })
        const screen = st.nav[st.nav.length - 1]?.screen
        if (st.liveMatch || screen === 'matchday') st.instantResult(); else st.continueWeek()
        await new Promise(r => setTimeout(r, 5))
      }
      await S.getState().persistNow()
    })
  }
  const night = theme === 'night'
  await page.evaluate(n => { const S = window.rugbyStore; if (S.getState().night !== n) S.getState().toggleNight() }, night)
  const [screen, param] = target.split(':')
  await page.evaluate(([s, p]) => { const S = window.rugbyStore; S.setState({ nav: [{ screen: 'home' }] }); if (s !== 'home') S.getState().go(s, p === undefined ? undefined : (isNaN(Number(p)) ? p : Number(p))) }, [screen, param])
  await page.waitForTimeout(500)
  if (tab) { await page.locator('.content .tab-bar button').nth(Number(tab)).click(); await page.waitForTimeout(300) }
  if (js) console.log(JSON.stringify(await page.evaluate(js), null, 1))
  const name = `${out}/${size}-${theme}-${target.replace(/[:/]/g, '_')}${tab ? '-t' + tab : ''}.png`
  await page.screenshot({ path: name })
  console.log(name)
} finally {
  await ctx.close(); server.stop()
}
process.exit(0)
