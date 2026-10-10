# Store readiness checklist: Google Play and the App Store (1.8.17)

Checked on 10 October 2026 against the repository (branch
`claude/rugby-game-animation-ideas-qusfd5`, version 1.8.17, Play code 56) and
against the stores' current published rules. Sources are listed at the end.

Key: **DONE** in place and checked · **FIXED** fixed in this round ·
**OWNER** needs you (a console, an account, a device or a decision) ·
**APPROVE** wording that needs your approval before it ships ·
**WATCH** fine today, with a deadline coming.

---

## 1. Must do before submitting (blockers)

| # | Item | Store | Status | What to do |
|---|---|---|---|---|
| B1 | **Privacy declarations under-declare AdMob.** Play Data safety and Apple App Privacy list only the device ID. Google's own AdMob disclosure pages say the SDK also collects the IP address (Apple: coarse location), app interactions, and diagnostics (crash logs, performance). | Both | OWNER | Re-answer both forms from Google's current pages: Play: *developers.google.com/admob/android/privacy/play-data-disclosure*; Apple: *developers.google.com/admob/ios/privacy/data-disclosure*. Then update `docs/ADS-STEP-BY-STEP.md` Step 7 to match. |
| B2 | **The in-game About page says "The game collects nothing about you and sends nothing anywhere"** (`about.privacyBody`, `about.sub`). True for the web game, not for the apps with AdMob. Apple compares this with the privacy label. | Both | APPROVE | Proposed: "The game itself collects nothing about you. Careers are saved on this device only, which is why the Save / Load screen has an Export button: it is the only backup there is. In the phone apps, the adverts are served by Google AdMob, which uses your device's advertising identifier; the privacy policy has the detail." Plus the five other languages once approved. |
| B3 | **"Club names are real"** in the About page and store copy is wrong: clubs carry their towns' and cities' names. | Both | APPROVE | Already raised in the copy review. |
| B4 | **Play phone screenshots were 1080x2340**, which breaks Play's rule that the long side is at most twice the short side. | Play | FIXED | `scripts/storeart.mjs` now makes 1080x1920 (9:16). Regenerated in `storeart/play/`. |
| B5 | **No Play tablet screenshots** (7-inch and 10-inch). | Play | FIXED | Now generated: `storeart/play-tablet7/` (1200x1920) and `storeart/play-tablet10/` (1600x2560), en and fr. |
| B6 | **iPad 13-inch screenshots** were from 27 Sep, English only, before the 1.8.17 tablet fixes. Required, because the build runs on iPad. | Apple | FIXED | Now part of `storeart.mjs`: `storeart/ios-ipad13/` (2048x2732), en and fr, from the current build. |
| B7 | **No support page.** The Support URL pointed at the privacy policy. Apple requires a Support URL with real contact details. | Apple (Play recommends) | FIXED | `public/support.html` (contact, restore, refunds, adverts, saves). Live on the website once merged. The listing doc and walkthrough now point at it. |
| B8 | **Website / Marketing URL** was not set anywhere. AdMob finds `app-ads.txt` through the developer website the store lists. | Both | FIXED in docs, OWNER in consoles | Enter `https://phaserugbymanager.com` as Play's Website and App Store's Marketing URL. |
| B9 | **EU DSA trader status.** You are a trader (a company earning money). Address, phone and email are shown to EU users. Apple removes apps without it from the EU store. | Both | OWNER | Declare in Play Console and App Store Connect. You will need a business phone number. |
| B10 | **Apple: enrolment, agreements, app record, 12 IAPs, TestFlight.** | Apple | OWNER | `packaging/ios/APP-STORE-WALKTHROUGH.md`. |
| B11 | **Device tests of purchases** (buy, cancel, pending, restore after reinstall, intro offer) on Android and iPhone. | Both | OWNER | Section 10 of `LAUNCH-PROGRAMME.md`. |
| B12 | **Age rating, Apple's new questionnaire** (mandatory since 31 Jan 2026). Answer it in full; adverts and in-app purchases are both declared. | Apple | OWNER | Expected 4+. |

