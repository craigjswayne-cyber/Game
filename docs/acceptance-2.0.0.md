# 2.0.0 match: acceptance checklist

What "commentary, graphics and animation in harmony" means, item by item, and how each item is proved. Every item comes from the owner's own words in `scripts/tmp/REBUILD.md`, the team rules in `scripts/tmp/AGENTS.md`, or the approved spec `docs/match-sim-spec.md`.

How to run the checks:
- `npx vite-node scripts/harmonycheck.ts` runs every automatic check: the record rules on 300 skeleton matches (seeds 1 to 300) and 20 real fixtures (seeds 1 to 20, built as `scripts/simread.ts real` builds one); the commentary on all 320; the pitch schedule on 24 of them (`--anim=N` for more; each bake takes about 0.7 s and a lot of memory); the manager's decisions on 8 real fixtures (`--dec=N`). It prints one row per rule, the spread of penalties a match, and a last line, HARMONY PASSED or HARMONY FAILED. About 35 s. Add `--why` to group failures by cause.
- `npx vite-node scripts/harmonycheck.ts dump <seed> <from> <to> [real]` prints the plays (with clock, cause, offender, land, passes, until) and the commentary lines of one match, with the failures in that range.
- `npx vite-node scripts/harmonycheck.ts moments` finds the moments in the recording list below.
- `npx vite-node scripts/harmonycheck.ts pace <real seed> <from play> <to play>` prints each play's time and speed on screen; `words <real seed> <from s> <to s>` prints the commentary as `thin()` leaves it, with the second on screen; `eyes` finds the ten moments in the owner's list.
- Round 4 checks (pace, smoothness, positions, words on the schedule) run on 6 real fixtures, the three closest and three widest at 75:00 (`--pace=N`); sameness on the 20 real fixtures and on 20 matches of fixture 1's pairing. The whole run takes about 40 s.
- `npx vitest run tests/simharmony.test.ts` is the quick version (40 seeds, record only, one test per rule).

Status words: PASS (the automatic check passes), FAIL (it fails; see "Open engine faults"), NEEDS HIS EYES (no machine can judge it; the owner watches, using the recording list).

Three allowances are mine, not the owner's, and he should confirm them: up to 10% of matches may fall outside 6 to 17 penalties (item 29); "about 4 minutes" is read as 3.5 to 4.5 minutes (item 34); a kick to touch from exactly on halfway, or landing exactly on the 22 line, is not judged either way as a 50:22 (items 8 and 9; 7 of 3,430 kicks to touch in the 300 seeds), because the record is to 0.1 m and I could not confirm from the law text which side of the line counts.

## The checklist

