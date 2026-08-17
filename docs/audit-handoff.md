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

- `main` = `f7ad9da`, deployed to Pages, verified green BY SHA.
- Full suite passes 117, 0 failures (default tier). `bash scripts/suite.sh all`
  adds the long tier - note the positional arg, not an env var.
- `memoprobe` and `dialweight` BOTH READ GREEN NOW, AND THAT IS NOT A FIX.
  Neither was touched. The rating change (f7ad9da) moved form, which moved
  results, which reshuffled both probes' samples. dialweight's documented
  problem is that it cannot resolve effects below its own noise floor, and a
  green run is not evidence that it can; memoprobe failed one week in seven on
  one seed, so a clean pass is roughly what chance predicts. Treat Job 1 and
  Job 2 below as still open. If either goes red again, it has not regressed -
  it has been resampled.

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

## A bug class worth knowing: the off-screen reply

Found from live feedback, not from any probe. Four screens shared it.

A button calls an engine function that returns a sentence, and the screen puts
that sentence in ONE banner at the top of the page. On a desktop-sized page you
always see it. On a 412x915 phone, scrolled down to the eighth role card, the
reply renders 786px above your thumb - and if the tap also collapses a list, the
page jumps and nothing you can see has changed. The manager's report was "no
matter what I press he won't sign and no reason". There was always a reason.

Two rules came out of it, both applied in `Training.tsx`:

  KEY THE MESSAGE TO THE THING THAT ASKED, not to the page. `useState('')` for a
  page-wide message is the smell; `useState<{key, text}>` is the fix.

  PUT THE REASON IN FRONT OF THE DECISION, through a predicate BOTH sides read.
  `appointBlock` / `courseBlock` are read by the row (to write the shortfall and
  grey the button) and by the engine (to refuse). A row that offers a button and
  a handler that refuses it is the bug written twice.

`scripts/hireprobe.mjs` guards it, and it measures `getBoundingClientRect`
distance from the tapped button rather than checking the DOM contains the text -
which is the only version of the test that would have failed on the old build.

Still to check by the same method: any other screen where a list is long and the
outcome of a row action is rendered outside that row.

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

## Two feature requests from the user, in priority order

### 1. Continue should serve the desk (asked twice now)

> "when I click continue it doesnt just continue through all unread message and
> force me to respond to press enquiries etc. this should be the central home
> where the game communicates everything and everything should be answered, read
> between games."

This is the same complaint recorded at season.ts ~2617 ("press questions should
be forced to be cleared before each next match"), where the fix was judged too
large: "The hard continue-gate is a bigger rework of every walk flow; what ships
now is the honest half." What shipped was expiry - unanswered questions do not
follow you into the next week, three-week-old stories get filed - which treats
the pile growing and not the actual complaint, which is that the game never makes
you answer anything.

The precedent exists: a transfer bid genuinely blocks Continue (10E). The
mechanism is there; it has never been applied to press or news.

Why it was deferred is a real reason, not an excuse: Continue has several jobs -
advance a day, jump to matchday, step the wizard, handle the Annual - and a gate
has to be right in all of them or you ship a game that looks frozen. That exact
bug happened this session (Continue visible but dead on the Annual, soakui hung
on it). So: one gate, evaluated in one place, with a probe that walks every
Continue path including the Annual and the wizard.

### 2. The board asks what you expect, and it costs you (partly built)

> "think they'll win the league? they get a bit more money but they best win or
> the board will be nervous about their budget. same goes if a manager picks a
> top team and selects fight bravely against relegation then it should be showing
> his lack of expectation and the squad should be more doubtful of their manager."

The pressure half EXISTS (25C): a week-2 press question sets `state.stance` to
high / board / safe, and `boardReaction` reads it on every result all season.
Options carry flat morale effects of +0.5 / +0.1 / -0.2.

Two gaps, both named by the user:

  NO MONEY. Aiming high buys pressure and nothing else. It should come with a
  budget bump, and the board's patience already shortens to pay for it. Measure
  this one: a budget bump with no matching cost is exactly the free lunch the
  kicking dial was, and dialweight cannot currently resolve effects that small.

  THE SQUAD REACTION IS FLAT. -0.2 whether you are at Northampton or a promoted
  side. It should scale with the gap between what you promised and what the
  club's stature implies, so talking it down at a big club reads as a manager who
  does not believe in them, and the same words at a newly-promoted club cost
  nothing. That turns a three-way choice into a read on your own situation, which
  is the shape that makes the referee/physicality decision work.

## OPEN BUG: the desk gate hangs at season rollover (do not ship as-is)

The Continue desk gate (`days.deskBlock`, `store.continueWeek`) does what the
user asked - `scripts/deskgate.mjs` reports 7 failures against the build without
it and none with it - but `scripts/soakui.mjs` will not pass five seasons with it
in place, and the fault is MINE, measured:

| build | result |
|---|---|
| without the gate (502d559) | SOAK UI PASSED, five seasons, 1676 taps |
| with the gate | STUCK: 60 taps without the week moving, "READ (1)" at s5 wk1 |

The baseline is the important row. It was run only after two rounds of patching
had already been spent assuming the stall was pre-existing - the exact mistake
this document warns about two sections above ("treat a red probe as a claim about
the probe until proven otherwise"), applied in reverse: a red probe was treated
as a claim about the CODEBASE when it was a claim about my change.

### Why the "no progress" bound did not save it

`Store.lastDeskN` releases the gate when the unread count comes back UNCHANGED.
That catches a stalled count. It does not catch an OSCILLATING one - if serving
a story causes another to appear or reappear, the count changes every tap while
never reaching zero, and the comparison never fires. The two soak runs reported
`READ (2)` and `READ (1)` at the same week, which is consistent with oscillation
rather than a stuck value.

Note also why week 1 is where it bites, and why an earlier guess that "the gate
cannot be involved, day steps are not gated" was wrong: week 1 is pre-season, so
`nextStep` there is the FRIENDLY - a `match` step - and `deskGates` is true.

### The fix to try, and the order to do it in

1. INSTRUMENT FIRST. Log the unread ids (not just the count) on every gate hold
   at s5 wk1. The question to answer is whether the same story is served
   repeatedly, or a new one keeps arriving. Do not patch before that is known;
   two patches have already been written against a guess.
2. THEN BOUND BY HOLDS, NOT BY SIZE. Replace the count comparison with a hard
   budget: the gate may hold at most N times in one week, counted, reset when the
   week turns. That terminates whatever the cause is, which the size comparison
   provably does not.
3. Re-run `node scripts/soakui.mjs` and require five of five before merging. It
   takes about 13 minutes and it is the only thing that settles it - deskgate
   passing is necessary and nowhere near sufficient.

The work is on `claude/rugby-manager-mobile-app-rk7yz1` and deliberately NOT on
main. `main` is at 502d559, which is what is deployed.
