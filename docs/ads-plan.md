# Putting ads in the game, on Android and iOS

**Written 28 Aug 2026, for the owner's brief: "make a plan for how I insert
ads into the game on both. I want to make money in this game."**

This is the whole route from where the code actually is today to money
arriving, in the order it has to happen, with the costs and the numbers named.
It supersedes nothing: `packaging/android-ads/README.md` holds the Android
shell detail, `docs/monetisation-spec.md` §2-3 holds the placement design, and
`docs/ads-privacy-draft.md` holds the policy text. This is the plan that ties
them together and says what to do first.

---

## 1. The good news: the game is already ad-ready

Every surface an ad would use is built, shipped and probed. Nothing in
`src/` has to change to start earning:

* **Two banner slots** - `AD_PLACES = ['home-foot', 'results-foot']`. They
  render only when `globalThis.rmAds` exists, only outside a match, never on
  a modal or the title screen, and never at all for somebody who has bought
  Remove all ads.
* **Four rewarded placements**, all coded, all opt-in, all rendering only
  when a bridge exists: the physio's favour (Medical), the agency's file
  (Player/Shortlist), the analyst's extra session (Matchday), the town's
  collection (Finances). Each replaces a *fee the game already charged* -
  none of them invents a power a paying manager gets and nobody else can.
* **The Remove all ads product** (`phase.supporter`, £1.99) is written,
  priced and gated on `adBridge()`, so it cannot be sold in a build that has
  no ads to remove.

So the entire remaining job is in the **shells**. The web build at
phaserugbymanager.com stays exactly as it is: free, offline, ad-free,
`netprobe` green.

## 2. The one architectural decision, and the recommendation

**Android ships today as a TWA** - Chrome rendering the site full-screen,
with no native code of ours in the APK. AdMob is a native SDK. There is
nowhere in a TWA to put it, and a JavaScript ad tag is closed off twice over
(netprobe, and AdSense policy forbids web display ads inside a wrapped app).

**iOS already ships as a Capacitor shell** - built in v1.1.8, native code and
all, with StoreKit billing in `packaging/ios/PhaseBilling.swift`.

> **Recommendation: fold Android into the same Capacitor shell as iOS.**
> One wrapper, one plugin surface, one bridge contract, two platforms. The
> iOS shell already proves the pattern; doing Android the same way means the
> ad plugin, the consent plumbing and the release process are written once.

What that costs, honestly:

| Given up | Consequence |
|---|---|
| Digital Goods API billing | The wrapper injects `rmBilling` itself via Play Billing Library, exactly as the iOS shell injects StoreKit. The web side needs no change - it speaks to whichever bridge exists. |
| Zero-native-code review posture | Our code is in the APK now: crash reporting and SDK updates become ours to own. |
| Auto-updating web content | The TWA renders the live site; the wrapper bundles `dist/`, so every content change becomes a store release on both platforms. |

The appId stays `com.phaserugbymanager.app` and the upload key is unchanged,
so Play treats the wrapper as an ordinary update of the existing app.

**If you would rather not touch Android yet:** ship ads on iOS first (the
shell exists), leave the TWA earning nothing but store revenue, and fold
Android in later. That is a legitimate order and it is slower to money.

## 2a. The cost nobody costed: you lose same-day updates

Added 30 Aug 2026, because §2's table understates this line and it is the one
that will actually change how the owner works.

**Today, a Pages deploy reaches every installed copy in minutes.** The TWA is
Chrome rendering the live site, so shipping a fix is `git push` and about
twenty-five minutes of CI. On 29-30 Aug alone that route delivered around
twenty fixes to a phone in the owner's hand, several of them the same morning
they were reported. There was no Play review in any of it.

**After the Capacitor fold, every one of those becomes a store release.** The
wrapper bundles `dist/`, so a one-line copy change is a new AAB, an upload, a
review (hours to days), and a staged rollout. The turnaround this project has
been running on - report at breakfast, fixed by lunch - stops being available.

That is not an argument against ads. It is the price, and it should be paid
knowingly rather than discovered afterwards.

### The third route: a native shell that still loads the live site

