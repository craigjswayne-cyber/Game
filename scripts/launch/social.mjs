// Social graphics: one editorial system, every post rendered from data.
//
//   node scripts/launch/social.mjs [ID,ID]
//
// Reads docs/launch/assets/04-social/source/posts.json and writes
// docs/launch/assets/04-social/final/<id>/<format>.png. Formats:
//   feed   1080x1350  4:5   Instagram / Facebook feed
//   story  1080x1920  9:16  Stories, Reels covers, TikTok, Shorts (text kept out
//                            of the bottom UI band; see PLATFORM-SPECS.md)
//   square 1080x1080  1:1
//   wide   1600x900   16:9  X, Discord, YouTube community, website
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { C, fontFace, mark, head } from './brand.mjs'

const A = 'docs/launch/assets/04-social'
const RAW = process.env.RAW || 'storeart/raw/en'
const RAW_BIG = process.env.RAW_BIG || 'storeart/raw/en-z1.15'
const TMP = 'storeart/tmp'
mkdirSync(TMP, { recursive: true })
const only = process.argv[2]?.split(',')
const { posts } = JSON.parse(readFileSync(`${A}/source/posts.json`, 'utf8'))

const FORMATS = {
  feed: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
  wide: { w: 1600, h: 900 },
}

const shotUrl = (p) => {
  const f = `${p.big ? RAW_BIG : RAW}/${p.shot}.png`
  return existsSync(f) ? 'file://' + resolve(f) : null
}

