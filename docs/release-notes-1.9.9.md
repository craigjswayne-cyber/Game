# PHASE: Rugby Manager 1.9.9: release notes

Version 1.9.9, Play versionCode 68. Baseline: 1.9.8, code 67. Three more
ideas from the French Pro Manager at Aurillac (3 Nov 2026), and the fix that
turned the Gate green again after 1.9.7 and 1.9.8.

## What changed for players

**Transfer search: several attributes, out of 100**
- The filter has a tick box for every attribute, grouped as on the player's
  page (Set piece, Skills, Physical, Mental), and one minimum: 40+ to 90+.
  A player must reach it on every attribute ticked.
- The minimum is now on the same 1 to 100 scale as the player's page (it was
  8+ to 18+ on the internal 20 scale). It compares the number his page
  prints, so a man the scouts only half know is judged on their reading.

**A player's rating at each position**
- The Attributes tab shows "By position": his rating in his own shirt and in
  each one he can sensibly play, best first, using the same figure as the
  team sheet. A flanker of 83 reads 66 at lock and at number 8. Positions
  outside his family are left off. Another club's player shows "?" until he
  has been scouted, like his main rating.

**The physio signs the fatigue warning**
- The card on Tactics that warns about a dial kept at an extreme used to come
  from a "conditioning coach" who is not on the staff. It now comes from your
  physio, by name ("Physio {name} wants a word"), or "Head Physio" while the
  post is empty.

**Team > General Info on small phones**
- Under 360px wide the nationality flag column gives way, so the name, the
  fitness ring and (C) fit beside the 1.9.7 rating column. 360px and up is
  unchanged.

## Not changed

- No engine, balance or save change. The pre-season (a longer build-up,
  chosen friendlies, fitness programmes) was asked for and is not planned:
  a first season should get a new manager into matches.

## For the build

- The Gate (the full browser list on `main`) had been red since 1.9.7, and
  GitHub Pages only deploys on a green Gate, so the website stayed on 1.9.6.
  `loannameui` (the 320px squeeze) and `loanlistui` (a second ghost button in
  the loan sheet) are fixed here.

## Tests

- `scripts/visitback.mjs` gains: the filter's minimum is out of 100, ticks
  narrow the list, survive reopening and reset; a flanker's By position row;
  the fatigue warning names the physio.
