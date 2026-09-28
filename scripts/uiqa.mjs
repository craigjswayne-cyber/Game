// UI QA SWEEP (1.8.0). The owner: "Check alignment of all menus" and "Identify
// any areas which feel unfinished".
//
// Every other browser harness in here walks one path at one size. This one
// starts a career, plays a few weeks so the screens have something on them,
// then photographs EVERY screen, every tab on it and the three bottom-nav
// menus, at four geometries (the Samsung, the small Android, landscape and a
// tablet) in both themes, plus one French pass because French is the longest.
// The pictures are for a person to look at; alongside them it measures the
// things a picture hides until you squint: sideways scroll, text past the
// right edge, text cut by an ellipsis, leftover debug or placeholder copy.
//
// Run: npm run build && node scripts/uiqa.mjs [outDir] [--only=412n,360n,...]
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { startPreview } from './lib/preview.mjs'

const OUT = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? '/tmp/uiqa'
const ONLY = (process.argv.find(a => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean)
const PORT = 4391
mkdirSync(OUT, { recursive: true })

const CONFIGS = [
  { id: '412n', w: 412, h: 915, night: true, full: true },
  { id: '412d', w: 412, h: 915, night: false, full: false },
  { id: '360n', w: 360, h: 800, night: true, full: true },
  { id: '844n', w: 844, h: 390, night: true, full: false },
  { id: '820n', w: 820, h: 1180, night: true, full: false },
  { id: '820d', w: 820, h: 1180, night: false, full: false },
  { id: '412fr', w: 412, h: 915, night: true, full: true, lang: 'fr' },
].filter(c => !ONLY.length || ONLY.includes(c.id))

const server = await startPreview(String(PORT), 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => {
  let a = 20260927
  Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  try { if (!localStorage.getItem('rm-lang')) localStorage.setItem('rm-lang', 'en') } catch {}
})
const errors = []
page.on('pageerror', e => errors.push(e.message))

const findings = []
const shot = async (name, full) => {
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  if (!full) return
  // the page scrolls inside .content, so a full-page shot sees one screen;
  // take the rest of it in viewport-sized pieces
  for (let k = 1; k < 5; k++) {
    const moved = await page.evaluate(k => {
      const sc = document.querySelector('.content')
      if (!sc) return false
      const step = sc.clientHeight - 60
      if (sc.scrollHeight - sc.clientHeight <= step * (k - 1) + 4) return false
      sc.scrollTop = step * k
      return true
    }, k)
    if (!moved) break
    await page.waitForTimeout(120)
    await page.screenshot({ path: `${OUT}/${name}__${k}.png` })
  }
  await page.evaluate(() => { const sc = document.querySelector('.content'); if (sc) sc.scrollTop = 0 })
}

const measure = (name) => page.evaluate((name) => {
  const out = []
  const W = window.innerWidth
  const se = document.scrollingElement
  if (se.scrollWidth > W + 1) out.push(`page scrolls sideways (${se.scrollWidth} > ${W})`)
  const sc = document.querySelector('.content')
  if (sc && sc.scrollWidth > sc.clientWidth + 1) out.push(`.content scrolls sideways (${sc.scrollWidth} > ${sc.clientWidth})`)
  const inScroller = el => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') && a.scrollWidth > a.clientWidth + 1 && a !== document.body) return true
    }
    return false
  }
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const leaf = !el.querySelector('*')
    const txt = (el.textContent ?? '').trim()
    if (leaf && txt && r.right > W + 1 && !inScroller(el)) seen.add(`past right edge: "${txt.slice(0, 30)}" (+${Math.round(r.right - W)})`)
    if (txt && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === 'ellipsis') seen.add(`ellipsis: "${txt.slice(0, 30)}" [${el.className}]`)
  }
  out.push(...[...seen].slice(0, 8))
  const body = document.body.innerText
  const bad = body.match(/\b(TODO|FIXME|lorem|ipsum|coming soon|undefined|NaN|null|\[object|placeholder)\b|\{\{|\}\}|\b[a-z]+\.[a-z][A-Za-z]+\.[a-z][A-Za-z]+\b/gi)
  if (bad) out.push(`suspicious text: ${[...new Set(bad)].slice(0, 6).join(', ')}`)
  const ver = body.match(/\bv?1\.\d+\.\d+\b/g)
  if (ver) out.push(`version strings: ${[...new Set(ver)].join(', ')}`)
  const emo = body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu)
  if (emo) out.push(`emoji: ${[...new Set(emo)].join(' ')}`)
  // tap targets: buttons and links smaller than 44px tall (report only the
  // shortest few, the full audit is scripts/tapsize.mjs)
  const small = []
  for (const b of document.querySelectorAll('button, a, [role=button], [role=tab], select, input')) {
    const r = b.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || r.top > window.innerHeight * 3) continue
    if (r.height < 36 || r.width < 30) small.push(`${((b.textContent ?? '').trim() || b.getAttribute('aria-label') || b.tagName).slice(0, 18)} ${Math.round(r.width)}x${Math.round(r.height)}`)
  }
  if (small.length) out.push(`small taps: ${small.slice(0, 6).join('; ')}`)
  return out
}, name)

