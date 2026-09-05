/*
 * ads-bridge.js - the shell's advert provider, in the shape the game speaks.
 *
 * THIS FILE IS NOT PART OF THE WEB BUILD. scripts/netprobe.ts holds that the
 * web build carries no ad SDK, no tracker and no network call, and it still
 * does: this script is copied into the Android and iOS shells by
 * packaging/shell/install-ads.mjs and loaded from the shell's index.html
 * BEFORE the game bundle, so that by the time src/game/monetise.ts reads
 * globalThis.rmAds, it is there. On the website there is no such script and
 * the game renders no advert, no frame and no placeholder.
 *
 * WHAT THE GAME EXPECTS (src/game/monetise.ts, AdBridge):
 *
 *   mount(el, place)      draw a banner for this slot: 'home-foot' or
 *                         'results-foot', the only two places a banner may be
 *   unmount(el)           take it down when the slot leaves the screen
 *   showRewarded(place)   play a rewarded spot the player asked for, and
 *                         resolve 'completed' | 'skipped' | 'unavailable' -
 *                         only 'completed' earns the favour
 *
 * WHAT THE PLUGIN GIVES US (@capacitor-community/admob 8): a native banner
 * that OVERLAYS the bottom of the web view rather than shrinking it, so the
 * page has to leave room itself. We do that with one CSS custom property,
 * --ad-inset, set to the banner's height while one is showing and to 0px
 * otherwise; the game's bottom navigation adds it to its safe-area padding
 * (src/ui/theme.css .bottom-nav), so the banner sits under the nav, never
 * over content and never over a button.
 *
 * THE RULES, and where each is kept:
 *
 *   consent before the first request   ready(): UMP form (and on iOS the ATT
 *                                      prompt) resolve before initialize(),
 *                                      and no banner or spot is asked for
 *                                      until ready() answered true. If consent
 *                                      cannot be gathered, there are no ads
 *                                      and the game is untouched.
 *   never over a sheet                 a MutationObserver watches for
 *                                      .modal-veil / .tut-veil and hides the
 *                                      banner while one is open, resuming it
 *                                      after.
 *   never on the title, in a match,    the game only mounts a slot on Home and
 *   between a tap and its result       Results (AdSlot.tsx); the bridge draws
 *                                      nothing anywhere it was not mounted.
 *   a supporter never sees a banner    adsAllowed() in the game refuses before
 *                                      mount() is ever called; the bridge does
 *                                      not need to know.
 *   rewarded is capped per real day    REWARDED_CAP below, counted in
 *                                      localStorage against today's date.
 *
 * IDs come from window.__phaseAds, written into index.html by install-ads.mjs
 * from packaging/shell/ads.json: Google's TEST ids until the owner's real
 * ones are pasted in. Live ids in a debug build are a policy strike; test ids
 * in a store build earn nothing. ads.json says which is which.
 */
