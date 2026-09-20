/**
 * Every campus sprite, every level, on a dark ground and a light one.
 *
 *   node scripts/spriteqa.mjs [out.png]
 *
 * WHY IT EXISTS. scripts/sprites.mjs cuts 60 tiles out of ten sheets of the
 * owner's art, and every failure it can have is a picture: a number badge
 * welded to a roof, a building hollowed out because the flood ate through it,
 * a level scaled differently from the one below so the campus appears to
 * shrink as the club grows, a stray line of the sheet's own typography left
 * floating over a set of posts. Every one of those has actually happened, and
 * not one of them is visible from the console - the script reports sixty files
 * written either way. This is the only thing that can see them.
 *
 * BOTH GROUNDS, because the knockout is the risky step: a tile that still
 * carries a skirt of the sheet's dark backdrop looks perfect on the night
 * theme and wears a grey halo on the daylight one.
 *
 * A REPORTER, not a probe. It writes a picture and has no verdict to give.
 */
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const FAC = ['pitch', 'paddock', 'kicking', 'academy', 'briefing',
  'gym', 'recovery', 'hospitality', 'shop', 'stadium']
const b64 = (f) => 'data:image/webp;base64,' + readFileSync('src/ui/sprites/' + f).toString('base64')
const rows = (list) => list.map(f =>
  `<div class="r"><div class="n">${f}</div>` +
  [0, 1, 2, 3, 4, 5].map(l =>
    `<div class="c"><img src="${b64(`${f}-${l}.webp`)}"><i>${l}</i></div>`).join('') +
  '</div>').join('')

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#1a201e;font:12px system-ui;color:#9fb0a8}
.lite{background:#f1f4f1}.lite .n{color:#12201a}.lite i{color:#5a6b62}
.r{display:flex;align-items:flex-end;gap:4px;padding:6px 10px;border-bottom:1px solid #2a332f}
.n{width:86px;color:#e6ece9;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
.c{width:150px;display:flex;flex-direction:column;align-items:center}
.c img{width:150px;display:block}
.c i{font-style:normal;opacity:.6}
</style><div>${rows(FAC.slice(0, 5))}</div><div class="lite">${rows(FAC.slice(5))}</div>`

const OUT = process.argv[2] ?? 'sprites.png'
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1010, height: 900 } })
await p.setContent(html)
await p.screenshot({ path: OUT, fullPage: true })
console.log(`${OUT}: ${FAC.length} ladders, 6 levels each, dark ground and light`)
await b.close()
