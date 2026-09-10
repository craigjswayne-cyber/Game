/*
 * ONE FILE, FOR SENDING TO SOMEBODY.
 *
 * The app is a dozen ES modules, three fonts and two stylesheets, which is the
 * right shape for a thing that gets deployed and the wrong shape for a thing
 * you want to hand to one person to look at. This flattens all of it into a
 * single self contained .html: no server, no build on their end, no network.
 *
 * What is lost, deliberately:
 *
 *   - the service worker, so no offline cache. There is no second file for it
 *     to be, and a registration that always fails is noise in the console. The
 *     hosted build is the one that works on the tube.
 *   - the web app manifest, so Add to Home Screen gives a plain bookmark rather
 *     than the standalone shell.
 *
 * Everything else is the real app, including localStorage, so a person opening
 * the file gets the intake and keeps their data between visits.
 *
 * Run:  npm run singlefile              ->  dist/made-by-mimi.html
 *       npm run singlefile -- --artifact ->  dist/made-by-mimi.artifact.html
 *
 * The --artifact variant is the same page without the document scaffolding,
 * for hosts that supply their own <head> and <body> and wrap what you give
 * them. Same styles, same script, same app.
 */
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const at = (...p) => join(ROOT, ...p)

const FONTS = [
  ['playfair-display-latin-wght-normal.woff2', "'Playfair Display'", 'normal', '400 700'],
  ['playfair-display-latin-wght-italic.woff2', "'Playfair Display'", 'italic', '400 700'],
  ['sora-latin-wght-normal.woff2', "'Sora'", 'normal', '100 800'],
]

/* The fonts go in as base64. About 150KB of the finished file, and the reason
   it looks like the app rather than like Times New Roman. */
async function fontFaces() {
  const faces = []
  for (const [file, family, style, weight] of FONTS) {
    const b64 = (await readFile(at('fonts', file))).toString('base64')
    faces.push(`@font-face {
  font-family: ${family};
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url(data:font/woff2;base64,${b64}) format('woff2-variations');
}`)
  }
  return faces.join('\n')
}

const result = await build({
  entryPoints: [at('js/app.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
})

// The only edit made to the app's own code: there is no sw.js beside a single
// file, so the registration call goes. The function stays, unused, rather than
// cutting into the module and risking everything else that imports from it.
const script = result.outputFiles[0].text.replace(/^\s*registerWorker\(\);\s*$/m, '')

const [tokens, app, icon] = await Promise.all([
  readFile(at('styles/tokens.css'), 'utf8'),
  readFile(at('styles/app.css'), 'utf8'),
  readFile(at('icons/icon.svg'), 'utf8'),
])

const ARTIFACT = process.argv.includes('--artifact')

const head = `<title>Made by Mimi</title>
<style>
${await fontFaces()}
${tokens}
${app}
</style>`

const body = `<div id="app" class="app">
  <noscript>Made by Mimi needs JavaScript switched on.</noscript>
</div>
<script>
${script}
</script>`

const html = ARTIFACT ? `${head}\n${body}\n` : `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="Fitness, nutrition, mindset and 1-1 coaching, in one place." />
<meta name="theme-color" content="#FDFBF7" />
<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}" />
${head}
</head>
<body>
${body}
</body>
</html>
`

await mkdir(at('dist'), { recursive: true })
const out = at(ARTIFACT ? 'dist/made-by-mimi.artifact.html' : 'dist/made-by-mimi.html')
await writeFile(out, html)
console.log(`${out}  ${Math.round(html.length / 1024)}KB`)
