// The layout law, at every phone we claim to fit (round 22, the RC battery).
//
// Every browser harness in here drives one geometry: 412x915 at DPR 2.625,
// the Samsung the user actually plays on. That is the right default and the
// wrong release gate: a store listing puts the game on 360px Androids, 375px
// iPhone SEs and 430px Pro Maxes on day one, and none of them had ever been
// measured. This runs the portraitqa layout checks - masthead collisions,
// unreachable content under the bottom nav, truncated text, right-edge
// overflow, unmarked sideways scrollers, squad-table fit - across six real
// device geometries. Real Safari cannot run in this container, so WebKit
// sizes are emulated in Chromium and the difference is declared in the RC
// report rather than papered over.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const DEVICES = [
  { name: 'galaxy 412x915', w: 412, h: 915, dpr: 2.625 },   // the baseline phone
  { name: 'android-s 360x740', w: 360, h: 740, dpr: 3 },    // small Android, the floor
  { name: 'iphone-se 375x667', w: 375, h: 667, dpr: 2 },    // shortest screen still sold
  { name: 'iphone-14 390x844', w: 390, h: 844, dpr: 3 },
  { name: 'pro-max 430x932', w: 430, h: 932, dpr: 3 },
  { name: 'tablet 768x1024', w: 768, h: 1024, dpr: 2 },
]

