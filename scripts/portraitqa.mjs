// Portrait is the layout the user actually plays in (he said so), but every
// harness in here drives 844x390 landscape - portrait was a blocked orientation
// with a "play anyway" escape hatch, so nothing has ever measured it.
//
// This drives the real phone geometry (412x915 logical, which is a 1080x2340
// Samsung at DPR 2.625) and reports the things the screenshots showed: clipped
// masthead titles, text hidden behind the fixed bottom nav, rows running off
// the right edge, and font sizes.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const server = spawn('npx', ['vite', 'preview', '--port', '4233', '--strictPort'], { stdio: 'pipe' })
await new Promise(r => setTimeout(r, 2500))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 })
await page.addInitScript(() => {
  localStorage.setItem('rm-night', '1')
  localStorage.setItem('rm-portrait', '1') // past the rotate veil
})

let fails = 0
const ok = (cond, what) => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${what}`); if (!cond) fails++ }

// Can the bottom of the page actually be reached? The first version of this
// flagged every element whose rect ran past the nav, which is just normal
// scrolled-out content and had nothing to do with the nav - a scrollport clips
// at its own edge and getBoundingClientRect reports through the clip. Scroll to
// the end first: whatever is still covered after that is genuinely unreachable.
const unreachableAtBottom = () => page.evaluate(() => {
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

// The masthead packs a title, a date line, a night toggle and MATCHDAY into one
// 412px-wide strip, and the screenshots showed "WK 2" running underneath the
// moon. Any text box that intersects a control's box is a collision.
const mastheadCollisions = () => page.evaluate(() => {
  const mh = document.querySelector('.masthead')
  if (!mh) return []
  // controls count too, not only text: the collision in the screenshots was the
  // date line running underneath the night-mode moon, and a button whose label
  // is an icon has no text node to match on
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

// Text the layout has truncated with an ellipsis, and anything past the right edge.
const clipped = () => page.evaluate(() => {
  const trunc = [], over = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.height < 6 || r.width < 6 || r.top > window.innerHeight) continue
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === 'ellipsis') {
      const t = (el.textContent ?? '').trim()
      // name the element, or the next reader has to guess which rule to change
      const sel = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
      if (t) trunc.push(`${t.slice(0, 24)} [${sel} ${Math.round(el.clientWidth)}px] (${el.scrollWidth - el.clientWidth}px cut)`)
    }
    if (r.right > window.innerWidth + 1 && (el.textContent ?? '').trim() && !el.querySelector('*')) {
      // Inside a horizontal scroller, being past the right edge is what
      // scrolling IS - not a layout fault. Six tabs cannot fit 412px at any
      // legible size, so the strip has to scroll; what matters is whether the
      // user can tell. Exempt scrollers here and check the affordance below.
      let inScroller = false
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a)
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 1) { inScroller = true; break }
      }
      if (!inScroller) over.push(`${(el.textContent ?? '').trim().slice(0, 26)} (+${Math.round(r.right - window.innerWidth)}px)`)
    }
  }
  // Every strip that does scroll sideways must say so, or the tabs past the
  // edge are invisible: a mask/fade on the scrollable edge is the signal.
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

const fonts = () => page.evaluate(() => {
  const tally = new Map()
  for (const el of document.querySelectorAll('.content *, .masthead *')) {
    const r = el.getBoundingClientRect()
    if (r.height < 6 || !(el.textContent ?? '').trim() || el.querySelector('*')) continue
    const s = Math.round(parseFloat(getComputedStyle(el).fontSize) * 2) / 2
    tally.set(s, (tally.get(s) ?? 0) + 1)
  }
  return [...tally].sort((a, b) => b[0] - a[0])
})

// Does the page force-dark? A browser only leaves a dark page alone if it says so.
const scheme = () => page.evaluate(() => ({
  root: getComputedStyle(document.documentElement).colorScheme,
  meta: document.querySelector('meta[name="color-scheme"]')?.content ?? null,
  paper: getComputedStyle(document.querySelector('.card') ?? document.body).backgroundColor,
}))

const report = async (label) => {
  const nav = await unreachableAtBottom()
  const mh = await mastheadCollisions()
  const clip = await clipped()
  const f = await fonts()
  console.log(`\n--- ${label}`)
  console.log(`  fonts: ${f.map(([s, n]) => `${s}px x${n}`).join(', ')}`)
  ok(mh.length === 0, `masthead controls do not collide${mh.length ? `: ${mh.join('; ')}` : ''}`)
  ok(nav.covered.length === 0, `the end of the page is reachable${nav.covered.length ? `: ${nav.covered.join('; ')}` : ''}`)
  ok(clip.trunc.length === 0, `no text truncated${clip.trunc.length ? `: ${clip.trunc.join('; ')}` : ''}`)
  ok(clip.over.length === 0, `nothing past the right edge${clip.over.length ? `: ${clip.over.join('; ')}` : ''}`)
  ok(clip.mute.length === 0, `every sideways scroller shows it scrolls${clip.mute.length ? `: ${clip.mute.join('; ')} has no edge fade` : ''}`)
}

try {
  await page.goto('http://localhost:4233/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  const s = await scheme()
  console.log(`color-scheme: root "${s.root}", meta ${s.meta ?? 'absent'}`)
  ok(s.root === 'dark' || s.meta != null,
    'the page declares a colour scheme, so the browser will not force-dark it into grey')

  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await report('wizard: competition')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await report('wizard: club pick')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Portrait')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  await report('home')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.waitForSelector('.submenu-item', { timeout: 8000 })
  await report('hub menu')
  await page.click('.submenu-item >> text=Selection & Tactics')
  await page.waitForSelector('.tab-bar', { timeout: 8000 })
  await report('tactics: selection')
  await page.click('.tab-bar >> text=Tactics')
  await page.waitForTimeout(400)
  await report('tactics: pitch')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Fixtures & Results')
  await page.waitForTimeout(500)
  await report('fixtures')
} catch (e) {
  console.error('PORTRAIT QA stopped early:', e.message)
  fails++
}
console.log(`\n${fails ? `PORTRAIT QA FAILED (${fails})` : 'PORTRAIT QA PASSED'}`)
await browser.close()
server.kill()
process.exit(fails ? 1 : 0)