(function () {
  'use strict'
  var w = window
  var cfg = w.__phaseAds
  var C = w.Capacitor
  // Every line here reaches the Xcode / Android Studio console as
  // "[log] - [phase-ads] ...": when a device shows no advert, this is how we
  // learn which rule said no. Nothing is logged on the website, where there
  // is no cfg and the script is not even present.
  var why = 'not started'
  function log() { try { console.log.apply(console, ['[phase-ads]'].concat([].slice.call(arguments))) } catch (e) {} }
  if (!cfg) return
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) { log('not a native shell - no adverts'); return }
  // ask the NATIVE side whether the plugin is really in this build - the
  // registerPlugin proxy answers every property name, so the proxy alone
  // proves nothing (the lesson of src/game/storekit.ts)
  var headers = C.PluginHeaders || []
  var present = false
  for (var i = 0; i < headers.length; i++) if (headers[i] && headers[i].name === 'AdMob') present = true
  if (!present || typeof C.registerPlugin !== 'function') {
    log('the AdMob plugin is NOT in this build (PluginHeaders lacks "AdMob") - no adverts. Plugins present:', headers.map(function (h) { return h && h.name }).join(', '))
    return
  }
  var ad = C.registerPlugin('AdMob')
  var platform = typeof C.getPlatform === 'function' ? C.getPlatform() : cfg.platform
  var ids = cfg[platform] || cfg.android
  if (!ids) { log('no ids for platform', platform); return }
  log('bridge loaded for', platform, cfg.testing ? '(TEST ids)' : '(live ids)', 'app', ids.appId)

  var REWARDED_CAP = 6         // spots per real day, the plan's ceiling
  var SHOW_TIMEOUT_MS = 300000 // a spot that neither rewards nor closes in five minutes is over

  // ---- room at the bottom -------------------------------------------------
  // The page may not have a document element yet: this script runs before the
  // game and, injected by a test, before the page itself, so every DOM touch
  // is deferred to the moment there is a DOM to touch.
  function setInset(px) {
    var root = document.documentElement
    if (root) root.style.setProperty('--ad-inset', (px > 0 ? px : 0) + 'px')
  }
  function whenDom(fn) {
    if (document.documentElement && document.body) fn()
    else document.addEventListener('DOMContentLoaded', fn, { once: true })
  }
  whenDom(function () { setInset(0) })

  // ---- consent, then the SDK ---------------------------------------------
  // Runs once, lazily, the first time anything is asked for. Nothing here
  // throws out to the game: every failure is "no ads", which is the honest
  // outcome and the one the game is built to render.
  var readyP = null
  function ready() {
    if (readyP) return readyP
    readyP = (async function () {
      try {
        if (platform === 'ios') {
          var s = await ad.trackingAuthorizationStatus()
          log('tracking (ATT) status before asking:', s && s.status)
          if (s && s.status === 'notDetermined') {
            var s2 = await ad.requestTrackingAuthorization()
            log('tracking (ATT) status after asking:', s2 && s2.status)
          } else if (s && s.status !== 'authorized') {
            log('ATT prompt skipped: the system already answered', s && s.status, '- on a Simulator check Settings > Privacy & Security > Tracking')
          }
        }
        var opts = cfg.consentDebug ? { debugGeography: 1, testDeviceIdentifiers: cfg.testDevices || [] } : undefined
        var info = await ad.requestConsentInfo(opts)
        log('consent info:', JSON.stringify(info))
        if (info && !info.canRequestAds && info.isConsentFormAvailable) {
          info = await ad.showConsentForm()
          log('after consent form:', JSON.stringify(info))
        }
        if (!info || !info.canRequestAds) {
          why = info && !info.isConsentFormAvailable
            ? 'consent required but no consent form exists - is the AdMob "European regulations" message Published for this app?'
            : 'consent not given - no adverts'
          log(why)
          return false
        }
        await ad.initialize({
          maxAdContentRating: 'General',
          initializeForTesting: !!cfg.testing,
          testingDevices: cfg.testDevices || []
        })
        why = 'ready'
        log('SDK initialised')
        return true
      } catch (e) {
        why = 'error before the SDK could start: ' + (e && (e.message || e.code) || e)
        log(why)
        return false
      }
    })()
    return readyP
  }

  // ---- banner --------------------------------------------------------------
  // One native banner, hidden and resumed as slots come and go; recreated
  // only when the slot asks for a different unit. Every plugin call goes
  // through one queue so a fast screen flip cannot interleave a show and a
  // hide.
  var q = Promise.resolve()
  function enqueue(job) { q = q.then(job, job).catch(function () {}); return q }
  var wantedEl = null, wantedPlace = null, created = null /* place the live banner was made for */, visible = false

  ad.addListener('bannerAdSizeChanged', function (s) { log('banner size', JSON.stringify(s)); setInset(s && s.height ? s.height : 0) })
  ad.addListener('bannerAdFailedToLoad', function (e) { log('banner FAILED to load:', JSON.stringify(e)); setInset(0) })
  ad.addListener('bannerAdLoaded', function () { log('banner loaded') })

  function veiled() { return !!document.querySelector('.modal-veil, .tut-veil') }

  function reconcile() {
    return enqueue(async function () {
      var shouldShow = !!wantedEl && !veiled()
      if (shouldShow) {
        if (!(await ready())) return
        if (created && created !== wantedPlace) { await ad.removeBanner(); created = null; visible = false }
        if (!created) {
          log('asking for banner', wantedPlace, ids.banner[wantedPlace] || ids.banner['home-foot'])
          await ad.showBanner({
            adId: ids.banner[wantedPlace] || ids.banner['home-foot'],
            adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0,
            isTesting: !!cfg.testing
          })
          created = wantedPlace; visible = true
        } else if (!visible) { await ad.resumeBanner(); visible = true }
      } else if (visible) {
        await ad.hideBanner(); visible = false; setInset(0)
      }
    })
  }

  whenDom(function () {
    new MutationObserver(function () { if (wantedEl) reconcile() })
      .observe(document.documentElement, { childList: true, subtree: true })
  })

  // ---- rewarded ------------------------------------------------------------
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }
  function spotsToday() {
    try { var v = (localStorage.getItem('rm-rw') || '').split(':'); return v[0] === today() ? (+v[1] || 0) : 0 } catch (e) { return 0 }
  }
  function countSpot() { try { localStorage.setItem('rm-rw', today() + ':' + (spotsToday() + 1)) } catch (e) {} }

  async function showRewarded(place) {
    if (spotsToday() >= REWARDED_CAP) return 'unavailable'
    if (!(await ready())) return 'unavailable'
    try { await ad.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: !!cfg.testing }) } catch (e) { log('rewarded spot could not be prepared:', e && (e.message || e.code) || e); return 'unavailable' }
    return new Promise(function (resolve) {
      var earned = false, done = false, handles = []
      function finish(v) {
        if (done) return
        done = true
        clearTimeout(timer)
        handles.forEach(function (p) { p.then(function (h) { h && h.remove && h.remove() }).catch(function () {}) })
        if (v === 'completed') countSpot()
        resolve(v)
      }
      function on(ev, fn) { handles.push(Promise.resolve(ad.addListener(ev, fn))) }
      on('onRewardedVideoAdReward', function () { earned = true })
      on('onRewardedVideoAdDismissed', function () { finish(earned ? 'completed' : 'skipped') })
      on('onRewardedVideoAdFailedToShow', function () { finish('unavailable') })
      var timer = setTimeout(function () { finish(earned ? 'completed' : 'unavailable') }, SHOW_TIMEOUT_MS)
      // the plugin resolves this on the reward and never on a dismissal, so
      // the events above are what decide; the call itself only reports a
      // refusal to show
      Promise.resolve(ad.showRewardVideoAd({ adId: ids.rewarded })).catch(function () { finish('unavailable') })
    })
  }

  // ---- the bridge ----------------------------------------------------------
  w.rmAds = {
    mount: function (el, place) { wantedEl = el; wantedPlace = place; reconcile() },
    unmount: function (el) { if (wantedEl === el || !el) { wantedEl = null; wantedPlace = null; reconcile() } },
    showRewarded: showRewarded,
    // for the probe and for a debugging session on a device: never read by the game
    __state: function () { return { created: created, visible: visible, wanted: wantedPlace, spotsToday: spotsToday(), why: why } }
  }
})()
