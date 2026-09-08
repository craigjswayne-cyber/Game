/*
 * Rasterise the app icon.
 *
 * icons/icon.svg is the master. Android and the install prompt want PNGs, and a
 * maskable icon needs its content inside the middle 80 percent or the launcher
 * crops the monogram, so the maskable variant is drawn smaller rather than
 * scaled from the same file.
 *
 * Run:  node mimi/scripts/icons.mjs
 */
import { chromium } from 'playwright-core'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICONS = fileURLToPath(new URL('../icons/', import.meta.url))
const CHROME = [process.env.CHROME, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p))

const face = (scale) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <rect width="512" height="512" rx="${scale === 1 ? 112 : 0}" fill="#4a121a"/>
    <circle cx="256" cy="256" r="${176 * scale}" fill="none" stroke="#e3aeb5" stroke-width="6" opacity="0.55"/>
    <text x="256" y="${256 + 74 * scale}" text-anchor="middle"
      font-family="Playfair Display, Georgia, serif" font-size="${248 * scale}" font-style="italic"
      fill="#fdfbf7">M</text>
  </svg>`

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {})
const page = await browser.newPage()

const draw = async (svg, size, name) => {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`)
  await page.waitForTimeout(120)
  const buf = await page.screenshot({ omitBackground: false })
  await writeFile(join(ICONS, name), buf)
  console.log(`wrote ${name} (${size}px)`)
}

await draw(face(1), 192, 'icon-192.png')
await draw(face(1), 512, 'icon-512.png')
await draw(face(1), 180, 'icon-180.png')
await draw(face(0.74), 512, 'icon-maskable-512.png')

await browser.close()
