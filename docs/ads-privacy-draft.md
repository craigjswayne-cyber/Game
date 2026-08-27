# DRAFT: privacy-policy text and Play data-safety answers for the ads era

**Status: DRAFT. Nothing in this file is live and nothing in it may go live
until the release that actually carries an ad SDK** (the Capacitor wrapper in
`packaging/android-ads/` - which as of v1.1.4 is a plan, not a build). The
live policy (`public/privacy.html`) truthfully says "no advertising, no
advertising SDK, no network requests", and that stays word-for-word true for
every TWA build. Swapping this text in early would make the policy false in
the other direction. Written 27 Aug 2026 as part of the ads groundwork so the
day ads ship, the policy work is a paste, not a scramble.

---

## 1. Replacement for the `Advertising` section of privacy.html (EN)

```html
<h2>Advertising</h2>
<p>The Android app shows a small number of banner advertisements, served by
Google AdMob. Advertising is the only thing in the game that uses the network
and the only thing that involves a third party. AdMob may collect and use your
device's advertising identifier and coarse technical data (device model, OS
version, rough IP-derived region) to serve and measure ads, under
<a href="https://policies.google.com/privacy">Google's privacy policy</a>; the
partners it may share data with are listed at
<a href="https://policies.google.com/technologies/partner-sites">Google's
partner page</a>. Where the law requires it you will be asked for consent
before the first ad, and declining limits ads to non-personalised ones rather
than limiting the game.</p>
<p>A one-off "Remove all ads" purchase removes every banner permanently. You
can also reset or delete your device's advertising identifier at any time in
Android's settings. The web version of the game shows no advertising at
all.</p>
```

## 2. Replacement for the last sentence of `Network use` (EN)

The current section claims zero network requests. In the ad build it becomes:

```html
<p>The game itself is fully offline once loaded: the simulation makes no
network requests, sends nothing anywhere, and is checked automatically on
every build for anything that could. The one exception in the Android app is
advertising (see below), which is the app shell's doing, not the game's, and
which the "Remove all ads" purchase switches off entirely.</p>
```

## 3. French versions

Ads-era policy will need the FR mirror of whichever page carries it (the
in-game policy is EN-only today; the Play listing links the same page).
Prepared so the store listing's French reviewers see matching copy:

```html
<h2>Publicité</h2>
<p>L'application Android affiche un petit nombre de bannières publicitaires,
servies par Google AdMob. La publicité est la seule chose dans le jeu qui
utilise le réseau et la seule qui implique un tiers. AdMob peut collecter et
utiliser l'identifiant publicitaire de votre appareil et des données
techniques sommaires (modèle, version du système, région approximative) pour
diffuser et mesurer les annonces, selon la
<a href="https://policies.google.com/privacy">politique de confidentialité de
Google</a>. Là où la loi l'exige, votre consentement sera demandé avant la
première annonce ; un refus limite les annonces à des annonces non
personnalisées, pas le jeu.</p>
<p>Un achat unique « Supprimer toutes les pubs » retire définitivement toutes
les bannières. Vous pouvez aussi réinitialiser ou supprimer l'identifiant
publicitaire de votre appareil à tout moment dans les réglages Android. La
version web du jeu n'affiche aucune publicité.</p>
```

## 4. Play Console data-safety answers (the delta, ad build only)

Today every collection answer is No, and stays No until the ad release. Then:

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Device or other IDs → Advertising ID | Collected **and shared** (with Google/AdMob) · Purpose: **Advertising or marketing** · Optional: No (unless Remove-all-ads owned) · Processed ephemerally: No |
| Approximate location | **No**, provided AdMob's location-based ads are disabled in the AdMob console - disable them and keep this No |
| Data encrypted in transit | Yes |
| Ways to request deletion | Advertising ID is user-resettable/deletable at OS level; the app holds no account data |
| App collects nothing else | unchanged - saves stay on-device |

Also triggered by the SDK: the `com.google.android.gms.permission.AD_ID`
manifest permission and its console declaration (reason: advertising), and
the "Ads" declaration on the App content page flips to **Yes, contains ads**
(which also puts the "Contains ads" label on the listing).

## 5. The Store row and product (already wired, code side)

`phase.supporter` ("Remove all ads", $1.99, Managed) renders in the Store
only where `adBridge()` reports a live ad provider, so the product can never
be offered in a build that shows nothing to remove. Create and activate the
Play product on the day the ad build ships - `packaging/twa/README.md` §4
carries the same instruction on the product table.
