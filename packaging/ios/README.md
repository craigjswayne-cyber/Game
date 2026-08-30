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

## Building it

The toolchain is **pinned in this folder's own `package.json`** - Capacitor
8.5.0, deliberately a separate npm project from the game. The web app must
never gain a Capacitor dependency: `scripts/netprobe.ts` fails the suite on
anything in the bundle that could make a network call, and the shipped game
stays a pure offline PWA. `src/game/storekit.ts` reads `globalThis.Capacitor`
and imports nothing, which is what lets the two live apart.

```sh
cd packaging/ios
npm install        # the pinned toolchain
./scaffold.sh      # build the game, add the platform, install the plugin
```

`scaffold.sh` was verified end to end on Linux: it builds `dist/`, generates
the Xcode project, bundles the game inside it, and copies the four plugin
files into the App target. Re-running it syncs instead of regenerating, so it
is safe to run after every change to the game. The generated `ios/` tree is
gitignored - it is build output, and it carries a copy of `dist/` inside it.

**The bundle identity is `com.phaserugbymanager.app`**, the same identity as
the Android build - verified in the generated project's
`PRODUCT_BUNDLE_IDENTIFIER`. Two apps, one name, and neither can ever change
it.

> A note on `capacitor.config.json`: it lives HERE, not at the repository
> root, and its `webDir` is `../../dist` - relative to this folder. An earlier
> version of this file told you to copy it to the repo root, which would have
> pointed `webDir` outside the repository entirely. Run the CLI from this
> folder, as `scaffold.sh` does, and the paths resolve.

## Then the Mac

Everything above runs anywhere. Everything below is Xcode, and Xcode is a Mac.

```sh
npx cap open ios
```

Four things in Xcode before the first run, in this order:

1. **The four plugin files must be in the App target.** `scaffold.sh` copies
   them into `ios/App/App/`; if Xcode's navigator does not list them, drag
   them in (Capacitor 8's template uses classic project references, not
   Xcode 16 synchronised folders, so a file on disk is not automatically a
   file in the target).
2. **Build Settings → Objective-C Bridging Header → `App/App-Bridging-Header.h`.**
   `PhaseBilling.m` is Objective-C in a Swift target and imports
   `<Capacitor/Capacitor.h>`; without the bridging header it fails to compile
   with "file not found", which reads like a broken dependency and is not one.
   The Capacitor template does not generate this header - that is why one
   ships in this folder.
3. **Signing & Capabilities → + Capability → In-App Purchase.** Without it
   StoreKit returns nothing and every product reads unavailable.
4. **Product → Scheme → Edit Scheme → Run → Options → StoreKit Configuration
   → `Products.storekit`.** This is how you test all ten purchases on the
   simulator without App Store Connect, real money or a review.

And before the first archive:

* **Info.plist**: `ITSAppUsesNonExemptEncryption` = NO (the app uses no
  encryption and makes no connections).
* **Orientation**: portrait and landscape both allowed - which is what the
  generated Info.plist already declares, and it matches the web manifest's
  `"orientation": "any"`. Portrait is the tuned one; the game works either way
  and locking it is what the release audit removed.
* **Icon**: `storeart/ios/icon-1024.png`, produced by `scripts/storeart.mjs`,
  opaque as Apple requires.
* **Screenshots**: `storeart/ios/en` and `storeart/ios/fr`, already at 1290x2796.
* **Capabilities beyond IAP**: none. No push, no background modes, no iCloud,
  no sign-in.

---

## The purchase bridge: three files, and what each is for

`src/game/monetise.ts` defines one four-method contract - `details`, `buy`,
`owned`, `consume` - and knows nothing about any store. Android builds that
contract out of browser APIs (`src/game/playbilling.ts`); iOS gets it from a
native plugin. Nothing in the game between those two ends knows which platform
it is running on.

| File | Where it goes | What it does |
|---|---|---|
| `PhaseBilling.swift` | drag into the **App** target in Xcode | StoreKit 2: products, purchase sheet, entitlements, finishing |
| `PhaseBilling.m` | beside it, same target | the ObjC macro that makes those four methods visible to the web view |
| `App-Bridging-Header.h` | beside it, same target | lets the ObjC file above see Capacitor's headers - the template does not ship one |
| `Products.storekit` | beside it, same target | the ten products, for testing purchases with no App Store Connect |
| `src/game/storekit.ts` | already in the web build | dresses the plugin in the contract, and attaches at boot |

