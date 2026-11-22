# 2.0.0 match: acceptance checklist

What "commentary, graphics and animation in harmony" means, item by item, and how each item is proved. Every item comes from the owner's own words in `scripts/tmp/REBUILD.md`, the team rules in `scripts/tmp/AGENTS.md`, or the approved spec `docs/match-sim-spec.md`.

How to run the checks:
- `npx vite-node scripts/harmonycheck.ts` runs every automatic check: the record rules on 300 skeleton matches (seeds 1 to 300) and 20 real fixtures (seeds 1 to 20, built as `scripts/simread.ts real` builds one); the commentary on all 320; the pitch schedule on 24 of them (`--anim=N` for more; each bake takes about 0.7 s and a lot of memory); the manager's decisions on 8 real fixtures (`--dec=N`). It prints one row per rule, the spread of penalties a match, and a last line, HARMONY PASSED or HARMONY FAILED. About 35 s. Add `--why` to group failures by cause.
- `npx vite-node scripts/harmonycheck.ts dump <seed> <from> <to> [real]` prints the plays (with clock, cause, offender, land, passes, until) and the commentary lines of one match, with the failures in that range.
- `npx vite-node scripts/harmonycheck.ts moments` finds the moments in the recording list below.
- `npx vitest run tests/simharmony.test.ts` is the quick version (40 seeds, record only, one test per rule).

Status words: PASS (the automatic check passes), FAIL (it fails; see "Open engine faults"), NEEDS HIS EYES (no machine can judge it; the owner watches, using the recording list).

Three allowances are mine, not the owner's, and he should confirm them: up to 10% of matches may fall outside 6 to 17 penalties (item 29); "about 4 minutes" is read as 3.5 to 4.5 minutes (item 34); a kick to touch from exactly on halfway, or landing exactly on the 22 line, is not judged either way as a 50:22 (items 8 and 9; 7 of 3,430 kicks to touch in the 300 seeds), because the record is to 0.1 m and I could not confirm from the law text which side of the line counts.

## The checklist

