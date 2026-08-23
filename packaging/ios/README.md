# Packaging for the App Store

Apple has no PWA route: the App Store takes a binary, so the game needs a
wrapper - a native shell whose whole job is to display the same web build
full-screen and to own the two things a web page cannot do on iOS, which are
StoreKit and the file system.

Nothing in this folder builds on its own. It is the shape of the project, the
bridge that has to be written on the native side, and the two review problems
worth knowing about before starting.

---

## The two review problems

**1. Guideline 4.2, minimum functionality.** "A repackaged website" is a
standard rejection, and a WKWebView pointing at a URL is exactly what it looks
like. The case here is winnable and worth making in the review notes:

* the app is a complete offline game - no connection needed after install, no
  server, nothing loaded remotely at runtime;
* it holds twenty-plus seasons of state on the device;
* it is not a wrapper around a website that exists to be a website: the same
  code happens to also run in a browser.

**Ship the web assets in the bundle rather than loading a URL.** A wrapper that
loads `https://…` is a browser; a wrapper that loads `dist/index.html` off disk
is an app that happens to be built with web technology, works on a plane, and
does not need App Transport Security exceptions. This also removes any question
about the app changing after review.

**2. Guideline 5.2, intellectual property.** The player names are real and
unlicensed (see `docs/release-readiness.md`). Apple's review is the stricter of
the two stores on this. The mitigations in the game - the unofficial statement
on the title screen, in About & legal and in the privacy policy, no official
imagery, a contact address for removal requests - should be repeated in the
review notes, and `docs/store-listing.md` has that text ready.

---

## The shape of it

```sh
npm i -g @capacitor/cli
npm i @capacitor/core @capacitor/ios
npx cap init "PHASE: Rugby Manager" com.phaserugbymanager.app --web-dir=dist
npm run build && npx cap add ios && npx cap sync ios
npx cap open ios          # Xcode from here
```

`capacitor.config.json` in this folder is the configuration that matters:
bundled assets, the night ground behind the web view so no white flash gets
through, and no server block at all.

In Xcode, before the first archive:

* **Info.plist**: `ITSAppUsesNonExemptEncryption` = NO (the app uses no
  encryption and makes no connections).
* **Orientation**: portrait and landscape both allowed. Portrait is the tuned
  one; the game works either way and locking it is what the release audit
  removed.
* **Icon**: `storeart/ios/icon-1024.png`, produced by `scripts/storeart.mjs`,
  opaque as Apple requires.
* **Screenshots**: `storeart/ios/en` and `storeart/ios/fr`, already at 1290x2796.
* **Capabilities**: none. No push, no background modes, no iCloud, no sign-in.

---

## The StoreKit half of the bridge

The web side is done and needs nothing: `src/game/monetise.ts` looks for
`globalThis.rmBilling` and uses it if it is there. On iOS the native side
injects it, which WKWebView can do properly - a `WKUserScript` at
`.atDocumentStart` runs before the bundle loads.

Three methods, matching `BillingBridge`:

```swift
// Sketch: StoreKit 2, one non-consumable, posting results back to the page.
import StoreKit
import WebKit

let SKU = "phase.supporter"

// injected at document start, so the page never sees a moment without it
let bridgeJS = """
globalThis.rmBilling = {
  _calls: {}, _n: 0,
  _send(method, arg) {
    const id = ++this._n
    return new Promise(res => {
      this._calls[id] = res
      window.webkit.messageHandlers.billing.postMessage({ id, method, arg })
    })
  },
  details(sku) { return this._send('details', sku) },
  buy(sku)     { return this._send('buy', sku) },
  owned()      { return this._send('owned') },
  _resolve(id, value) { const f = this._calls[id]; delete this._calls[id]; if (f) f(value) },
}
"""

// and on the native side, replying to each call by id:
//   details -> Product.products(for: [SKU]) -> { sku, price: product.displayPrice }
//   buy     -> product.purchase() -> .success  => verify, finish(), reply "owned"
//                                  -> .userCancelled => reply "cancelled"
//                                  -> .pending      => reply "pending"
//                                  -> anything else => reply "error"
//   owned   -> Transaction.currentEntitlements -> [productID]
```

Four things that decide whether this passes review and whether customers are
happy, all of which the web side already expects:

| Rule | Why |
|---|---|
| `transaction.finish()` after a verified purchase | an unfinished transaction is re-presented forever and eventually refunded |
| `.userCancelled` must map to `cancelled`, not `error` | it is not a failure and must not be shouted about |
| `.pending` must map to `pending` | Ask-to-Buy holds a purchase for days; telling a paying customer it failed is the worst of the five |
| a visible **Restore** button | Apple requires one for non-consumables. It is already on the Supporter page, which is why that page stays reachable after a purchase |

`Transaction.updates` should also be observed for the whole app lifetime: a
purchase approved later (Ask-to-Buy) arrives there, and calling back into the
page with `rmBilling._resolve` is not enough - the page needs to hear about it,
so post it as a fresh `owned()` result or simply reload the entitlement, which
`restore()` does at every boot.

---

## Selling it up front instead

If the answer is a paid app rather than a free one with a Supporter unlock,
none of the StoreKit work is needed at all:

```sh
VITE_EDITION=paid npm run build && npx cap sync ios
```

Everybody who can run it is already a supporter: no purchase UI, no restore, no
IAP metadata, no `phase.supporter` product, and one fewer review surface. Set
the price on the listing and ship. Verified: the paid build shows the supporter
mark, no ad slot and no purchase card.
