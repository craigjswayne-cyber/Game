# Release audit: where it got to, and what to do next

Last updated at the end of the session that shipped the 106-3 batch (subs
sheet, garbage time, rating tail, the war chest, memoprobe's root cause and
the CRN dialweight). Read this before picking up the remaining work.

## The headline lesson, still undefeated

**Treat a red probe as a claim about the probe until proven otherwise.** The
score now stands at eight probe bugs to one engine character (the sin-bin
`<=`). The newest entry is the best one: memoprobe's "one week in seven on
one seed" was the probe detecting memos BY COUNT while the news log was
trimmed underneath it - a trim moved the length, the probe re-read a
five-week-old memo against today's table, and the memo had been honest all
along. The stamp built to test the previous hypothesis (quotedPos on the
news item) disproved that hypothesis in one run. Instrument before you
diagnose; the instrument will usually convict the yardstick.

The tells, all seen in the wild: a number that moved when it could not have,
a failure rate too low for a broken invariant, a yardstick snapshotted once
and compared against many samples, a fixed band with no relation to the
sample's noise floor, detection by aggregate (length, count) over a log that
is trimmed or resampled, boundary `<=` against `<`.

## Current state

- All work committed on claude/rugby-manager-mobile-app-rk7yz1-m54m3g;
  merge to main and Pages deploy verified BY SHA (see the standing rules -
  a branch-filtered workflow query returns months-old greens).
- Suite: full `bash scripts/suite.sh all` run this session - see the session
  log for the verdict. New probes in the engine tier: sheetlock, blowprobe,
  stanceprobe. stancecheck is a REPORTER (measurement, no verdict).
- Health numbers moved ON PURPOSE this session: garbage-time compression
  costs the world ~1.2 pts a game, all of it in already-decided matches.
  bandcheck pool now reads 53.2 pts (band 52-56), 6.25 tries, 55.2% home,
  1.7% draws, 6.2% blowouts (was 7.4%). If a future bandcheck reads ~54.4,
  that is the OLD engine, not a fix.

## What shipped this session, and what it measured

1. **Subs no longer rewrite the saved XV** (mkSide plays on a copy).
   lineupFor returns the user sheet by reference; one afternoon rewrote 8 of
   23 slots on the old engine (sheetlock.ts). This also means instant-result
   injury covers no longer leak into the sheet - the injured man's shirt is
   held for him, as lineupFor's repair path always intended.

