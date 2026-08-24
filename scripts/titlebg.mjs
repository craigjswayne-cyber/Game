// Turn the key-art poster into the title screen's background.
//
// Kept as a script rather than done once by hand, because the art will be
// re-cut and every one of the decisions below will have to be made again.
//
//   node scripts/titlebg.mjs <poster.png>
//
// Three things have to happen to a poster before it can sit behind live UI:
//
// 1. THE COMPOSITION STAYS WHOLE. The first attempt cropped the wordmark band
//    out and kept the desk, which left a landscape image filling a portrait
//    screen - and `cover` then zooms enormously to fill the width, magnifying
//    the picture into a texture. The frame is portrait and so is the phone;
//    keep the frame.
//
// 2. THE POSTER'S OWN WORDMARK AND ICON GO. The title screen draws both, live:
//    the wordmark scales with the text-size control and the icon is the brand
//    mark. Two of each on one screen is a mistake whichever copy you keep.
//
//    BLURRING THEM IS NOT ENOUGH, and this is the part that took two goes. A
//    Gaussian blur of white lettering on a dark ground does not remove the
//    lettering, it spreads its brightness into a halo - reported from a real
//    phone as "a weird glow", and that is exactly what it was. So the band is
//    blurred to destroy the letterforms AND crushed with a dark wash to take
//    the brightness back out, feathered top and bottom so there is no seam.
//
// 3. IT GETS SMALL. This is an offline PWA whose shell is precached. A 2MB PNG
//    on the first screen is a bad trade for a background.
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: node scripts/titlebg.mjs <poster.png>'); process.exit(1) }
const OUT = 'src/ui/title-bg.webp'

const b64 = readFileSync(SRC).toString('base64')
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 900, height: 1600 } })

const out = await page.evaluate(async (data) => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + data
  await img.decode()

  const W = 760, H = Math.round(img.height * (W / img.width))
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0, W, H)

  // the band holding the poster's icon, wordmark and tagline rule
  const top = Math.round(H * 0.055)
  const h = Math.round(H * 0.475)

  // destroy the letterforms
  g.save()
  g.beginPath(); g.rect(0, top, W, h); g.clip()
  g.filter = 'blur(26px)'
  g.drawImage(c, 0, 0)
  g.restore()

  // and take the brightness the blur just spread around back out again,
  // feathered at both edges so the band does not read as a rectangle
  const crush = g.createLinearGradient(0, top, 0, top + h)
  crush.addColorStop(0, 'rgba(10,14,12,0)')
  crush.addColorStop(0.18, 'rgba(10,14,12,0.72)')
  crush.addColorStop(0.82, 'rgba(10,14,12,0.72)')
  crush.addColorStop(1, 'rgba(10,14,12,0)')
  g.fillStyle = crush
  g.fillRect(0, top, W, h)

  // the overall knock-back: text sits on all of this
  g.fillStyle = 'rgba(10,14,12,0.4)'
  g.fillRect(0, 0, W, H)
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, 'rgba(10,14,12,0.55)')
  grad.addColorStop(0.5, 'rgba(10,14,12,0.3)')
  grad.addColorStop(1, 'rgba(10,14,12,0.5)')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)

  // how bright is the brightest thing left in the band? A halo shows up here
  // as a high number long before anybody notices it on a phone.
  const { data: px } = g.getImageData(0, top, W, h)
  let peak = 0
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]
    if (lum > peak) peak = lum
  }
  return { webp: c.toDataURL('image/webp', 0.74), w: W, h: H, peak: Math.round(peak) }
}, b64)

const buf = Buffer.from(out.webp.split(',')[1], 'base64')
writeFileSync(OUT, buf)
console.log(`${OUT}: ${out.w}x${out.h}, ${(buf.length / 1024).toFixed(0)} KB`)
console.log(`brightest pixel behind the wordmark: ${out.peak}/255 ${out.peak > 90 ? '- TOO BRIGHT, the halo is back' : '- clean'}`)
await browser.close()
process.exitCode = out.peak > 90 ? 1 : 0