function html(p, fmt) {
  const { w, h } = FORMATS[fmt]
  const wide = fmt === 'wide'
  const u = wide ? h / 900 : w / 1080
  const img = p.shot ? shotUrl(p) : null
  // the text column: full width, or the left half on the wide format
  const col = wide && img ? 860 * u : (wide ? 1300 * u : 888 * u)
  const padX = wide ? 110 * u : 96 * u
  const top = fmt === 'story' ? 300 * u : (wide ? 110 * u : 96 * u)
  const hSize = { feed: 82, story: 90, square: 74, wide: 76 }[fmt] * u
  const centred = !img && p.kind !== 'career'
  const store = p.store ? `<div class="store">${mark(30 * u)}<span>Free on Google Play</span></div>` : ''

  let inner = ''
  if (p.kind === 'story') {
    inner = `<div class="lead">${p.lead}</div>
      <div class="quote">“${p.quote}”</div>
      <div class="attr">${p.attr}</div>`
  } else if (p.kind === 'countdown') {
    inner = `<div class="num">${p.n}</div><h1>${head(p.h)}</h1><p class="sub">${p.sub}</p>`
  } else if (p.kind === 'career') {
    inner = `<h1>${head(p.h)}</h1>
      <div class="stats">${p.stats.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</div>
      <p class="sub">${p.sub}</p><div class="attr">${p.attr}</div>`
  } else if (p.kind === 'update') {
    inner = `<div class="tag">UPDATE · AVAILABLE NOW</div><h1>${p.h}</h1><p class="sub">${p.sub}</p>`
  } else {
    inner = `<h1>${head(p.h)}</h1>${p.sub ? `<p class="sub">${p.sub}</p>` : ''}${p.foot ? `<div class="foot">${p.foot}</div>` : ''}`
  }

  // where the screen sits: bleeding off the bottom on tall formats, the right
  // edge on wide ones
  let screen = ''
  if (img) {
    const shift = p.focus ? `transform:translateY(-${p.focus * 900 * (wide ? 0.62 : 1) * u * (fmt === 'square' ? 0.75 : 1)}px)` : ''
    const box = wide
      ? `right:${110 * u}px;top:${90 * u}px;width:${520 * u}px;height:${1300 * u}px`
      : fmt === 'story'
        ? `left:${150 * u}px;right:${150 * u}px;top:${980 * u}px;height:${1800 * u}px`
        : fmt === 'square'
          ? `left:${300 * u}px;right:${-40 * u}px;top:${560 * u}px;height:${1300 * u}px`
          : `left:${170 * u}px;right:${170 * u}px;top:${760 * u}px;height:${1600 * u}px`
    screen = `<div class="screen" style="${box}"><img src="${img}" style="${shift}"></div>`
  }
  const eyebrow = `<div class="eyebrow">${mark(36 * u)}<span>PHASE</span>${p.pillar ? `<span class="rule"></span><span class="pill">${p.pillar}</span>` : ''}</div>`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
body { font-family: 'Space Grotesk', sans-serif; color: ${C.text}; -webkit-font-smoothing: antialiased; position: relative;
  background: radial-gradient(${w * 0.9}px ${h * 0.8}px at ${wide ? '75%' : '50%'} ${wide ? '60%' : '85%'}, ${C.surface1} 0%, ${C.canvas} 70%), ${C.canvas}; }
.col { position: absolute; left: ${padX}px; top: ${top}px; width: ${col}px; ${centred ? `left:0;right:0;width:auto;top:0;bottom:${fmt === 'story' ? 500 * u : 0}px;padding:0 ${padX}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;` : ''} }
.eyebrow { display: flex; align-items: center; gap: ${16 * u}px; font-size: ${22 * u}px; font-weight: 700; letter-spacing: ${5.5 * u}px; color: ${C.text2}; text-transform: uppercase; }
.eyebrow .rule { width: ${48 * u}px; height: ${2 * u}px; background: ${C.borderStrong}; }
.eyebrow .pill { color: ${C.muted}; }
h1 { margin-top: ${52 * u}px; font-size: ${hSize}px; line-height: 1.0; font-weight: 700; letter-spacing: ${-2 * u}px; text-transform: uppercase; }
h1 .dot { color: ${C.primary}; }
.sub { margin-top: ${30 * u}px; font-size: ${33 * u}px; line-height: 1.4; color: ${C.text2}; max-width: ${820 * u}px; }
.foot { margin-top: ${30 * u}px; font-size: ${24 * u}px; font-weight: 700; letter-spacing: ${3 * u}px; text-transform: uppercase; color: ${C.primary}; }
.lead { margin-top: ${52 * u}px; font-size: ${30 * u}px; font-weight: 700; color: ${C.gold}; }
.quote { margin-top: ${24 * u}px; font-size: ${(p.quote?.length ?? 0) > 70 ? 54 : 64}px; line-height: 1.12; font-weight: 700; letter-spacing: ${-1.2 * u}px; }
.quote { font-size: ${((p.quote?.length ?? 0) > 70 ? 52 : 62) * u}px; }
.attr { margin-top: ${28 * u}px; font-size: ${22 * u}px; letter-spacing: ${3 * u}px; text-transform: uppercase; color: ${C.muted}; font-weight: 700; }
.num { font-size: ${380 * u}px; line-height: .8; font-weight: 700; letter-spacing: ${-14 * u}px; color: ${C.text}; margin-top: ${40 * u}px; }
.num + h1 { margin-top: ${24 * u}px; font-size: ${hSize * 1.1}px; }
.tag { margin-top: ${52 * u}px; font-size: ${22 * u}px; letter-spacing: ${5 * u}px; font-weight: 700; color: ${C.primary}; }
.tag + h1 { margin-top: ${18 * u}px; text-transform: none; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0 ${40 * u}px; margin-top: ${56 * u}px; max-width: ${820 * u}px; }
.stats div { border-top: ${2 * u}px solid ${C.border}; padding: ${22 * u}px 0 ${26 * u}px; display: flex; flex-direction: column; }
.stats b { font-size: ${76 * u}px; font-weight: 700; letter-spacing: ${-2 * u}px; line-height: 1; }
.stats span { font-size: ${22 * u}px; letter-spacing: ${3 * u}px; text-transform: uppercase; color: ${C.text2}; margin-top: ${10 * u}px; font-weight: 700; }
.store { position: absolute; left: 0; right: 0; bottom: ${(fmt === 'story' ? 700 : 90) * u}px; display: flex; justify-content: center; align-items: center; gap: ${14 * u}px;
  font-size: ${26 * u}px; font-weight: 700; letter-spacing: ${2 * u}px; color: ${C.text}; }
.screen { position: absolute; border-radius: ${44 * u}px; overflow: hidden; border: ${3 * u}px solid ${C.borderStrong}; background: ${C.canvas};
  box-shadow: 0 ${30 * u}px ${100 * u}px rgba(0,0,0,.55); }
.screen img { width: 100%; display: block; }
.markbig { margin-bottom: ${10 * u}px; }
</style></head><body>
<div class="col">${centred ? `<div class="markbig">${mark(120 * u)}</div>` : eyebrow}${inner}</div>
${screen}${store}
<script>
  // the screen follows the words: it starts a fixed gap below wherever the
  // text block ends, so a three-line headline never collides and a short one
  // leaves no dead band
  document.fonts.ready.then(() => {
    const col = document.querySelector('.col'), sc = document.querySelector('.screen')
    if (!col || !sc || ${wide}) return
    const bottom = col.getBoundingClientRect().bottom
    sc.style.top = Math.max(bottom + ${80 * u}, ${fmt === 'story' ? 860 * u : 480 * u}) + 'px'
  })
</script>
</body></html>`
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
let n = 0
for (const p of posts) {
  if (only && !only.includes(p.id)) continue
  const formats = p.formats ?? ['feed', 'story', 'square', 'wide']
  const dir = `${A}/final/${p.id.startsWith('LCH') ? 'launch/' : ''}${p.id}`
  mkdirSync(dir, { recursive: true })
  for (const fmt of formats) {
    const { w, h } = FORMATS[fmt]
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    const file = resolve(`${TMP}/${p.id}-${fmt}.html`)
    writeFileSync(file, html(p, fmt))
    await page.goto('file://' + file)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${dir}/${p.id}-${fmt}-${w}x${h}.png` })
    await page.close()
    n++
  }
}
await browser.close()
console.log(`SOCIAL: ${n} graphics written to ${A}/final`)
