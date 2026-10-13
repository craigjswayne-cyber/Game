# PHASE: Rugby Manager 1.9.0: release notes

Version 1.9.0, Play versionCode 58 (subject to the Console check below),
iOS MARKETING_VERSION 1.9.0 (from `package.json`). Baseline: 1.8.18, code 57.
Package and bundle id, signing, product ids and permissions are unchanged.
No new SDK or plugin. Google Mobile Ads SDK stays pinned at 25.4.0.

## What changed for players

**The match** (engine change; fingerprint rebaselined with its reason)
- Scrums and lineouts are contested every time instead of being estimated
  after the match (`setPieceContest`). The scrum reads the two packs, how fresh
  each front row is and the referee; the lineout the throw and the jumpers
  against the contest, worse in the wet. Clean, scrappy and stolen ball move
  the try chance; the scrum's real penalties replace the old unit ratio.
  Ordinary packs keep 89-90% of their own scrums, a dominant one 91%, a
  beaten one 85%; a spent front row 83% against 87% fresh (`packprobe`,
  `statsprobe`).
- Players tire by their position's work (`roleDrain`): the front row pays for
  every scrum and ends a match at 23 energy against the wings' 37. A side's
  average tiredness is unchanged (53.8 and 32.4 against 54.3 and 32.5 on the
  old engine), and bandcheck holds: 49.5 points, 6.48 tries, 53.7% home wins,
  2.1% draws, 8.0% blowouts (was 49.7, 6.49, 54.7%, 1.6%, 8.6%).
- Commentary no longer repeats a line inside twelve (0.66% of 31,446 drawn
  lines), and a try's words fit the moment: a late try in a close game, a try
  off the bench, a second try, a signature trait's own lines (`commvoiceprobe`).
  New lines in six languages. The match stream does not move for it.

**Screens**
- The match menu's line-ups are live telemetry: all 23 in 24 px rows under
  the scoreboard, with energy bars by unit, ratings and card, HIA and injury
  flags, and the opposition's 23 a tap away (`telemetryui`).
- Home leads with one hero card (the next decision and the match); the rest
  are compact tiles going where they always went.
- The player page names each man's signature trait and personality with what
  each does, hidden for other clubs until scouted, and the attributes read in
  four honest groups: Set piece & contact, Skills, Physical, Mental
  (`traitcard`). The 1-100 figures keep their fixed per-player fifth (37 or
  86), by the owner's choice.

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
