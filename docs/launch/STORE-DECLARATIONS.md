# Store declarations checklist (1.8.16)

The release hardening pass could not check these from the repository: they live
in Play Console and App Store Connect. This is the list to tick there before the
1.8.16 build goes to production. Each line says what the build actually does,
so an answer can be checked against it.

Re-checked against the code on 9 October 2026 (release-readiness round after
1.8.16). The boxes below are console tasks: none of them can be ticked from the
repository, and none is marked done without the owner's confirmation.

## What the build does (facts from the repo)

- **Adverts:** Google AdMob through `@capacitor-community/admob` 8.1.0, in the
  Android and iOS shells only. One banner at the foot of seven screens
  (`AD_PLACES` in `src/game/monetise.ts`: Home, the day's schedule, results,
  the live match's highlights, news, the press room, finances), optional
  rewarded spots, `maxAdContentRating: 'General'`, live ids (`testing: false`
  in `packaging/shell/ads.json`). Pro Manager (`phase.supporter`) removes the
  banners. The ad bridge lives only in the shells (`packaging/android/package.json`,
  `packaging/shell/ads.json`). The web game has no adverts and makes no
  network calls (`scripts/netprobe.ts` enforces this).
- **Advertising ID:** the AdMob SDK adds the `com.google.android.gms.permission.AD_ID`
  permission on Android and reads the advertising identifier.
- **Consent:** Google's consent SDK (UMP) is used; where it says a privacy
  choice is required, Settings shows a way back into it (`src/ui/screens/Settings.tsx`).
- **Purchases:** Play Billing and StoreKit through `PhaseBilling`
  (`packaging/android/PhaseBilling.java`, `packaging/ios/PhaseBilling.swift`).
  No loot boxes, no randomised purchases, no cash-out.
- **Game data:** careers and settings stay on the device (IndexedDB and local
  storage). No accounts, no analytics, no crash reporting.
- **Feedback report:** the player sends it themselves by email or copy and
  paste. The game does not transmit it.
- **Real names:** real club, player and referee names, with the unofficial
  statement in the game (`about.unofficialBody`), the privacy policy and the
  store description.

## Google Play Console: App content

- [ ] **Ads:** "Yes, my app contains ads".
- [ ] **Advertising ID:** Yes, the app uses an advertising ID. Purpose:
      Advertising or marketing.
- [ ] **Data safety:** use the table in `docs/ADS-STEP-BY-STEP.md`, Step 7
      (Device or other IDs: collected and shared, for advertising, users can
      choose). Ignore the older "No" table at the top of the Data safety
      section in `docs/store-listing.md`: it describes the build before adverts.
- [ ] **Content rating (IARC):** answers as in `docs/store-listing.md`
      ("Play Content rating"). Digital purchases: **Yes**. Users can interact:
      No. Expected result PEGI 3 / Everyone. If the questionnaire asks about
      adverts, answer Yes.
- [ ] **Target audience:** 13 and over is the safe choice for an app with
      personalised adverts. Choosing under-13 age groups brings the Families
      policy and its advert restrictions into play.
- [ ] **Privacy policy URL:** `https://phaserugbymanager.com/privacy.html`
      (open it once and confirm it loads and mentions AdMob).
- [ ] **Financial features, health, government, news:** all No.

## Apple App Store Connect

- [ ] **App Privacy:** Identifiers (Device ID) for Third-Party Advertising,
      linked, used for tracking; Usage Data (Advertising Data) for Third-Party
      Advertising. Table in `docs/ADS-STEP-BY-STEP.md`, Step 7.
- [ ] **App Tracking Transparency:** the iOS build shows the tracking prompt
      before personalised adverts. Confirm on a device that it appears once.
- [ ] **Age rating:** 4+ questionnaire as in `docs/store-listing.md`, with
      In-App Purchases ticked.
- [ ] **Export compliance:** No non-exempt encryption.

## Real names next to the disclaimer: your decision

- [ ] Read the unofficial statement in the store description and in the game
      (menu, About & legal) and confirm it is the wording you want.
- [ ] Play's **Content rights** question ("Does your app contain, show or
      access third-party content?"): `docs/store-listing.md` answers "Does not
      contain third-party content". The game shows real player and referee
      names, so this answer is a judgement call. Decide whether to answer Yes
      and say the names are factual sporting data used without logos or kits.
      This is a legal question; take advice if unsure.

## On the day

- [ ] Play: version code 55, version name 1.8.16 (`packaging/android/version.json`).
- [ ] App Store: version 1.8.16, build number one higher than the last build in
      TestFlight (Xcode does not track it; check App Store Connect).
- [ ] iOS archive built with `./scaffold.sh` as the last step, not a bare
      `cap sync` (which strips the advert bridge). Before archiving, the Xcode
      console filtered on `phase-ads` must show `bridge loaded for ios`.
- [ ] Release notes: short, no tips.
- [ ] After upload, open the pre-launch report and check it found no crash.
