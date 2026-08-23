// The two-accent contract.
//
// The colour system lives in src/ui/tokens.css: night (default) and day from
// one variable swap, semantic roles only, green = positive/actionable, gold =
// value/attention, red = loss/risk, key numbers neutral, hero gradient on the
// club header and matchday hero only. scripts/tokenlint.ts guarantees no hex
// escapes the token file; THIS probe guarantees the rendered page honours the
// meanings. Red on any tree before the token system: the anchors resolve to
// the old palette or to nothing at all.
//
// Run: node scripts/paletteqa.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4193', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

let fails = 0
const ok = (c, what) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const hex = (h) => {
  const n = h.replace('#', '')
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`
}

const readTokens = (page) => page.evaluate(() => {
  const el = document.querySelector('.app') ?? document.documentElement
  const cs = getComputedStyle(el)
  const get = (t) => cs.getPropertyValue(t).trim()
  return {
    night: el.classList?.contains('night') ?? false,
    canvas: get('--canvas'), s1: get('--surface-1'), border: get('--border'),
    tp: get('--text-primary'), ts: get('--text-secondary'), tm: get('--text-muted'),
    primary: get('--primary'), gold: get('--gold'), danger: get('--danger'),
    positive: get('--text-positive'), hero: get('--hero-gradient'),
  }
})

try {
  // ---- NIGHT IS THE DEFAULT: no localStorage at all ----
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await page.goto('http://localhost:4193/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  const t = await readTokens(page)
  ok(t.night, 'a fresh install opens under the floodlights (night default)')
  ok(t.canvas === '#1a201e', `night canvas #1a201e (saw ${t.canvas})`)
  ok(t.s1 === '#242b29', `night surface-1 #242b29 (saw ${t.s1})`)
  ok(t.border === '#333c3a', `night border #333c3a (saw ${t.border})`)
  ok(t.tp === '#f0f4f2' && t.ts === '#b3bdb9' && t.tm === '#8b958f',
    `chalk text ramp resolves (saw ${t.tp}/${t.ts}/${t.tm})`)
  ok(t.primary === '#34c06f' && t.gold === '#e9be68' && t.danger === '#ef6c63',
    `the three signals resolve: green ${t.primary}, gold ${t.gold}, red ${t.danger}`)
  ok(t.positive === '#34c06f', 'the --text-positive alias follows --primary through the mode')
  ok(t.hero.includes('#16523a') && t.hero.includes('#1e8c4e'), 'night hero gradient is the deep green pair')

  // ---- into a save: the applied rules ----
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Palette QA')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.masthead', { timeout: 20000 })
  await page.waitForTimeout(600)

  const chrome = await page.evaluate(() => {
    const bg = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      return { image: cs.backgroundImage, color: cs.backgroundColor, ink: cs.color }
    }
    const filledPrimary = [...document.querySelectorAll('button')].filter(b => {
      const c = getComputedStyle(b).backgroundColor
      return c === 'rgb(52, 192, 111)'
    })
    const board = [...document.querySelectorAll('.hub-widget')].find(w => w.textContent.includes('confidence'))
    return {
      masthead: bg('.masthead'), nav: bg('.bottom-nav'), continueBtn: bg('.continue-btn'),
      filledPrimaryCount: filledPrimary.length,
      boardNumber: board ? getComputedStyle(board.querySelector('b')).color : null,
    }
  })
  ok(!!chrome.masthead && chrome.masthead.image.includes('22, 82, 58'),
    'the club header wears the hero gradient')
  ok(!!chrome.nav && !chrome.nav.image.includes('22, 82, 58') && !chrome.nav.image.includes('52, 192, 111'),
    'the bottom nav does not - the gradient is rationed to its two homes')
  ok(!!chrome.continueBtn && chrome.continueBtn.color === hex('34c06f') && chrome.continueBtn.ink === hex('070d0a'),
    'Continue is the filled primary action, on-primary ink')
  ok(chrome.filledPrimaryCount <= 1,
    `at most one filled-primary button in the view (saw ${chrome.filledPrimaryCount})`)
  ok(chrome.boardNumber === hex('f0f4f2'),
    `a key number renders in text-primary, not green (saw ${chrome.boardNumber})`)

  const nav = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.bottom-nav button')]
    const active = btns.find(b => b.classList.contains('active'))
    const idle = btns.find(b => !b.classList.contains('active'))
    return { active: active && getComputedStyle(active).color, idle: idle && getComputedStyle(idle).color }
  })
  ok(nav.active === hex('34c06f'), `the selected nav icon is primary (saw ${nav.active})`)
  ok(nav.idle === hex('8b958f'), `a resting nav icon is muted, not coloured (saw ${nav.idle})`)
  await page.close()

  // ---- DAY: the same names, the other values ----
  const day = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await day.addInitScript(() => localStorage.setItem('rm-night', '0'))
  await day.goto('http://localhost:4193/')
  await day.waitForSelector('text=RUGBY', { timeout: 15000 })
  const d = await readTokens(day)
  ok(!d.night, 'rm-night=0 turns the daylight on')
  ok(d.canvas === '#f1f4f1' && d.s1 === '#ffffff', `day surfaces resolve (saw ${d.canvas}/${d.s1})`)
  ok(d.primary === '#0f7a43' && d.gold === '#8a6516' && d.danger === '#c0362c',
    `day signals resolve: green ${d.primary}, gold ${d.gold}, red ${d.danger}`)
  ok(d.positive === '#0f7a43', 'the alias follows the mode: --text-positive is the day green')
  await day.close()

  console.log(fails ? `PALETTE QA FAILED (${fails})` : 'PALETTE QA PASSED: two accents, both modes, meanings held')
  process.exitCode = fails ? 1 : 0
} catch (e) {
  console.error('PALETTE QA FAILED:', String(e).slice(0, 400))
  process.exitCode = 1
} finally {
  await browser.close()
  server.stop()
}
