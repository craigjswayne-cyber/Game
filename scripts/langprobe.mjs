// Probe: the language picker is where it was asked for, and it actually works.
//
// A language switch is the easiest feature in a game to ship broken, because
// every part of it fails quietly:
//
//   the picker renders but the tree does not re-render, so the screen stays
//   English until you navigate;
//   the choice is not persisted, so the game forgets on the next launch;
//   <html lang> stays "en", so a screen reader reads French with an English
//   voice and the browser hyphenates it wrongly;
//   the translated words are longer than the English ones and the bottom nav,
//   which fits six labels at 412px in English, overflows.
//
// All four are checked here against a real build, because none of them can be
// seen from the source.
//
// The picker's POSITION is an assertion too: it was asked for on the title
// screen, below the text size control. That is a product decision (it has to be
// answerable before a career exists), so it is pinned rather than left to the
// next person tidying the menu.
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const server = await startPreview('4207', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
page.setDefaultTimeout(8000)
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
const errs = []
page.on('pageerror', e => errs.push(e.message))
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })

const box = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }
}, sel)

try {
  await page.goto('http://localhost:4207/')
  await page.waitForSelector('text=RUGBY')

  // ---- it is on the title screen, under the text size ---------------------
  ok(await page.locator('.lang-row').count() === 1, 'the language row is on the title screen')
  const size = await box('.text-scale-row')
  const lang = await box('.lang-row')
  say(`  text size ends at ${Math.round(size?.bottom ?? -1)}px, language starts at ${Math.round(lang?.top ?? -1)}px`)
  ok(!!size && !!lang && lang.top >= size.bottom, 'and it is below the text size control, as asked')
  ok(!!lang && lang.left >= 0 && lang.right <= 412, 'the row fits a 412px screen')

  // both languages are offered, each written in its own language
  ok(await page.locator('.lang-btn').count() === 2, 'two languages are offered')
  ok(await page.locator('.lang-btn >> text=English').count() === 1, 'English is named English')
  ok(await page.locator('.lang-btn >> text=Français').count() === 1, 'French is named Français, not French')

  // a tap target you can hit, despite the small type
  const hit = await page.evaluate(() => {
    const el = document.querySelector('.lang-btn')
    const r = el.getBoundingClientRect()
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2)
    const owns = (h) => !!h && (el === h || el.contains(h))
    const reach = (dx, dy) => { let n = 0; for (; n <= 40; n++) { if (!owns(document.elementFromPoint(cx + dx * (n + 1), cy + dy * (n + 1)))) break } return n }
    return { w: reach(-1, 0) + reach(1, 0) + 1, h: reach(0, -1) + reach(0, 1) + 1 }
  })
  say(`  language button hit area: ${hit.w}x${hit.h}`)
  ok(Math.min(hit.w, hit.h) >= 44, 'the language button is big enough to tap')

  // ---- English first, then the switch -------------------------------------
  ok((await page.locator('.tagline').innerText()).includes('SILVERWARE'), 'it opens in English on an en-GB device')
  ok(await page.getAttribute('html', 'lang') === 'en', 'and stamps <html lang="en">')

  await page.click('.lang-btn >> text=Français')
  await page.waitForTimeout(250)
  const fr = await page.locator('.tagline').innerText()
  say(`  tagline after the switch: "${fr}"`)
  ok(fr.includes('TROPHÉES'), 'the strapline is French straight away, with no navigation needed')
  ok(await page.locator('text=Nouvelle carrière').count() === 1, 'and so is the New Career button')
  ok(await page.getAttribute('html', 'lang') === 'fr', 'the document says lang="fr", so a screen reader changes voice')
  ok(await page.locator('.lang-btn[aria-pressed="true"] >> text=Français').count() === 1, 'the picker shows which language is on')

  // ---- the longer language, at the largest type ----------------------------
  //
  // The two controls stack: "Nouvelle carrière" is six characters longer than
  // "New Career", and a player who has already asked for 1.3x type is the one
  // who finds the overflow. textscale.mjs measures this screen in English only.
  await page.locator('.text-scale-btn').last().click()
  await page.waitForTimeout(300)
  // the zoom has to have actually landed, or the overflow check below is a
  // measurement of nothing dressed up as a pass
  const zoom = await page.evaluate(() => document.documentElement.style.zoom)
  ok(zoom === '1.3', `the 1.3x type setting took (zoom: ${zoom || 'none'})`)
  const over = await page.evaluate(() => {
    // zoom scales the layout, so compare against the document rather than a
    // hard 412: innerWidth is already in zoomed units
    const w = document.documentElement.clientWidth
    const wide = [...document.querySelectorAll('.title-screen *')]
      .filter(el => el.getBoundingClientRect().right > w + 1)
      .map(el => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30))
    return { w, wide, scrollOver: document.documentElement.scrollWidth - w }
  })
  say(`  French at 1.3x type: viewport ${over.w}, overflow ${over.scrollOver}px`)
  ok(over.scrollOver <= 1, `nothing runs off the title screen in French at 1.3x${over.wide.length ? ': ' + over.wide.slice(0, 3).join(', ') : ''}`)
  await page.locator('.text-scale-btn').first().click()
  await page.waitForTimeout(250)

  // ---- and it is remembered ------------------------------------------------
  await page.reload()
  await page.waitForSelector('.tagline')
  ok((await page.locator('.tagline').innerText()).includes('TROPHÉES'), 'the choice survives a reload')
  ok(await page.getAttribute('html', 'lang') === 'fr', 'including the lang attribute on the very first paint')

  // ---- a French career: the chrome is translated and still fits ------------
  await page.click('text=Nouvelle carrière')
  await page.waitForSelector('text=English Premier Division')

  // The wizard is the first minute of the game, so it is the worst place to
  // leave English lying about. Competition and club names are data and stay as
  // they are; everything the wizard says for itself should have changed.
  ok((await page.locator('.wizard-hint').first().innerText()).includes('compétition'), 'the wizard opens in French')
  // innerText, not textContent: these read back through the stylesheet, and
  // the masthead and the fact labels are both text-transform: uppercase - so
  // the assertion has to be case-blind or it is testing the CSS. (The accent
  // surviving that transform is worth seeing: ÉTAPE, not ETAPE.)
  const stepLine = await page.locator('.masthead .date').innerText()
  say(`  step counter: "${stepLine}"`)
  ok(/^étape/i.test(stepLine), 'the step counter is French')
  ok(await page.locator('.action-bar >> text=Confirmer').count() === 1, 'and the forward button says Confirmer')

  // a gated step must still say what it wants, in French
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Joueur vedette')
  const facts = await page.locator('.detail-panel .fact-grid label').allInnerTexts()
  say(`  club facts in French: ${facts.join(' | ')}`)
  const lower = facts.map(f => f.toLowerCase())
  ok(lower.includes('réputation') && lower.includes('stade'), 'the club panel labels are French')
  ok(facts.some(f => f.includes('É') || f.includes('É'.toLowerCase())), 'and accents survive the uppercase transform')
  const factClip = await page.evaluate(() => [...document.querySelectorAll('.detail-panel .fact-grid label')]
    .filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.trim()))
  ok(factClip.length === 0, `no club fact label is cut off${factClip.length ? ': ' + factClip.join(', ') : ''}`)

  await page.click('.action-bar >> text=Confirmer')
  // the placeholder is translated too, so a French probe cannot use the
  // English selector every other harness uses
  await page.fill('input[placeholder="ex. A. Gaffer"]', 'Le Gaffer')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirmer')
  ok(await page.locator('text=▸ Démarrer la carrière').count() === 1, 'the last button of the wizard is French')
  await page.click('text=▸ Démarrer la carrière')
  await page.waitForSelector('.tut-box')
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')

  // ---- Home, the screen a manager sees every week --------------------------
  //
  // The dashboard is the densest thing in the game outside match day: four
  // half-width hub widgets and four half-width dash panels, all of them sized
  // for English words. "Transfer budget" becomes "Budget transferts" and
  // "confidence" becomes "confiance"; either can push a panel out of its row.
  const hub = await page.locator('.hub-widget label').allInnerTexts()
  say(`  hub widgets in French: ${hub.join(' | ')}`)
  ok(hub.some(h => h.toLowerCase().includes('championnat')), 'the hub widgets are French')

  const dashHeads = await page.locator('.dash-head').allInnerTexts()
  say(`  dash panels in French: ${dashHeads.join(' | ')}`)
  ok(dashHeads.length > 2, `the dashboard rendered (${dashHeads.length} panels)`)
  ok(dashHeads.some(h => h.toLowerCase().includes('calendrier')), 'and its panel headings are French')

  const homeOverflow = await page.evaluate(() => {
    const w = document.documentElement.clientWidth
    const bad = []
    for (const el of document.querySelectorAll('.hub-widget span, .hub-widget label, .dash-head, .dash-line span, .dash-line b')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      // clipped by its own box, or hanging off the screen
      if (el.scrollWidth > el.clientWidth + 1 || r.right > w + 1) {
        bad.push((el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24))
      }
    }
    return { w, bad, docOver: document.documentElement.scrollWidth - w }
  })
  ok(homeOverflow.bad.length === 0, `nothing on the dashboard is cut off in French${homeOverflow.bad.length ? ': ' + homeOverflow.bad.slice(0, 5).join(', ') : ''}`)
  ok(homeOverflow.docOver <= 1, `and Home does not scroll sideways (${homeOverflow.docOver}px over)`)

  // no English left where a French sentence should be. Club, competition and
  // player names are data and stay as they are; these are the ones the screen
  // says for itself, and they are the ones that betray a missed extraction.
  const leftovers = await page.evaluate(() => {
    const words = ['Fixtures', 'Finances Balance', 'Wage room', 'confidence', 'Transfer budget', 'unread message', 'Season Objectives', 'Next match']
    const text = document.querySelector('.content')?.innerText ?? ''
    return words.filter(w => text.includes(w))
  })
  ok(leftovers.length === 0, `no English left on Home${leftovers.length ? ': ' + leftovers.join(', ') : ''}`)

  const labels = await page.locator('.bottom-nav .nlbl').allInnerTexts()
  say(`  bottom nav in French: ${labels.join(' | ')}`)
  ok(labels.some(l => l.startsWith('Accueil')), 'the nav rail is in French')

  // THE OVERFLOW CHECK. Six labels at 412px, and French is the longer language.
  const rail = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.bottom-nav .nlbl')) {
      const r = el.getBoundingClientRect()
      out.push({ text: el.textContent.trim(), clipped: el.scrollWidth > el.clientWidth + 1, right: r.right, left: r.left })
    }
    return out
  })
  const clipped = rail.filter(r => r.clipped)
  ok(clipped.length === 0, `no nav label is cut off${clipped.length ? ': ' + clipped.map(c => c.text).join(', ') : ''}`)
  ok(rail.every(r => r.left >= -0.5 && r.right <= 412.5), 'and the rail stays inside the screen')

  // The submenu carries the longest text in the chrome - eleven destinations,
  // and "Infrastructures du club" against "Club Infrastructure". Opened by the
  // caret, not by position: the rail's labels are translated, so a title=
  // selector would be an English assumption hiding inside a French test.
  await page.locator('.bottom-nav button', { hasText: '▸' }).first().click()
  await page.waitForSelector('.submenu')
  // the menu slides in; measured mid-flight it reports left: -37 and fails a
  // check that has nothing to do with the language it is in
  await page.waitForTimeout(500)
  const items = await page.locator('.submenu-item').allInnerTexts()
  say(`  submenu in French: ${items.slice(0, 4).map(s => s.replace(/\s+/g, ' ').trim()).join(' | ')}`)
  ok(items.length > 5, `the submenu opened and is populated (${items.length} items)`)
  ok(items.some(i => i.includes('Infrastructures')), 'and its items are translated')
  const menuOverflow = await page.evaluate(() => {
    const el = document.querySelector('.submenu')
    const r = el.getBoundingClientRect()
    // a translated label that wraps is not a failure; one that leaves the
    // screen, or that gets clipped by its own row, is
    const clipped = [...document.querySelectorAll('.submenu-item')]
      .filter(i => i.scrollWidth > i.clientWidth + 1)
      .map(i => i.textContent.replace(/\s+/g, ' ').trim())
    return { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), over: r.left < -0.5 || r.right > 412.5, clipped }
  })
  ok(!menuOverflow.over, `the submenu fits the screen in French (${menuOverflow.w}px wide, ${menuOverflow.left}..${menuOverflow.right})`)
  ok(menuOverflow.clipped.length === 0, `no submenu item is cut off${menuOverflow.clipped.length ? ': ' + menuOverflow.clipped.join(', ') : ''}`)

  ok(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
  await page.screenshot({ path: '/tmp/langprobe-fail.png' }).catch(() => {})
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

say(fails ? `\nLANG PROBE FAILED (${fails})` : '\nLANG PROBE PASSED: the switch is where it was asked for, it works, and French still fits')
done(fails)
