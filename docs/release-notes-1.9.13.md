# PHASE: Rugby Manager 1.9.13: release notes

**IN PROGRESS, ON HOLD (owner, 14 Nov 2026: "1.9.13 but there may be more to
come have it fixed and on pause").** Do not build or upload until the owner
says it is ready. The store "What's new" text is written when it is.

Version 1.9.13, Play versionCode 72. Baseline: 1.9.12, code 71.

## What changed for players

- **Sheets clear the bottom bar on iPhone.** A bug report from Quins (iPhone,
  Safari, 390x746, 1.9.11): "When you open filters or try to loan a player
  the navigation banner at the bottom blocks search and offer loan button."
  The Transfer Centre's filter and loan sheets were drawn inside the
  screen's scrolling area, and Safari clips a pinned box to the area it sits
  in, so the bottom bar covered Show and Offer. 1.9.12 moved the half-time
  squad sheet to the app's top level for the same reason; now every sheet in
  the game is drawn there (18 in all).

## Not changed

- The match engine, saves and the world: this is a change to where the
  screen draws its sheets.

## Tests

- New: `scripts/sheetroot.mjs` (browser). At 390x746 the filter and loan
  sheets sit at the app root, not inside the scrolling screen, their
  buttons are what a tap lands on, and Escape still closes them. It fails
  on 1.9.12 and passes on 1.9.13.
- Chromium does not clip the way Safari does, so the harness checks the
  structure that prevents the bug. Confirm on an iPhone in Safari before
  release.
