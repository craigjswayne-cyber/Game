# Packaging for Google Play (the Capacitor shell)

This folder builds the Play Store app as a real app: the game bundled inside
a Capacitor WebView, purchases through Google Play Billing directly, no
Chrome. It replaces `packaging/twa/`, the Bubblewrap Trusted Web Activity that
shipped every Play build up to version code 15.

`PLAY-WALKTHROUGH.md` has every click for the owner. This file is the why and
the how of the pieces.

## Why the shell

Three reasons, in the order they came up:

1. **"Chrome is running in the background."** A TWA is Chrome. The notice is
   Chrome. There is no setting that removes it, because it is true.
2. **Adverts.** AdMob only runs inside a real app. The game has been wired for
   two banner slots, four rewarded placements and a Remove All Ads product
   since v1.1.4 (`docs/ads-plan.md`), and none of it can light up inside a
   web wrapper. The shell is the precondition; adverts themselves are a later
   release (`docs/ADS-STEP-BY-STEP.md`).
3. **One code path for two phones.** `packaging/ios` has been a Capacitor
   shell with a StoreKit plugin since v1.1.17. Android now mirrors it file for
   file: same `capacitor.config.json` shape, same `scaffold.sh` job, same
   plugin name and contract.

The cost is same-day updates. A push to `main` still updates the website in
twenty minutes; the Play app now updates through a build and Play review.

## What is here

| File | What it is |
|---|---|
| `package.json` | the shell's own npm project, Capacitor 8.5.0 pinned, like iOS |
| `capacitor.config.json` | appId `com.phaserugbymanager.app`, webDir = the built game, no `server` block |
| `version.json` | the Play `versionCode` for the next upload (17), and the Play Billing Library version (8.0.0, the floor Play enforces) |
| `PhaseBilling.java` | the purchase plugin, on the Play Billing Library |
| `scaffold.sh` | builds the game, adds or syncs the platform, installs and registers the plugin, patches Gradle and the manifest, copies the art in |
| `icons-android.mjs` | draws `res/` from `public/icon.svg` on a machine with a browser; run when the icon changes, commit the result |
| `res/` | the launcher icons (legacy and adaptive, five densities) and eleven splash sizes, committed, copied over the project by `scaffold.sh` |
| `android/` | the generated Android Studio project: gitignored, build output |

## The purchase bridge, on Android

`src/game/monetise.ts` defines a four-method contract (details, buy, owned,
consume) and knows nothing about any store. `src/game/storekit.ts` finds a
Capacitor plugin called `PhaseBilling` and dresses it in that contract. On iOS
the plugin is `PhaseBilling.swift`; on Android it is `PhaseBilling.java`. Both
answer the same shapes:

| Method | In | Out |
|---|---|---|
| `details` | `{ skus: string[] }` | `{ products: { sku, price, title }[] }`, price already formatted by the store |
| `buy` | `{ sku }` | `{ outcome: 'owned' \| 'cancelled' \| 'pending' \| 'unavailable' \| 'refused' \| 'error' }` |
| `owned` | | `{ skus: string[] }`: permanent entitlements plus consumables paid for and not yet consumed |
| `consume` | `{ sku }` | `{}` |

The one design decision is the same on both: **a consumable is not consumed
at purchase**. `consume` is called by the game after the career has kept what
was bought. An unconsumed purchase survives a crash or a reinstall, comes back
through `owned()`, and is offered to the career again. Non-consumables are
acknowledged immediately, because Play refunds anything unacknowledged after
three days.

`src/game/playbilling.ts`, the Digital Goods road the TWA used, stays: it is
what the website and anyone still on the old app use. In the shell its attach
step finds no `getDigitalGoodsService` and stands aside; `attachStoreKit`
then finds the plugin. `main.tsx` tries them in that order.

## How Capacitor Android finds the plugin

Not by scanning. A plugin that is part of the app (not an npm package) must
be passed to `registerPlugin()` in `MainActivity` before `super.onCreate`.
`scaffold.sh` writes that activity. Miss it and the app compiles, runs, and has
no shop, silently, which is the same failure the iOS shell had in a different
costume (`packageClassList`).

## Careers, and the storage the old app leaves behind

The TWA kept IndexedDB and localStorage inside Chrome's profile. The shell's
WebView has its own. Nothing can copy between them. So:

* the website shows a one-time card on Home to anyone it can tell is inside
  the old Play app (the TWA's `android-app://` referrer, noted at boot in
  `src/game/shell.ts`), asking them to Export before they update;
* the shell's title screen shows a one-time *Import a backup* card on a fresh
  install (`isAndroidShell()` and no saves);
* purchases are not affected: `owned()` reads the Google account at boot and
  `restore()` grants everything it finds.

## Building it here, and why it stops

`scaffold.sh` runs anywhere Node runs. Compiling needs the Android SDK, whose
download host (`dl.google.com`) is not reachable from the development
container, so the build itself happens on the owner's machine with Android
Studio. `PhaseBilling.java` is written against Play Billing Library 8.0.0
and Capacitor 8's `com.getcapacitor.Plugin` API; the first Android Studio
build is the compile check.

## Probes

`scripts/storeprobe.mjs` section 2e boots the game under a fake Capacitor
global with a `PhaseBilling` plugin and platform `android`, with nothing
else injected, and holds that the bridge is found, registered, and sells.
`scripts/netprobe.ts` holds that the web build gained no network call.
