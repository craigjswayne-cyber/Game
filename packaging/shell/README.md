# packaging/shell: what both shells share

The Android shell (`packaging/android`) and the iOS shell (`packaging/ios`) are
separate npm projects around the same built game. The pieces that are the same
on both phones live here rather than twice.

| File | What it is |
|---|---|
| `ads-bridge.js` | the advert provider, in the four-method shape `src/game/monetise.ts` reads off `globalThis.rmAds`; loaded by the shell's `index.html` before the game, never part of the web build |
| `ads.json` | the AdMob App IDs and ad unit IDs per platform, plus `testing`, `testDevices` and `consentDebug`; Google's TEST ids until the owner's real ones go in |
| `install-ads.mjs` | run by both `scaffold.sh` scripts after `cap sync`: copies the bridge in, writes the ids into `index.html`, puts the App ID into the Android manifest or the iOS `Info.plist` |

## How an advert reaches the screen

```
AdSlot.tsx mounts a slot on Home or Results
  -> monetise.adsAllowed(): no supporter, a provider exists, a declared place
  -> rmAds.mount(el, 'home-foot')                     ads-bridge.js
       -> consent (UMP form; ATT prompt first on iOS) then initialize()   once
       -> AdMob.showBanner({ adId, ADAPTIVE_BANNER, BOTTOM_CENTER })
       -> 'bannerAdSizeChanged' -> --ad-inset: 50px on <html>
            -> .bottom-nav padding grows by that much (theme.css), so the
               native banner, which overlays the web view, sits under the nav
  leaving the screen / a sheet opening -> hideBanner(), --ad-inset: 0px
  coming back                          -> resumeBanner(), no second request
```

Rewarded: `rmAds.showRewarded(place)` prepares and shows one spot and resolves
`'completed'` only on the plugin's reward event; a dismissal is `'skipped'`, a
load or show failure `'unavailable'`. Six completed spots per real day is the
ceiling, counted in `localStorage`.

## The plugin

`@capacitor-community/admob` 8.1.0, pinned in both shells' `package.json`, on
Google Mobile Ads SDK 25.x (Android) and 13.x (iOS) with the User Messaging
Platform for consent. Its JavaScript name is `AdMob` on both platforms; the
bridge asks `Capacitor.PluginHeaders` whether the native side really has it
before trusting the proxy `registerPlugin` hands back, for the same reason
`src/game/storekit.ts` does.

## Test ids, live ids

`ads.json` ships with Google's published test ids and `testing: true`: every
banner says "Test Ad", every spot is a test spot, nothing is earned and nothing
is a policy problem. The release that carries the owner's real ids flips
`testing` to `false` in the same commit and lists the owner's phones in
`testDevices`, because clicking a live advert in your own app is a strike.
`scripts/adsprobe.mjs` holds that the two states are internally consistent.

## Probes

`scripts/adsprobe.mjs` runs the real bridge over the real build with the plugin
faked one layer down: consent order, banner only where a slot is, room made and
given back, a sheet hiding it, rewarded outcomes and the daily cap, the iOS
tracking prompt. `scripts/netprobe.ts` still holds that the web build carries
none of this.