| # | His complaint or rule (date) | What must be true | How it is checked | Status |
|---|---|---|---|---|
| 1 | "Laws followed" (AGENTS.md) | Every play is a move the laws machine (`law.ts`) allows from the state before it | R01-laws, R02-shape | PASS |
| 2 | 0:11 "knock-on plate with no Northampton man near ball" (20 Nov) | A knock-on is only by the side with the ball, or by a man under a kick; after a carry it is the carrier himself, at the place of the ball | R06-knockon | PASS |
| 3 | Same, on the pitch | The plate shows the side whose man is at the ball, and he is at it | Eyes list, 8 and 10 | NEEDS HIS EYES |
| 4 | 0:18 "carrier sideways then backwards" (20 Nov); "no player running backwards with the ball" (AGENTS.md) | No carry goes wide (more than 10 m across) and ends more than 2 m behind where it started | R09-backwards | PASS |
| 5 | Same, on the pitch | No man runs back with the ball between record points | Eyes list, 1 and 2 | NEEDS HIS EYES |
| 6 | 0:18 "defence passive" (20 Nov) | Every carry that is stopped names its tackler, so the pitch knows who must close on him | R30-tacklers (real fixtures) | PASS |
| 7 | Same, on the pitch | The named tacklers move to the carrier and make the tackle | Eyes list, 1 and 2 | NEEDS HIS EYES |
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
| 19 | Same, on the pitch | The ball never moves backwards on screen unless the record has a pass, a kick or a forward pass that is called | Eyes list, 8 | NEEDS HIS EYES |
| 20 | Every play on the pitch (spec 2.3) | x 0 to 100, y 0 to 70; nothing in open play sits on a touchline | R03-pitch | PASS |
| 21 | Restarts after scores (spec 2.3) | A conversion after every try and only after a try; a kick-off by the side that conceded after every score; a penalty try is 7 with no conversion | R18-restart-score, R29-score | PASS |
| 22 | Second half (Law 12) | Kicked off by the side that did not kick off the first half | R22-restart-half | PASS |
| 23 | "Missed penalty kick at goal restarts with a 22 drop-out" (brief, 21 Nov; spec 2.3) | A missed kick at goal or drop goal is followed by a 22 drop-out by the defending side | R19-restart-miss | PASS |
| 24 | Dead ball and held up (Law 21) | A kick that runs dead: 22 drop-out; a kick touched down by the defence or a try held up: goal-line drop-out; always by the defending side | R20-restart-dead, R21-restart-heldup | PASS |
| 25 | Every restart has a reason (20 Nov, 20:50 lawscan: "play after a score with no kick-off", "missed kick with no drop-out") | Every kick-off and drop-out has its reason before it; a kick-off short of 10 m or out on the full is called (restartError) and never played on; a 22 drop-out crosses the 22 | R23-restart-cause | PASS |
| 26 | Scrums and lineouts (spec 2.3) | A scrum has a knock-on, forward pass, bad throw, unplayable ball or penalty before it, the put-in against the side at fault, and is not within 5 m of a goal line or touch; a lineout follows the ball going out, on that touchline, at that place | R10-scrum, R11-lineout | PASS |
| 27 | "Kicks at goal from where the penalty was" (brief, 21 Nov) | The kick at goal is taken at the penalty mark | R16-goal-spot | PASS |
| 28 | Cards: ten minutes, numbers on the field, return (brief, 21 Nov) | A card follows a penalty against that side and names one of its men; he is never named in play while off; his return (the record's `until`) is said at the first play after it, with the right count of men | R24-cards, R25-binned, C09-line-binback | PASS |
| 29 | Penalties: "Aim between 6-17" (20 Nov, 23:16) | Penalties and free kicks average 11 to 12 a match; no more than 10% of matches outside 6 to 17 | R32-pen-mean (11.53), R31-pen-range (12 of 320 outside, 3.8%) | PASS (see "Penalties a match" below: his call) |
| 30 | Kicks out on the full "about 1 or 2 a game" (brief, 21 Nov) | Mean 1.0 to 2.0 a match | R33-outonfull (1.66) | PASS |
| 31 | Clock (spec 3.1, "the clock is real") | `t` never goes backwards; the referee's `clock` restarts at 40:00 for the second half | R27-clock-mono | PASS |
| 32 | Same | The clock moves by exactly the live and dead seconds the record gives (including `pre`, the walk to a set piece), so the pitch can schedule from it | R28-clock-sum | PASS |
| 33 | The score | Try 5, penalty try 7, conversion 2, penalty goal 3, drop goal 3; tries and final score agree with the plays | R29-score | PASS |
| 34 | "About 4 minutes for an Extended match" (AGENTS.md) | The schedule for a whole match is 3.5 to 4.5 minutes | A04-length | RETIRED 22 Nov (replaced by item 48) |
| 35 | "Fades only for lineouts, conversions, kicks at goal, after half-time" (20 Nov, 20:23; AGENTS.md) | The schedule fades only on those plays | A03-fades (still run and reported) | RETIRED 22 Nov as the rule (replaced by item 49: every play shown, speed the only lever) |
| 36 | "Scrums, kick-offs, 22s: players form up in view" (same) | They form up on screen with no fade | Eyes list, 10 | NEEDS HIS EYES |
| 37 | The pitch plays the record and nothing else (AGENTS.md "the one idea") | The schedule covers every play once, in order, never back in time | A01-schedule-cover, A02-schedule-time | PASS |
| 38 | "Manager decisions must change the match from that minute on" (AGENTS.md): strength | A change from minute 40 leaves every play before it the same, and moves the result after it | R35-decision (100 seeds: 0 changed before; side 0's margin after up 6.85 points a match) | PASS |
| 39 | Same: a substitution | Made only at a dead ball; the man off was on the field, the man on was on that side's bench; every play before it the same; the man on plays; the man off is never named again | R36-substitution, R37-dec-sub (8 real fixtures: 7 made, 1 rightly refused; the record now also holds the game's own substitutions, and every one is checked by R36) | PASS |
| 40 | Same: the manager's penalty call | Posts gives a kick at goal, corner a kick to touch, tap a tap, scrum a scrum | R38-dec-call (52 calls over 8 real fixtures, all obeyed; fixed by the lead in 9e09f0a8) | PASS |
| 41 | Same: a tactics change | Every play before it the same; the match changes after it | R39-dec-tactics (8 of 8 the same before, 8 of 8 changed after) | PASS |
| 42 | Same: a half-time team talk | The first half the same; the second changes | R40-dec-talk (8 of 8 the same before, 8 of 8 changed after) | PASS |
| 43 | "There is still no connection with players, commentary & graphics" (20 Nov, 22:06) | Every man named in a play is on the side it says and on the field (through substitutions); every man named in the words is in that play, or the one it gives as the reason, or is its offender | R26-names, C05-line-player | PASS |
| 44 | "Everything that happens is clear on the pitch and in words" (AGENTS.md) | Every score, card, penalty, scrum, lineout, kick-off, half-time and full time has a line; every line points at a real play, in order; its side, its kind and its score agree with the play | C01, C02, C03, C04, C08 | PASS |
| 45 | The shape of a real match (spec section 4, approved 20 Nov) | Ball in play 32 to 38 min, tries 6.0 to 6.6, points 48 to 53, scrums 11 to 17, lineouts 22 to 29 | R34-shape-rates (36.5 min, 6.52, 50.2, 14.1, 24.8) | PASS |
| 46 | "Perfect speed, perfect movement" of the 1.9.16 highlight clips (AGENTS.md) | The new pitch feels as good | Eyes list, 1 and 6 | NEEDS HIS EYES |
| 47 | "Vertical phone, full pitch in view, no moving camera; fast-forward between key moments, slow for key moments" (AGENTS.md; 20 Nov, 22:51) | So on screen | Recording list | RETIRED 22 Nov in part: the pace half is replaced by items 50 to 53; the screen half (full pitch in view, still camera) is item 62 |

| 48 | "8 mins is fine." (22 Nov, 22:13) | An Extended match takes 7 to 9 minutes to watch | P01-length | PASS (8.00 to 8.89 min over 6 fixtures) |
| 49 | "Everything else is on fast forward BUT still happening, not just being ignored." (22 Nov, 22:13) | Every play is shown: none condensed, every play with the ball in play has time on screen | P02-every-play | PASS |
| 50 | "For build ups to tries and key moments the game should be normal speed" (22 Nov, 22:13): key moments | Every key moment (spec section 8, read from the record by the checker, not from the pitch's own list) at 1x: no frame of it above 1.15x | P03-key-1x | PASS |
| 51 | Same: build-ups | The possession that ends in each try is at 1x from its first play (the set piece, turnover, catch or tap it began with), or from 35 s before the grounding (the pitch's BUILD_MAX) if longer: 90% of its frames at 1.15x or less | P04-buildup-1x | FAIL |
| 52 | "then everything else is on fast forward" (22 Nov, 22:13) | 80% of all other frames at 1.5x or more | P05-ff | PASS (median 7.5x to 9.1x) |
| 53 | "If a [close] game the last few mins should be slower." (22 Nov, 22:13) | Margin 7 or fewer at 75:00: the rest of the match at 2.2x or less; margin 15 or more: not slowed (median over 2.2x) | P06-close | PASS (close finishes at 2.0x) |
| 54 | "I believe we can get there with smoothness." (22 Nov, 22:13); "It feels jumpy not smooth" (22 Nov, quoted in fromRecord.ts) | No step in speed: never more than 10% faster or slower between two screen frames | P07-ease | PASS (largest 6%) |
| 55 | Same | Small, even steps on screen at 60 frames a second and 3.3 px a metre: men's step 99th percentile 5 px or less in fast forward; change in step 99th percentile 1 px or less; ball's step 99th percentile 14 px or less | S01-steps | PASS (men 4.0 px, change 0.81 px, ball 9.8 px) |
| 56 | Same | No shaking: a man's step reverses between two screen frames (both 0.3 px or more) for under 0.5 men on average, 3 or more at once in under 1% of frames (men bound in a ruck, scrum or maul, lifted, or off are left out) | S02-jitter | PASS (0.01 to 0.02 men; 3 or more in 0.06% to 0.14% of frames) |
| 57 | "Players just randomly travel a strange angle" (22 Nov, quoted in tests/simpitch.test.ts) | The lead's scripts/tmp/oddruns.ts, as fromRecord.ts oddRuns(): 196 or fewer odd runs a match (15% of the 1,309 measured before), no side sliding 5 m or more sideways in two seconds, wings in their lane 90% of the time, a flat defensive line at 80% of rucks | S03-positions | FAIL (side slide 5.3 m and 5.5 m) |
| 58 | "We need more commentary notes to keep it engaging and clear." (22 Nov, 22:13): clear | Readable: no more than one new line every 1.4 s in fast forward or at normal speed, and no more than 7 in any 10 s on screen | W01-load | FAIL (busiest 10 s: 10 to 18 lines) |
| 59 | Same: engaging | Never more than 15 s on screen with no new line | W02-gaps | FAIL (up to 36.2 s) |
| 60 | Same: clear | Every key moment has a line on screen while it happens | W03-key-words | PASS (199 of 199) |
| 61 | "The games shouldn't feel repetitive." (22 Nov, 22:13): within a match | No more than 15% of lines word for word an earlier line, and no wording three times running | W04-repeat | PASS (worst 5%) |
| 62 | Same: across matches | Sameness score (below) 60 or less over 20 pairings, 70 or less over 20 matches of one pairing | W05-sameness | PASS (58.7 and 59.2) |
| 63 | "Full pitch in view, no moving camera" (AGENTS.md), and the smoothness he will judge | So on screen, and smooth to his eye | Eyes list, all ten | NEEDS HIS EYES |

## The four test failures of round 2, judged (22 Nov)

After GAMEPLAY's commit 474d5457, `tests/simharmony.test.ts` failed on four rules. Each was looked at play by play with `dump`.

- R04 possession: my rule was out of date. The record now has interceptions (`carry/intercepted`, ball to the other side, interceptor in `vs`), which is a legal way for the ball to change hands. Rule updated; R17 now also checks the interceptor is named and the ball goes to his side.
- R13 50:22: my rule was too tight at the lines. Seed 147 play 443 lands exactly on the 22 line (x 78.0) and seed 133 play 434 is kicked from exactly on halfway (x 50.0). The rule now reads the 22 line as in the 22, uses the record's new `land`, and leaves a kick exactly on halfway or exactly on the 22 line unjudged (7 of 3,430 kicks).
- R15 penalty cause: my rule was out of date. Penalties after a kick now carry `cause` 'offsideAtKick', 'obstruction', 'highTackle' or 'notReleasing' (seed 1 play 85: offsideAtKick). Rule rewritten: every penalty must have a cause that fits the play before it, and its offender must be on the other side and on the field.
- R23 restart cause: my rule was out of date. A kick-off short of 10 m is now called (seed 7 play 64 lands at x 40.9, play 65 is restartError/notTen). The rule now fails only a short or out-on-the-full kick-off that is played on, or a call the kick does not support.

None of the four is an engine fault. The test now passes: 32 of 32.

Two commentary failures in round 2 were also mine: an offender named in a penalty line was not counted as in the play (it is in `offender`), and "kicks off straight into touch, on the full" at restartError/outOnFull is a true kick into touch. Both rules are fixed.

## Round 4 (22 Nov): what the new checks measure, and the thresholds

The owner gave the rules; the numbers that turn them into pass or fail are mine and should be confirmed with him: 1.15x as "normal speed", 1.5x as "fast forward", 2.2x as "about 2x" at a close finish, 15 points as a blow-out, 10% a frame as a step in speed, 5 px and 1 px for the steps on screen, 1 line every 1.4 s and 7 in 10 s for reading, 15 s for the longest silence, 15% and three running for repeats, 60 and 70 for sameness.

Measured on 6 real fixtures (3, 2 and 17 close at 75:00; 9, 14 and 11 blow-outs), 22 Nov 23:07:

| | Fast forward | Normal speed |
|---|---|---|
| Men's step on screen, px a frame, 50th / 95th / 99th percentile | 0.8 / 3.2 / 4.0 (largest 4.0) | 0.1 / 0.4 / 0.5 |
| Ball's step on screen, px a frame, 50th / 95th / 99th | 0.2 / 7.0 / 9.8 | 0.0 / 1.0 / 1.4 |
| Change in step from one frame to the next, men, 95th / 99th | 0.24 / 0.81 | |
| Change in step, ball, 95th / 99th | 1.34 / 5.14 | |
| New lines a second on screen (after `thin()`) | 0.47 to 0.60 | 0.15 to 0.20 |
| New lines a second before `thin()` (what the preview shows today, as nothing in src/ui calls `thin()`) | 0.94 to 1.14 | |

THE SAMENESS SCORE. Over every pair of matches in a set, the mean of four likenesses, each 0 (nothing alike) to 1 (the same), shown out of 100: (1) how the tries came (try type with the start of the move: "break from lineout", "pickAndGo from scrum"); (2) the run of play (the kinds of play three at a time, rucks left out); (3) the words (line wordings with names and numbers taken out); (4) the scoring sequence (who scored what, in order, as an edit distance). Today: 58.7 over 20 pairings (tries 31, run of play 97, words 71, scoring 37) and 59.2 over 20 matches of one pairing (tries 29, run of play 97, words 73, scoring 37). The run of play is 97 for any two matches, because rugby has one grammar (carry, ruck, carry); it does not tell matches apart and could be dropped. The thresholds are a first proposal; they need his view after he has watched a few.

What a watcher would find samey today, plainly:
- The words more than the rugby: the two "visits to the 22" summary lines appear 4.6 and 4.5 times a match; "Fresh legs: X is straight into the action" 3.8 times and "X, just on, has a first touch" 3.5 times; the lineout lines about 3 times each.
- The tries are varied: no one kind is more than 13% of the 137 tries over 20 matches (break from a catch 13%, pick and go from a lineout 10%, break from a lineout 10%).
- The scoring is varied: 17 different first three scores in 20 matches.
- The clubs do not yet play like themselves: 20 matches between the same two clubs are no more alike (59.2) than 20 different pairings (58.7).

## Open engine faults

None in the record. The round 2 fault (a corner offered from inside 5 m and then tapped, real fixture 4 play 28) is fixed: 52 penalty calls over 8 real fixtures, all obeyed. The open faults of round 4 are in the pitch and the words: see Final status and `scripts/tmp/requests.md` (22 Nov, 23:10).

## Penalties a match (R31, for the owner to decide)

320 matches (300 skeleton, 20 real) after GAMEPLAY's round 4 (f5318296), penalties and free kicks, both sides together:

| Per match | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 19 | 20 | 23 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Matches | 2 | 1 | 11 | 12 | 32 | 36 | 29 | 43 | 37 | 33 | 31 | 12 | 23 | 9 | 6 | 2 | 1 |

Mean 11.53, median 11, 5th percentile 7, 95th percentile 17. 3 matches have fewer than 6 and 9 have more than 17: 12 of 320 (3.8%) outside his 6 to 17. The question for him stands: is 6 to 17 a band every match must sit in, or the range the average should sit in?

## Eyes list (refreshed 22 Nov for the owner's new rules)

Open each link on the dev server; `from` is seconds on screen. The preview builds the same real fixture as `harmonycheck` and `simread real`. Found with `npx vite-node scripts/harmonycheck.ts eyes`, on the pitch as saved 23:01; if ANIMATION changes the speeds, the seconds move (re-run `eyes`).

| | Moment | Where | Link | What to look for |
|---|---|---|---|---|
| 1 | A try build-up at normal speed | Real 1 (Leicester v La Rochelle), minute 2, from play 2 | `/lp-record.html?rec=1&from=0` | The whole move at life speed from its first phase, every pass and ruck, to the grounding |
| 2 | Plain fast forward in midfield | Real 1, minute 31, play 183 | `/lp-record.html?rec=1&from=256` | Ten phases between the 30 m lines wound on: every carry and ruck still there, men moving smoothly, no flicker |
| 3 | A close finish | Real 1, minute 76, play 492 | `/lp-record.html?rec=1&from=469` | From 75:00 the game slows to about 2x and stays there to the whistle |
| 4 | A blow-out finish | Real 5 (Leicester v Fuchu), minute 76, play 546 | `/lp-record.html?rec=5&from=456` | From 75:00 it stays on fast forward |
| 5 | A kick exchange | Real 2 (Leicester v Munster), minute 30, play 216 | `/lp-record.html?rec=2&from=151` | Kicks back and forth: the ball's flight, the catchers under it, the chasers, each kick named |
| 6 | A maul try | Real 1, minute 18, play 110 | `/lp-record.html?rec=1&from=157` | Lineout, the maul forms and drives over, at life speed |
| 7 | A card period | Real 1, minute 6, play 35 | `/lp-record.html?rec=1&from=51` | The card shown, 14 men for ten minutes, and the return said and seen |
| 8 | An interception | Real 1, minute 10, play 68 | `/lp-record.html?rec=1&from=76` | The pass, the interceptor, the ball turning round with no jump; the knock-on plates elsewhere name the man at the ball |
| 9 | A 50:22 | Real 2, minute 26, play 183 | `/lp-record.html?rec=2&from=119` | The kick bounces into touch in the 22 and the kicking side throws in |
| 10 | A 22 drop-out forming up | Real 1, minute 9, play 60 | `/lp-record.html?rec=1&from=73` | The men walk into place on screen, no fade |

Note for item 3: the preview does not call `thin()` yet, so what he reads there today is about twice as many lines as the checked feed (request 3 to ANIMATION).

## Final status (22 November 2026, 23:10)

Run: `npx vite-node scripts/harmonycheck.ts` after GAMEPLAY f5318296 and COMMENTARY 614cea72, with fromRecord.ts as saved at 23:01 (ANIMATION had not committed). 37 s. HARMONY FAILED: 63 rules pass, 4 fail, none not run. Quick test: `npx vitest run tests/simharmony.test.ts`, 32 of 32 pass.

Checklist totals: 49 PASS, 4 FAIL (items 51, 57, 58, 59), 7 NEEDS HIS EYES (items 3, 5, 7, 19, 36, 46, 63), 3 RETIRED (34, 35, 47). 63 items.

The four failures, worst first:
1. Item 59, W02: 36.2 s with no new line, real fixture 14, from play 283 (clock 40:49), through a 13-phase build-up at 1x to the try at play 300. COMMENTARY.
2. Item 58, W01: 18 lines in 10 s, real fixture 3, from 294 s on screen (plays 358 to 390, a run of stoppages and substitutions at 8 to 20x). All six sampled matches have 10 to 18 in their busiest 10 s. COMMENTARY (`thin()` keeps every priority 3 line).
3. Item 51, P04: try build-ups reach 1x two phases late. Real fixture 2, try at play 362: plays 356 to 358 at 9 to 10x. 14 of 39 tries in the sample. ANIMATION.
4. Item 57, S03: a side slides 5.3 m (real 3, play 315) and 5.5 m (real 14) in two seconds; the limit is under 5 m. ANIMATION.
And not a rule but the biggest thing he will see: the preview does not call `thin()`, so it shows about one line a second in fast forward. ANIMATION.

What the passes do not prove: the smoothness numbers are steps between frames, computed from the bake at 3.3 px a metre; they do not see drawing, frame drops on a phone, or whether running looks like running. That is the eyes list.