Drag both native files into the App target (**Copy items if needed**, target
membership ticked). Xcode will offer to create a bridging header; accept it.
Nothing else in the generated project needs editing.

### The one design decision worth reading

**A consumable is bought and deliberately left UNFINISHED** until the game
calls `consume(sku)`, which it does only after the career has actually kept
what was bought.

That is the recovery path, not a flourish. An unfinished transaction survives
a crash, a force-quit, a flat battery and a reinstall; StoreKit hands it back
through `Transaction.unfinished` on the next launch, `owned()` reports it, and
the game's existing "paid, and held" rows offer it to the career again. Finish
it at purchase and a customer interrupted between paying and receiving has
simply lost the money - the one outcome `monetise.ts` exists to prevent.

Non-consumables are finished immediately: the entitlement itself is the
permanent record.

**The seven consumables are listed in two places** - `CONSUMABLE_SKUS` in
`monetise.ts` and `consumables` in `PhaseBilling.swift` - and
`scripts/moneyprobe.ts` §14 fails if they ever disagree. It also asserts that
`PhaseBilling.m` exposes all four methods, because a method missing from that
macro is invisible to the web view however well the Swift is written. That is
the same class of bug that shipped on Android in v1.1.6 and made five products
unbuyable, so it is pinned rather than trusted.

---

## Products in App Store Connect

The same ten product ids as Play, so one catalogue serves both stores:

**A PRODUCT'S TYPE CANNOT BE CHANGED AFTER IT IS CREATED**, on either store.
Get one wrong and the only remedy is a second product id and a migration, which
is exactly the corner v1.1.14 had to build its way out of on Play. So read the
Type column before creating anything.

| Product ID | Type | Name | Price |
|---|---|---|---|
| `phase.uncapped` | Non-consumable | Remove the Wage Cap | £9.99 |
| `phase.estate` | Non-consumable | Max your team facilities | £9.99 |
| `phase.pinnacle` | Non-consumable | Become an International Coach | £4.99 |
| `phase.license` | **Consumable** | Support the game | £0.99 |
| `phase.inject.s` | Consumable | Small Cash Injection | £0.99 |
| `phase.inject.m` | Consumable | Medium Cash Injection | £1.99 |
| `phase.inject.l` | Consumable | Large Cash Injection | £3.99 |
| `phase.inject.xl` | Consumable | The Sugar Daddy | £7.99 |
| `phase.heal` | Consumable | Full Squad Recovery | £0.99 |
| `phase.ground` | Consumable | The Estate, at the next ground | £9.99 |

Two of those rows have moved since this table was first written, and both are
the kind of mistake that cannot be undone:

* **`phase.license` is a CONSUMABLE**, and this file said non-consumable until
  v1.1.14. It became repeatable in v1.1.12 (owner: "Support the game should be
  available more than once") - a tip jar that takes one coin and then greys out
  is not a tip jar. Created as a non-consumable it would sell exactly once per
  Apple ID, for ever.
* **`phase.ground` is new in v1.1.14.** The Estate became one build per CLUB
  rather than one per save, and a non-consumable is sold once, so the repeat at
  a second ground had to be its own consumable product. `phase.estate` still
  covers the first ground and is still non-consumable; the two work as a pair.

`scripts/moneyprobe.ts` holds the same split against `PhaseBilling.swift` and
`Products.storekit`, so the code cannot drift from this table - but nothing can
check what you typed into App Store Connect.

Do **not** create `phase.supporter` (Remove all ads) until a build actually
ships ads - the store row only renders where an ad provider exists, so the
product would be sellable nowhere. `phase.editor` was removed in v1.1.3 and
must never be created.

Apple also requires, before review: a **paid applications agreement** signed
(products stay "Waiting for review"/unavailable without it), and **Restore
purchases** reachable in-app - it is the button at the foot of the Store, which
is why that page stays reachable after every purchase.

### Testing before any of that exists

`Products.storekit` in this folder is a StoreKit configuration file with all
ten products already defined. In Xcode: **Product → Scheme → Edit Scheme →
Run → Options → StoreKit Configuration → Products.storekit**. The simulator
then sells them locally - no App Store Connect, no sandbox account, no
waiting on review - and Debug → StoreKit lets you force interrupted purchases
and Ask-to-Buy, which is exactly how to prove the held-consumable path above
actually works.

## The edition question, already answered

The paid-up-front alternative that used to be described here was decided
against on 27 Aug: `VITE_EDITION=paid` removes the whole catalogue rather than
just one purchase, and it is the one configuration no probe has ever executed.
The free edition with the ten products is what ships on both stores.
