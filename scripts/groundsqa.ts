/**
 * Look at the club grounds, at every level, without playing a season to get
 * there.
 *
 *   npx vite-node scripts/groundsqa.ts [out.png]
 *
 * ClubGrounds is a pure function of a club: capacity, colours and nine facility
 * levels in, one SVG out. So it can be rendered on its own against invented
 * clubs, which is the only practical way to SEE the states that a real career
 * reaches years apart - a threadbare estate, a half-built one, a world-class
 * one, and the builders on site.
 *
 * It renders the real component, not a copy of it, against the real theme
 * files. A harness that re-implements the thing it is checking checks nothing.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import ClubGrounds from '../src/ui/ClubGrounds'
import { FACILITY_INFO, type Club, type FacilityId } from '../src/game/model'

const IDS = Object.keys(FACILITY_INFO) as FacilityId[]
const facs = (fn: (i: number) => number) =>
  Object.fromEntries(IDS.map((f, i) => [f, fn(i)])) as Record<FacilityId, number>

const CASES: { title: string; club: Partial<Club>; building: FacilityId | null }[] = [
  { title: 'Threadbare · 8,500', building: null,
    club: { short: 'BRK', colors: ['#7a2230', '#f0e2c8'], capacity: 8_500, facilities: facs(i => (i < 2 ? 1 : 0)) } },
  { title: 'Good · 24,000 · building', building: 'academy',
    club: { short: 'CAL', colors: ['#1f5e3a', '#e9be68'], capacity: 24_000, facilities: facs(i => 2 + (i % 2)) } },
  { title: 'World class · 82,000', building: null,
    club: { short: 'STM', colors: ['#12325e', '#d8dee8'], capacity: 82_000, facilities: facs(() => 5) } },
]

const body = CASES.map(c => `<figure><figcaption>${c.title}</figcaption>${
  renderToStaticMarkup(createElement(ClubGrounds, {
    club: c.club as Club, buildingId: c.building, selected: null, onPick: () => {},
  }))}</figure>`).join('')

const css = ['src/ui/tokens.css', 'src/ui/theme.css'].map(f => readFileSync(f, 'utf8')).join('\n')
const shell = (cls: string) => `<!doctype html><meta charset="utf-8"><style>${css}
  body { margin: 0; background: var(--canvas); font-family: system-ui; }
  .row { display: flex; }
  /* 330px is the width of a card on a 360px phone - the size this is
     actually read at, not whatever the window happens to be. */
  figure { margin: 0; flex: 0 0 330px; padding: 8px; }
  figcaption { font: 700 11px/1.6 system-ui; color: var(--text-primary); letter-spacing: 1px; text-transform: uppercase; }
  </style><div class="app ${cls}"><div class="row">${body}</div></div>`

const OUT = process.argv[2] ?? 'grounds.png'
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1050, height: 320 }, deviceScaleFactor: 2 })
const shots: Buffer[] = []
for (const cls of ['night', 'day']) {
  await page.setContent(shell(cls))
  shots.push(await page.screenshot({ fullPage: true }))
}
// one file, both themes, because the whole risk here is a drawing that is
// legible in the dark and a grey smear in daylight
const stacked = await page.evaluate(async (b64s) => {
  const imgs = await Promise.all(b64s.map(async (b: string) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im
  }))
  const c = document.createElement('canvas')
  c.width = Math.max(...imgs.map(i => i.width))
  c.height = imgs.reduce((s, i) => s + i.height, 0)
  const g = c.getContext('2d')!
  let y = 0
  for (const i of imgs) { g.drawImage(i, 0, y); y += i.height }
  return c.toDataURL('image/png')
}, shots.map(b => b.toString('base64')))
writeFileSync(OUT, Buffer.from(stacked.split(',')[1], 'base64'))
console.log(`${OUT}: ${CASES.length} estates x night/day`)
await browser.close()
