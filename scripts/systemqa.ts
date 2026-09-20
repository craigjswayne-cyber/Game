/**
 * Every primitive, in every state, in both themes, on one sheet.
 *
 *   npx vite-node scripts/systemqa.ts [out.png]
 *
 * WHY THIS AND NOT A STORYBOOK. The same argument the rest of this repo
 * makes about runtime dependencies: what is needed here is a picture of the
 * parts, and Storybook is a build system, a dev server and forty packages to
 * get one. This renders the REAL components against the REAL stylesheets
 * with react-dom/server and screenshots the result, which is the same trick
 * scripts/groundsqa.ts uses for the campus.
 *
 * WHAT IT IS FOR. A design system fails quietly: a state nobody drew, a
 * disabled button that looks enabled, a tone that vanishes under the
 * daylight theme, a loading spinner the same colour as its own label. None
 * of those show up on a screen that happens not to use that state. They show
 * up here, side by side, every time.
 *
 * It is a REPORTER, not a probe - it has no pass or fail to give, it writes
 * a picture. scripts/suite.sh lists it under REPORTERS for that reason, the
 * same as groundsqa. The thing that DOES fail on this system is tokenlint,
 * which ratchets the inline-style count so screens cannot drift back off it.
 */
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import {
  Button, Chip, Divider, Grow, Icon, Inline, Meter, Panel, Rating, Stack, StatTile, Tabs, Text,
} from '../src/ui/primitives'
import {
  IcoAcademy, IcoAlert, IcoBuild, IcoCalendar, IcoChart, IcoCheck, IcoChevronRight, IcoClock,
  IcoCog, IcoDeal, IcoDoor, IcoFilter, IcoGrowth, IcoMedical, IcoMegaphone, IcoMoney, IcoPeople,
  IcoPerson, IcoPitch, IcoPlay, IcoSave, IcoSearch, IcoShirt, IcoSkip, IcoStadium, IcoStar,
  IcoTarget, IcoTraining, IcoWhistle,
} from '../src/ui/icons'

const row = (label: string, ...kids: ReactNode[]) =>
  h(Stack, { gap: 2, key: label },
    h(Text, { role: 'overline' }, label),
    h(Inline, { gap: 2, wrap: true }, ...kids))

const section = (title: string, ...kids: ReactNode[]) =>
  h(Panel, { key: title },
    h(Stack, { gap: 4 }, h(Text, { role: 'section' }, title), ...kids))

const ICONS: [string, () => JSX.Element][] = [
  ['medical', IcoMedical], ['training', IcoTraining], ['chart', IcoChart], ['academy', IcoAcademy],
  ['money', IcoMoney], ['stadium', IcoStadium], ['build', IcoBuild], ['calendar', IcoCalendar],
  ['person', IcoPerson], ['people', IcoPeople], ['cog', IcoCog], ['search', IcoSearch],
  ['filter', IcoFilter], ['check', IcoCheck], ['play', IcoPlay], ['skip', IcoSkip],
  ['whistle', IcoWhistle], ['alert', IcoAlert], ['star', IcoStar], ['shirt', IcoShirt],
  ['door', IcoDoor], ['save', IcoSave], ['pitch', IcoPitch], ['megaphone', IcoMegaphone],
  ['target', IcoTarget], ['clock', IcoClock], ['deal', IcoDeal], ['growth', IcoGrowth],
]

