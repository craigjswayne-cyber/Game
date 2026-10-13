# PHASE: Rugby Manager 1.9.0: release notes

Version 1.9.0, Play versionCode 58 (subject to the Console check below),
iOS MARKETING_VERSION 1.9.0 (from `package.json`). Baseline: 1.8.18, code 57.
Package and bundle id, signing, product ids and permissions are unchanged.
No new SDK or plugin. Google Mobile Ads SDK stays pinned at 25.4.0.

## What changed for players

**Purchases**
- A consumable (heal, board funding, estate work) bought while the store
  connection drops is credited once. Before, a failed consume followed by a
  store that could not be reached was read as a spent receipt: one payment
  could become two credits. (`src/game/monetise.ts` heldOf/bankOnce,
  `scripts/moneyprobe.ts` 12d2, which fails on 1.8.18.)
- iOS: a purchase that completes after the game stopped waiting (90 s) unlocks
  at once instead of on the next return to the app; a refunded consumable is
  never credited. (`packaging/ios/PhaseBilling.swift`; not compiled here.)

**Saves**
- Importing a second save file no longer replaces the first imported career.
  Imports take the next free name (imported, imported-2, ...), listed under
  Other Saves, and the career on screen is saved first. (`exportui`, which
  fails on 1.8.18.)
- A phone that runs out of space now shows the save-failed banner. Before,
  the write aborted without an error, the save queue waited for ever and
  autosave stopped for the session in silence. (`src/game/save.ts` onabort.)
- In a browser, Export no longer cancels its own download in some WebKit and
  Firefox builds.

**The board**
- A big club's board reads the early table more gently: the week-12 review is
  at half weight, and no review moves confidence more than 40% of the way to
  its target. A manager doing the job at a title favourite was in crisis in
  8 seasons of 36; now 5. The sleepwalker is judged as hard as before (17 of
  36), small clubs are untouched, and match results are unchanged
  (fingerprint and bandcheck identical).

**Feedback report**
- Offered once after the first finished season instead of after four weeks,
  so the report has a season of use in it. It gains a "finished" line.

## What changed in the test suite

- Twenty harnesses with a pass/fail verdict were in no suite list and had not
  run since they were written. They now run in the browser half. Four had
  gone stale against 1.8.16's deliberate changes (temperui, roomui,
  hlliveprobe, screensave) and were brought up to date. proprompt, already in
  the suite, failed whenever its drive got the manager sacked; it now holds
  the board the way annualprobe does. None of the five was a fault in the game.
- New coverage: double credit after a store dropout; export then import of a
  Unicode career compared field by field; a second import; an export that
  fails part way.

## Known and deferred (not release blockers)

- A consumable that was bought and not yet used is kept in this phone's
  storage, so a reinstall loses it (Pro and other permanent purchases do
  restore). `public/support.html` now says so. Proper fix: spend the receipt
  only when the effect is applied. Deferred to after launch.
- The Offers screen bug reported by a player on 13 Oct (Accept did not arm
  "Confirm sale") was not reproduced: tapping Accept then Confirm works in a
  touch-emulated phone at the same size, on all four skins, as Pro, with an
  "Already Asked" bid. Waiting on the player's save file and device details.
- `perfprobe` misses its 200 ms week budget about one run in three on this
  container (184 to 221 ms); 1.8.17 times the same here (186 v 184 ms mean),
  so it is the machine, not a regression.
- Saves carry no version number; old and newer files are healed field by
  field (savefuzz, migratetest).
- Save time on a budget Android late in a long career is still unmeasured.

## Before upload (owner)

See `docs/launch/STORE-READINESS-CHECKLIST.md` and the device record in
`docs/launch/LAUNCH-PROGRAMME.md` section 10. In short:
1. Play Console: confirm 57 is the highest accepted versionCode. If anything
   higher was uploaded, set `packaging/android/version.json` to one more.
2. Build with `packaging/android/scaffold.sh`, sign with the upload key, run
   Play's pre-launch report and 16 KB check.
3. Run the device record on a Samsung (Back script, safe areas, purchases,
   export and import, reopen) and fill in each line.
4. Paste the six What's new texts from `docs/store-listing.md`.
