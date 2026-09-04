// Probe: the shell's advert bridge, in a real browser, against the real build.
//
// packaging/shell/ads-bridge.js is the only code that ever talks to an ad SDK,
// and it ships in the Android and iOS shells only. This drives the REAL bridge
// script over the REAL game, with the native plugin faked underneath it - the
// same seam a device has, one layer down. What it holds:
//
//   consent comes first: no banner and no spot is asked for until the consent
//     form has answered and the SDK has been initialised, in that order;
//   consent refused means no adverts and an untouched game, not a broken one;
//   a banner is asked for only where the game mounted a slot, with that
//     slot's unit id, at the bottom, and the page makes room for it
//     (--ad-inset feeds the bottom nav's padding) and gives the room back;
//   a sheet over the page hides the banner and closing it brings it back;
//   leaving the screen hides it, coming back resumes it (no second request);
//   a rewarded spot earns the favour only when the plugin said it was
//     rewarded: dismissed early is 'skipped', failed is 'unavailable', and
//     six in a real day is the ceiling;
//   on iOS the tracking prompt is asked before consent.
//
// Run: node scripts/adsprobe.mjs   (needs a fresh npm run build)
import { chromium } from 'playwright-core'
import { startPreview, done } from './lib/preview.mjs'
import { writeSync, readFileSync } from 'node:fs'