Capacitor can point at a remote URL (`server.url` in `capacitor.config`)
instead of serving the bundled `dist/`. The shell is still native - the AdMob
and billing plugins work exactly as they would otherwise - but the CONTENT is
still phaserugbymanager.com, so same-day updates survive.

| | TWA (today) | Capacitor, bundled | Capacitor, remote URL |
|---|---|---|---|
| Ads possible | **No** | Yes | Yes |
| Native billing | Digital Goods only | Yes | Yes |
| Same-day content updates | **Yes** | No | **Yes** |
| Works with no connection | Yes (service worker) | Yes | Only with a bundled fallback |
| App-store risk | None today | None | **Apple 4.2 / 2.5.2 scrutiny** |

The risk in the third column is real and specific: Apple rejects apps that are
thin wrappers around a website, and a shell whose entire content is remote
invites that reading. The mitigations are to bundle `dist/` as the fallback and
prefer it when the network is absent (so the app is genuinely functional
offline and is not "just a web view"), and to keep the native surface
substantial - billing, ads, and the file-based save export all run natively.
Google Play has no equivalent objection.

**Recommendation, in order of what this project actually values:**

1. **Android first, Capacitor with a remote URL and a bundled fallback.** Play
   has no thin-wrapper rule to fall foul of, Android is where the users are,
   and same-day updates survive on the platform being played on.
2. **iOS second, Capacitor with the content bundled.** Take the store-release
   latency where the rules demand it, on the platform with no users yet.

That gets ads earning on Android without giving up the working rhythm, and it
keeps the iOS shell inside Apple's comfort zone.

### DECIDED, 30 Aug 2026: both platforms, content bundled

The owner was shown the table above and the cost in this section, and chose the
**bundled** route on both platforms rather than the remote-URL split.

So this is settled and the rest of the plan assumes it: `dist/` ships inside
both wrappers, the app works offline everywhere by construction, neither store
has a thin-wrapper question to ask - **and every future change, including a
one-line copy fix, is an upload and a review on both stores.** The same-day
turnaround this project has run on ends with the first ads release.

Two things follow that are worth doing before that release rather than after:

* **Batch the content work.** With review latency in the loop, a steady drip of
  single fixes costs more than it did. Group them.
* **Keep the web build honest.** phaserugbymanager.com stays free, ad-free and
  auto-updating, so there is still one surface where a fix is live in twenty-five
  minutes - useful for verifying a fix before it goes into a store build.

## 3. What actually gets built

One Capacitor project, two platform folders, three plugins:

```
@capacitor/core + @capacitor/cli + @capacitor/android + @capacitor/ios
@capacitor-community/admob        # banners + rewarded, both platforms
PhaseBilling (ours)               # StoreKit on iOS, Play Billing on Android
```

The shell injects, before the bundle loads:

```ts
globalThis.rmAds = {
  mount(el, place) {},       // a banner into el ('home-foot' | 'results-foot')
  unmount(el) {},            // tear down - a screen change must not leak a frame
  showRewarded(place) {},    // -> 'completed' | 'skipped' | 'unavailable'
}
globalThis.rmBilling = { details, buy, owned, consume }
```

`showRewarded` is optional. Ship banners alone and no rewarded button renders
anywhere; the game reads as complete without them. That is the cheapest first
release and it is the one to aim at.

## 4. Consent, which is not optional and is where apps get pulled

* **Android / EEA + UK: Google UMP SDK.** The consent form shows before the
  first ad request. Consent declined means **non-personalised ads**, not no
  game - the game must stay fully playable when the form is dismissed.
* **iOS: App Tracking Transparency.** The ATT prompt is required before the
  IDFA is used, and Apple requires a purpose string in `Info.plist`.
  Declining ATT is the majority case on iOS (industry-wide it runs roughly
  1 in 4 who allow); plan revenue on the assumption that most iOS ads are
  contextual, not personalised.
* **Both:** AdMob content rating set to match the game's (everyone), and
  sensitive categories blocked in AdMob's controls.
* **Families:** the game is rated for everyone but is **not** enrolled in
  Designed-for-Families. Enrolling makes AdMob's families policies bite much
  harder. Decide before enrolling, not after.
* Test app id `ca-app-pub-3940256099942544~3347511713` and test unit ids
  until the real ones exist. Live ids in a debug build is a policy strike.

