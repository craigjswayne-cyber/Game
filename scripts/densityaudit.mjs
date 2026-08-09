// How much of the first screenful is chrome?
//
// User, with a screenshot of The Rugby Wire: "for example do we need the rugby
// wire twice" - the top bar said The Rugby Wire and then the page said THE RUGBY
// WIRE again underneath it, with a tagline, over a rule, before a single story.
// And more generally: "i still think there is far too much space wasted in this
// game with boxes".
//
// scrollaudit measures how TALL a screen is. That is a different question and it
// misses this one entirely: a screen can be a tidy 1.2 screenfuls and still
// spend its first 120 pixels telling you the name of the screen you just tapped.
//
// So this measures three things per screen:
//
//   dup      does the page repeat the masthead title in its own content?
//   ink      how much of the first screenful actually says a word. The rest is
//            padding, margin and gap.
//   boxes    how deep the padded containers nest, because "boxes" is the word in
//            the complaint and a card inside a panel inside a section pays three
//            sets of padding to show one number.
//
// A screen with too little content to judge is marked ~ and left out of the
// average: no amount of tightening fills a Press Room nobody has visited yet.
import { chromium } from 'playwright-core'
import { startPreview } from './lib/preview.mjs'

const server = await startPreview('4191', 2500)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 844, height: 390 } })
await page.addInitScript(() => localStorage.setItem('rm-night', '1'))

const rows = []

const measure = async (name) => {
  await page.waitForTimeout(320)
  const m = await page.evaluate(() => {
    const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[^a-z0-9 ]/g, '')
    const scroller = document.querySelector('main.content') ?? document.scrollingElement
    const top = scroller.getBoundingClientRect().top

    // the masthead title, which the page has already been given for free
    const title = norm(document.querySelector('.masthead h1')?.textContent)

    // Anything in the content that says the same thing again. A short heading is
    // the giveaway: a story headline that happens to contain the words is fine,
    // a 30-character element that IS the title is not.
    let dup = null
    if (title.length > 3) {
      for (const el of scroller.querySelectorAll('h1, h2, h3, .wire-brand, .section-title, .card-title')) {
        const t = norm(el.textContent)
        if (!t || t.length > title.length + 6) continue
        if (t === title || title.includes(t) && t.length > 8) {
          const r = el.getBoundingClientRect()
          if (r.height > 4) { dup = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 34); break }
        }
      }
    }

    // "Far too much space wasted in this game with boxes." So measure the space.
    //
    // Two numbers, neither of which needs a list of class names - an earlier
    // version of this file tried "first element matching .wire-card, .fact-val,
    // .dtable tbody tr, ..." and six screens came back blank because they are
    // built out of classes that were not on the list. Enumerating what you happen
    // to know about instead of measuring the thing has cost this project three
    // rounds already.
    //
    //   ink    what fraction of the first screenful is covered by something that
    //          actually says a word. Everything else is padding, margin and gap.
    //   boxes  how deep the padded containers nest. A card inside a panel inside
    //          a section pays for three sets of padding to show one number, and
    //          that is what "boxes" means in the complaint.
    const H = scroller.clientHeight
    const W = scroller.clientWidth
    let inked = 0
    let deepest = 0
    let contentBottom = top
    const walker = document.createTreeWalker(scroller, NodeFilter.SHOW_ELEMENT)
    for (let el = walker.nextNode(); el; el = walker.nextNode()) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      // clip to the first screenful: below the fold is a scrolling problem, not
      // a density one, and scrollaudit already owns that question
      const y0 = Math.max(r.top, top), y1 = Math.min(r.bottom, top + H)
      if (y1 - y0 <= 0) continue

      // a leaf that carries its own words is ink
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
      if (own) {
        inked += Math.min(r.width, W) * (y1 - y0)
        if (r.bottom > contentBottom) contentBottom = r.bottom
      }

      // how many padded ancestors does it sit inside
      if (own) {
        let depth = 0
        for (let a = el; a && a !== scroller; a = a.parentElement) {
          const p = getComputedStyle(a)
          if (parseFloat(p.paddingTop) + parseFloat(p.paddingBottom) >= 10) depth++
        }
        if (depth > deepest) deepest = depth
      }
    }
    // Nested text-bearing elements double-count, so this is an index of how
    // busy the screenful looks rather than a true coverage percentage. Clamped
    // so a dense table does not read as 102%.
    const ink = Math.min(100, Math.round((inked / (W * H)) * 100))
    // A page with almost nothing to show is not a padding problem. The Press
    // Room in week 1 has one sentence in it because no journalist has turned up
    // yet, and no amount of tightening will raise its score.
    //
    // The first version tested scroller.scrollHeight < H * 0.75, which can never
    // be true: scrollHeight has a floor of clientHeight, so no screen was ever
    // marked sparse and the marker silently did nothing. Measure where the words
    // actually stop instead.
    const sparse = contentBottom - top < H * 0.6
    return { dup, ink, boxes: deepest, sparse }
  })
  rows.push({ name, ...m })
}

