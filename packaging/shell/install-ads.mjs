// Put the advert provider into a generated shell. Run by both scaffold.sh
// scripts after `cap sync`, which rewrites the web assets every time and so
// undoes this every time:
//
//   node ../shell/install-ads.mjs android
//   node ../shell/install-ads.mjs ios
//
// Four things, each idempotent:
//   1. ads-bridge.js copied beside the game's index.html
//   2. index.html given window.__phaseAds (this platform's ids from ads.json)
//      and a <script src="./ads-bridge.js"> BEFORE the game's module script,
//      so globalThis.rmAds exists when monetise.ts first looks for it
//   3. Android: the AdMob App ID as the APPLICATION_ID <meta-data> the SDK
//      refuses to start without
//      iOS: GADApplicationIdentifier, the ATT purpose string and Google's
//      SKAdNetwork id in Info.plist
//   4. a line saying which ids went in, because test ids in a store build
//      earn nothing and live ids in a debug build are a policy strike
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const platform = process.argv[2]
if (platform !== 'android' && platform !== 'ios') { console.error('usage: install-ads.mjs android|ios'); process.exit(2) }
const ads = JSON.parse(readFileSync(join(here, 'ads.json'), 'utf8'))
const ids = ads[platform]

// where cap sync put the web assets, relative to the shell folder we run in
const PUBLIC = platform === 'android' ? 'android/app/src/main/assets/public' : 'ios/App/App/public'
if (!existsSync(join(PUBLIC, 'index.html'))) { console.error(`no ${PUBLIC}/index.html: run cap sync first`); process.exit(1) }

// 1. the bridge
copyFileSync(join(here, 'ads-bridge.js'), join(PUBLIC, 'ads-bridge.js'))

// 2. the page: ids, then the bridge, then the game
const cfg = { platform, testing: !!ads.testing, consentDebug: !!ads.consentDebug, testDevices: ads.testDevices ?? [], [platform]: ids }
const tag = `<script id="phase-ads">window.__phaseAds=${JSON.stringify(cfg)}</script><script src="./ads-bridge.js"></script>`
const idx = join(PUBLIC, 'index.html')
let html = readFileSync(idx, 'utf8')
html = html.replace(/<script id="phase-ads">[\s\S]*?<\/script><script src="\.\/ads-bridge\.js"><\/script>/, '')
const at = html.search(/<script type="module"/)
if (at < 0) { console.error('index.html has no module script to sit in front of'); process.exit(1) }
html = html.slice(0, at) + tag + '\n    ' + html.slice(at)
writeFileSync(idx, html)

// 3. the native side's App ID
if (platform === 'android') {
  const mf = 'android/app/src/main/AndroidManifest.xml'
  let m = readFileSync(mf, 'utf8')
  const meta = `        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="${ids.appId}" />\n`
  if (/com\.google\.android\.gms\.ads\.APPLICATION_ID/.test(m)) {
    m = m.replace(/(android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s*android:value=")[^"]*(")/, `$1${ids.appId}$2`)
  } else {
    m = m.replace(/(\n\s*<\/application>)/, `\n${meta}$1`)
  }
  writeFileSync(mf, m)
} else {
  const pl = 'ios/App/App/Info.plist'
  let p = readFileSync(pl, 'utf8')
  const purpose = 'This lets the game show adverts that are more relevant to you. Say no and you still get every part of the game, with less relevant adverts.'
  const block = [
    '\t<key>GADApplicationIdentifier</key>',
    `\t<string>${ids.appId}</string>`,
    '\t<key>NSUserTrackingUsageDescription</key>',
    `\t<string>${purpose}</string>`,
    '\t<key>SKAdNetworkItems</key>',
    '\t<array>',
    '\t\t<dict>',
    '\t\t\t<key>SKAdNetworkIdentifier</key>',
    '\t\t\t<string>cstr6suwn9.skadnetwork</string>',
    '\t\t</dict>',
    '\t</array>',
  ].join('\n')
  if (/GADApplicationIdentifier/.test(p)) {
    p = p.replace(/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${ids.appId}$2`)
  } else {
    // the outermost dict closes last; the plist's own closing tags follow it
    p = p.replace(/(\n<\/dict>\s*<\/plist>\s*)$/, `\n${block}$1`)
  }
  writeFileSync(pl, p)
}

// 4. say what went in
console.log(`    ads-bridge.js + window.__phaseAds (${platform}), App ID ${ids.appId}`)
console.log(ads.testing
  ? '    GOOGLE TEST IDS - banners say "Test Ad" and earn nothing. Fine for a debug or internal build.'
  : '    LIVE IDS - never install this build on a phone that is not in testDevices; clicking your own adverts is a strike.')
