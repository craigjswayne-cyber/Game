# PHASE: Rugby Manager 1.9.4: release notes

Version 1.9.4, Play versionCode 63. Baseline: 1.9.3, code 62. The owner's
round of 20 Oct 2026, from a device test of 1.9.3.

## What changed for players

**Type**
- The screen title in the bar at the top ("Northampton RFC", "Job Centre",
  "Match Day") and the PHASE RUGBY MANAGER wordmark on the title screen are
  in bold Space Grotesk.
- Home tiles: the line under each label ("Aidan Pugh: a flying month", "Not
  convinced", "70%") is in the text face; the small label above keeps the
  serif.

**Home**
- Today, Needs your decision: the answers to a question sit one under
  another, full width, in the same style.

**Match day**
- The team sheet before kick-off shows names and fitness only; ratings stay
  on the Team tab's Starting XV.

**Careers**
- The Job Centre says "They sacked you: unlikely" for a club that sacked you,
  instead of counting the weeks. The wait still holds, so the old job cannot
  simply be taken straight back.
- The sacking sheet's three answers sit close together.

**Adverts and reviews**
- Google's advert consent form is asked for as soon as the app has loaded on
  first launch, instead of waiting for the first advert. A returning player
  who already answered sees nothing.
- The store review card is asked for after 8 competitive matches, again 30
  matches later and once more 60 after that, never more. Google shows it only
  to a build installed from Google Play, so a test install from Android Studio
  never sees it.

## Testing

tsc -b, eslint, cssaudit, unit tests (review ask schedule), the browser
harnesses touching the changed screens, on the production build.
