# The ad-carrying Android wrapper (groundwork, v1.1.4)

**Status: NOT BUILT. This folder is the plan, written down before the work,
because the owner asked for ads (27 Aug 2026) and the honest answer starts
with a constraint.**

---

## 1. The constraint: no ad SDK can ship in the TWA

The Play build that exists today (`packaging/twa/`) is a Trusted Web Activity:
Chrome rendering the site full-screen, with **no native code of ours in the
APK at all**. AdMob - like every mobile ad network worth the name - ships as a
**native SDK**. There is nowhere in a TWA to put it.

The alternative route, a JavaScript ad tag in the web bundle (AdSense et al),
is closed twice over:

* `scripts/netprobe.ts` fails the build on any network call, and that is a
  feature, not an obstacle - "fully offline, no requests" is in the privacy
  policy, the Play data-safety answers, and the game's whole pitch;
* web display ads inside a wrapped app violate AdSense policy anyway
  (AdMob is the product for apps, and AdMob is native).

So "integrate an ad network" means **replacing the TWA shell with a Capacitor
wrapper** (a WebView owning native code), the same architecture already
specced for iOS in `packaging/ios/`. The web game does not change: it already
looks for `globalThis.rmAds` (banners, rewarded) and `globalThis.rmBilling`
(purchases) and behaves perfectly when neither exists. All the work is in the
shell.

## 2. What trading the TWA for a wrapper costs

Worth having in view before starting - none of these are blockers, all of
them are work:

| Lose | Because |
|---|---|
| Digital Goods API billing | that browser API exists only in a TWA. The wrapper must inject `rmBilling` itself via the **Google Play Billing Library** (native), exactly as the iOS shell injects StoreKit. The web side needs nothing - it already speaks to whichever bridge exists. |
| Zero-native-code review posture | the APK now contains our code, so debug symbols, crash reporting and SDK updates become ours to own. |
| Auto-updating web content | the TWA shows the live site; the wrapper ships `dist/` in the bundle (deliberately - see the iOS README on guideline 4.2), so every content change is a Play release. |

The appId stays `com.phaserugbymanager.app` and the upload key stays the
same, so Play treats the wrapper as an ordinary update of the existing app.

## 3. The shape of the build

```sh
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "PHASE: Rugby Manager" com.phaserugbymanager.app --web-dir=dist
npm run build && npx cap add android && npx cap sync android
# then copy this folder's capacitor.config.json over the generated one
```

AdMob via the maintained community plugin (`@capacitor-community/admob`) or
the SDK directly; the Play Billing bridge is hand-rolled either way (the
pattern is the iOS README's `WKUserScript` sketch, translated to
`WebViewClient` + `addJavascriptInterface`).

## 4. The bridge contract the shell must honour

The page defines both interfaces in `src/game/monetise.ts`; the shell
implements them and injects **before the bundle loads** (Capacitor plugins
initialise pre-page, so this is natural):

```ts
globalThis.rmAds = {
  mount(el, place) {},        // draw a banner into el ('home-foot' | 'results-foot')
  unmount(el) {},             // tear it down; a screen change must not leak a frame
  showRewarded(place) {},     // -> Promise<'completed'|'skipped'|'unavailable'>
}
globalThis.rmBilling = {
  details(sku) {}, buy(sku) {}, owned() {}, consume(sku) {},
}
```

The moment `rmAds` exists, the game does the rest by itself:

* the two banner slots render (`AdSlot`, `AD_PLACES` - never during a match,
  never on a modal, never on the title screen);
* the **Remove all ads** row (`phase.supporter`, $1.99) appears in the Store -
  it is gated on `adBridge()` precisely so it can never be sold in a build
  that shows no ads. Create the Play product the same day, not before
  (`packaging/twa/README.md` §4);
* a supporter sees no banner ever again; rewarded spots (if `showRewarded`
  is wired) survive the purchase by design - the player asks for those.

Rewarded placements, caps and the per-day ledger are specced in
`docs/monetisation-spec.md` §2-3. Banners alone are a legitimate first ship;
`showRewarded` can be omitted entirely and no rewarded button renders.

## 5. AdMob specifics

* **App ID** goes in `AndroidManifest.xml`
  (`com.google.android.gms.ads.APPLICATION_ID`). Use Google's test app id
  `ca-app-pub-3940256099942544~3347511713` and test unit ids until the real
  ones exist - live ids in a debug build is a policy strike.
* **Consent**: ship Google's UMP SDK alongside; show the consent form where
  required (EEA/UK) before the first ad request, and request
  **non-personalised ads** when consent is declined. The game itself must
  stay playable when the form is dismissed.
* **Content rating**: set the AdMob app's content rating ceiling to match
  the game's (everyone); block sensitive categories in AdMob's controls.
* **Families**: the game is rated for everyone but is not enrolled in the
  Designed-for-Families programme; if it ever is, AdMob's families ad
  policies bite much harder - decide before enrolling.

## 6. Play Console changes on the day ads ship (NOT before)

The live listing currently declares - truthfully - that the app collects
nothing and makes no network requests. An ad SDK changes both. On the release
that carries ads, and on that release only:

* **Data safety form**: declare *Device or other IDs* (Advertising ID),
  collected, shared with Google (AdMob), purpose Advertising; add *Approximate
  location* if AdMob's location-based ads are left on (turn them off and the
  answer stays No). "Data is encrypted in transit" yes; "users can request
  deletion" - covered by the Advertising ID reset/delete at OS level.
* **Advertising ID permission**: the SDK adds `AD_ID` to the manifest;
  the console asks why - answer Advertising.
* **Privacy policy**: replace the Advertising and Network-use sections with
  the drafts in `docs/ads-privacy-draft.md` (EN + FR), which name AdMob,
  link Google's partner policy, and state the Remove-all-ads purchase.
* **In-app products**: create `phase.supporter` (Managed, $1.99,
  "Remove all ads").

Until that release, every one of those stays exactly as it is: the current
answers are true for the current build, and swapping them early would make
them false in the other direction.