## 5. The store paperwork, on the ads release and not one day before

The live listing says, truthfully, that the app collects nothing and makes no
network requests. An ad SDK makes both false. On the release that carries
ads, together, in the same commit:

* **Play data safety**: declare *Device or other IDs* (Advertising ID),
  collected, shared with Google, purpose Advertising. Add *Approximate
  location* only if AdMob location-based ads are left on - turn them off and
  the answer stays No. The SDK adds the `AD_ID` permission; the console will
  ask why, and the answer is Advertising.
* **Apple privacy nutrition label**: Identifiers -> Advertising, used for
  Third-Party Advertising, linked to the user. Plus the ATT purpose string.
* **Privacy policy**: paste the EN and FR replacements from
  `docs/ads-privacy-draft.md` into `public/privacy.html`. They name AdMob,
  link Google's partner policy and state the Remove all ads purchase.
* **Products**: create `phase.supporter` (£1.99, Remove all ads) in both
  consoles the same day the ads ship, never earlier.

## 6. What this is worth

No measured figures exist for this game - it has no ad history and no
installed base to sample. What follows is arithmetic to re-run with real
numbers once there are some, using industry-typical rates for a
UK/EU-weighted sports-management audience. **Treat every number as an order
of magnitude, not a forecast.**

Per 1,000 daily active players:

| Line | Typical rate | Per day | Per month |
|---|---|---|---|
| Banners: ~6 impressions/session, 1.4 sessions/day, eCPM £0.40-£1.20 | ~8,400 impr/day | £3-£10 | £100-£300 |
| Rewarded: ~12% of players watch ~1.4/day, eCPM £8-£20 | ~170 views/day | £1.40-£3.40 | £40-£100 |
| **Ads total** | | **£4-£13** | **£140-£400** |
| Remove all ads at £1.99, ~1.5% of players ever, spread over a year | | | **£25/mo** |

The shape of that table is the point, and it says three things:

1. **Ads are a volume business and the game does not have volume yet.** At
   1,000 DAU this is a few hundred pounds a month. At 100 DAU it is beer
   money, and the shell work costs the same either way.
2. **Rewarded earns 3-5x what a banner impression earns**, from a fraction
   of the impressions, and players *ask* for it. If only one thing ships,
   the highest-return-per-annoyance surface is rewarded, not banners - but
   banners are far less work, so shipping banners first and rewarded second
   is still the right order.
3. **The store already out-earns all of this per player.** A single Estate
   or Charter sale at £9.99 is worth roughly as much as a month of ads from
   thirty daily players. Ads are the tail; the ten products are the
   business. Which is the argument for getting the pay buttons right first
   and the ad SDK second.

## 7. The order to do it in

1. **The pay buttons work** - Play products activated, licence testing set
   up, a real purchase made end to end on a real device. This is worth more
   per player than everything below it and is nearly done.
2. **iOS shell to TestFlight** with StoreKit only, no ads. Proves the
   Capacitor+billing pattern on the platform where the shell already exists.
3. **Fold Android into Capacitor**, billing only, no ads. Ship it as an
   ordinary update and confirm purchases still work through the new bridge.
   *Stop here if the install base is small - everything below needs volume.*
4. **Banners on both**, behind UMP and ATT, with the data-safety, nutrition
   label and privacy-policy changes in the same release, plus the
   `phase.supporter` products. Two slots, no rewarded.
5. **Rewarded on both**, wiring `showRewarded` to AdMob rewarded units. Four
   placements light up on their own the moment the method exists.
6. **Measure, then tune** - AdMob mediation is worth turning on only once
   there is enough traffic for a second network to bid meaningfully.

## 8. What stays true throughout

* The web build never gets an ad, a tracker or a network call. `netprobe`
  fails the suite on any of the three, and that is a feature.
* No ad ever interrupts a match, sits on a modal, or appears on the title
  screen.
* No rewarded ad gives a paying manager a power that a non-paying one cannot
  earn; every one of them replaces a fee the game already charged.
* A manager who has bought Remove all ads never sees a banner again -
  rewarded buttons survive that purchase deliberately, because the player is
  the one asking for them.
