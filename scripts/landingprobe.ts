/**
 * ---- THE LANDING PAGE, AND THE GAME THAT IS NO LONGER BEHIND IT ----
 *
 * phaserugbymanager.com used to open straight into a playable game. It now opens
 * on landing/index.html and THE GAME IS NOT PUBLISHED TO THE WEB AT ALL.
 *
 * That happened in two steps on the same day. First the root became a landing
 * page and the game moved to /play/, because the browser build carries no
 * adverts and no shop and so earned nothing from anybody it swallowed. Then:
 * "i dont want people to be able to play in browser" - and a link you simply
 * stop advertising is still a URL that a bookmark reaches. So the deploy stopped
 * shipping the game to the web entirely.
 *
 * This probe therefore asserts the ABSENCE of something, which is the kind of
 * check that rots quietest: nothing looks wrong on the day somebody re-adds a
 * copy step, and the game is back on the web until a human happens to notice.
 *
 * That move quietly put three live things at risk, and none of them fails
 * loudly when broken:
 *
 *   1. /privacy.html is the privacy policy URL SUBMITTED TO BOTH STORES. A
 *      store field pointing at a 404 is found by a reviewer, weeks later, on a
 *      submission you thought was finished.
 *   2. /google59479af58f8cd344.html is Search Console ownership of the ROOT.
 *      Move it and verification silently lapses.
 *   3. /CNAME is what points the custom domain at Pages at all.
 *
 * All three ship in public/, and the deploy copies public/ over the site root
 * for exactly that reason. This probe holds the arrangement together from the
 * other end: it reads the workflow and asserts the assembly still happens, so
 * that a future edit to pages.yml cannot quietly go back to publishing dist/.
 *
 * It also holds the landing page's frozen palette to the real tokens. The page
 * has no build step on purpose - it must render even if the app's toolchain is
 * broken - so its colours are a hand copy of the night tokens, and a hand copy
 * is a thing that drifts.
 *
 * Run: npx vite-node scripts/landingprobe.ts
 */
import { readFileSync, existsSync } from 'node:fs'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const html = existsSync('landing/index.html') ? readFileSync('landing/index.html', 'utf8') : ''
ok(!!html, 'landing/index.html exists')

// ---- 1. it is a landing page, not the game ----
ok(/PHASE/.test(html) && /Rugby Manager/.test(html), 'it carries the name of the game')
ok(!/src="\/src\/main\.tsx"/.test(html) && !/type="module"/.test(html),
  'and it does NOT boot the app - the whole point is that it renders with no build')
ok(!/<script/i.test(html),
  'no script tag at all: nothing to break, nothing to wait for')

