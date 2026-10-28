# PHASE: Rugby Manager 1.9.7: release notes

Version 1.9.7, Play versionCode 66. Baseline: 1.9.6, code 65 (confirmed
accepted on the Console: Production and Open testing, 25 Oct 2026). One player
report from the 1.9.6 feedback card (Android, six seasons in, 25 Oct 2026):
"There is no wage room even if I join a different club."

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
