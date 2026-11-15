# PHASE: Rugby Manager 1.9.14: release notes

**IN PROGRESS.** Started 15 Nov 2026 from social feedback ("maybe make players
more affordable") and the owner's condition: keep the challenge.

## What changed for players

- **Within my budget.** A new transfer filter shows only players whose
  asking price fits your transfer budget. Transfers only; loans have their
  own terms.
- **Players in the last year of their contract cost a quarter less**, for
  every club, AI clubs included. As in real rugby, a club would rather take a
  fee now than lose the player for nothing in the summer. Wages, the salary
  cap, whether the player wants to come, and rival bids all still apply.

## Measured before it was kept

`scripts/contractendprobe.ts`: two careers (Quins, Leicester), four seasons
each, three leagues (Premiership, Top 14, URC), against 1.9.13's prices.

| | 1.9.13 | half price (rejected) | a quarter off (kept) |
|---|---|---|---|
| clubs' strength drifting apart (rating points) | 0.86 | 0.34 | 0.00 |
| different champions in 8 seasons (Prem, Top 14, URC) | 6, 4, 3 | 5, 3, 5 | 6, 3, 5 |
| most of the better players a club could afford | 28% | 56% | 34% |

Half price kept the leagues competitive but doubled what a manager could
afford, which is the challenge going. A quarter off eases the market a little
and changes nothing else. The probe holds those bounds (drift 0.9, titles one
season in three, affordable 35%) and runs with the slow, weekly set.

## Tests

- New: `scripts/contractendprobe.ts` (slow set), `scripts/ui1914.mjs`
  (Within my budget narrows the market, is counted, resets, and is not offered
  for loans).
