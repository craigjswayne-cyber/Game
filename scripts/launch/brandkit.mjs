// The brand kit: icons, avatars, favicons, lockups, headers and the Play
// feature graphic, every one drawn fresh from vector at its own size.
//
//   node scripts/launch/brandkit.mjs
//
// Writes into docs/launch/assets/01-brand/final, 02-store/final, 04-social/final
// and 07-discord/final. Sizes and their sources: docs/launch/PLATFORM-SPECS.md.
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { C, fontFace, mark, head } from './brand.mjs'

const A = 'docs/launch/assets'
const RAW = process.env.RAW || 'storeart/raw/en'
const TMP = 'storeart/tmp'
mkdirSync(TMP, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const log = []

async function render(path, w, h, body, { css = '', transparent = false } = {}) {
  mkdirSync(dirname(path), { recursive: true })
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const file = resolve(`${TMP}/bk-${Math.random().toString(36).slice(2)}.html`)
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: ${transparent ? 'transparent' : C.canvas}; }
body { font-family: 'Space Grotesk', sans-serif; color: ${C.text}; -webkit-font-smoothing: antialiased; position: relative; }
${css}</style></head><body>${body}</body></html>`)
  await page.goto('file://' + file)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(120)
  await page.screenshot({ path, omitBackground: transparent })
  await page.close()
  log.push(`${path} ${w}x${h}`)
}

/** Strip the alpha channel: Apple's 1024 icon and store screenshots refuse it. */
const opaque = (p) => execFileSync('convert', [p, '-background', C.canvas, '-alpha', 'remove', '-alpha', 'off', p])

// ---------------------------------------------------------------- icons
// The app icon is the ball and ring on the badge green, full bleed. Stores
// apply their own corner mask, so the master is a plain square (Play adds a 30%
// radius itself; Apple masks its own squircle).
const iconBody = (s) => `<div style="width:${s}px;height:${s}px">${mark(s, { square: true })}</div>`
await render(`${A}/01-brand/final/icon/icon-master-1024.png`, 1024, 1024, iconBody(1024))
opaque(`${A}/01-brand/final/icon/icon-master-1024.png`)
await render(`${A}/02-store/final/play/play-icon-512.png`, 512, 512, iconBody(512))
await render(`${A}/02-store/final/ios-6.9/appstore-icon-1024.png`, 1024, 1024, iconBody(1024))
opaque(`${A}/02-store/final/ios-6.9/appstore-icon-1024.png`)

// favicons: at 16 and 32 the ring is the first thing to turn to mud, so the
// small sizes drop it and give the ball more of the square
const smallMark = (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${s}" height="${s}">
  <rect width="64" height="64" rx="12" fill="${C.badge}"/>
  <g transform="rotate(-32 32 32)">
    <ellipse cx="32" cy="32" rx="19" ry="27" fill="${C.keyline}"/>
    <ellipse cx="32" cy="32" rx="16" ry="24" fill="#ffffff"/>
    <path d="M31.2 9.2 C23 16.4 20.2 24.8 20.9 34 C23 25.8 25.4 18.6 33.4 10.8 Z" fill="${C.keyline}"/>
    <path d="M32.8 54.8 C41 47.6 43.8 39.2 43.1 30 C41 38.2 38.6 45.4 30.6 53.2 Z" fill="${C.keyline}"/>
  </g></svg>`
for (const s of [16, 32, 48]) {
  await render(`${A}/05-website/final/favicon-${s}.png`, s, s, smallMark(s), { transparent: true })
}
writeFileSync(`${A}/05-website/final/favicon-small.svg`, smallMark(64))
execFileSync('convert', [`${A}/05-website/final/favicon-16.png`, `${A}/05-website/final/favicon-32.png`, `${A}/05-website/final/favicon-48.png`, `${A}/05-website/final/favicon.ico`])
log.push(`${A}/05-website/final/favicon.ico 16/32/48`)
await render(`${A}/05-website/final/apple-touch-icon-180.png`, 180, 180, iconBody(180))
opaque(`${A}/05-website/final/apple-touch-icon-180.png`)

// the 32px check: the brief's test, kept as a visible proof sheet
await render(`${A}/01-brand/final/icon/icon-size-check.png`, 760, 220, `
  <div style="display:flex;align-items:flex-end;gap:40px;padding:40px">
    ${[128, 64, 48, 32, 24, 16].map(s => `<div style="text-align:center;font-size:13px;color:${C.muted}">
      <div style="border-radius:${s * 0.22}px;overflow:hidden;width:${s}px;height:${s}px;margin:0 auto 10px">${s <= 32 ? smallMark(s) : mark(s, { square: true })}</div>${s}px</div>`).join('')}
  </div>`)

// ---------------------------------------------------------------- avatars
// One circular-safe avatar: every platform crops to a circle, so the ring sits
// inside the circle with a margin. Each size drawn fresh, never resized.
const avatar = (s) => `<div style="width:${s}px;height:${s}px;background:${C.badge};display:flex;align-items:center;justify-content:center">${mark(s * 0.86, { disc: false })}</div>`
const AVATARS = [
  ['01-brand/final/avatar/avatar-master-1024.png', 1024],
  ['04-social/final/avatars/youtube-avatar-800.png', 800],
  ['04-social/final/avatars/x-avatar-400.png', 400],
  ['04-social/final/avatars/instagram-avatar-320.png', 320],
  ['04-social/final/avatars/tiktok-avatar-200.png', 200],
  ['04-social/final/avatars/facebook-avatar-720.png', 720],
  ['07-discord/final/discord-server-icon-512.png', 512],
]
for (const [p, s] of AVATARS) { await render(`${A}/${p}`, s, s, avatar(s)); opaque(`${A}/${p}`) }

// ---------------------------------------------------------------- lockups
const word = (u, colour = C.text, sub = C.text2) => `
  <div style="display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:${100 * u}px;font-weight:700;letter-spacing:${6 * u}px;line-height:.9;color:${colour}">PHASE</div>
    <div style="font-size:${25 * u}px;font-weight:700;letter-spacing:${9.6 * u}px;margin-top:${14 * u}px;color:${sub}">RUGBY MANAGER</div>
  </div>`
const lockup = (u, colour, sub) => `<div style="display:flex;align-items:center;gap:${30 * u}px;padding:${40 * u}px">${mark(150 * u)}${word(u, colour, sub)}</div>`
await render(`${A}/01-brand/final/logo/lockup-horizontal-dark-bg.png`, 1000, 300, lockup(1.18, C.text, C.text2), { transparent: true })
await render(`${A}/01-brand/final/logo/lockup-horizontal-light-bg.png`, 1000, 300, lockup(1.18, '#14201b', '#4e5a55'), { transparent: true })
await render(`${A}/01-brand/final/logo/wordmark-dark-bg.png`, 800, 220, `<div style="padding:40px">${word(1.4)}</div>`, { transparent: true })
await render(`${A}/01-brand/final/logo/wordmark-light-bg.png`, 800, 220, `<div style="padding:40px">${word(1.4, '#14201b', '#4e5a55')}</div>`, { transparent: true })
await render(`${A}/01-brand/final/logo/lockup-stacked-dark-bg.png`, 800, 800, `
  <div style="height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;text-align:center">
    ${mark(300)}<div style="align-items:center;display:flex;flex-direction:column">${word(1.5)}</div></div>`, { transparent: true })
writeFileSync(`${A}/01-brand/final/logo/mark.svg`, mark(512))
writeFileSync(`${A}/01-brand/final/icon/icon-master.svg`, mark(1024, { square: true }))
log.push(`${A}/01-brand/final/logo/mark.svg`, `${A}/01-brand/final/icon/icon-master.svg`)

// ---------------------------------------------------------------- palette sheet
const sw = [['Canvas', C.canvas], ['Surface 1', C.surface1], ['Surface 2', C.surface2], ['Border', C.borderStrong],
  ['Chalk (text)', C.text], ['Text 2', C.text2], ['Action green', C.primary], ['Badge green', C.badge], ['Value gold', C.gold]]
await render(`${A}/01-brand/final/palette.png`, 1600, 900, `
  <div style="padding:90px">
    <div style="font-size:22px;letter-spacing:6px;font-weight:700;color:${C.text2}">PHASE · COLOUR</div>
    <div style="font-size:64px;font-weight:700;margin:22px 0 60px;letter-spacing:-1px">The game's own palette<span style="color:${C.primary}">.</span></div>
    <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:16px">
      ${sw.map(([n, h]) => `<div><div style="height:300px;border-radius:14px;background:${h};border:2px solid ${C.border}"></div>
        <div style="margin-top:16px;font-size:20px;font-weight:700">${n}</div><div style="font-size:18px;color:${C.text2}">${h}</div></div>`).join('')}
    </div>
    <div style="margin-top:60px;font-size:22px;color:${C.text2}">Green means positive or actionable. Gold means value or attention. Red means loss or risk. Nothing else gets colour.</div>
  </div>`)
await render(`${A}/01-brand/final/typography.png`, 1600, 900, `
  <div style="padding:90px">
    <div style="font-size:22px;letter-spacing:6px;font-weight:700;color:${C.text2}">PHASE · TYPE</div>
    <div style="font-size:150px;font-weight:700;letter-spacing:-4px;line-height:1;margin-top:30px">Space Grotesk</div>
    <div style="display:flex;gap:80px;margin-top:60px">
      <div><div style="font-size:84px;font-weight:700;letter-spacing:-2px;line-height:1">HEADLINE<span style="color:${C.primary}">.</span></div><div style="color:${C.text2};font-size:20px;margin-top:14px">700 · uppercase · tight tracking · one green full stop</div></div>
      <div><div style="font-size:24px;font-weight:700;letter-spacing:6px;color:${C.text2};margin-top:24px">EYEBROW LABEL</div><div style="color:${C.text2};font-size:20px;margin-top:14px">700 · tracked +6</div></div>
    </div>
    <div style="font-size:34px;line-height:1.4;color:${C.text2};max-width:1100px;margin-top:60px">Body copy is 400 weight in the secondary chalk. Short sentences. British English. No em dashes.</div>
    <div style="font-size:20px;color:${C.muted};margin-top:40px">SIL Open Font License 1.1 · self-hosted, the same 22KB variable file the game ships</div>
  </div>`)

// ---------------------------------------------------------------- feature graphic
// Play: 1024x500, JPEG or 24-bit PNG, no alpha. Text kept inside the central
// area and off the bottom edge, where Play can overlay a play button.
const shotSrc = (n) => 'file://' + resolve(`${RAW}/${n}.png`)
if (existsSync(`${RAW}/word-kept.png`)) {
  await render(`${A}/02-store/final/play/feature-graphic-1024x500.png`, 1024, 500, `
    <div style="position:absolute;inset:0;background:radial-gradient(700px 500px at 78% 70%, ${C.surface1}, ${C.canvas} 70%)"></div>
    <div style="position:absolute;left:72px;top:96px;width:560px">
      <div style="display:flex;align-items:center;gap:12px;font-size:15px;font-weight:700;letter-spacing:4px;color:${C.text2}">${mark(28)}PHASE: RUGBY MANAGER</div>
      <div style="font-size:52px;font-weight:700;line-height:1.02;letter-spacing:-1.2px;margin-top:30px">THE WORLD<br>REMEMBERS<br>WHAT YOU DID<span style="color:${C.primary}">.</span></div>
    </div>
    <div style="position:absolute;right:86px;top:58px;width:250px;height:520px;border-radius:26px;overflow:hidden;border:2px solid ${C.borderStrong};box-shadow:0 20px 60px rgba(0,0,0,.55)">
      <img src="${shotSrc('word-kept')}" style="width:100%;display:block"></div>`)
  opaque(`${A}/02-store/final/play/feature-graphic-1024x500.png`)
}

// ---------------------------------------------------------------- share image
// Open Graph / link previews: 1200x630, the proposition and one real screen
if (existsSync(`${RAW}/word-kept.png`)) {
  await render(`${A}/05-website/final/og-image-1200x630.png`, 1200, 630, `
    <div style="position:absolute;inset:0;background:radial-gradient(800px 600px at 78% 70%, ${C.surface1}, ${C.canvas} 70%)"></div>
    <div style="position:absolute;left:84px;top:118px;width:640px">
      <div style="display:flex;align-items:center;gap:14px;font-size:17px;font-weight:700;letter-spacing:4.5px;color:${C.text2}">${mark(32)}PHASE: RUGBY MANAGER</div>
      <div style="font-size:62px;font-weight:700;line-height:1.02;letter-spacing:-1.5px;margin-top:36px">THE WORLD<br>REMEMBERS<br>WHAT YOU DID<span style="color:${C.primary}">.</span></div>
    </div>
    <div style="position:absolute;right:100px;top:70px;width:300px;height:640px;border-radius:30px;overflow:hidden;border:2px solid ${C.borderStrong};box-shadow:0 20px 60px rgba(0,0,0,.55)">
      <img src="${shotSrc('word-kept')}" style="width:100%;display:block"></div>`)
  opaque(`${A}/05-website/final/og-image-1200x630.png`)
}

// ---------------------------------------------------------------- video thumbnail
// YouTube 1280x720 (VERIFY: PLATFORM-SPECS). Big type, one real screen: it
// has to read at the size of a thumbnail in a sidebar.
if (existsSync(`${RAW}/word-kept.png`)) {
  await render(`${A}/03-trailer/final/youtube-thumbnail-1280x720.png`, 1280, 720, `
    <div style="position:absolute;inset:0;background:radial-gradient(800px 700px at 78% 70%, ${C.surface1}, ${C.canvas} 70%)"></div>
    <div style="position:absolute;left:80px;top:0;bottom:0;width:720px;display:flex;flex-direction:column;justify-content:center">
      <div style="display:flex;align-items:center;gap:14px;font-size:20px;font-weight:700;letter-spacing:5px;color:${C.text2}">${mark(38)}PHASE</div>
      <div style="font-size:92px;font-weight:700;line-height:.98;letter-spacing:-2.5px;margin-top:26px">THE WORLD<br>REMEMBERS<span style="color:${C.primary}">.</span></div>
    </div>
    <div style="position:absolute;right:110px;top:70px;width:340px;height:760px;border-radius:32px;overflow:hidden;border:3px solid ${C.borderStrong};box-shadow:0 20px 60px rgba(0,0,0,.55)">
      <img src="${shotSrc('word-kept')}" style="width:100%;display:block"></div>`)
  opaque(`${A}/03-trailer/final/youtube-thumbnail-1280x720.png`)
}

// ---------------------------------------------------------------- headers
// YouTube channel art 2560x1440: everything that matters inside the central
// 1546x423 safe area (VERIFY in PLATFORM-SPECS). X header 1500x500: the avatar
// overlaps the bottom left, so the lockup sits right of centre.
const banner = (w, h, scale, align = 'center') => `
  <div style="position:absolute;inset:0;background:radial-gradient(${w * 0.5}px ${h}px at 50% 50%, ${C.surface1}, ${C.canvas} 75%)"></div>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:${align};padding:0 ${w * 0.08}px">
    <div style="display:flex;align-items:center;gap:${40 * scale}px">
      ${mark(150 * scale)}
      <div style="width:${2 * scale}px;height:${150 * scale}px;background:${C.borderStrong}"></div>
      <div>
        <div style="font-size:${78 * scale}px;font-weight:700;letter-spacing:${-1.5 * scale}px;line-height:1">THE WORLD REMEMBERS<br>WHAT YOU DID<span style="color:${C.primary}">.</span></div>
        <div style="font-size:${22 * scale}px;font-weight:700;letter-spacing:${7 * scale}px;color:${C.text2};margin-top:${22 * scale}px">PHASE: RUGBY MANAGER</div>
      </div>
    </div>
  </div>`
await render(`${A}/04-social/final/headers/youtube-banner-2560x1440.png`, 2560, 1440, banner(2560, 1440, 1.6))
await render(`${A}/04-social/final/headers/x-header-1500x500.png`, 1500, 500, banner(1500, 500, 1.05, 'flex-end'))
await render(`${A}/04-social/final/headers/facebook-cover-1640x624.png`, 1640, 624, banner(1640, 624, 1.1))
await render(`${A}/07-discord/final/discord-server-banner-960x540.png`, 960, 540, banner(960, 540, 0.62))

// ---------------------------------------------------------------- discord welcome
await render(`${A}/07-discord/final/discord-welcome-1600x900.png`, 1600, 900, `
  <div style="position:absolute;inset:0;background:radial-gradient(900px 700px at 70% 60%, ${C.surface1}, ${C.canvas} 72%)"></div>
  <div style="position:absolute;left:120px;top:150px;width:900px">
    <div style="display:flex;align-items:center;gap:16px;font-size:22px;font-weight:700;letter-spacing:6px;color:${C.text2}">${mark(40)}PHASE: RUGBY MANAGER</div>
    <div style="font-size:104px;font-weight:700;line-height:.98;letter-spacing:-2.5px;margin-top:48px">WELCOME TO<br>THE DRESSING<br>ROOM<span style="color:${C.primary}">.</span></div>
    <div style="font-size:30px;line-height:1.45;color:${C.text2};margin-top:40px;max-width:640px">Managers, careers and rugby talk. Start in #welcome, report bugs in #bug-reports, share your stories in #careers.</div>
  </div>
  ${existsSync(`${RAW}/home.png`) ? `<div style="position:absolute;right:130px;top:110px;width:340px;height:900px;border-radius:36px;overflow:hidden;border:3px solid ${C.borderStrong};box-shadow:0 30px 90px rgba(0,0,0,.6)"><img src="${shotSrc('home')}" style="width:100%"></div>` : ''}`)

await browser.close()
writeFileSync(`${A}/01-brand/final/EXPORTS.txt`, log.join('\n') + '\n')
console.log(log.join('\n'))
console.log(`BRAND KIT: ${log.length} files`)
