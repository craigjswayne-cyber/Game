// Launch capture: real screens from the real build, for the store frames, the
// social templates and the trailer storyboard.
//
// Every picture comes from a showcase save written by scripts/launch/showcase.ts
// (the deterministic deepsave career, snapshotted at the weeks its stories
// land). Nothing on screen is edited: the capture opens the save, navigates the
// way a player would (through the same store the app runs on) and photographs.
//
//   npm run build
//   npx vite-node scripts/launch/showcase.ts      writes storeart/saves/*.json
//   node scripts/launch/capture.mjs               writes storeart/raw/<lang>/*.png
//
// VIEW=400x868 DSF=3 LANG=en ONLY=home,legacy
import { chromium } from 'playwright-core'
import { startPreview } from '../lib/preview.mjs'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'

const [VW, VH] = (process.env.VIEW || '400x868').split('x').map(Number)
const DSF = Number(process.env.DSF || 3)
const LANG = process.env.LANG_UI || 'en'
const OUT = process.env.OUT || `storeart/raw/${LANG}${process.env.VIEW ? '-' + process.env.VIEW : ''}${process.env.ZOOM ? '-z' + process.env.ZOOM : ''}`
const SAVES = process.env.SAVES || 'storeart/saves'
const ZOOM = process.env.ZOOM || '' // the game's own Text size setting: 1.15 Bigger, 1.3 Biggest
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
mkdirSync(OUT, { recursive: true })

/** The shots. `save` is a snapshot tag; `show` stages the screen. */
const SHOTS = [
  { name: 'home', save: 'final', show: st => st.home() },
  { name: 'office', save: 'final', show: st => { st.home(); st.go('press') } },
  { name: 'word-kept', save: 's11w30', story: /^Word kept:/ },
  { name: 'agents', save: 's11w30', story: /^Agents talk:/ },
  { name: 'rival-coach', save: 'final', story: /finished above you$/ },
  { name: 'bid', save: 's11w27', story: /^Brive bid/ },
  { name: 'offers', save: 's11w27', show: st => { st.home(); st.go('offers') } },
  { name: 'transfers', save: 'final', show: st => { st.home(); st.go('transfers') } },
  { name: 'tactics', save: 'final', show: st => { st.home(); st.go('tactics') } },
  { name: 'legacy', save: 'final', show: st => { st.home(); st.go('legacy') } },
  { name: 'profile', save: 'final', show: st => { st.home(); st.go('profile') } },
  { name: 'club', save: 'final', show: st => { st.home(); st.go('club') } },
  { name: 'annual', save: 'final', show: st => { st.home(); st.go('seasonreview') } },
  { name: 'history', save: 'final', show: st => { st.home(); st.go('history') } },
  { name: 'academy', save: 'final', show: st => { st.home(); st.go('academy') } },
  { name: 'match', save: 's11w30', match: true },
].filter(s => !ONLY || ONLY.includes(s.name))

const server = await startPreview('4232', 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const say = s => console.log(s)
let fails = 0

async function open(tag) {
  const file = `${SAVES}/${tag}.json`
  if (!existsSync(file)) throw new Error(`missing ${file}: run scripts/launch/showcase.ts`)
  const record = JSON.parse(readFileSync(file, 'utf8'))
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, locale: LANG === 'en' ? 'en-GB' : LANG })
  page.setDefaultTimeout(15000)
  await page.addInitScript(([l, z]) => { localStorage.setItem('rm-night', '1'); localStorage.setItem('rm-lang', l); if (z) localStorage.setItem('rm-zoom', z); localStorage.setItem('phase.matchPrefs', JSON.stringify({ highlights: 'key', bigText: true, speed: 2 })) }, [LANG, ZOOM])
  await page.goto('http://localhost:4232/')
  await page.waitForSelector('text=RUGBY', { timeout: 20000 })
  await page.evaluate((rec) => new Promise((res, rej) => {
    const req = indexedDB.open('rugby-manager', 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('saves')) req.result.createObjectStore('saves') }
    req.onsuccess = () => {
      const tx = req.result.transaction('saves', 'readwrite')
      tx.objectStore('saves').put(rec, 'deep')
      tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error)
    }
    req.onerror = () => rej(req.error)
  }), record)
  await page.reload()
  await page.waitForSelector('text=RUGBY')
  await page.click('text=Load Career')
  await page.click(`text=${record.state.managerName}`)
  await page.waitForSelector('.bottom-nav', { timeout: 20000 })
  for (let i = 0; i < 4 && await page.locator('.celebrate-veil').count(); i++) {
    await page.locator('.celebrate-veil').click({ position: { x: 5, y: 5 } })
    await page.waitForTimeout(300)
  }
  // the first-run tips are for a new manager, not for a save twelve seasons in
  if (await page.locator('.tut-close .btn').count()) await page.locator('.tut-close .btn').click()
  await page.waitForTimeout(600)
  return { page, record }
}

