// Probe: every rewarded-advert button is gold and black and says "(Free with ad)".
//
// Owner, 1.8.9, from the Player Profile on Android: "Ask the agency should be
// gold and black like the store. (Free with ad) should be the actual wording."
// RewardedButton (components.tsx) is the one component behind every such
// button, so this opens one of them, the agency's file on another club's
// player, and reads it under the night theme, the day theme and a skin in
// each: the label ends "(Free with ad)", the fill is the theme's --gold-fill,
// the ink is --on-gold-fill, and the two clear 4.5:1. The six locales' labels
// are read straight from the dictionaries.
//
// Run: node scripts/spotadui.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync, readFileSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// ---- the words, in every language ----
const SUFFIX = { en: '(Free with ad)', fr: '(gratuit avec une pub)', es: '(gratis con un anuncio)', it: '(gratis con una pubblicità)', af: "(gratis met 'n advertensie)", ja: '（広告視聴で無料）' }
const KEYS = ['watchAgency', 'watchInside', 'watchOpinion', 'watchTapeRoom', 'watchTeamNight', 'watchTown', 'physioCut']
for (const [lang, suf] of Object.entries(SUFFIX)) {
  const till = JSON.parse(readFileSync(`src/locales/${lang}.json`, 'utf8')).till
  const labels = [...KEYS.map(k => till[k]), ...['watchAnalyst', 'watchAnalyst_w'].flatMap(k => till[k] ? Object.values(till[k]) : [])]
  const bad = labels.filter(s => typeof s !== 'string' || !s.endsWith(suf))
  ok(bad.length === 0, `${lang}: every rewarded label ends "${suf}"${bad.length ? ` (not: ${bad.join(' | ')})` : ''}`)
}

const server = await startPreview('4241', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: 'en-GB' })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', e => errors.push(String(e.message ?? e)))
await page.addInitScript(() => {
  localStorage.setItem('rm-night', '1')
  // a provider that exists, or no rewarded button renders at all
  globalThis.rmAds = { mount() {}, unmount() {}, showRewarded: async () => 'completed' }
})

const lum = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

try {
  await page.goto('http://localhost:4241/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Spot Probe')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // another club's man, opened the way the market opens him
  await page.evaluate(() => {
    const s = window.rugbyStore.getState()
    const g = s.game
    const p = Object.values(g.players).find(x => x.clubId && x.clubId !== g.userClubId && !x.onLoan)
    s.go('player', p.id)
  })
  await page.waitForSelector('.spot-ad', { timeout: 8000 })

  const read = () => page.evaluate(() => {
    const b = document.querySelector('.spot-ad')
    const cs = getComputedStyle(b)
    const app = getComputedStyle(document.querySelector('.app'))
    // resolve the two tokens to rgb the same way the button does
    const probe = document.createElement('span')
    document.querySelector('.app').appendChild(probe)
    probe.style.color = 'var(--gold-fill)'; const fill = getComputedStyle(probe).color
    probe.style.color = 'var(--on-gold-fill)'; const ink = getComputedStyle(probe).color
    probe.remove()
    return { text: b.textContent, bg: cs.backgroundColor, fg: cs.color, fill, ink, cls: document.querySelector('.app').className, h: b.getBoundingClientRect().height, _: app.colorScheme }
  })
  const check = async (name) => {
    const r = await read()
    ok(r.bg === r.fill && r.fg === r.ink, `${name}: gold fill, near-black ink (${r.bg} / ${r.fg})`)
    const c = ratio(r.fg, r.bg)
    ok(c >= 4.5, `${name}: ink on gold is ${c.toFixed(2)}:1`)
    return r
  }
  const night = await check('night')
  ok(/\(Free with ad\)$/.test(night.text), `it reads "${night.text}"`)
  ok(night.h >= 44, `and is a full-size target (${Math.round(night.h)}px)`)

  const setApp = (add, remove) => page.evaluate(([a, r]) => { const el = document.querySelector('.app'); r.forEach(x => el.classList.remove(x)); a.forEach(x => el.classList.add(x)) }, [add, remove])
  await setApp(['day'], ['night']); await page.waitForTimeout(100)
  await check('day')
  for (const skin of ['midnight', 'heritage', 'stealth']) {
    await setApp([`skin-${skin}`], ['day']); await setApp(['night'], []); await page.waitForTimeout(80)
    await check(`${skin} (night)`)
    await setApp(['day'], ['night']); await page.waitForTimeout(80)
    await check(`${skin} (day)`)
    await setApp([], [`skin-${skin}`, 'day']); await setApp(['night'], [])
  }
} catch (e) {
  ok(false, `walk broke: ${String(e.message ?? e).split('\n')[0]}`)
}
if (errors.length) ok(false, `page errors: ${[...new Set(errors)].join(' | ').slice(0, 200)}`)
await browser.close()
await server.stop?.()
say(fails ? `\nSPOT AD UI FAILED (${fails})` : '\nSPOT AD UI PASSED: every rewarded button is gold and black and says Free with ad')
done(fails)
