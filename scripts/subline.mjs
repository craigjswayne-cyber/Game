// ---- ONE LINE UNDER A TITLE. EVERYWHERE. ----
//
// Owner, on the Marquee Players heading: "the line under marquee players -
// reduce so its all on one line. make this a habit across the game."
//
// A habit is a thing somebody has to remember, and somebody eventually does not.
// This measures it instead. Every string that goes into SectionTitle's `sub` -
// eighty-odd of them, in both languages - is rendered into a real
// `.section-title` at real phone width, with the app's own stylesheet and its
// own fonts, and asked how many lines it took. More than one is a failure.
//
// WHY IT IS MEASURED AND NOT COUNTED. A character budget is the obvious
// shortcut and it is wrong twice over: the sub is a proportional 11px face, so
// "Wimbledon" and "IIIIIIIII" are nothing like the same width, and French runs
// perhaps a fifth longer than English for the same sentence, so one budget
// cannot serve both. The browser already knows the answer. Ask it.
//
// The width the sub gets is the width of a section heading's content box on the
// owner's phone - 412 logical pixels less the heading's own 14px of padding
// either side. When a sub cannot fit beside its title it drops to its own line
// at that full width, which is the generous case; this measures the generous
// case, so anything that fails here fails everywhere.
//
// Run: node scripts/subline.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { readFileSync, readdirSync } from 'node:fs'
import { writeSync } from 'node:fs'
import { done, startPreview } from './lib/preview.mjs'

const say = s => writeSync(1, s + '\n')
let fails = 0
const ok = (cond, what) => { say(`${cond ? '  ok  ' : 'FAIL  '}${what}`); if (!cond) fails++ }

// ---- every key the UI actually puts in a sub ----
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])

