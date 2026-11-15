# PHASE: Rugby Manager 1.9.14: release notes

**IN PROGRESS (owner, 15 Nov 2026: "Work on it now but dont merge and ill
keep adding to it").** Version and versionCode are raised when the round is
closed, not before.

## What changed for players

- **A season plan, every pre-season.** Player feedback: "Be good have a
  preseason focus choose how you will play that season & practice set play".
  A card on Home in the pre-season weeks asks three things at once: how we
  play (attack and defence style), the set plays to drill (the lineout and
  scrum calls, each marked drilled or not yet, with Set-Piece Work to drill
  them faster), and the training focus for the opening weeks. Set the plan and
  each choice goes where its own screen already reads it (Tactics, the
  playbook, Training, match prep), so it can still be changed there later; the
  card folds to one line with Change, and is gone once the season starts. It
  adds no rule of its own: a club planned this way plays exactly like one set
  up by hand the same way.

## Not changed

- The match engine and the world: the plan only writes settings that already
  existed.

## Tests

- New: `tests/preseasonplan.test.ts`, `scripts/preplanui.mjs` (browser: the
  card in week 1, every choice at least 44px, each choice lands on its screen,
  the card folds and is gone in the season).

## Still to come in this round

- The Xcode warnings (29): the AdMob and Filesystem plugin upgrades, tested
  against the adverts.
- Whatever the owner adds.