2. **Garbage-time compression** (stepTick): leading side's open-play try
   chance damps past +35, floor 0.3, rng stream untouched. Forced mismatch
   max 101 -> 78, median rout kept; top-v-top distributions identical.
   Context that matters: headless top-v-top NEVER produced a 60+ margin in
   425 fixtures - the user's 106-3 at Leinster needed a managed save's
   stacked advantages. The compression bounds the scoreboard whatever the
   cause; the cause itself (how big a managed side's edge can compound) has
   not been separately measured and could be a future pass.

3. **Rating margin tail** (teamRatingTerm): flat cap at margin 25 meant
   31-6 paid like 106-3; now +0.35 more by margin 53, exactly symmetric,
   form untouched. 55+ wins bank mean 8.09, floor 6.7, 43% at 8+.

4. **The war chest** (the user's board-expectations ask, both halves):
   - 'Judge us in May' releases 12% of budget (100-400k, on the button)
     against beating the pundits' predicted finish; a miss repays 1.75x out
     of next summer's refresh. The rate is MEASURED (stancecheck.ts, 16
     paired careers x 3 seasons): 57% miss rate, net +85k +/- 47k a season,
     the residual arriving through better finishes (3.23 v 3.75 mean), not
     the ledger. 2x taxed 100k/season, 1.2x paid 173k - both free lunches.
   - The squad reaction was DEAD CODE (opt.morale only applies with a
     playerId). It now lands on every player and scales with stature:
     safe at a title favourite -0.7, at a wooden-spoon pick 0.0; high +0.2
     favourite, +0.6 unfancied. Reaction prose says so.
   - Found underneath: the season review's "+£250k budget" per met
     objective was WIPED by the budget refresh 400 lines later, every
     season, for two versions - only the boardOwed favour arrived. Money
     promises now settle after the refresh (stanceprobe pins the landing).

5. **memoprobe root cause** - see the headline lesson. boardMemo stamps
   quotedPos; the probe detects by id, holds prose to stamp always, stamp
   to table same-season.

6. **dialweight is CRN now**: one canonical career at 50s; per user
   fixture, the same fixture simmed from the same state and same rng at 10
   and 90; paired difference. Two clubs (Northampton + the league's most
   pack-leaning by packTilt, currently Saracens). What it resolved that
   three reverted calibrations could not:
   - aggression by referee STRADDLES ZERO: +0.30 lenient / -2.33 fussy.
   - kicking leans low-end at both shapes (-2.54 +/- 0.86 NOR, -0.92 SAR),
     inside the 4.0 dominance bar. A real number at last; if it is ever
     tuned, tune it against THIS harness only.
   - style/tempo are mean-level while swinging 6-10 |points| an afternoon,
     and tempo flips sign between clubs - balanced decision dials.
   - The mean-louder-than-noise assert on style/tempo was REMOVED on
     purpose: under CRN a balanced dial reads mean-zero while deciding
     matches. Decoration is caught exactly - all paired diffs zero.
   Probes that pin seed-specific outcomes (a title, a finish) break when
   the engine legitimately moves; stanceprobe now FINDS a qualifying seed
   at runtime instead. Prefer that shape.

## Open work, roughly in order

1. **Pass 9 of the commercial release audit** - untouched.
   Prompt: docs/release-audit-prompt.md.
2. **Where does a managed save's edge come from?** The 106-3 needed an
   effective strength gap headless play never produces between top clubs.
   Facilities + morale + chem + talks + briefs each measured fine alone;
   nobody has measured them STACKED against the AI baseline. If the stack
   is worth more than a rep tier, difficulty reads too easy for an
   attentive manager. (This is measurement, not a fix - the compression
   already bounds the scoreboard.)
3. **Ratings, user's verdict pending**: "feel better but still a little way
   off" was written before the tail shipped. Wait for live feedback before
   touching the constants again.
4. Two design calls that are the USER'S to make, not yours to assume:
   - every replacement comes on at 60% minimum, making the Medical screen's
     "under 62%" warning partly untrue for bench players
   - forwards still rate below backs (21% v 29% rated 7+ post-tail);
     closing it needs a scrum/breakdown term, and those figures carry the
     tactical dials, so it could be farmed by a slider. Left deliberately.

## Conventions worth knowing

- Full suite: `bash scripts/suite.sh all` - POSITIONAL arg. Without `all`
  it silently skips the five long probes.
- Never rebuild `dist` or edit `src`/`scripts` while a suite runs.
- Every fix ships with a probe demonstrated to fail on the old code, via a
  git worktree at HEAD with `ln -sfn /home/user/Game/node_modules`.
- Every new dial mean-neutral, verified by MEASUREMENT (stancecheck.ts is
  the current template: paired careers, same seeds, report the SEM).
- Deterministic gates use mulberry32 on seed/id hashes, never the shared
  match rng (dialweight's per-fixture rng is the template).
- Deploy verification must MATCH THE SHA.
- No em dashes in game text (scripts/textlint.ts); chat is exempt.

## The off-screen reply bug class (from live feedback, still worth hunting)

A button calls an engine function that returns a sentence, and the screen
puts that sentence in ONE banner at the top of the page - 786px above the
thumb that tapped. KEY THE MESSAGE TO THE THING THAT ASKED
(`useState<{key, text}>`), and PUT THE REASON IN FRONT OF THE DECISION
through a predicate both the row and the engine read (Training.tsx's
appointBlock/courseBlock). scripts/hireprobe.mjs guards it by measuring
getBoundingClientRect distance from the tapped button. Screens with long
lists whose row actions render outside the row have not all been checked.

## Feature requests on file

1. **Continue should serve the desk** - shipped (the desk gate, budgeted at
   MAX_DESK_HOLDS because a rollover writes 54 stories in one settle).
   Watch for feedback on the gate's feel.
2. **Board expectations cost money** - shipped this session, see above.
