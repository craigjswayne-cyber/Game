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
 *
 * THE LADDER, under the three estates: the same club with every facility at
 * level 0, then 1, then 2, and so on to 5. That row answers the only question
 * this drawing really has to answer - can you SEE what the board paid for -
 * and it answers it for all six states rather than for the three a career
 * happens to pass through slowly. A level that looks like its neighbour is a
 * level the map cannot show, and this is where that would be obvious.
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

const draw = (club: Partial<Club>, building: FacilityId | null) =>
  renderToStaticMarkup(createElement(ClubGrounds, {
    club: club as Club, buildingId: building, selected: null, onPick: () => {},
  }))

const body = CASES.map(c =>
  `<figure><figcaption>${c.title}</figcaption>${draw(c.club, c.building)}</figure>`).join('')

/** Every facility at the same level, 0 to 5. */
const LADDER = [0, 1, 2, 3, 4, 5].map(l =>
  `<figure><figcaption>all at level ${l}</figcaption>${draw({
    short: 'LAD', colors: ['#1f5e3a', '#e9be68'], capacity: 24_000, facilities: facs(() => l),
  }, null)}</figure>`).join('')

const css = ['src/ui/tokens.css', 'src/ui/theme.css'].map(f => readFileSync(f, 'utf8')).join('\n')
const shell = (cls: string) => `<!doctype html><meta charset="utf-8"><style>${css}
  body { margin: 0; background: var(--canvas); font-family: system-ui; }
  /* .app is the GAME's shell - a 560px-wide flex column the height of a phone -
     and this page is a contact sheet, not a phone. The class has to stay,
     because it is what carries the theme's tokens onto everything below it;
     the layout it brings with them does not. Without this the two rows were
     laid out inside a 560px box and printed on top of each other. */
  .app { display: block !important; max-width: none !important; height: auto !important;
         box-shadow: none !important; }
  .row { display: flex; }
  /* THE LADDER IS RENDERED AT THE SIZE IT IS PLAYED AT, which is the whole
     point of it. Six cells across one row made each campus 154px wide, and the
     map is up to 440px wide on a phone - so every judgement made from that row
     was made at a third of the real scale, and every detail looked worse than
     it is. Three across, two rows down, at the same 330px the estates above
     use. A contact sheet that lies about size is worse than no contact sheet. */
  .row.ladder { flex-wrap: wrap; width: 1040px; }
  .row.ladder figure { flex: 0 0 330px; }
  /* 330px is the width of a card on a 360px phone - the size this is
     actually read at, not whatever the window happens to be. */
  figure { margin: 0; flex: 0 0 330px; padding: 8px; }
  figcaption { font: 700 11px/1.6 system-ui; color: var(--text-primary); letter-spacing: 1px; text-transform: uppercase; }
  </style><div class="app ${cls}"><div class="row">${body}</div><div class="row ladder">${LADDER}</div></div>`

const OUT = process.argv[2] ?? 'grounds.png'
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1060, height: 320 }, deviceScaleFactor: 2 })
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
console.log(`${OUT}: ${CASES.length} estates and a 0-5 ladder, night and day`)
await browser.close()
