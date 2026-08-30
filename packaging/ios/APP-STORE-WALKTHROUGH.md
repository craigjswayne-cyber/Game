# Getting PHASE onto the App Store, step by step

`README.md` in this folder is the technical reference: what the bridge does, why
the bridging header exists, how a consumable is held. This file is the other
thing — the order to do it in, on a Mac, from an empty Apple account to a
submitted build.

Most of the writing is already done. The listing copy, the screenshots and both
review arguments come out of the repo; what follows is which button, in what
order, and which mistakes cannot be undone.

| | |
|---|---|
| App name | PHASE: Rugby Manager |
| Bundle ID — never changes | `com.phaserugbymanager.app` |
| Apple Developer Program | $99 / year |

---

## Phase 1 — Get an Apple account

Start this first even if you do nothing else. Everything here waits on somebody
who is not you.

### 1. Enrol in the Apple Developer Program

<https://developer.apple.com/programs/enroll/>, signed in with an Apple ID.

* Use an Apple ID you intend to keep for ever — it becomes the account that owns
  the app, and moving an app between accounts later is a real chore.
* **Turn on two-factor authentication on that Apple ID first.** Enrolment
  refuses without it.
* Pay the $99. Approval is usually 24–48 hours.

**The one real decision: Individual or Organization.** Individual is quick, but
your own legal name is published on the App Store as the seller, visible to
every customer. Organization publishes under a company name — which is how you
would match the *Forwards & Backs* already used on Google Play — but needs a
D-U-N-S number, which is free and can take up to a couple of weeks to issue. If
the two stores should match, request the D-U-N-S number before anything else.

### 2. Install Xcode while you wait

Mac App Store → Xcode → Get. Well over 10 GB. Open it once when it finishes and
let it install the extra components it asks for.

### 3. Get the game onto the Mac

```sh
git clone https://github.com/craigjswayne-cyber/Game.git
cd Game
npm install
```

Node from <https://nodejs.org> (LTS) if `npm` is not found.

---

## Phase 2 — Build the app on your own machine

None of this needs the Apple account, so it can all be done while enrolment is
pending. By the end the real game runs on a simulated iPhone and sells all ten
products with fake money.

### 4. Build the iOS shell

**You do not need CocoaPods.** Capacitor 8 resolves iOS dependencies through
Swift Package Manager when every plugin ships a `Package.swift`, which is the
case here — the run prints "All Capacitor plugins have a Package.swift file" and
writes `Package.swift` instead of a Podfile. A clean Mac with no CocoaPods, and
no Homebrew, scaffolds this project perfectly well.

(An earlier version of this file said the opposite and sent the owner off to
install CocoaPods, which failed anyway because macOS's built-in Ruby is 2.6 and
CocoaPods needs 3.0+. None of it was necessary.)

```sh
cd packaging/ios
npm install
./scaffold.sh
```

If `npm install` here warns about install scripts the way the top-level one
does, approve them by name (`npm approve-scripts <pkg>`) and run it again.
`packaging/ios` is deliberately its own npm project, so it has its own
permissions to grant.

If `./scaffold.sh` says "permission denied", run `chmod +x ./scaffold.sh` once.

Builds the game, generates the Xcode project, copies the four purchase files in,
and prints the bundle identity — check it says `com.phaserugbymanager.app`. Safe
to re-run whenever the game changes; it syncs rather than starting over.

### 5. Open it in Xcode

```sh
npx cap open ios
```

### 6. Four settings in Xcode, in this order

`scaffold.sh` prints these too.

1. **Check the four files are in the app.** Under `App` in the left-hand list:
   `PhaseBilling.swift`, `PhaseBilling.m`, `App-Bridging-Header.h`,
   `Products.storekit`. If any is missing, drag it in from Finder with *Copy
   items if needed* ticked and the *App* target ticked.
2. **Bridging header.** Blue *App* project → *Build Settings* → search
   "bridging" → *Objective-C Bridging Header* = `App/App-Bridging-Header.h`.
3. **Capability.** *Signing & Capabilities* → *+ Capability* → *In-App Purchase*.
4. **Test products.** *Product* → *Scheme* → *Edit Scheme* → *Run* → *Options* →
   *StoreKit Configuration* → `Products.storekit`.

> **Where this bites.** Skip the bridging header and the build fails with "file
> not found", which reads exactly like a broken dependency and is not one. Skip
> the capability and every product reads unavailable, which reads exactly like
> broken code and is not that either.

### 7. Run it, and try to break the purchases

Pick an iPhone simulator and press ▶. Open the Store from Game Status — with the
StoreKit configuration set, all ten products work with fake money, no Apple
account, no waiting.

> **Test this one properly.** *Debug → StoreKit* can force an interrupted
> purchase. Buy Full Fitness, interrupt it, force-quit, relaunch: the store
> should still be offering it. That path is the difference between a customer
> who pays and receives and one who pays and does not.

---

## Phase 3 — Set up the shop side

