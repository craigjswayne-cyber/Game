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
  // the coaching philosophies come from game/tactics.ts, so this is French now
  // too - every other harness picks the same tile by its English name
  await page.click('.speech-tile >> text=Domination des avants')
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

  // ---- the weekly loop: Team, then the treatment room ----------------------
  //
  // The squad tables are the tightest layout in the game: fixed colgroups down
  // to 26px, with headings that are already abbreviations in English. "Sél" for
  // "Pkd" and "CJ" for "YC" have to fit the same columns, and a heading that
  // wraps costs a row on every one of 42 players.
  await page.locator('.submenu-item', { hasText: 'Équipe' }).first().click()
  await page.waitForSelector('.tab-bar')
  const tabs = await page.locator('.tab-bar button').allInnerTexts()
  say(`  squad tabs in French: ${tabs.join(' | ')}`)
  ok(tabs.some(x => x.toLowerCase().includes('composition')), 'the squad tabs are French')

  // the team sheet itself
  const sheetHeads = await page.locator('.section-title').allInnerTexts()
  ok(/xv de départ/i.test(sheetHeads.join(' ')), `the team sheet is French (${sheetHeads[0]?.replace(/\s+/g, ' ').trim()})`)

  // MEASURED AGAINST ENGLISH, NOT AGAINST ZERO.
  //
  // The first version of this asserted that no heading in the squad table
  // clips, and it went red on "Mor" - which clips in English too, in a 26px
  // column, and has done since the column was written. That is a real layout
  // bug and it is not this feature's, so an absolute assertion here would
  // either be permanently red or force an unrelated fix into a translation
  // commit. What this probe owns is the DIFFERENCE: a heading that the longer
  // language breaks and English does not.
  const squadHeadings = async () => {
    await page.locator('.tab-bar button').nth(1).click()   // General, by position
    await page.waitForSelector('.dtable thead')
    await page.waitForTimeout(200)
    return page.evaluate(() => {
      const out = { clipped: [], text: [], over: document.documentElement.scrollWidth - document.documentElement.clientWidth }
      for (const th of document.querySelectorAll('.dtable thead th')) {
        const label = th.textContent.replace(/[▾▴]/g, '').trim()
        out.text.push(label)
        // width, not height: these headings are `white-space: nowrap`, so a
        // long one overflows its column rather than wrapping
        if (th.scrollWidth > th.clientWidth + 1) out.clipped.push(label)
      }
      return out
    })
  }
  const frCols = await squadHeadings()
  say(`  general columns (fr): ${frCols.text.join(' | ')}`)
  ok(frCols.over <= 1, `the squad table does not scroll sideways in French (${frCols.over}px over)`)

  // back to English on the same career, to see which of those clip anyway
  await page.evaluate(() => localStorage.setItem('rm-lang', 'en'))
  await page.reload()
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  await page.locator('.bottom-nav button', { hasText: '▸' }).first().click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(400)
  await page.locator('.submenu-item', { hasText: 'Team' }).first().click()
  await page.waitForSelector('.tab-bar')
  const enCols = await squadHeadings()
  say(`  general columns (en): ${enCols.text.join(' | ')}`)
  if (enCols.clipped.length) say(`  (already clipped in English, not this feature's: ${enCols.clipped.join(', ')})`)

  // same position, so compare by index rather than by label
  const newlyClipped = frCols.text
    .map((label, i) => ({ label, i }))
    .filter(({ label, i }) => frCols.clipped.includes(label) && !enCols.clipped.includes(enCols.text[i]))
    .map(({ label, i }) => `${label} (was ${enCols.text[i]})`)
  ok(newlyClipped.length === 0, `no column heading is broken by French that English fits${newlyClipped.length ? ': ' + newlyClipped.join(', ') : ''}`)
  ok(enCols.over <= 1, `and the English table is still clean too (${enCols.over}px over)`)

  // put it back for the rest of the run
  await page.evaluate(() => localStorage.setItem('rm-lang', 'fr'))
  await page.reload()
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })

  // the treatment room, whose section subtitles are full sentences
  await page.locator('.bottom-nav button', { hasText: '▸' }).first().click()
  await page.waitForSelector('.submenu')
  await page.locator('.submenu-item', { hasText: 'Infirmerie' }).click()
  await page.waitForSelector('.inline-input')
  const physio = await page.locator('.card .meta').first().innerText()
  say(`  medical header: "${physio.replace(/\s+/g, ' ').trim().slice(0, 70)}"`)
  ok(/kiné|blessures|poste vacant/i.test(physio), 'the medical header is French')
  ok(await page.getAttribute('.inline-input', 'placeholder') === 'Chercher un joueur…', 'and so is the search placeholder')

  // ---- Tactics, whose words nearly all come from the engine's own tables ----
  //
  // Roles, presets, set-piece routines, bench splits, finisher briefs, the
  // opposition philosophy and the analyst's read all live in src/game/*.ts as
  // label tables. Those are the ones that silently stay English, because the
  // screen renders whatever the table holds and no screen-level sweep can see
  // it. So this walks the tabs and looks at what the tables produced.
  await page.locator('.bottom-nav button', { hasText: '▸' }).first().click()
  await page.waitForSelector('.submenu')
  await page.waitForTimeout(400)
  await page.locator('.submenu-item', { hasText: 'Tactique' }).first().click()
  await page.waitForSelector('.tab-bar')
  const tTabs = await page.locator('.tab-bar button').allInnerTexts()
  say(`  tactics tabs: ${tTabs.join(' | ')}`)
  ok(tTabs.some(x => /conquête/i.test(x)), 'the tactics tabs are French')

  // a role sheet: the names and descriptions come from game/roles.ts
  await page.locator('.form-chip').first().click()
  await page.waitForSelector('.modal .club-pick')
  const roleNames = await page.locator('.modal .club-pick .cname').allInnerTexts()
  say(`  role options: ${roleNames.join(' | ')}`)
  ok(roleNames.some(r => /naturel/i.test(r)), 'the role sheet is French')
  ok(!roleNames.some(r => /^(Scrummager|Mobile Prop|Jackal|Playmaker)$/i.test(r)), 'and no role kept its English name')
  await page.locator('.modal-veil').click({ position: { x: 5, y: 5 } }).catch(() => {})
  await page.waitForTimeout(300)

  // the set-piece routines, from game/playbook.ts
  await page.locator('.tab-bar button', { hasText: 'Conquête' }).click()
  await page.waitForSelector('.routine-grid')
  const routines = await page.locator('.routine-grid .speech-tile b').allInnerTexts()
  say(`  set-piece calls: ${routines.slice(0, 4).join(' | ')}`)
  ok(!routines.some(r => /^(Front Ball|Middle Jump|Hold And Feed|Hard Shove)$/i.test(r)), 'the set-piece playbook is French')

  // the bench splits and finisher briefs, from game/bench.ts
  await page.locator('.tab-bar button', { hasText: 'Banc' }).click()
  await page.waitForSelector('.routine-grid')
  const splits = await page.locator('.routine-grid .speech-tile b').allInnerTexts()
  say(`  bench splits: ${splits.join(' | ')}`)
  ok(!splits.some(x => /^(Five and Three|Six and Two|Four and Four)$/i.test(x)), 'the bench splits are French')

  // the week's preparation, from game/analyst.ts
  await page.locator('.tab-bar button', { hasText: 'Prépa' }).click()
  await page.waitForTimeout(300)
  const prepChips = await page.locator('.preset-chip').allInnerTexts()
  say(`  prep options: ${prepChips.join(' | ')}`)
  ok(!prepChips.some(x => /Attacking Shapes|Defensive Drills|Conditioning|Recovery Week/i.test(x)), 'the preparation options are French')

  // the sliders and the opposition read, from game/tactics.ts and philosophy.ts
  await page.locator('.tab-bar button', { hasText: 'Plan de jeu' }).click()
  await page.waitForSelector('.slider-row')
  const sliderText = await page.locator('.slider-row').first().innerText()
  say(`  first dial: "${sliderText.replace(/\s+/g, ' ').trim().slice(0, 90)}"`)
  ok(!/Forwards \/ pick-and-go|Expansive \/ wide/i.test(sliderText), 'the dials are French')
  const planText = await page.locator('.content').innerText()
  const engleft = ['All-Out Attack', 'Shut Up Shop', 'Keep It Tight', 'Kick the Corners', 'With the Ball', 'Without the Ball']
    .filter(w => planText.includes(w))
  ok(engleft.length === 0, `no English game plan left${engleft.length ? ': ' + engleft.join(', ') : ''}`)

  // ---- the day room and match day, the two longest screens in the game -----
  //
  // Between them they hold the week's bulletin, the whole pre-match briefing,
  // the tunnel, the touchline and full time. Almost none of it is a label: it is
  // sentences the screen builds at render out of the assistant, the analyst, the
  // table and the referee, which is exactly the kind of text that stays English
  // without anybody noticing. So the walk goes all the way to a final whistle.
  //
  // The match COMMENTARY is English on purpose - it is written into the report
  // the save keeps (docs/i18n.md) - so nothing here reads the ticker.
  const walkTo = async (stop, max = 40) => {
    for (let i = 0; i < max; i++) {
      if (await page.locator(stop).count()) return true
      if (await page.locator('.wire-body').count()) {
        // Continue handed us the morning's paper: read to the end of the queue
        await page.locator('.btn-row .btn.gold').last().click().catch(() => {})
      } else if (await page.locator('.continue-btn').count()) {
        await page.locator('.continue-btn').click().catch(() => {})
      } else break
      await page.waitForTimeout(220)
    }
    return (await page.locator(stop).count()) > 0
  }

  ok(await walkTo('.day-head'), 'Continue reaches a day bulletin')
  if (await page.locator('.day-head').count()) {
    const head = (await page.locator('.day-head').innerText()).replace(/\s+/g, ' ')
    say(`  day room: "${head.slice(0, 80)}"`)
    ok(/Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi/i.test(head), 'the day is named in French')
    ok(/semaine/i.test(head), 'and so is the week line')  // the head is uppercased by CSS
    const dayText = await page.locator('.content, .day-head').first().innerText().catch(() => '')
    const dayEng = ['The Review', 'The Morning Papers', 'On The Wire', 'Treatment Room', 'The market',
      'The boardroom', 'The training ground', 'Tomorrow', 'Continue ▸']
      .filter(w => dayText.includes(w))
    ok(dayEng.length === 0, `no English left in the day room${dayEng.length ? ': ' + dayEng.join(', ') : ''}`)
    const next = await page.locator('.day-next').innerText().catch(() => '')
    ok(/Continuer/.test(next), `and its own Continue is French ("${next.trim()}")`)
  }

  ok(await walkTo('.mday-head', 60), 'and the week walks on to a match')
  if (await page.locator('.mday-head').count()) {
    const mTabs = await page.locator('.tab-bar button').allInnerTexts()
    say(`  match-day tabs: ${mTabs.join(' | ')}`)
    ok(mTabs.some(x => /Équipe/i.test(x)) && mTabs.some(x => /Causerie/i.test(x)), 'the match-day tabs are French')
    const kickBtn = await page.locator('.continue-btn').innerText().catch(() => '')
    ok(/Coup d'envoi/i.test(kickBtn), `the kick-off button is French ("${kickBtn.trim()}")`)

    // the briefing tab is the sentence-heavy one: stakes, referee, opposition,
    // the assistant's plan, all of them assembled rather than looked up
    await page.locator('.tab-bar button', { hasText: 'Briefing' }).click()
    await page.waitForTimeout(400)
    const brief = await page.locator('main.content').innerText()
    const briefEng = ['The Stakes', 'The Whistle', 'The Finishers', 'Head to Head', "Assistant's Game Plan",
      'The Opposite Number', 'Danger Man', 'The Book On Them', 'Partnerships', 'has the appointment']
      .filter(w => brief.includes(w))
    ok(briefEng.length === 0, `no English left in the briefing${briefEng.length ? ': ' + briefEng.join(', ') : ''}`)
    ok(/Face à face|Mêlée|Touche/i.test(brief), 'and the head-to-head bars are French')

    // down the tunnel: the dressing room, then whatever the ready check says
    await page.locator('.continue-btn').click()
    await page.waitForTimeout(500)
    if (await page.locator('.talk-modal').count()) {
      const tiles = await page.locator('.talk-modal .speech-tile b').allInnerTexts()
      say(`  dressing room: ${tiles.join(' | ')}`)
      ok(!tiles.some(x => /Calm the nerves|Light the fuse|Nobody rates us|I expect a win/i.test(x)),
        'the team talk is French')
      await page.locator('.talk-modal .btn.ghost.block').click()
      await page.waitForTimeout(500)
    }
    if (await page.locator('.modal .btn.gold').count() && !(await page.locator('.live-wrap').count())) {
      const ready = await page.locator('.modal').innerText()
      ok(!/Are you ready for the game\?|Not Yet|Take the Field/i.test(ready), 'the ready check is French')
      await page.locator('.modal .btn.gold').click()
      await page.waitForTimeout(600)
    }

    ok(await page.locator('.live-wrap').count() > 0, 'and the match starts')
    if (await page.locator('.live-wrap').count()) {
      const caps = await page.locator('.ctrl-cap').allInnerTexts()
      say(`  touchline controls: ${caps.join(' | ')}`)
      // 'Pause' is not on the list: it is the same word in both languages, so it
      // is no evidence either way
      ok(!caps.some(x => /^(Play|Squad)$/i.test(x)), 'the touchline controls are French')
      const l10 = await page.locator('.l10-label').innerText().catch(() => '')
      ok(!/PENALTIES/i.test(l10), `and the possession strip is French ("${l10}")`)

      // to full time: Skip, and press through half-time and the hour
      for (let i = 0; i < 30 && !(await page.locator('.ft-stamp').count()); i++) {
        const skip = page.locator('.speed-controls .btn', { hasText: 'Passer' })
        if (await skip.count()) await skip.first().click().catch(() => {})
        else if (await page.locator('.panel-area .btn.gold').count()) {
          await page.locator('.panel-area .btn.gold').first().click().catch(() => {})
        }
        await page.waitForTimeout(700)
      }
      ok(await page.locator('.ft-stamp').count() > 0, 'the match reaches full time')
      if (await page.locator('.ft-stamp').count()) {
        const stamp = (await page.locator('.ft-stamp').innerText()).replace(/\s+/g, ' ')
        say(`  full time: "${stamp.trim()}"`)
        ok(/VICTOIRE|DÉFAITE|MATCH NUL/i.test(stamp), 'the full-time stamp is French')
        const report = await page.locator('.panel-area').innerText()
        const ftEng = ["Coach's Verdict", 'The Unit Battles', 'Star Player', 'Match Stats', 'The Highlights',
          'Continue to Results', 'Player ratings', 'The Two Fixes', 'The Fix']
          .filter(w => report.includes(w))
        ok(ftEng.length === 0, `no English left in the full-time report${ftEng.length ? ': ' + ftEng.join(', ') : ''}`)
      }
    }
  }

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
