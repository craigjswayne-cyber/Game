# Packaging for Google Play (Trusted Web Activity)

The game is a PWA. Play accepts one of those as a **Trusted Web Activity**: a
thin native package whose whole job is to open your own verified URL full-screen,
with no browser chrome. Same code, same deploy, one more artefact.

This folder holds the two files that make it work and the walk-through that
nobody remembers the second time.

```
packaging/twa/
  twa-manifest.json          Bubblewrap's config, pre-filled bar two values
  .well-known/assetlinks.json   the proof the app and the site are the same owner
```

---

## 0. The blocker to settle first: the address

**A TWA has to prove it owns its domain**, by serving
`/.well-known/assetlinks.json` **at the domain root** with the signing
certificate's fingerprint in it. Without that proof, Android still opens the app
- with a browser address bar across the top, which fails the "app-like" bar and
looks like exactly what it is.

The game currently deploys to GitHub Pages. Two cases:

* **`user.github.io/Game/` (a project page)** - the root of `user.github.io` is
  a *different repository*, and `github.io` is on the Public Suffix List. Asset
  links have to be served from `https://user.github.io/.well-known/`, which
  means committing this file to the `user.github.io` repo. Doable, and it works,
  but the scope of the TWA is then a subdirectory - set `startUrl` and
  `fullScopeUrl` to `/Game/`, not `/`.
* **A custom domain** (`phaserugbymanager.com`, or a subdomain) - the clean
  answer. Point it at Pages, serve `.well-known/assetlinks.json` from
  `public/.well-known/` in this repository, and everything below is
  straightforward.

**A custom domain is the recommendation**, because it also gives the listing a
stable home, an e-mail address that matches, and somewhere to host the privacy
policy that is not a personal account URL.

## 0b. The step that is easy to skip: deploy first, then package

A TWA ships **no web assets**. It is a shell around the live URL, so the app
Play users get is whatever that address is currently serving - at install and at
every launch afterwards. Build a TWA against a stale deploy and you have shipped
the stale deploy, and no amount of green probes will tell you, because every
probe in this repository runs against a local `npm run build`.

So before `bubblewrap build`, every time:

1. the release work is merged to `main` (Pages deploys from `main` only);
2. the Pages workflow has finished;
3. you have opened the live URL on a phone and read the build stamp under the
   wordmark on the title screen. It carries the version and the build time, and
   it is there for this. If it does not say the version you are about to put in
   `appVersionName`, stop - you are packaging something else.

## 1. Tools

```sh
npm i -g @bubblewrap/cli      # needs Node 18+, a JDK and the Android SDK;
bubblewrap doctor             # bubblewrap will offer to fetch the last two
```

## 2. Fill in the config

Edit `twa-manifest.json`:

| Field | What it must become |
|---|---|
| `host`, `startUrl`, `fullScopeUrl`, `iconUrl`, `webManifestUrl` | the real address the game is served from |
| `packageId` | your reverse-domain id. It can never change: it is the app's identity on Play forever |
| `signingKey.path` | where the keystore lives. **Because the path and alias are already filled in below, `bubblewrap build` assumes the file at that path already exists and goes straight to signing with it - it will NOT offer to create one for you the way a truly blank manifest would.** Create it yourself first (§3) or `bubblewrap build` fails with `FileNotFoundException: ./android.keystore`. **Back the resulting file up.** Losing it means never updating the listing again |
| `appVersionCode` | 1 for the first upload, then +1 every single upload, forever |
| `appVersionName` | match `package.json`'s version |

## 3. Build

The manifest in this folder already has `signingKey` filled in - a location and
an alias, not a file. Nothing has generated the actual keystore yet, and
`bubblewrap build` will not offer to (see the note on `signingKey.path` above).
Create it once, from inside this folder, before the first build ever:

```sh
cd packaging/twa
keytool -genkeypair -v -keystore android.keystore -alias phase -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password (invent one, **write it down**, you will need it every
build) and some name/organisation fields that are never shown to a player or
verified by anyone - anything is fine. Then:

```sh
bubblewrap build   # produces app-release-bundle.aab, signed with the keystore above
```

`bubblewrap build` prints the SHA-256 fingerprint of your signing key. Put it in
`.well-known/assetlinks.json`, publish that file at the domain root, and check it
with:

```sh
curl https://YOUR-HOST/.well-known/assetlinks.json
```

**Then add the second fingerprint.** Play re-signs every upload with its own key
("Play App Signing"), so the certificate on a device is *not* your upload key.
Play Console → Setup → App signing shows the fingerprint it uses; both belong in
the file, or the address bar comes back the day after release.

**Never leave a placeholder in that array while you wait for Play to show you
the real value.** The file shipped with
`"REPLACE:WITH:THE:SHA256:PLAY:APP:SIGNING:GIVES:YOU"` sitting in it as a
reminder, which is worse than shipping nothing: a fingerprint that is not 32
colon-separated hex bytes is not a fingerprint, and a validator entitled to
reject the malformed entry is equally entitled to reject the statement holding
it. One correct fingerprint is a valid file. One correct fingerprint plus a
note-to-self is a gamble on someone else's parser.

And the stake is bigger than the address bar, which is only the *symptom* you
can see. Verification is what puts the app in trusted mode, trusted mode is what
makes the browser hand the page a Digital Goods service, and that service is the
whole of `bridge()` in `monetise.ts`. So an unverified TWA has no bridge, which
means `tillOpen()` is false, which means every shelf in the game renders
`null` - the Supporter door on About, the Boardroom on Finances, all of it.
The shop does not fail loudly when asset links are wrong. It is simply not
there, exactly as it is not there in a browser tab, and it looks like a game
that was built without one.

## 4. Billing

`twa-manifest.json` already declares it:

```json
"features": { "playBilling": { "enabled": true } },
"alphaDependencies": { "enabled": true }
```

That is what makes the browser hand the page a Digital Goods service.
`src/game/playbilling.ts` builds the bridge from it at boot, and does nothing at
all anywhere else - which is why the web build has no purchase door.

In Play Console (Monetise → Products → In-app products), create the **nine**
products below of `docs/monetisation-spec.md` §1. (Do NOT create
`phase.editor` — the In-Game Editor was removed on the owner's call, 27 Aug,
before any store sold one. Do NOT create `phase.supporter` yet either — see
the note under the table.) Until they exist, the store in the
game is a door with nothing behind it: every shelf shows an unpriced button and
every purchase ends in "Nothing was charged", which is exactly what the owner's
first installed build showed (27 Aug).

| Product ID | Play type | Product | Price |
|---|---|---|---|
| `phase.license` | Managed (**consumable** from v1.1.12) | Support the game | $0.99 |
| `phase.uncapped` | Managed (non-consumable) | Remove the salary cap | $9.99 |
| `phase.estate` | Managed (non-consumable) | The Estate | $9.99 |
| `phase.pinnacle` | Managed (non-consumable) | The International Stage | $4.99 |
| `phase.inject.s` | Consumable | Board Injection (Small) | $0.99 |
| `phase.inject.m` | Consumable | Board Injection (Medium) | $1.99 |
| `phase.inject.l` | Consumable | Board Injection (Large) | $3.99 |
| `phase.inject.xl` | Consumable | The Sugar Daddy | $7.99 |
| `phase.heal` | Consumable | Full Fitness | $0.99 |

The tenth SKU, `phase.supporter` (Remove all ads, Managed, $1.99), exists in
the code but its store row only renders where an ad provider exists
(`adBridge()`). Create it in Play Console **on the day a wrapper build ships
ads**, not before — a purchasable "Remove all ads" in a build that shows no
ads is a refund magnet and a review risk.

### The price the customer sees is not always the price you typed

The store row and every `REFERENCE_PRICES` entry in `src/game/monetise.ts` are
GUIDE prices; Play's own answer always wins, and Play's answer is whatever
Play Console is set to charge. Two Console settings decide that, and neither
is in this repository:

1. **Tax-inclusive or tax-exclusive pricing** (Play Console → Monetise →
   *Manage settings* → *Tax and compliance* → the price-display setting for
   each country). Set to tax-exclusive, Play ADDS VAT on top of the number you
   typed, so a £9.99 product is charged at £11.99 in the UK - which is exactly
   what the refund email showed on 29 Aug 2026. Set it to tax-inclusive and the
   customer is charged the number on the row.
2. **The per-country price**, which can drift from the template price if it was
   ever edited by hand.

Owner's brief, v1.1.12: "support the game should be 99p so adjust whatever the
additional fee is thats made it higher so it is 99p only." That adjustment is
made in Play Console on `phase.license`, not in the code - the code already
says £0.99 and defers to whatever Play answers.

### Renaming a product

The product ID is permanent; the NAME on the row is not. `phase.uncapped` shipped
as "The Owner's Charter" and became "Remove the salary cap" in v1.1.13 (owner:
"the owners charter sounds weird simplify to remove all salary cap"), which is a
Play Console edit on the existing product - not a new one. Anyone who bought it
under the old name still owns it, because the receipt is against the id.

Every id must match `src/game/monetise.ts` **exactly** - a typo does not error,
it renders an unpriced button that cannot sell. The consumable/managed split
matters just as much: a consumable sold as managed can only ever be bought once.
(In Play a "managed product" is repeatable precisely because the APP consumes
it, so `phase.license` becoming repeatable in v1.1.12 needed no Console edit -
only the app spending the receipt.)
Set each price, **activate** each one, and test with a licence-tester account
before release: purchases by testers are free and refundable, and it is the only
way to see the acknowledge path (`docs/monetisation.md`) work end to end - an
unacknowledged purchase is auto-refunded by Play after three days.

(The paid-up-front alternative that used to be described here was decided
against, 27 Aug: `VITE_EDITION=paid` removes the whole catalogue, not just the
supporter purchase - see `docs/monetisation.md`. The free edition is the one
that ships.)

## 5. Upload

Play Console → Create app → Production (or Internal testing first, which is
what internal testing is for) → upload the `.aab`.

Then the questionnaires, whose answers are already written down in
`docs/store-listing.md`: Data safety, Content rating, Ads (no), Target audience,
Government apps (no), Financial features (no).

## 6. Shipping an update

An update is mostly not an upload, because a TWA is a window onto the live
site: **whatever `main` deploys is what every installed copy plays**, usually
within a launch or two (the service worker polls every fifteen minutes and
offers a one-tap refresh pill; it never forces a reload mid-match). Most fixes
ship by merging to `main` and never touch Play at all.

Upload a new `.aab` only when the *shell* changes - the version the listing
shows, billing configuration, icons, or anything else in `twa-manifest.json`:

1. Deploy first: the changes must be live on `main` (see §0b - this was
   learned the hard way).
2. Bump **both** versions in `twa-manifest.json`: `appVersionCode` one higher
   than whatever Play has seen (the file's comment block has the rules), and
   `appVersionName` to match `package.json`.
3. `bubblewrap build`, signed with the same keystore as last time. A different
   keystore is a rejected upload - and if the keystore is lost, the listing is
   over, which is why §3 says to back it up.
4. Play Console → the testing track you are on → Create new release → upload
   the `.aab` → roll it out.

The what's-new text for the release-notes field is pre-written, EN and FR, in
`docs/store-listing.md` ("What's new" / "Nouveautés").

## What breaks, and what it looks like

| Symptom | Cause |
|---|---|
| `FileNotFoundException: ./android.keystore` when signing | the keystore was never created - run the `keytool` command in §3 once, from inside this folder, before building |
| "Play Billing requires enableNotifications to be true" | `enableNotifications` in `twa-manifest.json` is `false`. Play Billing wires through the same Android notification-channel plumbing and bubblewrap refuses to build without it - set it `true`. The game itself still sends no notification; this is native build plumbing only |
| An address bar across the top | asset links missing, wrong fingerprint, or wrong scope. **Most likely: the file names only ONE key.** Play App Signing gives you two certificates - the UPLOAD key you sign with, and the APP SIGNING key Google re-signs with before shipping to phones. `assetlinks.json` must list BOTH `sha256_cert_fingerprints`, or whichever build you are not currently running fails verification. Get them from Play Console > Protected with Play > Play Store protection > **Manage Play app signing**: the page shows the upload key certificate, and a ready-made Digital Asset Links JSON containing the app signing one |
| `getDetails threw OperationError: clientAppUnavailable` while the app shows an address bar | the same single-fingerprint fault, seen from inside the game. A failed asset-link check drops the TWA to Custom Tabs, and a Custom Tab has NO billing client behind the Digital Goods API - so the store connects and returns nothing. Cost a full day on 29 Aug 2026 because the sideloaded build verified fine (it matched the upload key) while the Play build did not, so installing "properly" from Play is what BROKE it. `shelllint` now fails if either fingerprint goes missing |
| The purchase button never appears | billing not enabled in the TWA, or the SKU id does not match, or the product is not activated |
| "Item not found" on tapping buy | the product exists but the app was not uploaded to a track yet - Play needs the package published (internal testing counts) |
| "You can't rollout this release because it doesn't add or remove any app bundles" | the upload's `appVersionCode` repeats one Play already has (hit 26 Aug re-uploading after the keystore regeneration). Bump it in `twa-manifest.json`, rebuild, upload again |
| "Doesn't allow existing users to upgrade" | same cause as above: the version code must go up on every upload, no exceptions |
| The store shelves show buttons with no prices, and buying says nothing was charged | the in-app products have not been created (or not activated) in Play Console - see §4. The bridge is working; the catalogue is empty |
| The Store's health line says `getDetails threw OperationError: clientAppUnavailable` | **The APK's billing delegation is missing or stale - this is a BUILD fault, not a console one.** Chrome asked the app for a billing client and the app had none to give. `playBilling: true` in this manifest earns the `com.android.vending.BILLING` permission (which is why the Play listing still shows "In-app purchases"), but the delegation itself is native code bubblewrap generates, and a project generated by an old CLI - or built from a stale copy of this repo rather than the clone - ships the permission without the plumbing. Cost a full day on 29 Aug 2026, because every console setting was already correct: products active, backwards compatible, 173 countries, licence tester, installed from Play. Fix: `npm i -g @bubblewrap/cli@latest`, then `bubblewrap update` **in this folder of your CLONE**, then rebuild and upload |
| `fatal: not a git repository` while building | you are not in the clone. A GitHub "Download ZIP" unpacks to `Game-main/`, which is a snapshot with no git and no way to pull - and it carries its own `android.keystore` and `twa-manifest.json`, so builds from it silently ship whatever that snapshot held. Always build from the clone |
| A purchase reverses itself after three days | the acknowledge step is not running (see `playbilling.ts`) |
| The splash screen flashes white | `backgroundColor` in this file must match the manifest's, and both must be `#1a201e` |