const note = async (name) => {
  const m = await measure(name)
  if (m.length) findings.push({ name, issues: m })
}

const st = (fn, arg) => page.evaluate(([fn, arg]) => window.rugbyStore.getState()[fn](...(arg === undefined ? [] : [arg])), [fn, arg])
const go = async (screen, param) => {
  // never photograph a screen under a menu left open
  const open = await page.locator('.bottom-nav button[aria-expanded=true]').first()
  if (await open.count()) await open.click({ force: true }).catch(() => {})
  await page.evaluate(([s, p]) => {
    const store = window.rugbyStore
    // a fresh nav stack per screen so Back behaves the same everywhere
    store.setState({ nav: [{ screen: 'home' }] })
    if (s !== 'home') store.getState().go(s, p)
  }, [screen, param])
  await page.waitForTimeout(350)
}

// ---- the title screen and the new-career wizard, photographed on the way in
await page.goto(`http://localhost:${PORT}/`)
await page.waitForSelector('text=RUGBY', { timeout: 15000 })
await page.waitForTimeout(600)
for (const c of CONFIGS.filter(c => !c.lang)) {
  await page.setViewportSize({ width: c.w, height: c.h })
  await shot(`${c.id}-title`, false)
}
await page.setViewportSize({ width: 412, height: 915 })
await page.click('text=New Career')
await shot('412n-newgame-1', true); await note('412n-newgame-1')
await page.click('text=English Premier Division')
await page.waitForSelector('.club-tile')
await shot('412n-newgame-2', true); await note('412n-newgame-2')
await page.click('.tile >> text=Northampton')
await page.waitForSelector('text=Star Player')
await shot('412n-newgame-3', true); await note('412n-newgame-3')
await page.click('.action-bar >> text=Confirm')
await shot('412n-newgame-4', true); await note('412n-newgame-4')
await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Sam Carter')
await page.click('.speech-tile >> text=Forward Dominance')
await page.click('.action-bar >> text=Confirm')
await shot('412n-newgame-5', true); await note('412n-newgame-5')
await page.click('text=▸ Start Career')
await page.waitForSelector('.tut-box', { timeout: 15000 })
await shot('412n-tutorial', false)
await page.click('.tut-close .btn')
await page.waitForSelector('.bottom-nav')

// ---- play a few weeks so every screen has data
const WEEKS = Number(process.env.UIQA_WEEKS ?? 8)
await page.evaluate(async (weeks) => {
  const S = window.rugbyStore
  const start = S.getState().game.week
  for (let g = 0; g < 3000; g++) {
    const st = S.getState()
    if (st.game.week - start >= weeks && !st.liveMatch) break
    const club = st.game.clubs?.[st.game.userClubId]
    if (club) club.boardConfidence = Math.max(club.boardConfidence ?? 50, 70)
    for (const o of st.game.offers) if (o.status === 'pending' && o.forUser) o.status = 'rejected'
    for (const n of st.game.news) n.read = true
    for (const q of st.game.press) q.answered = true
    S.setState({ lastAdvanceAt: 0, wireQueue: [] })
    const screen = st.nav[st.nav.length - 1]?.screen
    // remember the last round-up the game itself opened, to photograph later
    for (const e of st.nav) if (e.screen === 'results' && e.param) window.__resultsParam = e.param
    if (st.liveMatch || screen === 'matchday') st.instantResult()
    else st.continueWeek()
    await new Promise(r => setTimeout(r, 5))
  }
}, WEEKS)
await page.waitForTimeout(500)
// leave some news unread so the inbox has a queue to show
await page.evaluate(() => { const g = window.rugbyStore.getState().game; g.news.slice(-6).forEach(n => { n.read = false }) })

const ids = await page.evaluate(() => {
  const g = window.rugbyStore.getState().game
  const mine = g.clubs[g.userClubId]
  const pid = (mine.squad ?? mine.playerIds ?? [])[0] ?? Object.keys(g.players ?? {})[0]
  const other = Object.keys(g.clubs).find(k => k !== g.userClubId && g.clubs[k].league === mine.league) ?? Object.keys(g.clubs)[1]
  return { pid: typeof pid === 'object' ? pid.id : Number(pid), other, week: g.week, results: window.__resultsParam }
})
console.log('ids', JSON.stringify(ids))

const SCREENS = [
  ['home'], ['inbox'], ['offers'], ['squad'], ['player', ids.pid], ['tactics'], ['fixtures'], ['tables'],
  ['transfers'], ['training'], ['finances'], ['club'], ['club', ids.other], ['press'], ['nations'], ['history'],
  ['legacy'], ['handbook'], ['settings'], ['bug'], ['about'], ['supporter'], ['jobs'], ['medical'], ['report'],
  ['profile'], ['saves'], ['dreamteam'], ['agency'], ['country'], ['infra'], ['academy'], ['matchday'],
  ['results', ids.results], ['day'],
  // mid-flow screens that need state a direct visit does not have: last, and
  // a crash here is recovered from below rather than poisoning the rest
  ['seasonreview'], ['draw'], ['annual'],
]
const recover = async () => {
  if (await page.locator('.bottom-nav').count()) return
  await page.evaluate(async () => { await window.rugbyStore.getState().persistNow?.() })
  await page.reload(); await page.waitForTimeout(1500)
  await page.evaluate(async () => { await window.rugbyStore.getState().resume() })
  await page.waitForTimeout(800)
}

