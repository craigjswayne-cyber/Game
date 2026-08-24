// Render the SVG icon to PNG sizes for the PWA manifest.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<body style="margin:0"><div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body>`)
  const buf = await page.screenshot({ omitBackground: true })
  writeFileSync(`public/icon-${size}.png`, buf)
  await page.close()
}

// THE MASKABLE ONE, which is a different picture and not a resize.
//
// Android does not show the icon you give it. It crops it to whatever shape
// the launcher is set to - circle, squircle, teardrop, rounded square - and
// guarantees only the middle 80%: a circle of 0.8x the width. Everything
// outside that is decoration the platform may remove.
//
// icon.svg fails that test. Its pale ring is 86.6% of the width across, so a
// circular mask shaves the ring flat at nine and three o'clock, and the first
// thing anybody sees of this game is a clipped logo on their home screen.
//
// The fix is not a smaller PNG, because a maskable icon must ALSO bleed to the
// edges - a transparent or letterboxed one gets a grey card drawn behind it.
// So: the brand green edge to edge, and the artwork inset to 76% so the ring
// clears the safe circle with room to spare.
{
  const size = 512
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<body style="margin:0">
    <div style="width:${size}px;height:${size}px;background:#0f7a43;
                display:flex;align-items:center;justify-content:center">
      <div style="width:${Math.round(size * 0.76)}px;height:${Math.round(size * 0.76)}px">
        ${svg.replace('<svg ', `<svg width="${Math.round(size * 0.76)}" height="${Math.round(size * 0.76)}" `)}
      </div>
    </div></body>`)
  // opaque on purpose: a maskable icon has no transparent edge to fall back on
  writeFileSync('public/icon-maskable-512.png', await page.screenshot({ omitBackground: false }))
  await page.close()
}

await browser.close()
console.log('icons written')
