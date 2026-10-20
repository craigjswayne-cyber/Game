# PHASE: Rugby Manager 1.9.3: release notes

Version 1.9.3, Play versionCode 62, iOS MARKETING_VERSION 1.9.3 (from
`package.json`). Baseline: 1.9.2, code 61. Package and bundle id, signing,
product ids and permissions are unchanged. The owner's round of 19 Oct 2026
followed the five-part 1.9.2 review (UI, game, commercial, code, gaps).

## What changed for players

**New fonts** (owner: "BOLD - source serif pro bold with HK grotesk regular")
- Headings, scores and labels in Source Serif 4 Bold (Adobe's current name
  for Source Serif Pro). Everything you read or tap in Hanken Grotesk (the
  current name of HK Grotesk, same foundry). Source Serif 4 Regular ships as
  the third face. Both under the SIL Open Font License, self-hosted.
- The landing page and its share card use the same two faces.

**Menus**
- The short section headings added to the menus in 1.9.2 are gone: each menu
  is one plain list again, with its icons. The order stays as 1.9.2 set it.

**Head injuries only for made-up players**
- A head injury assessment is only ever called for a player the game made
  up. A real player is never led off for one, and a real player who would
  have drawn a concussion gets a hamstring of the same length instead, so
  injury counts and weeks lost are unchanged.

**Asking for a rating**
- After eight competitive matches the phone's own review card (Google Play
  or the App Store) is asked for, once, at a quiet moment on Home or the day
  room. Never during a match, over a card or after a purchase. The store
  decides whether it shows; the game never asks again.

**Social**
- TikTok and Instagram (@phaserugbymanager) on the About page and the
  landing page's footer. The landing page has a 1200x630 share card, with
  full Open Graph and Twitter tags, so a link pasted into a chat or a post
  shows a proper preview.

**Smaller**
- Full time: the VICTORY / DEFEAT stamp sits in the top third and clears in
  two seconds, so it no longer covers the score or "Continue to Results". The
  score is not repeated under it unless a tie-break decided the match.
- Team talk: the summary says "steady" for the players who read "Ready to
  go", instead of "unmoved".
- Twelve English labels in sentence case ("Scout the market", "This week's
  results", "Full-time round-up" and others), as 1.9.2 started.

## Fixes found in the review

- **Saves.** The first save of each session also keeps a spare copy of the
  career. If the main record ever cannot be read, the game loads the spare
  instead of showing an empty slot, and the unreadable record is set aside
  rather than overwritten. The game also asks the browser not to evict its
  storage under disk pressure.
- **Crash log.** The last six errors now survive a reload (they were wiped by
  the crash screen's own Reload button), so a bug report sent after a crash
  carries the crash. Kept for a fortnight, on the device only.
- **Build.** The offline cache stamp fails the build loudly if it cannot find
  sw.js, instead of shipping an empty offline cache.
- **CI.** Node 22 in every workflow (Node 20 reached end of life in April
  2026). The Gate runs once per pull request instead of twice.
- **Notices.** Third-party notices list Capacitor, the AdMob plugin and the
  new fonts, and give zustand's real version.
- **Docs.** Losing `android.keystore` is recoverable through Play's upload key
  reset (Play App Signing is on); the launch programme said otherwise.

## Native shells

- `PhaseBilling.review()` on both platforms: Play In-App Review 2.0.2 on
  Android (pinned in `packaging/android/version.json` as `reviewLibrary`,
  added to app/build.gradle by scaffold.sh) and `AppStore.requestReview`
  (StoreKit, iOS 16+, with the older call below that) on iOS. Re-run
  `./scaffold.sh` so the new Java file and the Gradle line are in the shell.
  A shell from before 1.9.3 simply never asks.

## Balance

Fingerprint rebaselined for the HIA change (two of six fixed-seed matches
re-deal). Band check, four worlds, 9,336 league games, before and after:
49.3 -> 49.5 points, 6.45 -> 6.48 tries, 54.7% -> 54.4% home wins,
1.6% -> 2.0% draws, 7.9% -> 8.4% blowouts. Every band holds.
