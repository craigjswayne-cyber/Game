# PHASE: Rugby Manager 1.9.0: release report

13 October 2026. Branch `ccr-ace3495e-5psx37`.

## Verdict: NOT READY FOR RELEASE

The repository side is a release candidate: every automated gate passes or
has a measured, written-down reason, and no known P0 or P1 defect is open in
the code. It is not ready to ship because the mandatory checks that only a
person with a phone and the consoles can do have no evidence yet (section 5
and 6). Do those, record them in the device table, and it is a GO.

## 1. The candidate

| | |
|---|---|
| Commit | the tip of `ccr-ace3495e-5psx37` (this file's own commit; game code identical to `4ad8ae5`, the commit the full regression ran on; later commits change test harnesses only) |
| Version name | 1.9.0 (`package.json`; Android and iOS shells read it) |
| Play versionCode | 58 (`packaging/android/version.json`). 57 (1.8.18) is confirmed accepted: available to testers, 13 Oct 2026 (owner) |
| Package / bundle id | `com.phaserugbymanager.app`, unchanged |
| Products, permissions, signing | unchanged; no new SDK or plugin |
| Ads SDK | `play-services-ads` pinned at 25.4.0 (`scaffold.sh`) |
| Store art | regenerated from the final build, showing the new Home (`storeart/`, gitignored): Play phone 1080x1920, tablets 1200x1920 and 1600x2560, iPhone 1290x2796, iPad 2048x2732, feature graphic 1024x500, App Store icon 1024x1024 opaque |

## 2. What is in it

Full list: `docs/release-notes-1.9.0.md`. In short:

- **Match engine:** scrums and lineouts contested every time; fatigue by
  position; a fresh front row off the bench matters. Fingerprint
  rebaselined with its reason; bandcheck 49.5 pts, 6.48 tries, 53.7% home,
  2.1% draws, 8.0% blowouts (all bands hold).
- **Commentary:** no repeats inside twelve lines; tries worded for the moment
  and the scorer's trait; new lines in six languages.
- **Screens:** live 23-man telemetry in the match menu; Home with one hero
  card; the player page names trait and personality, attributes in four
  groups (the 37/86 figures kept, owner's choice).
- **Big clubs:** the early-season board reads the table more gently.
- **Fixes:** a consumable credited twice after a store dropout (Android);
  importing a second save replaced the first imported career; a full phone
  stopped autosave silently; iOS late purchase and refunded consumable
  (Swift, not compiled here); the feedback report waits for a finished
  season.
- **Test suite:** twenty verdict harnesses that were in no list now run; new
  probes for every change above.

## 3. Tests on the candidate

| Check | Result |
|---|---|
| Typecheck, build, textlint, tokenlint, cssaudit, i18nprobe, langparity, frenchprobe, ipprobe | pass |
| Engine suite (`suite.sh fast`, 274 probes, two shards) | 273 pass; **perfprobe** failed its 200 ms budget, re-set to 215 ms (see below) |
| Browser suite (`suite.sh browser`, 100 harnesses) | 98 pass; countryui and temperui failed on stale selectors (the new Home tile and the Character card), fixed in harness only, both pass |
| Soaks (`suite.sh all` long list, 12) | 11 pass; **aiecon** failed its mean-economy reference and was re-referenced after a paired test cleared the engine (+0.012M a club a season, one standard error); confirming run on the tip: **AI ECON PASSED** (median 0.28M, mean 0.32M a season) |
| fingerprint | rebaselined once, in the engine commit, with bandcheck before and after in the file |

**perfprobe** times a week's settle. The engine change costs 5 to 8% a
match (both engines in one process on the same 400 fixtures, alternating:
5.7 to 7.0 ms against 1.8.18's 5.3 to 6.6 ms), because every scrum and
lineout is now played and a spent front row comes off sooner. GitHub's
runners read 202.9 and 206.2 ms against the 200 ms budget where 1.8.18
passed. An earlier reading here (new engine faster) was this container's
noise and is withdrawn. The new code was trimmed (one pass for the legs, no
per-tick arrays; fingerprint unchanged) and the budget re-set to 215 ms by
the owner's decision, with the measurement in the file. It still catches a
1.5x regression. A budget-Android timing is still owed (testing.md).

Skipped: nothing in the suites. Reporters with no verdict (analysis,
boardprobe and the like) are listed by suite.sh as skipped, as always.

## 4. Saves and determinism

- Save format unchanged: no field removed; a few optional fields added to the
  in-match state (the set-piece counts and the commentary's memory), all
  absent-safe, so a match begun on 1.8.18 and resumed on 1.9.0 has its
  set-piece figures estimated the old way. savefuzz,
  migratetest, cloneprobe, importprobe, resumeprobe, reloadprobe, savequeue,
  backupreach and exportui (a Unicode career exported and imported back field
  for field, a second import in its own slot) all pass.
- Watching a match still never changes it (detailprobe, 120 fixtures).
  Commentary has its own dice; the simulation stream moved only in the
  set-piece commit, by design, with the reason in fingerprint.ts.

## 5. Physical-device tests

**None done. Every line is NOT VERIFIED.** The table to fill is in
`docs/launch/LAUNCH-PROGRAMME.md` section 10: Samsung Back script, Android
15/16 safe areas, a new career to week 2, buy / cancel / pending / restore
after reinstall, Pro removing the banner, export to the share sheet and
import (two files, both kept), closing and reopening into the same career.
A consumable bought with the connection dropping (one credit) is worth adding.

iOS is separate: the two Swift changes need an Xcode build and a StoreKit
test; Apple enrolment is still pending, so iOS does not hold Android up.

## 6. Owner actions before upload

1. Play Console: DONE for 57 (1.8.18 is available to testers, 13 Oct). Before
   building, check nothing above 57 went to another track since.
2. Run the device table on a Samsung with the signed release build.
3. Data safety: re-answer the AdMob questions (readiness checklist B1).
4. EU trader declaration (B9) and the content-rights / real-names answer
   (S12), if not done.
5. Ruck permission in writing (S13).
6. Paste the six What's new texts; upload the regenerated screenshots.
7. The player's save file for the Offers "Confirm sale" report (not
   reproduced here).

## 7. Risks and deferred

- **Biggest risk: the engine change has had no human play-test.** Bands,
  balance and 386 harnesses hold, but how a season feels with contested set
  pieces is untested by a person. Play two or three seasons before rolling
  out past 20%.
- A bought-but-unused consumable is lost on reinstall (disclosed on the
  support page; fix deferred).
- Saves carry no version number. Save time on a budget phone unmeasured.
- Deferred: the security list (mostly not applicable: no server), more
  set-piece words, a drag-and-drop team sheet on tablet.