try {
  await page.goto('http://localhost:4191/')
  await page.waitForSelector('text=RUGBY', { timeout: 15000 })
  await page.click('text=New Career')
  await page.waitForSelector('text=Gallagher Premiership')
  await page.click('text=Gallagher Premiership')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Northampton')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Density')
  await page.click('.speech-tile >> text=Forward Dominance')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForTimeout(400)
  await measure('home')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text="Team"')
  await page.waitForSelector('.dtable')
  await measure('squad')
  await page.click('.dtable tbody tr >> nth=0')
  await page.waitForSelector('text=Attributes')
  await measure('player: profile')
  await page.click('.back-btn')

  await page.click('.bottom-nav button[title="Hub"]')
  await page.click('.submenu-item >> text=Selection & Tactics')
  await page.waitForSelector('.tab-bar')
  await measure('tactics: selection')
  for (const [tab, label] of [['Tactics', 'tactics'], ['Prep', 'match prep'], ['Game Plan', 'game plan']]) {
    await page.click(`.tab-bar >> text=${tab}`)
    await measure(`tactics: ${label}`)
  }

  for (const [item, label] of [
    ['Team Report', 'team report'], ['Medical Centre', 'medical centre'],
    ['Fixtures & Results', 'fixtures'], ['Finances', 'finances'],
    ['Transfer Centre', 'transfers'],
    ['Training & Staff', 'training'], ['Club Infrastructure', 'infrastructure'],
    ['Club Information', 'club information'],
  ]) {
    await page.click('.bottom-nav button[title="Hub"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }

  // the press room sits under Manager, not the hub
  for (const [item, label] of [['Press Room', 'press room']]) {
    await page.click('.bottom-nav button[title="Manager"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }

  for (const [item, label] of [
    ['The Rugby Wire', 'the wire'], ['Team of the Week', 'team of the week'],
    ['Scouting Agency', 'scouting agency'], ['Competitions', 'competitions'],
    ['International Rugby', 'international rugby'], ['Roll of Honour', 'roll of honour'],
  ]) {
    await page.click('.bottom-nav button[title="World"]')
    await page.click(`.submenu-item >> text=${item}`)
    await measure(label)
  }
} catch (e) {
  console.error('DENSITY AUDIT stopped early:', e.message)
}

// Two boxes deep is a card inside the page. Three is a card inside a card, and
// on a 390px-tall phone that third set of padding is worth about a table row.
const BOX_LIMIT = 3
const dups = rows.filter(r => r.dup)
const nested = rows.filter(r => r.boxes >= BOX_LIMIT)

console.log('\n ink  boxes  dup                              screen')
rows.sort((a, b) => a.ink - b.ink)
for (const r of rows) {
  const flag = r.boxes >= BOX_LIMIT ? '!' : r.sparse ? '~' : ' '
  console.log(`${String(r.ink).padStart(3)}%  ${r.boxes} ${flag}    ${(r.dup ?? '').padEnd(32)} ${r.name}`)
}
const full = rows.filter(r => !r.sparse)
const avg = full.length ? full.reduce((s, r) => s + r.ink, 0) / full.length : 0
console.log(`\n${rows.length} screens measured (~ = too little content to judge, excluded from the average)`)
console.log(`${avg.toFixed(1)}% average ink across the ${full.length} screens with something on them`)
console.log(`${dups.length} repeat the masthead title in the content`)
console.log(`${nested.length} nest padded boxes ${BOX_LIMIT} deep or more`)
if (dups.length) console.log('DENSITY AUDIT FAILED: a screen states its own name twice')
else console.log('DENSITY AUDIT PASSED (no duplicate titles)')
await browser.close()
server.stop()
process.exit(dups.length ? 1 : 0)
