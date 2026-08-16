# Release audit: where it got to, and what to do next

Written at the end of the audit session that shipped `0bdf344`. Read this before
picking up the remaining work; it will save you rediscovering the same things.

## The headline finding

**Seven suite failures were investigated. Seven were the probe. Zero were the
engine.**

| probe | claimed | actually |
|---|---|---|
| auditprobe | a player scored from inside the sin bin | bin is `[from, from+10)`, the check used `<=`, so it counted his first legal minute back |
| benchprobe | a bomb squad pays out while sitting | an injury put one man on; the payout is proportional and was exactly right |
| dataaudit | 78 duplicate players | 37 pairs of different men sharing a name, 2 genuine double-listings |
| analystprobe | the analyst is 18 points more accurate than advertised | 39 draws against a +/-18 band; the roll is 57.97% over 80,000 draws |
| dialweight (v1) | kicking worth +11 league points | league points is a step function; the estimator's error bar was bigger than most effects |
| wireprobe | (earlier) three seasons of news | the log is trimmed weekly, so it read 34 weeks |
| geosweep (v1) | 26 sideways overflows | all 26 were deliberate swipeable tab strips |

The sin-bin one was escalated to the user as a release blocker. It was one
character. **Treat a red probe as a claim about the probe until proven
otherwise**, especially one that goes red after a deliberate engine change.

The tell in every case: a number moved that could not have moved, or a failure
rate too low to be a broken invariant.

## Current state

- `main` = `0bdf344`, deployed to Pages, verified green BY SHA.
- Full suite (`bash scripts/suite.sh all` - note the positional arg, not an env
  var) passes 115 including the long tier: soakhealth, soakui, stresstest,
  deepsave, e2edeep.
- Two known red, both understood, neither a game defect:
  - `memoprobe` - see below, half-diagnosed
  - `dialweight` - the sampling limit, see below

## Health numbers, four seeds, ~3,900 matches (scripts/bandcheck.ts)

54.4 points a game, 6.41 tries, 53.7% home wins, 2.1% draws, 7.4% blowouts.
Twenty seasons: save 7.2 -> 8.1MB and flattening, fee medians 2.40 / 3.20 / 2.90
/ 3.00M by era, user ends on 7.4M against an AI median of 13.7M.

## Job 1: settle memoprobe (small)

A board memo's league position disagrees with the table, one week in seven.
Evidence already gathered on seed 3:

```
wk10  memo 4 | before 4 | after 4   ok
wk16  memo 2 | before 3 | after 2   matches after
wk22  memo 3 | before 3 | after 3   ok
wk28  memo 5 | before 4 | after 5   matches after
wk34  memo 4 | before 4 | after 4   ok
wk39  memo 4 | before 5 | after 5   MATCHES NEITHER
wk40  memo 4 | before 5 | after 4   matches after
```

Six of seven match the end-of-week table, so `boardMemo` normally reads it after
results settle. The wk39 case matches neither, which means it read the table at
a moment inside `processWeekAndAdvance` that an outside observer cannot see.

Next: trace what happens between `boardMemo(state)` (season.ts ~2545) and the
end of that function. If the table can still move after the memo is written, the
memo is quoting a real position that later became stale, and the probe should
capture the position at write time rather than after the call. If nothing moves
it, it is a genuine bug in the memo.

Cosmetic either way: a memo saying 4th when you are 5th.

## Job 2: make the dial measurement trustworthy (the important one)

`scripts/dialweight.ts` measures what each tactical slider is worth. It cannot
currently resolve effects smaller than about two points a match, and that is not
good enough to say whether the tactics screen is balanced.

The proof it is underpowered: across three runs, `style` - which no edit touched
- measured **+5.16, then +2.09, then -0.10**. Three calibrations of the
aggression dial were made against numbers with that much slop before the pattern
was spotted, and all three were reverted.

What is already known and solid:
- kicking's free lunch is gone (it now costs attack and breakdown)
- physicality reads the referee, and the SLOPE is well resolved:
  +4.34 a match against a lenient whistle, +0.37 against a fussy one, n=741

What is NOT known:
- how big style and tempo really are. Both measure large at Northampton, but
  philosophy.ts pairs clubs to squad shape, so "expansive beats forward-led" at a
  backs club may be a squad read rather than a dominant strategy.
- whether the physicality split straddles zero (right in one case, wrong in the
  other) or merely slopes. The probe reports this and deliberately does not
  assert it.

Two things to do, in order:

1. **More sample.** Currently 8 seeds x 2 seasons per arm = 16 observations.
   Needs several times that. Consider measuring at match level with paired runs
   rather than at season level, which would cut variance far more cheaply than
   simply running more seasons.
2. **Two contrasting clubs.** Run the same sweep at a forward-heavy club as well
   as Northampton and assert that no dial wins in the SAME direction at both.
   That is the real dominant-strategy test and it has never been run.

## Job 3: audit the probes themselves

Seven for seven is a pattern. Go through `scripts/` asking of each one: does this
measure what its name says? Specific smells to look for, all of which were found
tonight:

- absolute assertions where only a difference is meaningful (benchprobe)
- boundary conditions at `<=` vs `<` (auditprobe)
- a yardstick snapshotted once and compared against many samples (analystprobe)
- a fixed band with no relation to the sample's noise floor (analystprobe,
  dialweight)
- collecting from a log that is trimmed underneath you (wireprobe)
- comparing strings where the thing you care about is identity (dataaudit)

## Job 4: Pass 9 of the audit

Untouched. "What would a hostile reviewer open first, and what has nobody ever
looked at." The audit prompt is in `docs/release-audit-prompt.md`.

## Conventions worth knowing

- Full suite: `bash scripts/suite.sh all`. Without `all` it silently skips the
  five long probes, and the skip line is easy to miss.
- Never rebuild `dist` or edit `src`/`scripts` while a suite runs.
- Every fix ships with a probe demonstrated to fail on the old code, via a git
  worktree at HEAD with `ln -sfn /home/user/Game/node_modules`.
- Deploy verification: match the SHA. `list_workflow_runs` with a branch filter
  returned runs from months ago that said "success", which would have been
  reported as a green deploy of tonight's build.