// ---- 2. no external request, ever ----
//
// A landing page that reaches out to a font CDN or an analytics host is a
// landing page that leaks its visitors and slows down on a bad connection.
// Everything it needs is beside it in landing/.
// The test is about what the page FETCHES, not about every absolute URL in it.
// An <a> to Google Play and a canonical URL are absolute by necessity and cost
// the visitor nothing; a font CDN in a <link> or an off-site <img src> is the
// actual risk. So: any external src at all, plus any external <link> that is
// not the canonical.
const badSrc = [...html.matchAll(/\bsrc="(?:https?:)?\/\/[^"]+"/g)].map(m => m[0])
const badLink = [...html.matchAll(/<link\b[^>]*>/g)]
  .map(m => m[0])
  .filter(tag => /href="(?:https?:)?\/\//.test(tag) && !/rel="canonical"/.test(tag))
const external = [...badSrc, ...badLink]
ok(external.length === 0, `the page fetches nothing off-site (${external.length ? external.join(', ') : 'no external src, no external stylesheet or font'})`)

// og:image is allowed to be absolute - it is metadata for a scraper, not a
// request the page makes - and so are the store links, which must be absolute
ok(/property="og:image" content="https:\/\/phaserugbymanager\.com\//.test(html),
  'the share image is an absolute URL, which is the one place that is required')

// ---- 3. the routes off it ----
ok(!/href="[^"]*play\//.test(html), 'it offers NO link to a browser build, because there is not one to link to')
ok(/href="\.\/privacy\.html"/.test(html), 'it links to the privacy policy, which reviewers and players both look for')
ok(/mailto:phaserugbymanager@gmail\.com/.test(html), 'and carries the contact address from the store listing')

// ---- 4. the store buttons ----
//
// Play's URL is derivable from the package id and was wired up before the app
// reached production, on purpose: it starts working the moment it does. The
// App Store one has no URL yet and must not pretend to.
ok(/play\.google\.com\/store\/apps\/details\?id=com\.phaserugbymanager\.app/.test(html),
  'the Google Play link uses the real package id')
ok(/class="store soon"/.test(html) && !/apps\.apple\.com/.test(html),
  'the App Store button is marked coming soon rather than linking nowhere')

// ---- 5. the assets it names all exist ----
for (const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) {
  const rel = m[1]
  if (rel.endsWith('/')) continue                       // ./play/ is made at deploy time
  if (rel === 'privacy.html') continue                  // comes from public/ at deploy time
  ok(existsSync(`landing/${rel}`), `landing/${rel} is in the repo`)
}

// ---- 6. the palette has not drifted from the game ----
const tokens = readFileSync('src/ui/tokens.css', 'utf8')
const nightBlock = tokens.slice(tokens.indexOf(':root,'), tokens.indexOf('/* ---------------- day'))
for (const name of ['canvas', 'surface-1', 'border', 'text-primary', 'text-secondary', 'text-muted', 'primary', 'on-primary', 'gold']) {
  const inGame = nightBlock.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase()
  const inPage = html.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase()
  ok(!!inGame && inGame === inPage,
    `--${name} matches the game's night palette (${inGame ?? '?'} vs ${inPage ?? 'missing'})`)
}

// ---- 7. the deploy still assembles the site ----
const wf = readFileSync('.github/workflows/pages.yml', 'utf8')
ok(/path: site$/m.test(wf), 'the deploy publishes site/, not dist/')
ok(!/cp -R dist/.test(wf), 'and it copies NO part of dist/ to the web - that is what stops the game being playable in a browser')
ok(/if \[ -e site\/play \]/.test(wf), 'and it fails the deploy outright if a site/play appears again')
ok(/cp -R public\/\. site\//.test(wf),
  'public/ is copied to the ROOT, which is what keeps privacy.html, CNAME and the Search Console file where they were')
ok(/cp -R landing\/\. site\//.test(wf), 'and the landing page is copied over the root')
for (const guard of ['test -f site/privacy.html', 'test -f site/CNAME', 'test -f site/google59479af58f8cd344.html']) {
  ok(wf.includes(guard), `the deploy refuses to publish without: ${guard.replace('test -f ', '')}`)
}

// The build step is NOT dead weight and must not be "tidied away": dist/ is what
// both shells bundle and what ipprobe reads to check no real mark ships. It is
// simply no longer the website.
ok(/npm run build/.test(wf), 'the deploy still builds dist/, which ipprobe and both shells depend on')
ok(/ipprobe/.test(wf), 'and still runs the real-world-marks check over it')

// ---- 8. dist/ is still the app, untouched ----
//
// The one way this whole arrangement could go wrong quietly is somebody
// "tidying up" by moving the game inside dist/ instead of at deploy time. Both
// shells load index.html from the root of what they bundle.
const capIos = JSON.parse(readFileSync('packaging/ios/capacitor.config.json', 'utf8'))
const capAnd = JSON.parse(readFileSync('packaging/android/capacitor.config.json', 'utf8'))
ok(capIos.webDir === '../../dist' && capAnd.webDir === '../../dist',
  'both shells still bundle dist/ itself, so the site rearrangement cannot reach them')

console.log(fails ? `\nLANDING PROBE FAILED (${fails})` : '\nLANDING PROBE PASSED: the shop window has no game behind it, and the three submitted URLs did not move')
if (fails) process.exit(1)