// A heading is a PAIR - the title and the line under it share one flex row, and
// that is the whole of why this probe exists. Measuring a sub on its own said
// every one of them fitted; the owner's screenshot said otherwise, because
// MARQUEE PLAYERS was sitting next to it taking a third of the width. So the
// title travels with the sub and both are rendered together.
const pairs = new Map()   // `${titleKey}|${subKey}` -> {title, sub}
for (const f of walk('src/ui').filter(f => /\.tsx?$/.test(f))) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/<SectionTitle\b([\s\S]*?)>([\s\S]*?)<\/SectionTitle>/g)) {
    const [, attrs, body] = m
    const subs = [...attrs.matchAll(/sub=\{[\s\S]*?\}/g)].flatMap(a =>
      [...a[0].matchAll(/t\(\s*['"]([\w.]+)['"]/g)].map(k => k[1]))
    if (!subs.length) continue
    const titles = [...body.matchAll(/t\(\s*['"]([\w.]+)['"]/g)].map(k => k[1])
    for (const sub of subs) {
      // an unknown title is the widest reasonable guess rather than nothing:
      // a heading with no measurable title still squeezes its sub in practice
      for (const title of (titles.length ? titles : [null])) {
        pairs.set(`${title}|${sub}`, { title, sub })
      }
    }
  }
}
say(`  ${pairs.size} title/subtitle pairs found in src/ui`)
ok(pairs.size > 40, 'the scan found the headings rather than nothing')

// ---- what each one says, in both languages ----
// A hole gets a value that is plausibly the widest a real one would be: a
// two-digit count, a full club name, a real money string. Filling {n} with "1"
// would let a line that breaks at "12" pass.
const FILL = {
  n: '12', max: '32', floor: '23', amount: '£12.5m', fee: '£25,000', weekly: '£12.5k',
  club: 'Northampton', player: 'Louis Bielle-Biarrey', name: 'Louis Bielle-Biarrey',
  week: '27', season: '2025-26', nat: 'New Zealand', pos: 'Second row', opp: 'Northampton',
  // TWO CLUB NAMES IN ONE LINE. The dressing-room modal says "{home} v {away}
  // - one speech, choose the tone" and these two holes had no entry, so they
  // fell through to the '12' default and the line was measured as "12 v 12 -
  // one speech, choose the tone". It passed at every size while the owner was
  // looking at it wrapped on his phone. A hole for a club name gets a club
  // name, and the longest real one in the game.
  home: 'Northampton', away: 'Northampton',
  cap: '£6.4m', over: '£240k', step: '£500,000', budget: '£96m', balance: '£12.5m',
}
const fill = (s) => String(s).replace(/\{(\w+)(?:_k|_l|_ll)?\}/g, (_m, k) => FILL[k] ?? '12')

const langs = {}
for (const l of ['en', 'fr']) {
  const d = JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8'))
  langs[l] = d
}
const lookup = (d, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), d)

/** Every written form of one key, filled in. A plural entry contributes both. */
const forms = (d, key) => {
  const v = lookup(d, key)
  if (v == null) return []
  return (typeof v === 'string' ? [v] : Object.values(v).filter(x => typeof x === 'string')).map(fill)
}

const lines = []
for (const { title, sub } of [...pairs.values()].sort((a, b) => (a.sub > b.sub ? 1 : -1))) {
  for (const l of ['en', 'fr']) {
    const subForms = forms(langs[l], sub)
    if (!subForms.length) continue
    // the LONGEST title this heading can carry, because that is the one that
    // leaves the sub least room
    const titleForms = title ? forms(langs[l], title) : ['']
    const widest = titleForms.sort((a, b) => b.length - a.length)[0] ?? ''
    for (const text of subForms) lines.push({ key: sub, lang: l, title: widest, text })
  }
}
say(`  ${lines.length} headings to measure (both languages, both plural forms)`)

const server = await startPreview(4247, 2500)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 })
await page.goto('http://localhost:4247/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

// AND AT EVERY TEXT SIZE THE GAME OFFERS. The zoom control (store.textScale)
// goes to 1.3, which is the whole point of having it - somebody is reading this
// on a phone at arm's length. Zoom takes width away from the layout in exact
// proportion, so a heading that fits at 1.0 and breaks at 1.3 is broken for the
// people who need it most. All three, or the rule is not a rule.
const SCALES = [1, 1.15, 1.3]
const measured = { one: 0, over: [] }
for (const scale of SCALES) {
  const got = await measureAt(page, lines, scale)
  measured.one += got.one
  measured.over.push(...got.over.map(o => ({ ...o, scale })))
}

async function measureAt(page, rows, scale) {
  return page.evaluate(async ([rows, scale]) => {
    await document.fonts.ready
  // a real section heading, off-screen, at the width one gets on the page
  const host = document.createElement('div')
  // The app applies its text scale as a zoom on the document root, so a 412px
  // phone holds 412/scale CSS pixels of layout. Setting the host to 412 AND
  // zooming it would render a 536px-wide heading on a 412px phone and measure
  // nothing at all - the first version of this did exactly that and reported a
  // clean sweep at every size.
  host.style.cssText = `position:fixed;left:-9999px;top:0;width:${412 / scale}px;zoom:${scale}`
  const head = document.createElement('div')
  head.className = 'section-title'
  // the title lives in the first span, exactly as SectionTitle renders it
  const titleWrap = document.createElement('span')
  const titleText = document.createElement('span')
  titleWrap.appendChild(titleText)
  const span = document.createElement('span')
  span.className = 'sub'
  head.appendChild(titleWrap)
  head.appendChild(span)
  host.appendChild(head)
  document.body.appendChild(host)
  // HOW MANY LINES, MEASURED BY HEIGHT.
  //
  // getClientRects().length is the obvious answer and it is silently wrong
  // here: the sub is a FLEX ITEM, so it is a block box and reports exactly one
  // rect however many lines of text are inside it. This probe passed 612 of 612
  // on that reading while the sub was visibly three lines deep at the largest
  // text size. So: one line of this element, measured, and everything against
  // that.
  span.textContent = 'x'
  const oneLine = span.getBoundingClientRect().height
  const one = []
  const over = []
  for (const r of rows) {
    titleText.textContent = r.title
    span.textContent = r.text
    const box = span.getBoundingClientRect()
    const rows_ = Math.round(box.height / oneLine)
    if (rows_ > 1) over.push({ ...r, rects: rows_, w: Math.round(box.width) })
    else one.push(r)
  }
  host.remove()
  return { one: one.length, over }
  }, [rows, scale])
}

say(`  ${measured.one} fit on one line, ${measured.over.length} do not`)
// GROUPED BY KEY, because one string is one edit however many text sizes and
// languages it breaks at. Worst first, so the biggest offenders are the ones
// you read.
const byKey = new Map()
for (const o of measured.over) {
  const g = byKey.get(`${o.lang} ${o.key}`) ?? { ...o, at: [] }
  g.at.push(o.scale)
  g.rects = Math.max(g.rects, o.rects)
  byKey.set(`${o.lang} ${o.key}`, g)
}
const worst = [...byKey.entries()].sort((a, b) => b[1].rects - a[1].rects || b[1].text.length - a[1].text.length)
say(`  ${byKey.size} strings to shorten`)
for (const [k, o] of worst.slice(0, 70)) {
  say(`    ${k}: up to ${o.rects} lines (x${o.at.join(' x')}) - "${o.text}"`)
}
if (worst.length > 70) say(`    ...and ${worst.length - 70} more`)
if (process.env.SUBLINE_JSON) {
  // the full list, for the pass that rewrites them
  writeSync(1, '\nJSON ' + JSON.stringify(worst.map(([k, o]) => [k, o.text, o.rects])) + '\n')
}

ok(measured.over.length === 0, `every line under a section title fits on one line, in both languages, at all ${SCALES.length} text sizes`)

await browser.close()
say(fails === 0
  ? '\nSUBLINE PASSED: one line under a title, everywhere, in both languages'
  : `\nSUBLINE FAILED: ${fails}`)
// done() takes the FAILURE COUNT and exits with it - it is not a server
// shutdown. Handing it the server object exited 1 on a clean run, which is how
// this probe reported red while printing every ok.
done(fails)