## 2. Should do before launch

| # | Item | Store | Status | What to do |
|---|---|---|---|---|
| S1 | **Restore on iPhone never calls `AppStore.sync()`.** Restore reads the current entitlements, which normally works, but Apple advises an explicit Restore to call `sync()` in case a purchase hasn't reached the device yet. | Apple | OWNER (test on a Mac) | Add a `sync` method to `PhaseBilling.swift`/`.m` and call it from Restore. I did not change it because the Swift can't be compiled or tested here; it needs a Mac. |
| S2 | **Open-source notices.** React, ReactDOM, Scheduler and Zustand (MIT) and Space Grotesk (SIL OFL 1.1) ship inside the app; their licences ask for the notice to go with it. | Both | FIXED (file), APPROVE (link) | `public/third-party-notices.txt` now ships in the app and on the website. A link from About & legal needs your approval. |
| S3 | **iOS export compliance** was a hand step on every upload. | Apple | FIXED | `packaging/ios/scaffold.sh` writes `ITSAppUsesNonExemptEncryption = NO`. |
| S4 | **iOS app icon** was a hand copy (missed once, in 1.2.4). | Apple | FIXED | The scaffold installs `AppIcon-1024.png` (1024x1024, no alpha). |
| S5 | **iOS launch screen** was Capacitor's white placeholder, which flashed before the dark first paint. | Apple | FIXED | `packaging/ios/Splash-2732.png` (the dark ground and icon, like Android's splash), installed by the scaffold. |
| S6 | **iOS version** was typed by hand. | Apple | FIXED | The scaffold sets the version from `package.json` (1.8.17). The build number stays manual: one higher than the last upload. |
| S7 | **Feature graphic said "entirely offline"**, but the apps use the network for adverts. | Play | FIXED | Now carries your tagline: "Your club. Your legacy. Your time. Build something worth remembering." |
| S8 | **Store listing in six languages.** The description says six languages, but the listing text exists only in English and French (only What's new is in all six). | Both | OWNER decision (D2) | Either translate the listing into es, it, ja and af, or accept English for those markets. |
| S9 | **Landing page says "Coming soon to the App Store"** (`landing/index.html` lines 293 and 367). | Web | OWNER | Flip it on the iOS launch day. |
| S10 | **Edge-to-edge on Android 15 and 16.** With target API 36 the app cannot opt out; the layout relies on CSS safe areas. | Play | OWNER (device) | Check the banner and the bottom bar on an Android 15 or 16 phone. |
| S11 | **Android 16 ignores portrait lock on large screens** (600dp and wider) for apps targeting API 36. | Play | DONE | The game already has landscape and tablet layouts (the 1.8.17 tablet round tested 1180x820). |
| S12 | **Content rights / real names** (Play "third-party content", Apple 5.2.1). Real player and referee names, no badges, kits or logos. | Both | OWNER (legal) | A judgement call already noted in `STORE-DECLARATIONS.md`; take advice if unsure. |
| S13 | **Ruck permission in writing.** | Both | OWNER | Email filed and dated. |
| S14 | **Google Mobile Ads SDK version floats** (`play-services-ads:25.4.+`), so two builds can differ. | Play | OWNER (Android Studio) | Pin it when you next build, and check the release with Play's 16 KB check. |

## 3. Deadlines coming

| Date | What | Status |
|---|---|---|
| 1 Nov 2026 | Play: the last extension date for target API 36 and Billing Library 8 | Already met: target 36 (Capacitor 8.5 default), Billing 8.0.0 |
| 1 Feb 2027 | Play: updates must support 16 KB page sizes | No native code of our own; confirm the AdMob libraries pass Play's check |
| 2027 | Android developer verification goes global | Register the package name and signing key in Play Console |
| April 2027 | Apple: iOS 27 SDK and iOS 15 minimum; launch storyboard required; `UIRequiresFullScreen` stops working | Deployment target is already 15.0; the launch storyboard is kept; iPad allows all orientations |
| 31 Aug 2027 | Play: Billing Library 8 no longer accepted | Move to 9 during 2027 |

## 4. Already in place (checked)

**Identity and build**
- Package and bundle id `com.phaserugbymanager.app`; name "PHASE: Rugby Manager" (20 of 30 characters).
- Version 1.8.17, Play code 56. Code 56 is above every code Play has accepted.
- Android: Capacitor 8.5.0, target and compile SDK 36, min SDK 24, Play Billing 8.0.0, AAB signed in Android Studio with the upload key (kept off the repo).
- iOS: Capacitor 8.5.0, iPhone and iPad, iOS 15.0 minimum, StoreKit 2. Must be archived with Xcode 26 or later (Apple's rule since 28 Apr 2026); check the Xcode version on the Mac before archiving.

**Adverts and consent**
- AdMob live ids, `testing: false`, General content rating.
- AD_ID permission declared (the build fails if it is missing).
- 50 SKAdNetwork ids, GADApplicationIdentifier, NSUserTrackingUsageDescription.
- UMP consent first, then ATT, then adverts (Google's order).
- "Advert privacy choices" in Settings where the law requires it.
- `app-ads.txt` at phaserugbymanager.com.

**Purchases**
- Restore button in the Store ("Restore a previous purchase"), plus a silent restore at start.
- Pending purchases and Ask to Buy handled; every purchase acknowledged; consumables consumed only once applied.
- Prices come from the store at runtime.

**Listing text** (all within limits)

| Field | Length (characters) |
|---|---|
| Short description | 76 of 80 |
| Full description | 3,977 of 4,000 |
| Subtitle | 29 of 30 |
| Promotional text | 164 of 170 |
| Keywords | 96 of 100 |
| What's new 1.8.17 | 237 to 493 of 500, in all six languages |

**Graphics**
- Play icon 512x512.
- Feature graphic 1024x500 with no alpha.
- App Store icon 1024x1024 with no alpha.
- iPhone 6.9-inch screenshots 1290x2796.

**Website**
- Privacy policy (9 Oct, covers AdMob, consent, deletion, contact and the publisher's address).
- Support page (new).
- `app-ads.txt`.
- Google Search Console file.

**Content rating answers** written down: PEGI 3 / Everyone expected; purchases declared; no gambling or loot boxes.

**Game**
- Offline play, no accounts (so no account-deletion duty), no analytics.
- Crash screen and an in-game bug report.
- All CI tests green on main.

## 5. Not needed

- Account deletion (Apple 5.1.1(v)): no accounts.
- Closed test with 12 testers for 14 days: applies to personal Play accounts made after 13 Nov 2023. The app is already in production on Play, so it does not apply to updates.
- A custom EULA: Apple's standard EULA covers it unless you want your own terms.

## Sources

- Play target API: developer.android.com/google/play/requirements/target-sdk (updated 1 Oct 2026)
- Play Billing deadlines: developer.android.com/google/play/billing/deprecation-faq (9 Sep 2026)
- 16 KB pages: developer.android.com/guide/practices/page-sizes (16 Sep 2026)
- Android 16 behaviour changes: developer.android.com/about/versions/16/behavior-changes-16
- Developer verification: developer.android.com/developer-verification/guides (18 Aug 2026)
- AdMob Play data disclosure: developers.google.com/admob/android/privacy/play-data-disclosure
- AdMob Apple data disclosure: developers.google.com/admob/ios/privacy/data-disclosure
- Apple upcoming requirements: developer.apple.com/news/upcoming-requirements/
- Apple screenshot specifications: developer.apple.com/help/app-store-connect/reference/screenshot-specifications
- Apple launch screen: developer.apple.com/documentation/technotes/tn3208 (14 Sep 2026)
- Apple UIRequiresFullScreen: developer.apple.com/documentation/technotes/tn3192 (13 Aug 2026)
- App Review Guidelines 3.1.1 (restore), 4.2, 5.1.2, 5.2.1: developer.apple.com/app-store/review/guidelines/
- Play store listing assets (2:1 rule, tablet sizes): support.google.com/googleplay/android-developer/answer/9866151 (not reachable from this machine; figures confirmed through Google's search snippets)
