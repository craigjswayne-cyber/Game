// Portrait is the layout the user actually plays in (he said so), but every
// harness in here drives 844x390 landscape - portrait was a blocked orientation
// with a "play anyway" escape hatch, so nothing has ever measured it.
//
// This drives the real phone geometry (412x915 logical, which is a 1080x2340
// Samsung at DPR 2.625) and reports the things the screenshots showed: clipped
// masthead titles, text hidden behind the fixed bottom nav, rows running off
// the right edge, and font sizes.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4233', 2500)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 })
await page.addInitScript(() => {
  localStorage.setItem('rm-night', '1')
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
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await report('wizard: competition')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await report('wizard: club pick')

  // ---- the wizard trail must never clip a club name ----
  // It carries the only information on that row you cannot get anywhere else:
  // WHICH club you picked. Step names went back to the line above them for
  // exactly this reason, so the trail is measured at every step from here on.
  const trailAt = async (where) => {
    const t = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.crumb')]
      return chips.map(e => ({
        text: e.textContent.trim(),
        w: Math.round(e.getBoundingClientRect().width),
        clipped: e.scrollWidth > e.clientWidth + 1,
      }))
    })
    console.log(`--- trail (${where}): ${t.map(c => `${c.text} ${c.w}px${c.clipped ? ' CLIPPED' : ''}`).join(' | ') || '(none)'}`)
    ok(t.length <= 3, `never more than three chips (${t.length})`)
    ok(t.every(c => !c.clipped), `nothing in the trail is truncated${t.some(c => c.clipped) ? ` [${t.filter(c => c.clipped).map(c => c.text).join(', ')}]` : ''}`)
    ok(!t.some(c => /^(manager|summary|competition|club)$/i.test(c.text)),
      'the trail holds choices, not step names')
    return t
  }
  await trailAt('after picking a club')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Portrait')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  const finalTrail = await trailAt('on the summary')
  ok(finalTrail.some(c => /Northampton/i.test(c.text)),
    `the club is named in full on the last step (${finalTrail.map(c => c.text).join(' | ')})`)
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav', { timeout: 15000 })
  await report('home')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.waitForSelector('.submenu-item', { timeout: 8000 })
  await report('hub menu')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.xv-split', { timeout: 8000 })
  await report('team: selection')
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Tactics')
  await page.waitForSelector('.form-pitch', { timeout: 8000 })
  await report('tactics: pitch')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Fixtures & Results')
  await page.waitForTimeout(500)
  await report('fixtures')

  // ---- the day bulletin, which is where Continue now lands between matches
  // The day name is the loudest thing on the screen by design, so it is also the
  // most likely thing to be truncated on 412px. Measured like any other page.
  let sawBulletin = false
  for (let tap = 0; tap < 8 && !sawBulletin; tap++) {
    if (await page.locator('text=Kick Off').count()) break
    await page.click('.continue-btn')
    await page.waitForTimeout(450)
    const head = await page.evaluate(() => {
      const d = document.querySelector('.day-head')
      if (!d) return null
      const day = d.querySelector('.dh-day')
      return {
        day: day?.textContent ?? '',
        clipped: day ? day.scrollWidth > day.clientWidth + 2 : false,
        theme: d.querySelector('.dh-theme')?.textContent ?? '',
        date: d.querySelector('.dh-date')?.textContent ?? '',
        h: Math.round(d.getBoundingClientRect().height),
      }
    })
    if (!head) continue
    sawBulletin = true
    console.log(`\n--- bulletin: ${head.day} / ${head.theme} / ${head.date}, header ${head.h}px`)
    ok(!head.clipped, `the day name fits its own line (${head.day})`)
    ok(head.h <= 150, `the header is a header, not a screenful (${head.h}px)`)
    await report(`day: ${head.day.toLowerCase()}`)
  }
  ok(sawBulletin, 'Continue reaches a day bulletin in the first week')

  // ---- the masthead earns its height: arrow, title and date on one row
  const mh = await page.evaluate(() => {
    const head = document.querySelector('.masthead')
    const back = document.querySelector('.masthead .back-btn')
    const h1 = document.querySelector('.masthead h1')
    const date = document.querySelector('.masthead .date')
    const ctl = document.querySelector('.mast-ctl')
    const top = e => (e ? Math.round(e.getBoundingClientRect().top) : null)
    return {
      h: Math.round(head?.getBoundingClientRect().height ?? 0),
      back: top(back), h1: top(h1), date: top(date), ctl: top(ctl),
    }
  })
  console.log(`\n--- masthead: ${mh.h}px tall, tops back ${mh.back} title ${mh.h1} date ${mh.date} controls ${mh.ctl}`)
  // baseline-aligned, so allow a few px between the title and the date
  ok(mh.h1 != null && mh.date != null && Math.abs(mh.h1 - mh.date) <= 10,
    'the title and the date share a row')
  ok(mh.back == null || (mh.h1 != null && Math.abs(mh.back - mh.h1) <= 16),
    'the back arrow is on that row too, not alone above it')
  ok(mh.ctl == null || (mh.h1 != null && mh.ctl > mh.h1 + 8), 'the controls take the row below')
  ok(mh.h <= 118, `the whole masthead is two rows, not four (${mh.h}px)`)

  // ---- the transfer filters on one line
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Transfer Centre')
  await page.waitForSelector('.filter-line', { timeout: 8000 })
  const fr = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.filter-line')].map(row => {
      const kids = [...row.children]
      const tops = kids.map(e => Math.round(e.getBoundingClientRect().top))
      // a control whose label is clipped is the "boxes overlap" complaint: the
      // text does not fit the box it is in, so the box looks like it is on top
      // of its neighbour
      const clipped = kids.filter(e => e.scrollWidth > e.clientWidth + 2)
        .map(e => (e.tagName === 'SELECT' ? e.options[e.selectedIndex].text : e.textContent.trim()))
      return {
        n: kids.length, spread: Math.max(...tops) - Math.min(...tops), clipped,
        labels: kids.map(e => (e.tagName === 'SELECT' ? e.options[e.selectedIndex].text : (e.value || e.placeholder || e.textContent).trim())),
      }
    })
    return rows
  })
  for (const row of fr) {
    console.log(`\n--- filters: ${row.n} controls [${row.labels.join(' | ')}], top spread ${row.spread}px`)
    ok(row.spread <= 2, `all on one line (${row.spread}px spread)`)
    ok(row.clipped.length === 0, `no filter label is clipped by its own box${row.clipped.length ? ` [${row.clipped.join(', ')}]` : ''}`)
  }
  ok(fr.length === 2 && fr[0].n === 2 && fr[1].n === 4, `two rows of filters, 2 then 4 (${fr.map(r => r.n).join('+')})`)
  await report('transfers')

  // ---- every squad table keeps its heading at the top, and fits the screen
  //
  // The bug this exists for: .tblwrap declared overflow-x: auto, CSS computed
  // overflow-y to auto with it, and the wrapper became a scrollport that never
  // scrolls - so `position: sticky; top: var(--stickyh)` pushed the heading row
  // --stickyh pixels DOWN from the wrapper's top and parked it among the
  // players. Two rows of the squad, then the column headings, then the rest
  // (user: "weird bug on select where the column headers are amongst the players
  // names so not at the top - same for stats, game time, contracts"). Measured
  // as a rule rather than a screenshot: no heading may sit below the first row
  // of the body, on any of the five views.
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.tab-bar', { timeout: 8000 })
  // 'Selection' is the team sheet pane (25B) - it has no thead, so the
  // heading law skips it and the four tables carry the check
  for (const view of ['Selection', 'General Info', 'Stats', 'Game Time', 'Contracts']) {
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
    if (!t) { console.log(`--- ${view}: no table to measure`); continue }
    console.log(`--- ${view}: heading at y=${t.head}, first row y=${t.firstRow}, table right edge ${t.tblRight} of ${t.viewport}`)
    ok(t.firstRow == null || t.head <= t.firstRow,
      `the column headings are above the players, not among them (${t.head} vs ${t.firstRow})`)
    ok(t.tblRight <= t.viewport + 1,
      `the table fits the screen, so no column hides past the right edge (${t.tblRight} of ${t.viewport})`)
  }

  // ---- contracts: every man, his wage and his expiry, in one place
  await page.click('.tab-bar >> text=Contracts')
  await page.waitForTimeout(400)
  const con = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.dtable tbody tr')]
    const heads = [...document.querySelectorAll('.dtable thead th')].map(e => e.textContent.replace(/[▾▴]/g, '').trim())
    const yrs = rows.map(r => r.children[5]?.textContent?.trim()).filter(Boolean)
    return { rows: rows.length, heads, sampleYears: yrs.slice(0, 3), allYears: yrs.every(y => /^20\d\d$/.test(y)) }
  })
  console.log(`--- contracts: ${con.rows} men, columns [${con.heads.join(', ')}], years ${con.sampleYears.join('/')}`)
  ok(con.rows > 20, `the whole squad is listed, not a top-earners sample (${con.rows})`)
  // Matched on a prefix, not the exact string. The header used to read "Wage"
  // and now reads "Wage /wk", because the per-week unit moved out of every single
  // row and into the column heading once (user: "we dont need /wk next to every
  // one"). An exact-match assertion on a label is a test of the wording rather
  // than of the layout, and it failed on a rename that fixed what it was for.
  ok(con.heads.some(h => h.startsWith('Wage')) && con.heads.includes('Until'),
    `wage and expiry are both columns [${con.heads.join(', ')}]`)
  ok(con.allYears, 'every man shows a contract year')
  await report('squad: contracts')

  // ---- the score column has one axis
  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Fixtures & Results')
  await page.waitForTimeout(400)
  const sc = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.rs-d')]
    if (!d.length) return null
    const mids = d.map(e => { const r = e.getBoundingClientRect(); return Math.round(r.left + r.width / 2) })
    return { n: d.length, spread: Math.max(...mids) - Math.min(...mids) }
  })
  if (sc) {
    console.log(`--- scores: ${sc.n} results, dash x spread ${sc.spread}px`)
    ok(sc.spread <= 1, `every dash sits on the same axis (${sc.spread}px spread)`)
  } else {
    console.log('--- scores: no results on this screen to measure')
  }
} catch (e) {
  console.error('PORTRAIT QA stopped early:', e.message)
  fails++
}
console.log(`\n${fails ? `PORTRAIT QA FAILED (${fails})` : 'PORTRAIT QA PASSED'}`)
await browser.close()
server.stop()
process.exit(fails ? 1 : 0)
