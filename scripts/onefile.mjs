/**
 * ---- THE WHOLE GAME AS ONE HTML FILE ----
 *
 * For a link somebody can open and play with no web server behind it: an
 * Artifact, a file on a phone, an email attachment. Reads the dist-single
 * build (vite.single.config.ts - one bundle, every language, font and image
 * already data URIs) and folds the script and the stylesheet into the markup.
 *
 * WHAT IT DROPS AND WHY: the manifest, the favicon and the apple-touch icon
 * are separate files this document cannot carry, and a link to a file that is
 * not there is a 404 in the console on every load. The game reads none of
 * them - they are how a browser offers "add to home screen", which needs a
 * real origin anyway.
 *
 * The one escaping rule that matters: a bundle full of rugby commentary can
 * contain the characters `</script` inside a string, and the parser would end
 * the block there. `<\/script` is the same string to JavaScript and invisible
 * to the parser.
 *
 *   node scripts/onefile.mjs [outfile]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

const dist = resolve('dist-single')
const out = process.argv[2] ?? resolve(dist, 'phase-onefile.html')
let html = readFileSync(resolve(dist, 'index.html'), 'utf8')

const js = readFileSync(resolve(dist, html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1].replace('./', 'dist-single/')), 'utf8')
const css = readFileSync(resolve(dist, html.match(/href="\.\/(assets\/[^"]+\.css)"/)[1].replace('./', 'dist-single/')), 'utf8')

// A REPLACER FUNCTION, NEVER A REPLACEMENT STRING. String.replace treats $&,
// $', $` and $1 as substitution patterns in the replacement, and a 3.9MB
// bundle of rugby commentary contains those sequences - the first attempt
// silently corrupted the JavaScript and the page died on "missing ) after
// argument list". A function's return value is inserted verbatim.
html = html
  .replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace(/<link[^>]*rel="stylesheet"[^>]*>/, () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
  .replace(/<link[^>]*rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*/g, '')
  .replace(/<link[^>]*rel="modulepreload"[^>]*>\s*/g, '')

// ---- ARTIFACT SHAPE ----
// An Artifact supplies its own <!doctype>, <head> and <body>: a second full
// document nested inside that one is not markup a browser is obliged to make
// sense of. `--artifact` emits the page CONTENT only - the title, the styles,
// the #root the game mounts into, and the bundle - with the head furniture
// that needs a real origin (manifest, icons) already dropped above and the
// viewport/theme meta left to the host.
if (process.argv.includes('--artifact')) {
  const title = (html.match(/<title>([^<]*)<\/title>/) ?? [, 'PHASE: Rugby Manager'])[1]
  const style = (html.match(/<style>[\s\S]*?<\/style>/) ?? [''])[0]
  const body = (html.match(/<body>([\s\S]*?)<\/body>/) ?? [, ''])[1]
  // Vite emits the module script into <head>, so it is NOT inside <body> and a
  // body-only capture silently drops the entire game (0.41MB of stylesheet and
  // an empty #root). Take the script wherever it sits, and put it last so the
  // element it mounts into exists before it runs.
  const script = (html.match(/<script type="module">[\s\S]*?<\/script>/) ?? [''])[0]
  html = `<title>${title}</title>\n${style}\n${body.trim()}\n${script}\n`
}

writeFileSync(out, html)
const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2)
console.log(`${out}  ${mb} MB`)
if (Buffer.byteLength(html) > 16 * 1024 * 1024) { console.log('OVER the 16MB artifact ceiling'); process.exit(1) }
