# PHASE: Rugby Manager 1.9.7: release notes

Version 1.9.7, Play versionCode 66. Baseline: 1.9.6, code 65 (confirmed
accepted on the Console: Production and Open testing, 25 Oct 2026). Two player
reports: one from the 1.9.6 feedback card (Android, six seasons in, 25 Oct
2026): "There is no wage room even if I join a different club."; and the
French Pro Manager at Aurillac who reported the adverts and the full squad
fixed in 1.9.6, with three more requests.

## What changed for players

**Wage room**
- The wage budget now moves with the wages. It was set when a career began
  and never changed again, while renewals and signings pushed every club's
  bill up. Five seasons in, most clubs had no room left, so moving club did
  not help.
- Every summer, each club's wage budget is at least its wage bill plus 18%,
  the same headroom a new career starts with. A budget that is already
  higher is kept.
- Taking a new job gives the manager the same headroom at the new club.
- A save from before 1.9.7 gives the manager's own club this headroom once,
  when it loads. It runs once only, so saving and reloading cannot be used
  to get more room. Other clubs catch up at the next summer.

**Back keeps your place**
- Back from a player now returns to the list as you left it: the transfer
  centre keeps its filters, tab and page, Team keeps the tab you were on
  (General Info, Stats and the rest, not the team sheet), and the list is
  scrolled to where you were. Opening a screen from the menu still starts
  clean. Memory only: restarting the game starts every screen fresh.

**Team: the rating on General Info**
- Team > General Info has an ability column (Abl) between position and age,
  sortable. Your own players always show their number.

**Free agents can be scouted**
- A free agent's page now has Shortlist & Scout and the agency's file, the
  same as a player at another club. Since 1.9.6 a free agent's rating was "?"
  until scouted, and there was no way to scout him, so he could only be
  signed blind.

## Measured

`scripts/wageroomprobe.ts` plays five seasons from a new career (seed 7,
Northampton):

| | before | after |
|---|---|---|
| clubs with no wage room, season one | 6 of 113 | 0 of 113 |
| clubs with no wage room, season six | 71 of 113 | 0 of 113 |
| manager moves to a club over its budget | no room (bill £318k/wk, budget £286k/wk) | room (budget £375k/wk) |

## Balance

- A manager who spends right up to the line each season gets 18% more room
  the next summer. The salary cap is checked separately and still applies.
  Not yet measured over a long career.
- AI clubs are unchanged: they sign on their income (aiecon.ts), not on this
  budget.
- No match engine change.

## Tests

- New: `tests/wageroom.test.ts` (the load fix), `scripts/wageroomprobe.ts`
  (five seasons and a job move).
- New: `scripts/visitback.mjs` (browser): Back keeps the transfer filters, the
  Team tab and the scroll; a fresh visit is clean; the ability column fits at
  360px with no "?"; a free agent can be shortlisted. Fails 9 checks on the
  1.9.6 screens.
- `docs/testing.md` and `suite.sh` counted 102 browser harnesses; the list
  holds 105 with this one.
