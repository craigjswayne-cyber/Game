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
every customer. Organization publishes under a company name — but needs a
D-U-N-S number, which is free and can take up to a couple of weeks to issue.

**Done — 31 Aug 2026.** D&B issued D-U-N-S **506525570** for **FWDS & BCKS**.
When enrolling:

* Pick **Organization** and enter that number. The legal entity name must be
  typed exactly as D&B holds it: `FWDS & BCKS`.
* Apple keeps its own copy of the D&B database, and a freshly issued number
  can take **up to two business days** to appear in it. "No match found" in
  the first day or two means *wait*, not re-request — a second request just
  muddies the record.
* The seller name shown to every App Store customer will be FWDS & BCKS; the
  app itself still displays as PHASE: Rugby Manager.
* The listing's Copyright field becomes `2026 FWDS & BCKS`.
* The same number serves a Google Play **organisation** account, should the
  Play side ever convert to one.

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
registers the purchase plugin, and prints the bundle identity — check it says
`com.phaserugbymanager.app`. Safe to re-run whenever the game changes; it syncs
rather than starting over.

You should see `registered PhaseBilling in packageClassList` in the output the
first time. That line is load-bearing: Capacitor 8 finds plugins ONLY through
that list, and the CLI leaves it empty for a plugin that is not an npm package.
Without it the app builds and runs perfectly and simply has no shop.

### 5. Open it in Xcode

```sh
npx cap open ios
```

### 6. Learn the four bits of the Xcode window

Everything below is one of these, so it is worth thirty seconds:

* **The left panel** is the file list ("the navigator"). The very top row has a
  blue icon and says **App** — that is the *project settings*, not a file.
* **The top bar**, left to right: a **▶ play** button, a **■ stop** button, then
  **App** (the scheme), then **>** and a device name (the destination).
* **The middle** is whatever you clicked.
* **⚠️ and ❌** appear in the top bar when something is wrong. Clicking them
  shows the list of problems.

If it says *Indexing* or *Resolving Package Graph* at the top, let it finish.
First open takes a minute or two.

### 7. Check the four purchase files are in the app

In the left panel, click the ▸ next to the yellow **App** folder to open it,
then the ▸ next to the **App** folder inside that. Look for these four:

```
PhaseBilling.swift
PhaseBilling.m
App-Bridging-Header.h
Products.storekit
```

**If all four are there, skip to step 8.** They are on disk either way —
`scaffold.sh` put them there — but Xcode does not always notice a file it did
not add itself.

If any is missing:

1. Right-click the inner **App** folder → **Show in Finder**. A Finder window
   opens on the right folder.
2. Select the missing files there (⌘-click for more than one) and drag them into
   the left panel in Xcode, dropping them onto that same inner **App** folder.
3. A box appears. Tick **Copy items if needed**, choose **Create groups**, and —
   this is the one that matters — make sure **App** is ticked under
   *Add to targets*. Click **Finish**.
4. **Xcode may then offer to create a bridging header. Say no** — *Don't create*.
   We ship one, and it is the file that makes `PhaseBilling.m` compile. Xcode's
   version is empty and points the build setting somewhere else, so accepting
   the offer gives you the exact error the shipped header exists to prevent.
   Step 8 points at ours by hand.

Expect the navigator to list only `AppDelegate`, `SceneDelegate`,
`capacitor.config.json`, `Main`, `Assets`, `LaunchScreen`, `Info`, `config` and
`public` before you do this. That is normal: Capacitor 8's template uses classic
project references, so a file on disk is not a file in the project.

> **Where this bites.** A file sitting in the folder is not the same as a file
> in the app. If `PhaseBilling.m` is not in the target, the purchase bridge is
> invisible to the game and every product reads unavailable, with no error
> anywhere to tell you why.

### 8. Point Xcode at the bridging header

1. Click the blue **App** at the very top of the left panel.
2. In the middle, under **TARGETS**, click **App**.
3. Along the top of that panel click **Build Settings**.
4. Just under those tabs, click **All** and **Combined**.
5. In the search box on the right of that strip, type `bridging`.
6. One row comes back: **Objective-C Bridging Header**. Double-click the empty
   space to the right of it and type exactly:

```
App/App-Bridging-Header.h
```

7. Press Return.

