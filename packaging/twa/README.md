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
| `signingKey.path` | where the keystore lives. **Back this file up.** Losing it means never updating the listing again |
| `appVersionCode` | 1 for the first upload, then +1 every single upload, forever |
| `appVersionName` | match `package.json`'s version |

## 3. Build

```sh
cd packaging/twa
bubblewrap init --manifest https://YOUR-HOST/manifest.webmanifest   # first time only
bubblewrap build                                                    # produces app-release-bundle.aab
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
| An address bar across the top | asset links missing, wrong fingerprint, or wrong scope |
| The purchase button never appears | billing not enabled in the TWA, or the SKU id does not match, or the product is not activated |
| "Item not found" on tapping buy | the product exists but the app was not uploaded to a track yet - Play needs the package published (internal testing counts) |
| A purchase reverses itself after three days | the acknowledge step is not running (see `playbilling.ts`) |
| The splash screen flashes white | `backgroundColor` in this file must match the manifest's, and both must be `#1a201e` |