const sheet = h(Stack, { gap: 4 },
  // TYPE FIRST, because it is the layer that carries the identity and the
  // one the old system had collapsed into a single face.
  section('Type',
    h(Text, { role: 'hero' }, '27 – 19'),
    h(Text, { role: 'figure', num: true }, '68'),
    h(Text, { role: 'title' }, 'Leicester RFC'),
    h(Text, { role: 'section' }, 'Treatment room'),
    h(Text, { role: 'overline' }, 'Next match · club friendly'),
    h(Text, { role: 'label' }, 'Loosehead Prop · England · 24'),
    h(Text, { role: 'lead' }, 'The board of Leicester RFC is delighted to confirm the appointment.'),
    h(Text, { role: 'body' }, 'A 24-year-old loosehead prop, a solid squad player. Fit and available.'),
    h(Text, { role: 'meta', tone: 'muted' }, 'Cédric Lassalle · injuries roughly 36% shorter')),

  section('Buttons · intent',
    row('primary',
      h(Button, { intent: 'primary', size: 'sm' }, 'Small'),
      h(Button, { intent: 'primary' }, 'Continue'),
      h(Button, { intent: 'primary', size: 'lg', iconRight: IcoChevronRight }, 'Kick off')),
    row('secondary', h(Button, {}, 'Secondary'), h(Button, { icon: IcoFilter }, 'Filter')),
    row('ghost', h(Button, { intent: 'ghost' }, 'Ghost'), h(Button, { intent: 'ghost', icon: IcoStar }, 'Shortlist')),
    row('danger', h(Button, { intent: 'danger' }, 'Release player'))),

  section('Buttons · state',
    row('default / selected / disabled / loading',
      h(Button, {}, 'Default'),
      h(Button, { selected: true }, 'Selected'),
      h(Button, { disabled: true }, 'Disabled'),
      h(Button, { loading: true }, 'Loading')),
    row('primary, same four',
      h(Button, { intent: 'primary' }, 'Default'),
      h(Button, { intent: 'primary', selected: true }, 'Selected'),
      h(Button, { intent: 'primary', disabled: true }, 'Disabled'),
      h(Button, { intent: 'primary', loading: true }, 'Loading')),
    row('block', h(Button, { intent: 'primary', block: true, size: 'lg' }, 'Take the field'))),

  section('Tiles',
    h(Inline, { gap: 2, wrap: true },
      h(StatTile, { label: 'Balance', value: '£2.1m', delta: '£140k', deltaDir: 'up' }),
      h(StatTile, { label: 'Board', value: '70%', sub: 'confidence' }),
      h(StatTile, { label: 'Wage bill', value: '£261k', delta: '£12k', deltaDir: 'down', sub: 'per week' }),
      h(StatTile, { label: 'League', value: '6th', size: 'lg' }))),

  section('Chips',
    row('status only, never a value',
      h(Chip, {}, 'Fit'),
      h(Chip, { tone: 'pos', icon: IcoCheck }, 'Available'),
      h(Chip, { tone: 'val', icon: IcoStar }, 'Captain'),
      h(Chip, { tone: 'neg', icon: IcoAlert }, 'Out 6 wks'),
      h(Chip, { tone: 'info' }, 'Listed'))),

  section('Tabs',
    h(Tabs, { value: 'selection', onChange: () => {}, items: [
      { id: 'selection', label: 'Selection' }, { id: 'depth', label: 'Depth' },
      { id: 'general', label: 'General info' }, { id: 'stats', label: 'Stats' },
    ] })),

  section('Rating and meter',
    h(Inline, { gap: 5 },
      h(Rating, { value: 68, sub: 'overall' }),
      h(Rating, { value: '6.0', sub: 'form', size: 'sm' }),
      h(Grow, {}, h(Stack, { gap: 3 },
        h(Meter, { value: 0.7, label: 'board' }),
        h(Meter, { value: 0.26, tone: 'val', label: 'reputation' }),
        h(Meter, { value: 0.12, tone: 'neg', label: 'dressing room' })))),
    h(Divider)),

  section('Icons',
    h(Inline, { gap: 3, wrap: true },
      ...ICONS.map(([name, g]) =>
        h(Stack, { gap: 1, key: name, className: 'ico-cell' },
          h(Icon, { glyph: g, size: 22 }),
          h(Text, { role: 'meta', tone: 'muted' }, name))))),
)

// THE FACES ARE INLINED, not stripped. The first cut removed every
// `src: url(...)` because the woff2 files are relative to src/ui and this
// page is served from nowhere - which meant the type specimen rendered in the
// fallback stack and showed nothing about the display face it exists to show.
const inlineFont = (css: string) => css.replace(
  /url\('\.\/fonts\/([^']+)'\)/g,
  (_, f: string) => `url(data:font/woff2;base64,${readFileSync(`src/ui/fonts/${f}`).toString('base64')})`)
const css = inlineFont(['src/ui/tokens.css', 'src/ui/theme.css', 'src/ui/system.css']
  .map(f => readFileSync(f, 'utf8')).join('\n'))

const page = (cls: string) => `<!doctype html><meta charset="utf-8"><style>${css}
  /* .app is the GAME's shell - a 560px flex column the height of a phone -
     and this is a contact sheet. The class has to stay because it carries the
     theme tokens; the layout it brings with them does not. */
  .app { display: block !important; max-width: none !important; height: auto !important;
         box-shadow: none !important; }
  body { margin: 0; background: var(--canvas); }
  .qa { padding: 16px; display: grid; gap: 16px; }
  .ico-cell { align-items: center; width: 64px; text-align: center; }
  </style><div class="app ${cls}"><div class="qa">${renderToStaticMarkup(sheet)}</div></div>`

const OUT = process.argv[2] ?? 'system.png'
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const p = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 })
const shots: string[] = []
for (const cls of ['night', 'day']) {
  await p.setContent(page(cls))
  shots.push((await p.screenshot({ fullPage: true })).toString('base64'))
}
// side by side, because the failure this catches is a tone that works in one
// theme and vanishes in the other
const stacked = await p.evaluate(async (b64s: string[]) => {
  const imgs = await Promise.all(b64s.map(async b => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im
  }))
  const c = document.createElement('canvas')
  c.width = imgs.reduce((s, i) => s + i.width, 0)
  c.height = Math.max(...imgs.map(i => i.height))
  const g = c.getContext('2d')!
  let x = 0
  for (const i of imgs) { g.drawImage(i, x, 0); x += i.width }
  return c.toDataURL('image/png')
}, shots)
writeFileSync(OUT, Buffer.from(stacked.split(',')[1], 'base64'))
console.log(`${OUT}: every primitive and state, night beside day`)
await browser.close()
