/**
 * ---- EVERY SHIPPED FILE IS THE THING IT CLAIMS TO BE ----
 *
 * public/icon.svg shipped MALFORMED for five releases. Its own explanatory
 * comment named the CSS tokens it copies - "(--ramp-g7 / g9 / --prop-white)" -
 * and A DOUBLE HYPHEN IS ILLEGAL INSIDE AN XML COMMENT, so the file was not
 * well-formed XML and every browser parsing it as SVG threw it away. That icon
 * is the site favicon and an entry in the web manifest. Both were silently
 * blank the whole time.
 *
 * Nothing caught it because every check that existed asked the same question:
 * IS THE FILE THERE. shelllint asserted icon-180.png was a real 180x180 PNG by
 * reading its header, which is exactly the right idea, and nothing did the
 * equivalent for anything else. A favicon that will not parse looks precisely
 * like a favicon that has not loaded yet, and a manifest icon that fails looks
 * like a slow connection.
 *
 * It surfaced only because a landing page put the same file in an <img>, where
 * broken is visible. That is luck, and luck is not a test strategy.
 *
 * So: every file this game ships is opened and checked against the format it
 * claims by its extension. PNG magic bytes and a sane header. WebP RIFF
 * container. WOFF2 signature. JSON that parses. SVG that is well-formed XML
 * with balanced tags. HTML that closes what it opens.
 *
 * The rule this file exists to keep:
 *
 *     PRESENCE IS NOT VALIDITY. A file that exists and cannot be read is
 *     worse than a file that is missing, because the missing one is noticed.
 *
 * Run: npx vite-node scripts/validityprobe.ts
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Everywhere a file can reach a player's device. dist/ is deliberately NOT
 *  walked: it is generated from these, so a fault there is a fault here, and
 *  checking both would report every problem twice. */
const ROOTS = ['public', 'landing', 'src/ui', 'src/ui/fonts', 'packaging/shell']

const files: string[] = []
const walk = (dir: string) => {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) { if (name.name !== 'node_modules') walk(p) }
    else files.push(p)
  }
}
for (const r of ROOTS) walk(r)

const CHECKED = new Set(['.png', '.svg', '.webp', '.woff2', '.json', '.webmanifest', '.html'])
const targets = files.filter(f => CHECKED.has(extname(f).toLowerCase()))
console.log(`${targets.length} shipped files to open, across ${ROOTS.length} roots\n`)

let png = 0, svg = 0, webp = 0, font = 0, json = 0, html = 0

for (const f of targets) {
  const ext = extname(f).toLowerCase()
  const buf = readFileSync(f)
  ok(statSync(f).size > 0, `${f} is not empty`)

  if (ext === '.png') {
    png++
    // \x89PNG\r\n\x1a\n, then IHDR with the dimensions
    const magic = buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20)
    ok(magic, `${f} carries the PNG signature`)
    ok(w > 0 && h > 0 && w < 20000 && h < 20000, `${f} declares a sane size (${w}x${h})`)
  }

  if (ext === '.webp') {
    webp++
    // RIFF....WEBP
    ok(buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP',
      `${f} is a RIFF/WEBP container`)
  }

  if (ext === '.woff2') {
    font++
    ok(buf.subarray(0, 4).toString('ascii') === 'wOF2', `${f} carries the WOFF2 signature`)
  }

  if (ext === '.json' || ext === '.webmanifest') {
    json++
    let parsed = true
    try { JSON.parse(buf.toString('utf8')) } catch { parsed = false }
    ok(parsed, `${f} parses as JSON`)
  }

  if (ext === '.svg') {
    svg++
    const text = buf.toString('utf8')
    // THE EXACT TRAP: -- inside <!-- ... -->. This is the check that would
    // have caught icon.svg on the day it was written.
    const comments = [...text.matchAll(/<!--([\s\S]*?)-->/g)].map(m => m[1])
    const offender = comments.find(c => c.includes('--'))
    ok(offender === undefined,
      `${f} has no double hyphen inside an XML comment${offender ? ` - found "${offender.trim().slice(0, 60)}..."` : ''}`)
    ok(/<svg[\s>]/.test(text) && /<\/svg>\s*$/.test(text.trim()), `${f} opens and closes as an svg`)
    const opens = (text.match(/<(?!\/|!|\?)[a-zA-Z]/g) ?? []).length
    const closes = (text.match(/<\//g) ?? []).length
    const selfs = (text.match(/\/>/g) ?? []).length
    ok(opens === closes + selfs, `${f} balances its tags (${opens} open, ${selfs} self-closed, ${closes} closed)`)
  }

  if (ext === '.html') {
    html++
    const text = buf.toString('utf8')
    // the google verification file is one line of text with an .html name and
    // is not markup at all; Search Console wants it exactly as issued
    if (/^google[0-9a-f]+\.html$/.test(f.split('/').pop() ?? '')) {
      ok(/^google-site-verification:/.test(text.trim()), `${f} is the verification token Google issued, verbatim`)
      continue
    }
    for (const tag of ['html', 'head', 'body']) {
      const o = (text.match(new RegExp(`<${tag}[\\s>]`, 'gi')) ?? []).length
      const c = (text.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
      ok(o === c, `${f} closes every <${tag}> it opens (${o} open, ${c} closed)`)
    }
    // an unclosed <div> is the classic way a page renders as a blank column
    const dOpen = (text.match(/<div[\s>]/gi) ?? []).length
    const dClose = (text.match(/<\/div>/gi) ?? []).length
    ok(dOpen === dClose, `${f} closes every <div> (${dOpen} open, ${dClose} closed)`)
  }
}

console.log(`\nopened ${png} PNG, ${webp} WebP, ${svg} SVG, ${font} font, ${json} JSON, ${html} HTML`)
console.log(fails
  ? `\nVALIDITY PROBE FAILED (${fails})`
  : '\nVALIDITY PROBE PASSED: every shipped file is the thing its name claims')
if (fails) process.exit(1)