const setNight = async (night) => {
  const cur = await page.evaluate(() => window.rugbyStore.getState().night)
  if (cur !== night) await st('toggleNight')
}

for (const c of CONFIGS) {
  if (c.lang) {
    await page.evaluate(async () => { await window.rugbyStore.getState().persistNow() })
    await page.evaluate(l => localStorage.setItem('rm-lang', l), c.lang)
    await page.reload()
    await page.waitForTimeout(1500)
    await page.evaluate(async () => { await window.rugbyStore.getState().resume() })
    await page.waitForTimeout(800)
  }
  await page.setViewportSize({ width: c.w, height: c.h })
  await setNight(c.night)
  for (const [screen, param] of SCREENS) {
    const base = `${c.id}-${screen}${param !== undefined && screen === 'club' ? '-other' : ''}`
    try {
      await go(screen, param)
      await shot(base, c.full); await note(base)
      // every tab on the screen
      const tabs = await page.locator('.content .tab-bar button').count()
      for (let i = 1; i < tabs; i++) {
        // a tab that navigates elsewhere (Competitions > Internationals) changes the bar
        if (await page.locator('.content .tab-bar button').count() !== tabs) break
        const label = ((await page.locator('.content .tab-bar button').nth(i).textContent()) ?? `t${i}`).trim().replace(/[^A-Za-z0-9]+/g, '_').slice(0, 20)
        await page.locator('.content .tab-bar button').nth(i).click()
        await page.waitForTimeout(250)
        await shot(`${base}-tab${i}-${label}`, c.full); await note(`${base}-tab${i}-${label}`)
      }
    } catch (e) {
      findings.push({ name: base, issues: [`harness: ${e.message.split('\n')[0]}`] })
    }
    await recover()
  }
  // the bottom-nav menus
  await go('home')
  for (const g of ['hub', 'manager', 'world']) {
    try {
      await page.click(`.bottom-nav button[data-group=${g}]`)
      await page.waitForSelector('.submenu-item', { timeout: 3000 })
      await shot(`${c.id}-menu-${g}`, false); await note(`${c.id}-menu-${g}`)
      // the menu is a drawer from the LEFT in portrait, so the veil is
      // tapped on its right-hand edge; toggling the group again is the backstop
      await page.click('.submenu-veil', { position: { x: c.w - 6, y: Math.round(c.h / 2) } }).catch(() => {})
      await page.waitForTimeout(200)
      if (await page.locator('.submenu-veil').count()) await page.click(`.bottom-nav button[data-group=${g}]`, { force: true })
      await page.waitForTimeout(150)
    } catch (e) { findings.push({ name: `${c.id}-menu-${g}`, issues: [`harness: ${e.message.split('\n')[0]}`] }) }
  }
  // the live match (the stage belongs to another task, but the frame is ours)
  if (c.full) {
    try {
      await go('matchday')
      await page.evaluate(() => { window.rugbyStore.setState({ lastAdvanceAt: 0 }) })
      const ko = page.locator('text=Kick Off ▸').first()
      if (await ko.count()) {
        await ko.click()
        if (await page.locator('.talk-modal').count()) { await shot(`${c.id}-talk-modal`, false); await page.click('.talk-modal .speech-tile >> nth=0') }
        try { await page.locator('text=▸ Take the Field').waitFor({ timeout: 2500 }); await page.click('text=▸ Take the Field') } catch {}
        await page.waitForSelector('.scoreboard', { timeout: 15000 })
        await page.waitForTimeout(2500)
        await shot(`${c.id}-live`, false); await note(`${c.id}-live`)
        await page.click('.speed-controls .btn >> nth=-1').catch(() => {})
        await page.waitForTimeout(400)
        await shot(`${c.id}-live-settings`, false)
        await page.keyboard.press('Escape')
        // back out of the match without playing it: restart state from the save
      }
    } catch (e) { findings.push({ name: `${c.id}-live`, issues: [`harness: ${e.message.split('\n')[0]}`] }) }
    // abandon the live match so the next config starts from the same week
    await page.evaluate(() => { const S = window.rugbyStore; if (S.getState().liveMatch) { S.setState({ lastAdvanceAt: 0 }); S.getState().instantResult() } })
    await page.waitForTimeout(400)
  }
}

writeFileSync(`${OUT}/findings.json`, JSON.stringify({ errors, findings }, null, 1))
console.log(`${findings.length} views with measured issues, ${errors.length} page errors; see ${OUT}/findings.json`)
await browser.close(); server.stop()
process.exit(0)