const server = await startPreview('4237', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

let fails = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${what}`); if (!cond) fails++ }

// The measurements are portraitqa's, verbatim where possible, so a failure
// here reads the same as a failure there.
const unreachableAtBottom = (page) => page.evaluate(() => {
  const sc = document.querySelector('.content')
  const nav = document.querySelector('.bottom-nav')
  if (!sc || !nav) return { covered: [] }
  sc.scrollTop = sc.scrollHeight
  const navTop = nav.getBoundingClientRect().top
  const covered = []
  for (const el of sc.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.height < 6 || r.width < 6 || el.querySelector('*')) continue
    const txt = (el.textContent ?? '').trim()
    if (!txt) continue
    if (r.top < navTop && r.bottom > navTop + 2) covered.push(`${txt.slice(0, 30)} (${Math.round(r.bottom - navTop)}px under)`)
  }
  sc.scrollTop = 0
  return { covered: covered.slice(0, 5) }
})

const mastheadCollisions = (page) => page.evaluate(() => {
  const mh = document.querySelector('.masthead')
  if (!mh) return []
  const boxes = [...mh.querySelectorAll('*')]
    .filter(e => (!e.querySelector('*') && (e.textContent ?? '').trim()) || e.tagName === 'BUTTON')
    .map(e => ({ t: ((e.textContent ?? '').trim() || e.getAttribute('aria-label') || e.tagName).slice(0, 22), r: e.getBoundingClientRect() }))
    .filter(b => b.r.width > 4 && b.r.height > 4)
  const hits = []
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, b = boxes[j].r
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    if (ox > 3 && oy > 3) hits.push(`"${boxes[i].t}" over "${boxes[j].t}"`)
  }
  return [...new Set(hits)].slice(0, 4)
})

const clipped = (page) => page.evaluate(() => {
  const trunc = [], over = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.height < 6 || r.width < 6 || r.top > window.innerHeight) continue
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === 'ellipsis') {
      const t = (el.textContent ?? '').trim()
      const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
      if (t) trunc.push(`${t.slice(0, 24)} [${sel} ${Math.round(el.clientWidth)}px] (${el.scrollWidth - el.clientWidth}px cut)`)
    }
    if (r.right > window.innerWidth + 1 && (el.textContent ?? '').trim() && !el.querySelector('*')) {
      let inScroller = false
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 1) { inScroller = true; break }
      }
      if (!inScroller) over.push(`${(el.textContent ?? '').trim().slice(0, 26)} (+${Math.round(r.right - window.innerWidth)}px)`)
    }
  }
  const mute = []
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el)
    if (!(cs.overflowX === 'auto' || cs.overflowX === 'scroll')) continue
    if (el.scrollWidth <= el.clientWidth + 1) continue
    const masked = (cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none')
    if (!masked) mute.push(el.className || el.tagName.toLowerCase())
  }
  return { trunc: [...new Set(trunc)].slice(0, 6), over: [...new Set(over)].slice(0, 6), mute: [...new Set(mute)].slice(0, 4) }
})

const report = async (page, dev, label) => {
  const nav = await unreachableAtBottom(page)
  const mh = await mastheadCollisions(page)
  const clip = await clipped(page)
  console.log(`--- ${dev} / ${label}`)
  ok(mh.length === 0, `masthead controls do not collide${mh.length ? `: ${mh.join('; ')}` : ''}`)
  ok(nav.covered.length === 0, `the end of the page is reachable${nav.covered.length ? `: ${nav.covered.join('; ')}` : ''}`)
  ok(clip.trunc.length === 0, `no text truncated${clip.trunc.length ? `: ${clip.trunc.join('; ')}` : ''}`)
  ok(clip.over.length === 0, `nothing past the right edge${clip.over.length ? `: ${clip.over.join('; ')}` : ''}`)
  ok(clip.mute.length === 0, `every sideways scroller shows it scrolls${clip.mute.length ? `: ${clip.mute.join('; ')} has no edge fade` : ''}`)
}

for (const dev of DEVICES) {
  const page = await browser.newPage({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: dev.dpr })
  await page.addInitScript(() => { localStorage.setItem('rm-night', '1') })
  console.log(`\n===== ${dev.name} (DPR ${dev.dpr}) =====`)
  try {
    await page.goto('http://localhost:4237/')
    await page.waitForSelector('text=RUGBY', { timeout: 15000 })

    await page.click('text=New Career')
    await page.waitForSelector('text=Gallagher Premiership')
    await page.click('text=Gallagher Premiership')
    await page.waitForSelector('.club-tile')
    await report(page, dev.name, 'wizard: club pick')
    await page.click('.tile >> text=Northampton')
    await page.waitForSelector('text=Star Player')
    await page.click('.action-bar >> text=Confirm')
    await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Matrix')
    await page.click('.speech-tile >> text=Forward Dominance')
    await page.click('.action-bar >> text=Confirm')
    await page.click('text=▸ Start Career')
    await page.waitForSelector('.tut-box', { timeout: 15000 })
    await page.click('.tut-close .btn')
    await page.waitForSelector('.bottom-nav', { timeout: 15000 })
    await report(page, dev.name, 'home')

    await page.click('.bottom-nav button[title="Hub"]')
    await page.waitForSelector('.submenu-item', { timeout: 8000 })
    await page.click('.submenu-item >> text="Team"')
    await page.waitForSelector('.tab-bar', { timeout: 8000 })
    await report(page, dev.name, 'team: overview')
    // the squad tables are the widest thing in the game, so they carry the
    // per-device fit check: no heading among the players, no column past the edge
    for (const view of ['Stats', 'Contracts']) {
      await page.click(`.tab-bar >> text=${view}`)
      await page.waitForTimeout(300)
      const t = await page.evaluate(() => {
        const th = document.querySelector('.dtable thead th')
        const tr = document.querySelector('.dtable tbody tr')
        const tbl = document.querySelector('.dtable')
        if (!th || !tbl) return null
        return {
          head: Math.round(th.getBoundingClientRect().top),
          firstRow: tr ? Math.round(tr.getBoundingClientRect().top) : null,
          tblRight: Math.round(tbl.getBoundingClientRect().right),
          viewport: window.innerWidth,
        }
      })
      if (!t) { console.log(`--- ${dev.name} / ${view}: no table to measure`); continue }
      ok(t.firstRow == null || t.head <= t.firstRow,
        `${view}: headings above the players (${t.head} vs ${t.firstRow})`)
      ok(t.tblRight <= t.viewport + 1,
        `${view}: the table fits ${dev.w}px (right edge ${t.tblRight})`)
    }

    await page.click('.bottom-nav button[title="Hub"]')
    await page.click('.submenu-item >> text=Fixtures & Results')
    await page.waitForTimeout(500)
    await report(page, dev.name, 'fixtures')

    await page.click('.bottom-nav button[title="Hub"]')
    await page.click('.submenu-item >> text=Transfer Centre')
    await page.waitForSelector('.filter-line', { timeout: 8000 })
    const spread = await page.evaluate(() =>
      [...document.querySelectorAll('.filter-line')].map(row => {
        const tops = [...row.children].map(e => Math.round(e.getBoundingClientRect().top))
        return Math.max(...tops) - Math.min(...tops)
      }))
    ok(spread.every(s => s <= 2), `transfer filters hold their lines at ${dev.w}px (spreads ${spread.join('/')})`)
    await report(page, dev.name, 'transfers')
  } catch (e) {
    console.error(` FAIL  ${dev.name} stopped early: ${e.message.split('\n')[0]}`)
    fails++
  }
  await page.close()
}

console.log(`\n${fails ? `DEVICE MATRIX FAILED (${fails})` : `DEVICE MATRIX PASSED: ${DEVICES.length} geometries hold the layout law`}`)
await browser.close()
server.stop()
process.exit(fails ? 1 : 0)