> **Where this bites.** Without this the build fails with *"'Capacitor/Capacitor.h'
> file not found"*, which looks like a missing dependency and is nothing of the
> kind.

### 9. Turn on In-App Purchase

1. Same place — blue **App** → **TARGETS → App**.
2. Click the **Signing & Capabilities** tab.
3. Click **+ Capability** (top left of that panel).
4. A window of capabilities opens. Type `in-app` and double-click
   **In-App Purchase**. The window closes and it appears in the list.

While you are on this tab you may see a red signing complaint. **For the
simulator it does not matter.** If you want it gone, tick *Automatically manage
signing* and pick a **Team**. If the Team dropdown is empty, add your Apple ID:
**Xcode → Settings** (⌘,) → **Accounts** → **+** → *Apple ID*. Your personal
Apple ID is fine for now; swap it for the real team when enrolment comes
through.

### 10. Point the scheme at the test products

1. Menu bar: **Product → Scheme → Edit Scheme…**
2. In the left of the box that opens, click **Run**.
3. Along the top, click **Options**.
4. Find **StoreKit Configuration** and choose **Products.storekit**.
5. **Close**.

This is what lets you buy all ten products with imaginary money, with no Apple
account and nothing to wait for.

### 11. Run it

1. In the top bar, click the device name next to **App** and pick any iPhone
   simulator — **iPhone 16** is fine.
2. Press **▶**.

First run is slow: Xcode compiles, then the simulator boots. Two or three
minutes is normal. The game should appear and play.

**If it looks like the game will not scroll, click and DRAG.** A scroll wheel or
a two-finger trackpad swipe often does not map into a WKWebView; holding the
mouse button and dragging is what simulates a finger on the glass. Verified on a
real Mac - the app scrolls fine, the Simulator was just refusing the gesture.

**If it fails,** click the red ❌ in the top bar to see the list. Nine times out
of ten it is step 8 or step 7 above.

### 12. Try to break the purchases

Open the Store inside the game (Game Status → the store) and buy things. Every
product should work.

Then the one that actually matters:

1. Menu bar: **Debug → StoreKit → Enable Interrupted Purchases**.
2. Buy **Full Fitness**.
3. Stop the app with the **■** button before the game confirms it.
4. Press **▶** again.

The store should still be offering you that heal. That is the path between a
customer who pays and receives and a customer who pays and does not — and it is
free to test here, which it is not later.

---

## Phase 3 — Set up the shop side

App Store Connect, <https://appstoreconnect.apple.com>. Needs the account.

### 13. Sign the Paid Applications Agreement — before anything else

*Business* (older accounts: *Agreements, Tax and Banking*) → *Paid Applications*
→ accept, then bank and tax details.

> **Where this bites.** Until this is signed *and* the bank details verified,
> every purchase reads unavailable and it looks exactly like broken code.
> Verification can take several days, which is why it goes first.

### 14. Create the app record

*Apps* → **+** → *New App*:

* Platform **iOS**
* Name **PHASE: Rugby Manager**
* Primary language **English (UK)**
* Bundle ID **com.phaserugbymanager.app** — pick from the list. Xcode registers
  it the first time you choose your team under *Signing & Capabilities*; if it
  is not offered, register it under *Certificates, Identifiers & Profiles →
  Identifiers*.
* SKU: anything private, e.g. `phase-rugby-manager`. Customers never see it.

### 15. Create the ten products — read the Type column twice

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

