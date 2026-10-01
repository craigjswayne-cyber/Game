// Browser probe: the screens that lost their emoji draw icons, not blobs.
//
// emojiprobe.ts reads the source. This reads the SCREEN, because an emoji can
// reach it by a road the source scan does not follow: a stored English subject
// in an old save, an icon field holding a name the glyph table lacks (which
// draws nothing and leaves a gap), a value interpolated into a sentence. The
// owner's words, 27 Sep 2026: "across the game can we use icons instead of
// emojis. Feels like it cheapens the game."
//
// It walks the screens the icon pass touched at the owner's phone size, with
// the store attached so the Supporter page has a door, and on each one checks
// that the visible text carries no pictographic emoji (flag emoji included
// since 1.8.2, as in emojiprobe: flags are drawn by src/ui/flags.tsx) and
// that every drawn glyph has a size. Screenshots land in $SHOTS (default
// /tmp/iconshots) to be looked at, not just counted.
//
// Run: npm run build && node scripts/iconshots.mjs
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync, writeSync } from 'node:fs'
import { startPreview, done } from './lib/preview.mjs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const OUT = process.env.SHOTS ?? '/tmp/iconshots'
mkdirSync(OUT, { recursive: true })

// the same definition as emojiprobe.ts: the pictographs, flag emoji included
const PICTO = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{2604}\u{2607}-\u{2712}\u{2714}\u{2716}\u{2718}-\u{27BF}\u{2B50}\u{2B55}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}]|.\u{FE0F}/gu
const emojiIn = (s) => [...s.matchAll(PICTO)].map(m => m[0])

// ---- TEMPORARY EXCEPTIONS (the same namespaces as emojiprobe.ts) ----
// Strings in these namespaces belong to tasks running alongside the icon pass
// and lose their emoji when those merge. Rendered text that matches one of
// their English strings is set aside before the check; the lead empties this
// list with emojiprobe's.
const TEMP_NAMESPACES = ['comm', 'hl', 'finances', 'press', 'tacticsScreen', 'training', 'report', 'mentoring', 'till']
const EN = JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url), 'utf8'))
const excused = []
const collect = (v) => {
  if (typeof v === 'string') { if (emojiIn(v).length) excused.push(new RegExp(v.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.*?'), 'gu')) }
  else if (v && typeof v === 'object') Object.values(v).forEach(collect)
}
TEMP_NAMESPACES.forEach(ns => collect(EN[ns]))
const excuse = (text) => excused.reduce((t, re) => t.replace(re, ''), text)
// ---- END TEMPORARY EXCEPTIONS ----

const PORT = 4266
const server = await startPreview(String(PORT), 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

async function walk(width, night) {
  const page = await browser.newPage({ viewport: { width, height: 915 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  await page.addInitScript((n) => localStorage.setItem('rm-night', n ? '1' : '0'), night)
  // a store, as a packaged build has one, so the Supporter page opens
  await page.addInitScript(() => {
    globalThis.rmBilling = {
      details: async (sku) => ({ sku, price: '£2.99' }),
      buy: async () => 'owned', reason: () => null, owned: async () => [], consume: async () => {},
    }
  })
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  if (width === 412 && night) await page.screenshot({ path: `${OUT}/newgame-club.png` })
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // give every marker something to mark: an injury, a listed man at another
  // club, a promise, the two stamps, a building site, a restless crowd, and an
  // old-save story with an emoji still at the front of its English
  const ids = await page.evaluate(() => {
    const st = window.rugbyStore.getState(); const g = st.game
    const mine = Object.values(g.players).filter(p => p.clubId === g.userClubId)
    mine[1].injury = { until: g.week + 3, desc: 'hamstring' }
    mine[2].status = 'key'
    // the market's first page is the best players, so mark those
    const theirs = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId).sort((a, b) => b.ca - a.ca)
    theirs.slice(0, 3).forEach(p => { p.transferListed = true })
    theirs[3].injury = { until: g.week + 2, desc: 'ankle' }
    g.licensed = true; g.uncapped = true
    g.fanMood = 50
    g.news.unshift({ id: g.nextId++, week: g.week, season: g.season, type: 'award', read: false,
      subject: '🏆 CHAMPIONS! An old save\'s story', body: '✅ filed before the icon pass' })
    st.touch()
    return { mine: mine[0].id, inj: mine[1].id, theirs: theirs[0].id }
  })

  const tag = `${width}${night ? '' : '-light'}`
  const check = async (name, before) => {
    if (before) await before()
    await page.waitForTimeout(450)
    const text = await page.locator('#root').innerText()
    const hit = emojiIn(excuse(text))
    ok(hit.length === 0, `${name} @${tag}: no emoji on screen${hit.length ? ` (found ${hit.join(' ')})` : ''}`)
    // a glyph with no box is a name the table lacks: it draws nothing
    const empty = await page.evaluate(() => [...document.querySelectorAll('svg.glyph')]
      .filter(s => { const r = s.getBoundingClientRect(); return s.childElementCount === 0 || (r.width === 0 && s.checkVisibility?.()) }).length)
    ok(empty === 0, `${name} @${tag}: every glyph draws (${empty} empty)`)
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: false })
  }
  // the screen scrolls inside the app shell, not the window
  const down = (px) => page.evaluate((n) => {
    const els = [...document.querySelectorAll('*')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight)
    els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]?.scrollBy(0, n)
  }, px)
  const go = async (screen, param) => { await page.evaluate(([s, p]) => window.rugbyStore.getState().go(s, p), [screen, param]); await page.waitForTimeout(150); await down(-99999) }

  await check('home', () => go('home'))
  await check('home-lower', () => down(700))
  await check('inbox', () => go('inbox'))
  await check('profile', () => go('profile'))
  await check('profile-lower', () => down(900))
  await check('infra', () => go('infra'))
  await check('infra-list', () => down(900))
  await check('supporter', () => go('supporter'))
  await check('squad-general', async () => { await go('squad'); await page.waitForTimeout(300); await page.click('.tab-bar >> text=General') })
  await check('squad-gametime', async () => {
    await page.click('.tab-bar >> text=Game Time')
    await page.waitForTimeout(200)
  })
  await check('transfers', () => go('transfers'))
  await check('transfers-contract', () => page.locator('select:has(option[value="contract"])').selectOption('contract'))
  await check('player', () => go('player', ids.mine))
  await check('player-theirs', () => go('player', ids.theirs))
  await check('settings', () => go('settings'))
  await check('settings-lower', () => down(1400))
  await check('annual', () => go('annual'))
  await check('legacy', () => go('legacy'))
  await check('dayroom', () => go('day'))
  await check('academy', () => go('academy'))
  await check('seasonreview', () => go('seasonreview'))
  await check('celebration', async () => {
    await page.evaluate(() => { const st = window.rugbyStore.getState(); st.game.celebration = { headline: 'CHAMPIONS', sub: 'Probe', icon: 'trophy' }; st.touch() })
  })
  await page.close()
}

try {
  await walk(412, true)
  await walk(412, false)
  await walk(360, true)
} catch (e) {
  fails++
  say(`FAIL  the walk broke: ${e.message.split('\n')[0]}`)
}
await browser.close()
server.stop()
say(fails ? `ICON SHOTS FAILED (${fails})` : `ICON SHOTS PASSED: icons, not emoji, on every screen walked (shots in ${OUT})`)
done(fails)
