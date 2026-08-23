/**
 * ---- THE GAME DOES NOT PHONE HOME, AND THIS IS WHY THAT STAYS TRUE ----
 *
 * Both stores are asked, in a form, what personal data this app collects. The
 * answer is "none", and the whole of the evidence for it is that the shipped
 * source contains no way to send anything anywhere: no fetch, no XHR, no
 * beacon, no socket, no analytics SDK, no remote font, no remote script.
 *
 * That was true because nobody had added one. It is now a claim on a store
 * listing and a privacy policy, so it is a thing that has to be POLICED - and
 * the single likeliest way for it to stop being true is monetisation, which is
 * exactly what has just been built. An ad SDK dropped into a component, a
 * price fetched from a backend "just for display", a crash reporter added to
 * chase one bug: each is one line, and each turns a truthful privacy label
 * into a false one.
 *
 * So: a static sweep of everything that ships, run in the suite.
 *
 * The bridge pattern (src/game/monetise.ts) exists to keep this passable. The
 * game hands a purchase to a shell that a store already trusts; the store's own
 * code makes whatever call it makes, in its own process, outside this bundle.
 * Nothing here reaches the network, which is why nothing here has to be
 * declared.
 *
 * Run: npx vite-node scripts/netprobe.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Every way a browser can start a request, by name. */
const BANNED: [RegExp, string][] = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/navigator\.sendBeacon/, 'navigator.sendBeacon'],
  [/new\s+WebSocket\b/, 'WebSocket'],
  [/new\s+EventSource\b/, 'EventSource'],
  [/\bimportScripts\s*\(/, 'importScripts()'],
  [/navigator\.geolocation/, 'geolocation'],
  [/getUserMedia/, 'getUserMedia'],
  [/\bNotification\s*\(/, 'Notification()'],
  [/googletagmanager|google-analytics|gtag\(|firebase|sentry|amplitude|mixpanel|admob|googlesyndication/i, 'a third-party SDK'],
  // a remote asset is a request too, and one that leaks an IP address
  [/["'`]https?:\/\/(?!localhost)/, 'an absolute http(s) URL'],
]

const files: string[] = []
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx|css|html)$/.test(p)) files.push(p)
  }
}
walk('src')
files.push('index.html')

console.log(`${files.length} shipped files swept\n`)

/**
 * ONE STRING IS ALLOWED TO LOOK LIKE A URL, and only in one file.
 *
 * 'https://play.google.com/billing' is a PAYMENT METHOD IDENTIFIER: the string
 * PaymentRequest matches on to decide which payment app to hand the sheet to,
 * and the string getDigitalGoodsService names its service by. Nothing fetches
 * it. It is spelled as a URL because that is the shape the spec chose for
 * identifiers, and refusing it here would mean the Android billing bridge
 * could not exist at all.
 *
 * Exact, and file-scoped: any other host, or this one anywhere else, still
 * fails.
 */
const ALLOWED: [string, RegExp][] = [
  ['src/game/playbilling.ts', /https:\/\/play\.google\.com\/billing/g],
]

const strip = (src: string, file: string) => {
  let out = src
    // comments are prose, and this file's own prose names every banned API
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const [f, re] of ALLOWED) if (file === f) out = out.replace(re, 'ALLOWED-PAYMENT-METHOD-ID')
  return out
}

const found: string[] = []
for (const f of files) {
  const src = strip(readFileSync(f, 'utf8'), f)
  for (const [re, what] of BANNED) {
    const m = src.match(re)
    if (m) {
      const line = src.slice(0, m.index).split('\n').length
      found.push(`${f}:${line} uses ${what}`)
    }
  }
}
for (const hit of found) console.log(`FAIL  ${hit}`)
ok(found.length === 0, `nothing in src/ or index.html can reach the network (${found.length} found)`)

// ---- the service worker is allowed exactly one kind of fetch ---------------
//
// public/sw.js is a cache, so it necessarily handles fetch events - but it must
// only ever serve the app's OWN assets. A service worker that fetched a third
// party would be a request the page never made and nobody could see.
{
  const sw = readFileSync('public/sw.js', 'utf8')
  const abs = strip(sw, 'public/sw.js').match(/["'`]https?:\/\/(?!localhost)[^"'`]*/g) ?? []
  ok(abs.length === 0, `the service worker names no remote host${abs.length ? `: ${abs.join(', ')}` : ''}`)
}

// ---- the fonts ship with the game ------------------------------------------
{
  const css = files.filter(f => f.endsWith('.css')).map(f => readFileSync(f, 'utf8')).join('\n')
  ok(!/fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*["']?https/i.test(css),
    'no stylesheet pulls a font from anybody else')
}

// ---- and the bridge itself is a bridge, not a client ------------------------
//
// monetise.ts is the one file allowed to know a store exists. What it is not
// allowed to do is talk to one: it reads globalThis for something a shell has
// injected and calls methods on it. If this file ever grows a URL, the sweep
// above catches it - this check is the narrower one, that it has not grown its
// own transport.
{
  const m = strip(readFileSync('src/game/monetise.ts', 'utf8'), 'src/game/monetise.ts')
  ok(!/\b(fetch|XMLHttpRequest|WebSocket)\b/.test(m),
    'the billing layer holds no transport of its own - it calls a bridge the shell injects')
  ok(/globalThis/.test(m), 'and it finds that bridge on globalThis, where a wrapper can put it')
}

console.log(fails ? `\nNET PROBE FAILED (${fails})` : '\nNET PROBE PASSED: nothing shipped can send anything anywhere')
if (fails) process.exit(1)