> **Why Xcode said 99 cents and Play says £1.19.** Two different things, and
> neither of them is a bug in the game.
>
> **Xcode's $0.99** was never Apple's price. It came from
> `packaging/ios/Products.storekit`, the LOCAL test configuration Xcode reads
> when there is no App Store behind the build. It carried bare decimals with no
> storefront named, so Xcode used its default one — the United States — and drew
> `0.99` as `$0.99`. The file now names `"_storefront": "GBR"`, so a test build
> quotes pounds. Apple has still never quoted a price for these products: they
> do not exist in App Store Connect until step 15 above creates them.
>
> **Play's £1.19** is real, and it is a Console price rather than code - but
> NOT for the reason this document gave until 31 Aug 2026. It said Play was
> adding 20% VAT to a 99p product because the account quoted prices exclusive
> of tax, and told the owner to switch that off. He checked: **tax-inclusive is
> automatic in the UK and there is no switch.** The arithmetic that made the
> story convincing - 99p x 1.2 = £1.19, to the penny - was a coincidence read
> as evidence, and it was written down as fact before anybody opened the
> Console.
>
> If UK prices are inclusive by definition, then whatever the Console shows IS
> what the customer pays: a buyer charged £1.19 was buying a product priced at
> £1.19, and the £0.99 in `REFERENCE_PRICES` is the wrong figure, not the till.
> Open the product in Play Console, read its UK price, and make the two agree.
>
> **When you create the Apple products,** pick the price POINT for £0.99 (Tier
> "£0.99" in the UK) rather than typing a number. App Store prices shown to UK
> customers are already tax-inclusive, so £0.99 is what is charged — which makes
> the two stores agree, which is the point.
>
> **The game no longer holds any prices at all** (v1.1.17, owner: "we need to
> not declare a cost on the game - let google play do that"). It sells in every
> storefront both stores reach, and a figure typed into the source is right in
> at most one of them. The prices in the table above are what to TYPE INTO THE
> CONSOLES; they exist nowhere in the app, and `moneyprobe.ts` now fails if any
> file under `src/` puts a money figure next to a product id.

### 16. Take the screenshots

```sh
node scripts/storeart.mjs
```

Writes `storeart/ios/en/` and `storeart/ios/fr/` at 1290×2796 (Apple's 6.7"
size) plus `storeart/ios/icon-1024.png`, opaque as required.

Upload five, in order: title screen, squad table, team sheet, match day,
full-time verdict.

### 17. Fill in the listing

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

### 17b. Refresh the content the app will ship

**Do this every single time, before anything else in this phase.** Android and
iOS do not work the same way and it is the easiest mistake in the project to
make:

* the **Android** app is a TWA - it renders the LIVE SITE, so a Pages deploy
  reaches every phone and no upload is needed for a content change;
* the **iOS** app **BUNDLES** the site inside the binary (`webDir` is
  `../../dist`). Nothing you deploy to the web reaches it. If you archive
  without rebuilding, you will ship whatever `dist/` happened to hold last
  time, and it will pass review looking like an old version of the game.

From the repository root:

```
git pull                      # get the release you mean to ship
npm ci && npm run build       # rebuild dist/ at that version
cd packaging/ios && npx cap sync ios
```

`cap sync` is what copies `dist/` into the iOS project. Run the CLI from
`packaging/ios`, not from the repo root - `webDir` is relative to that folder.

### 18. Set the version and build number

*App* target → *General* → **Version** `1.2.4`, **Build** `1`.
The version must match `package.json` and the figure on the App Store Connect
listing, or the upload is rejected.

Every upload needs a build number higher than the last. The version can repeat;
the build number can never go backwards.

### 19. Archive it

Change the device dropdown from a simulator to **Any iOS Device (arm64)**, then
*Product* → *Archive*.

> **Where this bites.** *Archive* is greyed out while a simulator is selected,
> with no explanation. This is the most common "why can't I click it" moment in
> the whole process, and the fix is that one dropdown.

### 20. Upload it

Organizer → **Distribute App** → *App Store Connect* → *Upload*. Answer the
encryption question **No** — the app uses none and makes no network connections.

Processing takes five to thirty minutes before the build appears in App Store
Connect.

> **"Unable to Add for Review - You must choose a build."** This is App Store
> Connect saying no binary has finished processing yet. It is not a fault in
> the listing: the metadata, screenshots and pricing can all be complete and
> the banner still shows, because a version cannot be reviewed without
> something to run. It clears on its own once the upload above finishes
> processing - then open the version page, scroll to **Build**, press the
> **+** (or *Add Build*) and pick it. If an hour has passed with nothing
> appearing, check the email on the Apple ID: a rejected upload (a missing
> icon, a bad entitlement, a duplicate build number) is reported there and
> nowhere in the web interface.

### 21. Test it for real, through TestFlight

Your app → *TestFlight* → add yourself as an internal tester, install via the
TestFlight app. Purchases run in Apple's sandbox: real flow, real sheets, no
money. **This is the last point where finding a problem is cheap.** Buy one of
everything.

### 22. Submit for review — and write the review notes

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

### 23. Wait

Usually 24–48 hours, occasionally longer around holidays. Email either way.

### 24. If it comes back rejected, do not rebuild

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