const say = (s) => writeSync(1, s + '\n')
let fails = 0
const ok = (c, what) => { say(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const ADS = JSON.parse(readFileSync('packaging/shell/ads.json', 'utf8'))
const BRIDGE = readFileSync('packaging/shell/ads-bridge.js', 'utf8')

const server = await startPreview('4211', 3000)
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' })

/**
 * A page booted the way the shell boots it: window.__phaseAds, a Capacitor
 * global whose native side says it has an AdMob plugin, and the bridge script
 * itself, all before the game. The fake plugin keeps a log of every call and
 * fires the same events the real one does.
 *   consent: 'required' (form shown, then allowed) | 'refused' | 'none' (not in EEA)
 *   spot: 'reward' | 'dismiss' | 'fail' | 'noload'  - how a rewarded spot ends
 */
const openPage = async ({ platform = 'android', consent = 'required', spot = 'reward', att = 'notDetermined' } = {}) => {
  const page = await browser.newPage({ viewport: { width: 412, height: 780 }, locale: 'en-GB' })
  page.setDefaultTimeout(9000)
  await page.addInitScript(() => localStorage.setItem('rm-night', '1'))
  await page.addInitScript(([platform, cfg, consent, spot, att]) => {
    globalThis.__phaseAds = { platform, testing: true, consentDebug: false, testDevices: [], [platform]: cfg }
    const log = []
    const listeners = {}
    const fire = (ev, data) => (listeners[ev] ?? []).forEach(fn => fn(data))
    const plugin = {
      addListener: async (ev, fn) => { (listeners[ev] ??= []).push(fn); return { remove: () => { listeners[ev] = listeners[ev].filter(f => f !== fn) } } },
      trackingAuthorizationStatus: async () => { log.push('trackingAuthorizationStatus'); return { status: att } },
      requestTrackingAuthorization: async () => { log.push('requestTrackingAuthorization') },
      requestConsentInfo: async () => {
        log.push('requestConsentInfo')
        if (consent === 'none') return { status: 'NOT_REQUIRED', canRequestAds: true, isConsentFormAvailable: false }
        return { status: 'REQUIRED', canRequestAds: false, isConsentFormAvailable: true }
      },
      showConsentForm: async () => { log.push('showConsentForm'); return { status: 'OBTAINED', canRequestAds: consent !== 'refused' } },
      initialize: async (o) => { log.push('initialize:' + (o?.maxAdContentRating ?? '')) },
      showBanner: async (o) => { log.push('showBanner:' + o.adId + ':' + o.position); setTimeout(() => fire('bannerAdSizeChanged', { width: 320, height: 50 }), 0) },
      hideBanner: async () => { log.push('hideBanner'); setTimeout(() => fire('bannerAdSizeChanged', { width: 0, height: 0 }), 0) },
      resumeBanner: async () => { log.push('resumeBanner'); setTimeout(() => fire('bannerAdSizeChanged', { width: 320, height: 50 }), 0) },
      removeBanner: async () => { log.push('removeBanner'); setTimeout(() => fire('bannerAdSizeChanged', { width: 0, height: 0 }), 0) },
      prepareRewardVideoAd: async (o) => { log.push('prepareRewardVideoAd:' + o.adId); if (spot === 'noload') throw new Error('no fill') ; return { adUnitId: o.adId } },
      showRewardVideoAd: async () => {
        log.push('showRewardVideoAd')
        setTimeout(() => {
          fire('onRewardedVideoAdShowed', {})
          if (spot === 'fail') return fire('onRewardedVideoAdFailedToShow', { code: 1, message: 'x' })
          if (spot === 'reward') fire('onRewardedVideoAdReward', { type: 'coin', amount: 1 })
          fire('onRewardedVideoAdDismissed', {})
        }, 30)
        return spot === 'reward' ? { type: 'coin', amount: 1 } : new Promise(() => {})
      },
    }
    globalThis.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => platform,
      PluginHeaders: [{ name: 'AdMob', methods: [] }],
      Plugins: {},
      registerPlugin: (name) => { const p = name === 'AdMob' ? plugin : {}; globalThis.Capacitor.Plugins[name] = p; return p },
    }
    globalThis.__adlog = log
  }, [platform, ADS[platform], consent, spot, att])
  await page.addInitScript(BRIDGE)
  const errs = []
  page.on('pageerror', e => errs.push(e.message))
  return { page, errs }
}

const startCareer = async (page) => {
  await page.goto('http://localhost:4211/')
  await page.waitForSelector('text=RUGBY')
  await page.click('text=New Career')
  await page.waitForSelector('text=English Premier Division')
  await page.click('text=English Premier Division')
  await page.waitForSelector('.club-tile')
  await page.click('.tile >> text=Leicester')
  await page.waitForSelector('text=Star Player')
  await page.click('.action-bar >> text=Confirm')
  await page.fill('input[placeholder="e.g. A. Gaffer"]', 'Gaffer')
  await page.click('.action-bar >> text=Confirm')
  await page.click('text=▸ Start Career')
  await page.waitForSelector('.tut-box', { timeout: 15000 })
  await page.click('.tut-close .btn')
  await page.waitForSelector('.bottom-nav')
}

const log = (page) => page.evaluate(() => [...globalThis.__adlog])
const inset = (page) => page.evaluate(() => document.documentElement.style.getPropertyValue('--ad-inset'))
const navPad = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.bottom-nav')).paddingBottom))
const settle = (page, ms = 250) => page.waitForTimeout(ms)

try {
  // ---- 1. consent, then the SDK, then a banner where the slot is -----------
  say('--- 1. the Android shell: consent first, then the SDK, then the Home banner')
  {
    const { page, errs } = await openPage()
    await startCareer(page)
    await settle(page, 600)
    const l = await log(page)
    const i = (s) => l.findIndex(x => x.startsWith(s))
    ok(await page.evaluate(() => typeof globalThis.rmAds?.mount === 'function' && typeof globalThis.rmAds?.showRewarded === 'function'),
      'the bridge is on globalThis in the shape monetise.ts reads (mount, unmount, showRewarded)')
    ok(i('requestConsentInfo') >= 0 && i('showConsentForm') > i('requestConsentInfo'), 'the consent form was asked for and shown')
    ok(i('initialize') > i('showConsentForm'), 'the SDK was initialised only after consent answered')
    ok(i('showBanner') > i('initialize'), 'and the first banner request came after that, not before')
    ok(!l.some(x => x.startsWith('trackingAuthorizationStatus')), 'no tracking prompt on Android (it is an Apple thing)')
    ok(l.filter(x => x.startsWith('showBanner')).length === 1, 'exactly one banner request on Home')
    ok(l.some(x => x === `showBanner:${ADS.android.banner['home-foot']}:BOTTOM_CENTER`), `with the Home unit id, at the bottom (${l.find(x => x.startsWith('showBanner'))})`)
    ok(await page.evaluate(() => document.querySelectorAll('.ad-slot').length === 1), 'the game rendered one slot, on Home')
    ok((await inset(page)) === '50px', `the page was told the banner is 50px tall (--ad-inset ${await inset(page)})`)
    ok((await navPad(page)) >= 50, `so the bottom nav made room under itself (padding-bottom ${await navPad(page)}px)`)

    // a sheet over the page: the banner steps aside
    await page.evaluate(() => { const v = document.createElement('div'); v.className = 'modal-veil'; v.id = 'probe-veil'; document.body.appendChild(v) })
    await settle(page, 400)
    ok((await log(page)).at(-1) === 'hideBanner' && (await inset(page)) === '0px', 'a sheet over the page hides the banner and the room is given back')
    await page.evaluate(() => document.getElementById('probe-veil').remove())
    await settle(page, 400)
    ok((await log(page)).at(-1) === 'resumeBanner' && (await inset(page)) === '50px', 'closing the sheet brings it back without a new request')

    // leave the screen: hidden; come back: resumed, not re-requested
    const before = (await log(page)).length
    await page.locator('.bottom-nav button').nth(0).click()   // the news
    await page.waitForTimeout(500)
    ok((await log(page)).slice(before).includes('hideBanner') && (await inset(page)) === '0px', 'leaving Home hides the banner (no slot on the inbox)')
    ok(await page.evaluate(() => document.querySelectorAll('.ad-slot').length === 0), 'and the game has no slot on that screen')
    await page.locator('.bottom-nav button').nth(1).click()   // home
    await page.waitForTimeout(500)
    const after = (await log(page)).slice(before)
    ok(after.includes('resumeBanner') && !after.some(x => x.startsWith('showBanner')), 'coming back resumes the same banner rather than requesting another')
    ok((await inset(page)) === '50px', 'and the room is made again')

    // a different slot wants a different unit
    await page.evaluate(() => globalThis.rmAds.mount(document.createElement('div'), 'results-foot'))
    await settle(page, 400)
    const tail = (await log(page)).slice(-2)
    ok(tail[0] === 'removeBanner' && tail[1] === `showBanner:${ADS.android.banner['results-foot']}:BOTTOM_CENTER`,
      `a slot with another unit id takes the old banner down and requests its own (${tail.join(' → ')})`)
    ok(errs.length === 0, `no page errors (${errs.join(' | ') || 'none'})`)
    await page.close()
  }

  // ---- 2. rewarded ---------------------------------------------------------
  say('\n--- 2. a rewarded spot earns the favour only when the plugin said so')
  for (const [spot, want] of [['reward', 'completed'], ['dismiss', 'skipped'], ['fail', 'unavailable'], ['noload', 'unavailable']]) {
    const { page, errs } = await openPage({ spot })
    await startCareer(page)
    const out = await page.evaluate(() => globalThis.rmAds.showRewarded('medical'))
    ok(out === want, `${spot} → '${out}'`)
    const l = await log(page)
    ok(l.some(x => x === `prepareRewardVideoAd:${ADS.android.rewarded}`), 'with the rewarded unit id')
    if (spot === 'noload') ok(!l.includes('showRewardVideoAd'), 'a spot that did not load is never shown')
    if (spot === 'reward') ok(await page.evaluate(() => localStorage.getItem('rm-rw')?.endsWith(':1')), 'and a completed spot counts one against today')
    ok(errs.length === 0, `no page errors (${errs.join(' | ') || 'none'})`)
    await page.close()
  }
  {
    const { page } = await openPage({ spot: 'reward' })
    await page.addInitScript(() => { const d = new Date(); localStorage.setItem('rm-rw', `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}:6`) })
    await startCareer(page)
    const out = await page.evaluate(() => globalThis.rmAds.showRewarded('medical'))
    const l = await log(page)
    ok(out === 'unavailable' && !l.some(x => x.startsWith('prepareRewardVideoAd')), `six today is the ceiling: '${out}' without asking the plugin`)
    ok(await page.evaluate(() => !!document.querySelector('.bottom-nav')), 'and the game is untouched by the refusal')
    await page.close()
  }

  // ---- 3. consent refused --------------------------------------------------
  say('\n--- 3. consent refused: no adverts, and the game plays on')
  {
    const { page, errs } = await openPage({ consent: 'refused' })
    await startCareer(page)
    await settle(page, 600)
    const l = await log(page)
    ok(l.includes('showConsentForm') && !l.some(x => x.startsWith('initialize')), 'the form was shown, the SDK never initialised')
    ok(!l.some(x => x.startsWith('showBanner')), 'no banner was ever requested')
    ok((await inset(page)) === '0px', 'the page kept all its room')
    const out = await page.evaluate(() => globalThis.rmAds.showRewarded('medical'))
    ok(out === 'unavailable' && !l.some(x => x.startsWith('prepareRewardVideoAd')), `a rewarded spot is politely 'unavailable' ('${out}')`)
    ok(await page.evaluate(() => !!document.querySelector('.bottom-nav') && document.body.innerText.includes('Leicester')), 'and Home rendered as it always does')
    ok(errs.length === 0, `no page errors (${errs.join(' | ') || 'none'})`)
    await page.close()
  }

  // ---- 4. outside Europe ----------------------------------------------------
  say('\n--- 4. outside the EEA and UK: no form to show, straight on')
  {
    const { page } = await openPage({ consent: 'none' })
    await startCareer(page)
    await settle(page, 600)
    const l = await log(page)
    ok(l.includes('requestConsentInfo') && !l.includes('showConsentForm') && l.some(x => x.startsWith('initialize')), 'consent info asked, no form needed, SDK initialised')
    ok(l.some(x => x.startsWith('showBanner')), 'and the Home banner requested')
    await page.close()
  }

  // ---- 5. iOS ------------------------------------------------------------------
  say('\n--- 5. the iOS shell: the tracking prompt before consent, and the iOS unit ids')
  {
    const { page, errs } = await openPage({ platform: 'ios' })
    await startCareer(page)
    await settle(page, 600)
    const l = await log(page)
    const i = (s) => l.findIndex(x => x.startsWith(s))
    ok(i('trackingAuthorizationStatus') >= 0 && i('requestTrackingAuthorization') > i('trackingAuthorizationStatus'), 'the App Tracking Transparency prompt was asked')
    ok(i('requestConsentInfo') > i('requestTrackingAuthorization'), 'before the consent form')
    ok(l.some(x => x === `showBanner:${ADS.ios.banner['home-foot']}:BOTTOM_CENTER`), 'and the banner carries the iOS unit id')
    ok(errs.length === 0, `no page errors (${errs.join(' | ') || 'none'})`)
    await page.close()
  }
  {
    const { page } = await openPage({ platform: 'ios', att: 'denied' })
    await startCareer(page)
    await settle(page, 600)
    const l = await log(page)
    ok(!l.includes('requestTrackingAuthorization') && l.some(x => x.startsWith('showBanner')), 'a tracking answer already given is not asked again, and adverts still show')
    await page.close()
  }

  // ---- 6. the ids file itself ----------------------------------------------
  say('\n--- 6. ads.json says what it is')
  ok(ADS.testing === true ? /3940256099942544/.test(ADS.android.appId) && /3940256099942544/.test(ADS.ios.appId) : !/3940256099942544/.test(ADS.android.appId + ADS.ios.appId),
    ADS.testing ? "testing is on and every id is Google's test publisher" : 'testing is off and no id is the test publisher')
  ok(/~/.test(ADS.android.appId) && /~/.test(ADS.ios.appId), 'App IDs carry a ~')
  ok(Object.values(ADS.android.banner).concat(Object.values(ADS.ios.banner), [ADS.android.rewarded, ADS.ios.rewarded]).every(s => /\//.test(s)), 'ad unit ids carry a /')
} catch (e) {
  say('PROBE THREW: ' + (e?.message ?? e))
  fails++
}

await browser.close()
say(fails ? `\nADS PROBE FAILED (${fails})` : '\nADS PROBE PASSED: consent first, banners only where the game put a slot, favours only for a spot that ran')
done(fails)
