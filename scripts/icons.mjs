// Render the SVG icon to PNG sizes for the PWA manifest.
import { chromium } from 'playwright-core'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

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

// THE APP STORE ICON, which has its own three rules.
//
// Apple rejects an icon that breaks any of them, and the Capacitor placeholder
// (a blue X) shipped in the project until v1.2.5 because nothing here wrote a
// real one:
//
//   1. EXACTLY 1024x1024. Not a resize of the 512 - that is soft on a Retina
//      store listing.
//   2. NO TRANSPARENCY. An alpha channel is an automatic rejection; Apple
//      composites nothing behind it, so a transparent corner renders black.
//   3. SQUARE CORNERS. iOS applies its own superellipse mask. Round the corners
//      yourself and the mask cuts them a second time, leaving a pinched,
//      slightly wrong silhouette next to every other icon on the home screen.
//
// So rx is stripped from the plate, the shot is taken opaque, and the artwork
// bleeds to all four edges.
//
// IT IS WRITTEN TO A TRACKED PATH FIRST. packaging/ios/ios/ is gitignored -
// Capacitor generates the whole Xcode project with `cap add ios`, so anything
// written only in there is lost the next time somebody regenerates it, and
// that is exactly how the placeholder survived this long. The canonical copy
// lives in packaging/ios/ and is committed; the live project gets a copy when
// it happens to exist on this machine.
{
  const size = 1024
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const square = svg
    .replace('<svg ', `<svg width="${size}" height="${size}" `)
    .replace('rx="14"', '')          // Apple masks it; we must not
  await page.setContent(`<body style="margin:0;background:#0f7a43">${square}</body>`)
  const shot = await page.screenshot({ omitBackground: false })
  writeFileSync('packaging/ios/AppIcon-1024.png', shot)
  const live = 'packaging/ios/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
  if (existsSync(live)) writeFileSync(live, shot)
  await page.close()
}

await browser.close()
console.log('icons written')
