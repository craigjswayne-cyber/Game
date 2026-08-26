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

## 4. Billing

`twa-manifest.json` already declares it:

```json
"features": { "playBilling": { "enabled": true } },
"alphaDependencies": { "enabled": true }
```

That is what makes the browser hand the page a Digital Goods service.
`src/game/playbilling.ts` builds the bridge from it at boot, and does nothing at
all anywhere else - which is why the web build has no purchase door.

In Play Console, create one **managed (non-consumable) product** with the id:

```
phase.supporter
```

The id must match `SUPPORTER_SKU` in `src/game/monetise.ts` exactly. Set its
price, activate it, and test it with a licence-tester account before release:
purchases by testers are free and refundable, and it is the only way to see the
acknowledge path (`docs/monetisation.md`) work end to end.

If you would rather sell the game up front instead, skip all of this, build with
`VITE_EDITION=paid npm run build`, and set the price on the listing. Everybody
who can run it is then already a supporter, and the purchase UI never appears.

## 5. Upload

Play Console → Create app → Production (or Internal testing first, which is
what internal testing is for) → upload the `.aab`.

Then the questionnaires, whose answers are already written down in
`docs/store-listing.md`: Data safety, Content rating, Ads (no), Target audience,
Government apps (no), Financial features (no).

## What breaks, and what it looks like

| Symptom | Cause |
|---|---|
| `FileNotFoundException: ./android.keystore` when signing | the keystore was never created - run the `keytool` command in §3 once, from inside this folder, before building |
| "Play Billing requires enableNotifications to be true" | `enableNotifications` in `twa-manifest.json` is `false`. Play Billing wires through the same Android notification-channel plumbing and bubblewrap refuses to build without it - set it `true`. The game itself still sends no notification; this is native build plumbing only |
| An address bar across the top | asset links missing, wrong fingerprint, or wrong scope |
| The purchase button never appears | billing not enabled in the TWA, or the SKU id does not match, or the product is not activated |
| "Item not found" on tapping buy | the product exists but the app was not uploaded to a track yet - Play needs the package published (internal testing counts) |
| A purchase reverses itself after three days | the acknowledge step is not running (see `playbilling.ts`) |
| The splash screen flashes white | `backgroundColor` in this file must match the manifest's, and both must be `#1a201e` |