async function playMatch(page) {
  // Continue until match day, then kick off and wait for a highlight clip
  await page.evaluate(() => window.rugbyStore.getState().home())
  await page.waitForTimeout(500)
  // an Annual still on the desk is read and put away, as a player would
  const annualBtn = page.locator('button:has-text("Ready for a new season")')
  if (await annualBtn.count()) { await annualBtn.click(); await page.waitForTimeout(600) }
  for (let i = 0; i < 80 && !(await page.locator('.mday-head').count()); i++) {
    if (await page.locator('text=Ready for a new season').count()) await page.locator('text=Ready for a new season').click().catch(() => {})
    else if (await page.locator('.content button.btn.ghost:has-text("“")').count()) await page.locator('.content button.btn.ghost:has-text("“")').nth(1).click().catch(() => {})
    else if (await page.locator('text=Skip the rest').count()) await page.locator('text=Skip the rest').click().catch(() => {})
    else if (await page.locator('.wire-body').count()) await page.locator('.btn-row .btn.gold').last().click().catch(() => {})
    else if (await page.locator('.continue-btn').count()) await page.locator('.continue-btn').click().catch(() => {})
    else break
    await page.waitForTimeout(300)
    for (let j = 0; j < 3 && await page.locator('.celebrate-veil').count(); j++) await page.locator('.celebrate-veil').click({ position: { x: 5, y: 5 } }).catch(() => {})
  }
  if (!(await page.locator('.mday-head').count())) { await page.screenshot({ path: `${OUT}/match-stuck.png` }); return false }
  await page.screenshot({ path: `${OUT}/match-preview.png` })
  await page.locator('.continue-btn').click()
  await page.waitForTimeout(700)
  if (await page.locator('.talk-modal').count()) {
    await page.locator('.talk-modal .speech-tile').first().click()
    await page.waitForTimeout(700)
  }
  if (await page.locator('.modal .btn.gold').count() && !(await page.locator('.live-wrap').count())) {
    await page.locator('.modal .btn.gold').click()
    await page.waitForTimeout(700)
  }
  await page.waitForSelector('.live-wrap', { timeout: 15000 })
  // a forced stop (an injury) must be answered before play restarts: keep the
  // assistant's man, as most managers would, and go back to the match
  const settle = async () => {
    if (await page.locator('.sheet-row.armed').count()) await page.locator('.sheet-row.armed').first().click().catch(() => {})
    const back = page.locator('button.btn.gold:has-text("Back to the Match"):not([disabled])')
    if (await back.count()) await back.first().click().catch(() => {})
  }
  let gotClip = false
  for (let i = 0; i < 240; i++) {
    await settle()
    if (!gotClip && await page.locator('.hl-clip').count()) {
      await page.waitForTimeout(1400)
      await page.screenshot({ path: `${OUT}/match-clip.png` })
      gotClip = true
    }
    const board = (await page.locator('.scoreboard').textContent().catch(() => '')) ?? ''
    const min = Number(board.match(/(\d+)['’]/)?.[1] ?? 0)
    if (min >= 30 && gotClip) break
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: `${OUT}/match-live.png` })
  for (let i = 0; i < 60 && !(await page.locator('.ft-stamp').count()); i++) {
    await settle()
    const skip = page.locator('.speed-controls .btn').nth(1)
    if (await skip.count()) await skip.click().catch(() => {})
    else if (await page.locator('.panel-area .btn.gold').count()) await page.locator('.panel-area .btn.gold').first().click().catch(() => {})
    await page.waitForTimeout(700)
  }
  if (await page.locator('.ft-stamp').count()) {
    await page.waitForTimeout(3400)
    await page.screenshot({ path: `${OUT}/match-fulltime.png` })
    const sc = await page.evaluate(() => { const el = document.querySelector('.content'); return el ? el.scrollHeight - el.clientHeight : 0 })
    if (sc > 0) {
      await page.evaluate(() => { const el = document.querySelector('.content'); el.scrollTop = el.scrollHeight * 0.45 })
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/match-verdict.png` })
    }
  }
  return true
}

for (const s of SHOTS) {
  let page
  try {
    const o = await open(s.save)
    page = o.page
    if (s.match) {
      const ok = await playMatch(page)
      say(`${ok ? '  ok  ' : 'FAIL  '}match`)
      if (!ok) fails++
      continue
    }
    if (s.story) {
      const id = o.record.state.news.filter(n => s.story.test(n.subject)).map(n => n.id).pop()
      if (id == null) throw new Error(`no story matching ${s.story}`)
      await page.evaluate((id) => {
        const st = window.rugbyStore.getState(); st.home(); window.rugbyStore.setState({ inboxId: id }); st.go('inbox')
      }, id)
    } else {
      await page.evaluate(`(${s.show.toString()})(window.rugbyStore.getState())`)
    }
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/${s.name}.png` })
    say(`  ok  ${s.name}`)
  } catch (e) {
    fails++
    say(`FAIL  ${s.name}: ${String(e).split('\n')[0]}`)
  } finally {
    await page?.close()
  }
}
await browser.close()
server.stop()
say(fails ? `CAPTURE: ${fails} failed` : 'CAPTURE: all shots taken')
process.exit(fails ? 1 : 0)