| # | His complaint or rule (date) | What must be true | How it is checked | Status |
|---|---|---|---|---|
| 1 | "Laws followed" (AGENTS.md) | Every play is a move the laws machine (`law.ts`) allows from the state before it | R01-laws, R02-shape | PASS |
| 2 | 0:11 "knock-on plate with no Northampton man near ball" (20 Nov) | A knock-on is only by the side with the ball, or by a man under a kick; after a carry it is the carrier himself, at the place of the ball | R06-knockon | PASS |
| 3 | Same, on the pitch | The plate shows the side whose man is at the ball, and he is at it | Recording list, A | NEEDS HIS EYES |
| 4 | 0:18 "carrier sideways then backwards" (20 Nov); "no player running backwards with the ball" (AGENTS.md) | No carry goes wide (more than 10 m across) and ends more than 2 m behind where it started | R09-backwards | PASS |
| 5 | Same, on the pitch | No man runs back with the ball between record points | Recording list, B | NEEDS HIS EYES |
| 6 | 0:18 "defence passive" (20 Nov) | Every carry that is stopped names its tackler, so the pitch knows who must close on him | R30-tacklers (real fixtures) | PASS |
| 7 | Same, on the pitch | The named tacklers move to the carrier and make the tackle | Recording list, C | NEEDS HIS EYES |
| 8 | 0:24 "50/22 on a kick caught in the 22 then thrown forward" (20 Nov) | A 50:22 is only called for a kick in open play, from the kicker's own half, that goes into touch inside the other 22; words only say "50:22" for a real one | R13-5022, C03-line-kind | PASS |
| 9 | "Laws followed": the 50:22 law the other way | Every kick that is a 50:22 in law is called one (otherwise the wrong side throws in) | R14-5022-missed | PASS |
| 10 | 0:27 "Treviso kick out but their own throw" (20 Nov) | The side that put the ball in touch never throws in, except after a penalty kicked to touch or a 50:22 | R12-throw | PASS |
| 11 | 1:00 "kick to touch label with no kick shown" (20 Nov) | Words that say a kick to touch only appear where the record has one (at the kick, or as the reason at the lineout) | C03-line-kind | PASS |
| 12 | Same, on the pitch | Every play, the kick included, is on the pitch's schedule once, in order, before the lineout | A01-schedule-cover | PASS |
| 13 | 0:08 "All the territory is with Northampton when Northampton have only just kicked off" (20 Nov, 22:06) | No territory or momentum line in the first ten minutes of a half; every percentage said is the record's own figure (within 3 points), worked out by the checker separately from the commentary | C06-line-territory | PASS |
| 14 | 0:09 "penalty for a breakdown without a breakdown ever taking place" (20 Nov, 22:06): the words | A breakdown penalty is only said after a ruck | C07-line-breakdown | PASS |
| 15 | Same: the record | Every penalty and free kick has its offence (`cause`) and it fits the play before (a ruck offence after a ruck, a scrum offence after a scrum, offside at the kick after a kick); the offender is on the other side and on the field | R15-penalty-cause | PASS |
| 16 | 0:13 "turnover again after the Northampton player randomly running all over the place" (20 Nov, 22:06) | The ball changes hands only by a catch, a turnover at the ruck or an interception with the man named, a set piece won against the feed, a penalty, a restart or a score; words only say turnover where the record has one | R04-possession, R05-actor, R17-turnover, C03-line-kind | PASS |
| 17 | Key moment "an interception that leads to a score" (20 Nov, 23:16) | The record holds interceptions (`carry/intercepted`), with the man named and the ball going to his side | R17-turnover, R04-possession | PASS |
| 18 | 0:14 "ball randomly flies back" (20 Nov, 22:06): the record | Every play starts where the last ended unless a kick moved it, and the metres gained match the change in place | R07-continuity, R08-gain | PASS |
| 19 | Same, on the pitch | The ball never moves backwards on screen unless the record has a pass, a kick or a forward pass that is called | Recording list, D | NEEDS HIS EYES |
| 20 | Every play on the pitch (spec 2.3) | x 0 to 100, y 0 to 70; nothing in open play sits on a touchline | R03-pitch | PASS |
| 21 | Restarts after scores (spec 2.3) | A conversion after every try and only after a try; a kick-off by the side that conceded after every score; a penalty try is 7 with no conversion | R18-restart-score, R29-score | PASS |
| 22 | Second half (Law 12) | Kicked off by the side that did not kick off the first half | R22-restart-half | PASS |
| 23 | "Missed penalty kick at goal restarts with a 22 drop-out" (brief, 21 Nov; spec 2.3) | A missed kick at goal or drop goal is followed by a 22 drop-out by the defending side | R19-restart-miss | PASS |
| 24 | Dead ball and held up (Law 21) | A kick that runs dead: 22 drop-out; a kick touched down by the defence or a try held up: goal-line drop-out; always by the defending side | R20-restart-dead, R21-restart-heldup | PASS |
| 25 | Every restart has a reason (20 Nov, 20:50 lawscan: "play after a score with no kick-off", "missed kick with no drop-out") | Every kick-off and drop-out has its reason before it; a kick-off short of 10 m or out on the full is called (restartError) and never played on; a 22 drop-out crosses the 22 | R23-restart-cause | PASS |
| 26 | Scrums and lineouts (spec 2.3) | A scrum has a knock-on, forward pass, bad throw, unplayable ball or penalty before it, the put-in against the side at fault, and is not within 5 m of a goal line or touch; a lineout follows the ball going out, on that touchline, at that place | R10-scrum, R11-lineout | PASS |
| 27 | "Kicks at goal from where the penalty was" (brief, 21 Nov) | The kick at goal is taken at the penalty mark | R16-goal-spot | PASS |
| 28 | Cards: ten minutes, numbers on the field, return (brief, 21 Nov) | A card follows a penalty against that side and names one of its men; he is never named in play while off; his return (the record's `until`) is said at the first play after it, with the right count of men | R24-cards, R25-binned, C09-line-binback | PASS |
| 29 | Penalties: "Aim between 6-17" (20 Nov, 23:16) | Penalties and free kicks average 11 to 12 a match; no more than 10% of matches outside 6 to 17 | R32-pen-mean (11.91), R31-pen-range (17 of 320 outside, 5.3%) | PASS (see "Penalties a match" below: his call) |
| 30 | Kicks out on the full "about 1 or 2 a game" (brief, 21 Nov) | Mean 1.0 to 2.0 a match | R33-outonfull (1.42) | PASS |
| 31 | Clock (spec 3.1, "the clock is real") | `t` never goes backwards; the referee's `clock` restarts at 40:00 for the second half | R27-clock-mono | PASS |
| 32 | Same | The clock moves by exactly the live and dead seconds the record gives (including `pre`, the walk to a set piece), so the pitch can schedule from it | R28-clock-sum | PASS |
| 33 | The score | Try 5, penalty try 7, conversion 2, penalty goal 3, drop goal 3; tries and final score agree with the plays | R29-score | PASS |
| 34 | "About 4 minutes for an Extended match" (AGENTS.md) | The schedule for a whole match is 3.5 to 4.5 minutes | A04-length (mean 4.00 min over 24 matches) | PASS |
| 35 | "Fades only for lineouts, conversions, kicks at goal, after half-time" (20 Nov, 20:23; AGENTS.md) | The schedule fades only on those plays | A03-fades | PASS |
| 36 | "Scrums, kick-offs, 22s: players form up in view" (same) | They form up on screen with no fade | Recording list, E | NEEDS HIS EYES |
| 37 | The pitch plays the record and nothing else (AGENTS.md "the one idea") | The schedule covers every play once, in order, never back in time | A01-schedule-cover, A02-schedule-time | PASS |
| 38 | "Manager decisions must change the match from that minute on" (AGENTS.md): strength | A change from minute 40 leaves every play before it the same, and moves the result after it | R35-decision (100 seeds: 0 changed before; side 0's margin after up 3.38 points a match) | PASS |
| 39 | Same: a substitution | Made only at a dead ball; the man off was on the field, the man on was on that side's bench; every play before it the same; the man on plays; the man off is never named again | R36-substitution, R37-dec-sub (8 real fixtures: 7 made, 1 rightly refused because the No. 8 was in the bin) | PASS |
| 40 | Same: the manager's penalty call | Posts gives a kick at goal, corner a kick to touch, tap a tap, scrum a scrum | R38-dec-call (48 calls over 8 real fixtures: 47 obeyed) | FAIL |
| 41 | Same: a tactics change | Every play before it the same; the match changes after it | R39-dec-tactics (8 of 8 the same before, 8 of 8 changed after) | PASS |
| 42 | Same: a half-time team talk | The first half the same; the second changes | R40-dec-talk (8 of 8 the same before, 8 of 8 changed after) | PASS |
| 43 | "There is still no connection with players, commentary & graphics" (20 Nov, 22:06) | Every man named in a play is on the side it says and on the field (through substitutions); every man named in the words is in that play, or the one it gives as the reason, or is its offender | R26-names, C05-line-player | PASS |
| 44 | "Everything that happens is clear on the pitch and in words" (AGENTS.md) | Every score, card, penalty, scrum, lineout, kick-off, half-time and full time has a line; every line points at a real play, in order; its side, its kind and its score agree with the play | C01, C02, C03, C04, C08 | PASS |
| 45 | The shape of a real match (spec section 4, approved 20 Nov) | Ball in play 32 to 38 min, tries 6.0 to 6.6, points 48 to 53, scrums 11 to 17, lineouts 22 to 29 | R34-shape-rates (36.1 min, 6.25, 49.0, 13.8, 24.5) | PASS |
| 46 | "Perfect speed, perfect movement" of the 1.9.16 highlight clips (AGENTS.md) | The new pitch feels as good | Recording list, F | NEEDS HIS EYES |
| 47 | "Vertical phone, full pitch in view, no moving camera; fast-forward between key moments, slow for key moments" (AGENTS.md; 20 Nov, 22:51) | So on screen | Recording list, G | NEEDS HIS EYES |

## The four test failures of round 2, judged (22 Nov)

After GAMEPLAY's commit 474d5457, `tests/simharmony.test.ts` failed on four rules. Each was looked at play by play with `dump`.

- R04 possession: my rule was out of date. The record now has interceptions (`carry/intercepted`, ball to the other side, interceptor in `vs`), which is a legal way for the ball to change hands. Rule updated; R17 now also checks the interceptor is named and the ball goes to his side.
- R13 50:22: my rule was too tight at the lines. Seed 147 play 443 lands exactly on the 22 line (x 78.0) and seed 133 play 434 is kicked from exactly on halfway (x 50.0). The rule now reads the 22 line as in the 22, uses the record's new `land`, and leaves a kick exactly on halfway or exactly on the 22 line unjudged (7 of 3,430 kicks).
- R15 penalty cause: my rule was out of date. Penalties after a kick now carry `cause` 'offsideAtKick', 'obstruction', 'highTackle' or 'notReleasing' (seed 1 play 85: offsideAtKick). Rule rewritten: every penalty must have a cause that fits the play before it, and its offender must be on the other side and on the field.
- R23 restart cause: my rule was out of date. A kick-off short of 10 m is now called (seed 7 play 64 lands at x 40.9, play 65 is restartError/notTen). The rule now fails only a short or out-on-the-full kick-off that is played on, or a call the kick does not support.

None of the four is an engine fault. The test now passes: 32 of 32.

Two commentary failures in round 2 were also mine: an offender named in a penalty line was not counted as in the play (it is in `offender`), and "kicks off straight into touch, on the full" at restartError/outOnFull is a true kick into touch. Both rules are fixed.

## Open engine faults

1. R38, the manager's penalty call is not obeyed inside 5 m. Real fixture 4 (Leicester v Wellington), the manager asked at every penalty to Leicester, answers taken in turn from the options offered. Play 28: penalty to side 0 (Leicester) at x 95.0, y 17.4, 5.0 m from the line it attacks, cause notBinding. `MatchSim.pending.options` offered 'corner'; the call was 'corner'; play 29 is tap/tapped. What should happen: either 'corner' is not offered from 5 m out or nearer (options 'posts', 'tap', 'scrum'), or 'corner' is a kick to touch. Today the manager is offered a choice the engine then ignores. Cause in `skeleton.ts`: `corner()` returns `tap()` when d <= 5, but `pending` builds its options from GOAL_RANGE only.

That is the only record fault the checks find.

## Penalties a match (R31, for the owner to decide)

320 matches (300 skeleton, 20 real), penalties and free kicks, both sides together:

| Per match | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Matches | 1 | 1 | 10 | 6 | 18 | 23 | 51 | 40 | 46 | 36 | 28 | 23 | 11 | 11 | 9 | 3 | 2 | 1 |

Mean 11.91, median 12, 5th percentile 7, 95th percentile 17. 2 matches have fewer than 6 and 15 have more than 17, so 17 of 320 (5.3%) are outside his 6 to 17. The question for him: is 6 to 17 the band every match must sit in (then the spread has to narrow, which also makes matches more alike), or the range the average should sit in (then this passes easily)?

## Recording list (the seven "needs his eyes" items)

Open `/lp-record.html?rec=<seed>&from=<play>` on the dev server (the preview builds the same real fixture as `harmonycheck` and `simread real`). Minutes are the referee's clock. Found with `npx vite-node scripts/harmonycheck.ts moments`.

| | Item | Where | What to look for |
|---|---|---|---|
| A | 3, knock-on plate | rec=1, from=18 (minute 3): Will Skelton knocks on in contact. Also rec=1, from=288 (minute 41): Gabriel Hamer-Webb knocks on under a high ball | The plate names the side of the man who drops it, and he is the man at the ball when it comes loose. The scrum that follows (play 19) forms where it was dropped |
| B | 5, carrier never runs back | rec=1, from=5 (minute 2): a wide carry, two or more passes, 15 m or more across, by Gabriel Hamer-Webb | The ball goes across by passes; the man who ends up with it runs forward or is tackled where he stands, never back towards his own line |
| C | 7, defence reacts | rec=1, from=46 (minute 7): Theo McFarland stopped by two tacklers. rec=1, from=53 (minute 8): Joe Heyes breaks and is hauled down | The named tacklers move to the carrier before contact; the cover runs across to the break and makes the tackle |
| D | 19, ball never flies back | rec=3, from=113 (minute 21): Leolin Zas forward pass. rec=2, from=150 (minute 22): Dan Kelly intercepts | The forward pass is shown going forward and is whistled, then the scrum; at the interception the ball goes to the interceptor and play turns round with no jump |
| E | 36, set pieces form up in view | rec=1, from=19 (minute 4) scrum; from=97 (minute 14) kick-off after a score; from=61 (minute 8) 22 drop-out; from=350 (minute 49) goal-line drop-out; from=23 (minute 5) lineout; from=289 (minute 41) half-time | Scrum, kick-off and both drop-outs: players walk into place on screen, no fade. Lineout and the second-half kick-off may fade |
| F | 46, feel against the 1.9.16 clips | rec=1, from=95 (minute 13): Ulupano Seuteni's try, then the conversion and the kick-off at play 97 | Put next to a 1.9.16 highlight clip: speed of running and passing, the ball's flight, no stutter |
| G | 47, the whole match | rec=1, from=0, the whole match on a phone held upright | Full pitch in view, camera still; ordinary play wound on, slowed at the try (minute 13), the yellow card (play 122, minute 16, Solomone Kata, the card shown with a penalty try) and the half-time; total about 4 minutes |

## Final status (22 November 2026)

Run: `npx vite-node scripts/harmonycheck.ts` (300 seeds + 20 real fixtures, 35 s). HARMONY FAILED on one rule: 52 rules pass, 1 fails (R38), none not run. Commentary: 83,932 lines over 320 matches, all nine commentary rules pass. Pitch schedule: 24 matches, all four pitch rules pass. Quick test: `npx vitest run tests/simharmony.test.ts`, 32 of 32 pass.

Checklist totals: 39 PASS, 1 FAIL (item 40), 7 NEEDS HIS EYES (items 3, 5, 7, 19, 36, 46, 47). 47 items.

What the passes do not prove: A04 passes at exactly 4.00 minutes because the pitch fits each match's schedule to 240 s (`fromRecord.ts` TARGET_S); it shows the length is right, not that the speeds within it feel right. The pitch rules check the schedule, not the picture: whether men and ball move as the record says is the seven items for his eyes.
