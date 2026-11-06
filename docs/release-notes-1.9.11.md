# PHASE: Rugby Manager 1.9.11: release notes

Version 1.9.11, Play versionCode 70. Baseline: 1.9.10, code 69. The owner's
round of 6 Nov 2026: the App Store approved 1.9.6, so both stores move to the
same version.

## What changed for players

- Android and iPhone are on the same version. iPhone players coming from
  1.9.6 get everything in 1.9.7 to 1.9.10: position retraining, the training
  load, the multi-attribute transfer search, ratings by position, the wage
  budget that moves with the wages, Back that keeps your place, the loan list
  that opens a player's page, and free agents who can be scouted.
- Every line added in 1.9.7 to 1.9.10 has been checked in the women's game and
  reads right for every player (the gender-neutral pass, #89).

## Store and website

- The website's App Store badge links to the live listing,
  `https://apps.apple.com/app/phase-rugby-manager/id6826581592`. It said
  "Coming soon". `scripts/landingprobe.ts` now holds the link and fails if any
  store button says coming soon.
- The App Store promotional text repeated the description's first two
  paragraphs almost word for word, and the store shows it directly above
  them. It now says what is new.
- The App Store description said three things twice ("Release a player",
  "offline, no account", and something that "remembers"). Each is now said
  once. The repeated "Release a player" bullet is gone from the Play
  description too. Both are in `docs/store-listing.md`.

## Before uploading

- Play: confirm 69 (1.9.10) is the highest accepted code on the Console, or
  use one more than the highest.
- App Store: set the build number in Xcode one higher than the 1.9.6 upload.
  Paste the new description and What's new with the 1.9.11 version; the
  promotional text can be changed now, without a build.
