# PHASE: Rugby Manager 1.9.8: release notes

Version 1.9.8, Play versionCode 67. Baseline: 1.9.7, code 66. Two more
notes from the French Pro Manager at Aurillac, after 1.9.7 (2 Nov 2026).

## What changed for players

**The loan list**
- A player on the loan list now has a road to his page. The loan sheet that
  opens from the list has "Open {name}'s profile", and his page has Shortlist
  & Scout and the agency's file like any other player at a club. Before, a
  row in Loan opened the sheet and nothing else, so he could not be scouted
  or read. Back returns to the loan list, still on Loan, with its filters.

**Back keeps the tab on more screens**
- 1.9.7 kept the tab on Transfers and Team. Now Team Report (Where We Stand,
  Best XV, Depth, Mentoring), the Academy, the Agency, a club's page and
  Tactics keep theirs too: open a player from Depth, press Back, and you are
  on Depth, not Where We Stand.

## Not changed

- No engine, balance or save change.

## Tests

- `scripts/visitback.mjs` gains Team Report's Depth tab and the loan sheet's
  profile link; both fail on the 1.9.7 screens.