App Store Connect, <https://appstoreconnect.apple.com>. Needs the account.

### 8. Sign the Paid Applications Agreement — before anything else

*Business* (older accounts: *Agreements, Tax and Banking*) → *Paid Applications*
→ accept, then bank and tax details.

> **Where this bites.** Until this is signed *and* the bank details verified,
> every purchase reads unavailable and it looks exactly like broken code.
> Verification can take several days, which is why it goes first.

### 9. Create the app record

*Apps* → **+** → *New App*:

* Platform **iOS**
* Name **PHASE: Rugby Manager**
* Primary language **English (UK)**
* Bundle ID **com.phaserugbymanager.app** — pick from the list. Xcode registers
  it the first time you choose your team under *Signing & Capabilities*; if it
  is not offered, register it under *Certificates, Identifiers & Profiles →
  Identifiers*.
* SKU: anything private, e.g. `phase-rugby-manager`. Customers never see it.

### 10. Create the ten products — read the Type column twice

Your app → *Monetization* → *In-App Purchases* → **+**.

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

> **Where this bites.** A product's type can never be changed after it is
> created. Get one wrong and the only remedy is a second product id and a
> migration — the corner v1.1.14 had to build out of on Play. Note especially
> that `phase.license` is a **consumable**: it is a tip jar, and a tip jar that
> takes one coin and greys out is not a tip jar.

Do **not** create `phase.supporter` (Remove all ads) until a build actually ships
ads. Never create `phase.editor` — removed before any store sold one.

### 11. Take the screenshots

```sh
node scripts/storeart.mjs
```

Writes `storeart/ios/en/` and `storeart/ios/fr/` at 1290×2796 (Apple's 6.7"
size) plus `storeart/ios/icon-1024.png`, opaque as required.

Upload five, in order: title screen, squad table, team sheet, match day,
full-time verdict.

### 12. Fill in the listing

Every field is written out word for word, inside Apple's limits, in
`docs/store-listing.md`. Copy from there rather than composing at the keyboard.

The answers people get wrong:

* App Privacy — **Data Not Collected**. Nothing else applies.
* Age rating — every category **None**, giving **4+**.
* Category — **Games → Sports**, secondary **Simulation**.
* Price — **Free**, with in-app purchases.
* Privacy policy URL — `https://phaserugbymanager.com/privacy.html`
* Support URL — the same page; it carries the contact address.

---

## Phase 4 — Send it to Apple

### 13. Set the version and build number

*App* target → *General* → **Version** `1.1.14`, **Build** `1`.

Every upload needs a build number higher than the last. The version can repeat;
the build number can never go backwards.

### 14. Archive it

Change the device dropdown from a simulator to **Any iOS Device (arm64)**, then
*Product* → *Archive*.

> **Where this bites.** *Archive* is greyed out while a simulator is selected,
> with no explanation. This is the most common "why can't I click it" moment in
> the whole process, and the fix is that one dropdown.

### 15. Upload it

Organizer → **Distribute App** → *App Store Connect* → *Upload*. Answer the
encryption question **No** — the app uses none and makes no network connections.

Processing takes five to thirty minutes before the build appears in App Store
Connect.

### 16. Test it for real, through TestFlight

Your app → *TestFlight* → add yourself as an internal tester, install via the
TestFlight app. Purchases run in Apple's sandbox: real flow, real sheets, no
money. **This is the last point where finding a problem is cheap.** Buy one of
everything.

### 17. Submit for review — and write the review notes

Your app → the version → pick the build → *Add for Review* → *Submit*.

Two things get an app like this rejected, and both are answered with words
rather than code. The arguments are drafted in `docs/store-listing.md`; paste
them into the review notes rather than hoping.

* **Guideline 4.2, minimum functionality** — "a repackaged website". The app
  ships every asset in the bundle, needs no connection after install, works on a
  plane, and holds twenty-plus seasons of state on the device. It is not a
  wrapper around a website; the same code happens to also run in a browser.
* **Guideline 5.2, intellectual property** — the player names are real and
  unlicensed. Point at the unofficial statement on the title screen, in About &
  legal and in the privacy policy, the absence of official imagery, and the
  contact address for removal requests.

---

## Phase 5 — Review

### 18. Wait

Usually 24–48 hours, occasionally longer around holidays. Email either way.

### 19. If it comes back rejected, do not rebuild

Apple's message always names a guideline number. Open *Resolution Center* and
reply to that specific guideline. A first rejection on an app like this is
almost always 4.2 or 5.2, and both are arguments rather than bugs. Reaching for
the code before reading which guideline was cited is how a week disappears.

---

## One rule that does not bend

Never paste a certificate, a `.p12` file, a private key, or an App Store Connect
`.p8` API key into a chat — with Claude or with anybody else. Same rule as the
Android keystore.

Fingerprints, product ids, bundle ids and error messages are all fine to share.
Key material never is. If one is exposed, revoke it in the developer portal and
issue a new one rather than hoping.
