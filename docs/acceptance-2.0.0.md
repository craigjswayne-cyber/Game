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

| 48 | "8 mins is fine" (22 Nov); "try-heavy matches may run to about 10 minutes" (lead, 24 Nov); on 25 Nov, match length: "1.C" (leave it; a try-heavy thriller may run 11 minutes or so; do not shorten lead-ins or the close finish) | Reported, not judged; a warning only above 12 minutes | P01-length | REPORT (8.0 to 9.1 minutes on 7 fixtures; none over 12) |
| 49 | "Everything else is on fast forward BUT still happening, not just being ignored." (22 Nov, 22:13) | Every play is shown: none condensed, every play with the ball in play has time on screen | P02-every-play | PASS |
| 50 | "For build ups to tries and key moments the game should be normal speed" (22 Nov); "normal speed" is the 1.9.16 clips' pace (24 Nov); line breaks, 25 Nov decision 2: "Only big ones" | Every key moment at the clips' pace (CLIP_RATE), every frame within 15%; of the line breaks only the big ones (fromRecord.ts bigBreak(): 20 m or more, ending in the 22, or leading to a try); the rest at about 3x with their label | P03-key-1x | PASS (big breaks at clip pace) |
| 51 | Same: build-ups. "No shortening of build-ups" (24 Nov; the 35 s cap RETIRED) | Every play of the possession that ends in a try, from its first play, at clip pace; a ball lying at a ruck may be wound on up to 2.5x (lead, 24 Nov 16:35); any play faster than 2.5x fails | P04-buildup-1x | PASS (no play over 2.5x in any build-up) |
| 52 | "then everything else is on fast forward" (22 Nov, 22:13) | 80% of all other frames at 1.5x or more | P05-ff | PASS |
| 53 | "If a [close] game the last few mins should be slower." (22 Nov, 22:13) | Margin 7 or fewer at 75:00: the rest of the match at 2.2x or less; margin 15 or more: not slowed (median over 2.2x) | P06-close | PASS (close finishes at 2.0x) |
| 54 | "I believe we can get there with smoothness." (22 Nov, 22:13); "It feels jumpy not smooth" (22 Nov, quoted in fromRecord.ts) | No step in speed: never more than 10% faster or slower between two screen frames | P07-ease | PASS (largest 6%) |
| 55 | Same | Small, even steps on screen at 60 frames a second and 3.3 px a metre: men's step 99th percentile 5 px or less in fast forward; change in step 99th percentile 1 px or less; ball's step 99th percentile 14 px or less | S01-steps | PASS (men 3.8 px, change 0.68 px, ball 9.2 px) |
| 56 | Same | No shaking: a man's step reverses between two screen frames (both 0.3 px or more) for under 0.5 men on average, 3 or more at once in under 1% of frames (men bound in a ruck, scrum or maul, lifted, or off are left out) | S02-jitter | PASS |
| 57 | "Players just randomly travel a strange angle" (22 Nov, quoted in tests/simpitch.test.ts) | The lead's scripts/tmp/oddruns.ts, as fromRecord.ts oddRuns(): 196 or fewer odd runs a match (15% of the 1,309 measured before), no side sliding 5 m or more sideways in two seconds, wings in their lane 90% of the time, a flat defensive line at 80% of rucks | S03-positions | PASS |
| 58 | "We need more commentary notes to keep it engaging and clear." (22 Nov, 22:13): clear | Readable: no more than one new line every 1.4 s, no more than 7 in any 10 s | W01-load | RETIRED 24 Nov (replaced by items 67 to 71: "a lot faster paced, a bit like the old Football Manager") |
| 59 | Same: engaging | Never more than 15 s on screen with no new line | W02-gaps | RETIRED 24 Nov (replaced by item 68, 1.2 s) |
| 60 | Same: clear | Every key moment has a line on screen while it happens | W03-key-words | PASS (199 of 199) |
| 61 | "The games shouldn't feel repetitive." (22 Nov, 22:13): within a match | No more than 15% of lines word for word an earlier line, and no wording three times running | W04-repeat | PASS (worst 5%) |
| 62 | Same: across matches | Sameness score (below) 60 or less over 20 pairings, 70 or less over 20 matches of one pairing | W05-sameness | PASS (54.9 and 56.3) |
| 63 | "Full pitch in view, no moving camera" (AGENTS.md), and the smoothness he will judge | So on screen, and smooth to his eye | Eyes list, all ten | NEEDS HIS EYES |
| 64 | "A moment early on said the ball went dead, but on screen it did not cross the dead-ball line. Check and fix." (24 Nov): the record | The record says where the ball went: a kick that ran dead lands beyond the try line (it cannot be drawn over the dead-ball line if the record lands it on the try line); a kick to touch lands on a touchline; a try is on the line | B01-record-bounds | PASS |
| 65 | Same: the picture | On screen the ball crosses the line the record says and stops beyond it: past the dead-ball line (8 m beyond the try line, as drawn), past the touchline for touch, out on the full and carried into touch; over the try line at a try; a kick at goal that is over passes between the posts (5.6 m apart) above the bar (3 m), one that misses does not (Law 1) | B02-picture-bounds | PASS |
| 66 | "Make sure everything in the game is affected by the decisions of the manager. This can't be a preset result." (24 Nov) | Every lever the engine takes (World strength, substitution, tactics kicking / aggression / tempo, team talks, penalty calls): every play before the call the same, the match different after it, and its measure moved the way rugby says, judged by a paired t of 2 or more over paired seeds | M01-levers (and `harmonycheck.ts levers 40`) | PASS (all 12 levers act from the call; doc rows checked in round 6) |
| 67 | "Significantly increase the amount of commentary notes, so it's a lot faster paced, a bit like the old Football Manager" (24 Nov): every play of a try | Every play of a try build-up has its own line | T01-build-said | PASS (run lines cover their plays) |
| 68 | Same: "flicking through" | No dead air while the ball is in play: never over 1.2 s with nothing on screen (a held line counts, lead 24 Nov 15:05), and at clip pace no line (other than a flash) up over 2.5 s | T02-tick | PASS |
| 69 | Same: "then it flashes when there's a key [moment], a try or a penalty goal" | Every try, goal and card has its line (never thinned out), and it stays up at least 2 s before the next line | T03-flash | PASS |
| 70 | "It must fit what is shown on the pitch" (24 Nov) | The line on screen is never about a play still to come, and more than one play behind for under 2% of the time the ball is in play | T04-in-step | PASS |
| 71 | Same: a ticker can be read | Ticker lines 70 characters or fewer, fuller lines 90, flash lines 48 (lead, 24 Nov 15:05) | T05-short | PASS |
| 72 | "Check all the fundamentals of the game, making sure it's as realistic as possible from what you can see and from what data you have" (24 Nov) | Our per-match figures on real fixtures within the range the sources give, widened by 20%; no source, no verdict | Realism table below (`harmonycheck.ts realism`) | FAIL (7 of 40 on 30 balanced fixtures: drop goals 0, kicks from hand 36, carries 181, tries from scrums 24%, penalty taps 2.8%, drop-goal success, penalties 12.7 by his choice) |
| 73 | "A card costs" (coordinator, 24 Nov, on the manager's levers) | A side with a man in the bin does worse a minute than with 15 | M02-card-cost | PASS |
| 74 | The captain effect (owner, 25 Nov, decision 3: yes, it stays) | A captain's leadership changes his side's discipline in its own 22 and a late call, as docs/match-sim-manager-levers.md describes | Accepted design | ACCEPTED (25 Nov) |
| 75 | Out-of-position costs as in round 7 (owner, 25 Nov, decision 4: yes, they stay) | A man out of position costs his side as measured in docs/match-sim-manager-levers.md | Accepted design | ACCEPTED (25 Nov) |
| 76 | Home advantage (owner, 25 Nov: "Leave it": it stays at the game's band, 51% to 57%) | Home wins in the game's band | F01 realism table (balanced set) | PASS (55.8% home wins on 120 balanced fixtures, round 6) |
| 77 | Disc size of v7 (owner, 25 Nov, decision 6: yes, it is fine) | | Accepted | ACCEPTED (25 Nov) |
| 78 | GO: "wire the new engine and pitch into the real match screen (Extended), with the manager's decisions, on the work branch only" (owner, 25 Nov, decision 7: yes): the stored result | The result the game stores for a watched Extended match is the match that was watched: score, tries, every scorer and his minute, cards, substitutions, injuries, and the season stats they feed | W01-stored (20 managed matches, scripted decisions: posts, a tactics change at 30:00, the No. 8 off at 50:00) | FAIL (1 of 20: seed 11, a try at minute 43 stored at 45) |
| 79 | Same: "This can't be a preset result" (24 Nov), through the real session | A decision at 50:00 through the session leaves every play before it the same and changes the match after it | W02-session-decisions | PASS (20 of 20 changed after the call, none before) |
| 80 | Same: the rest of the game untouched | With the new engine playing the managed match, every other fixture of that week has the same result as with the old engine's watched match; scripts/fingerprint.ts still passes | W03-rest-untouched, W04-fingerprint | PASS (220 other fixtures identical; fingerprint passes) |
| 81 | Same: the season still works | A season with every home match watched on the new engine: table, cards, injuries, condition, morale, money and player stats within 10% of the old engine; the saved game reads back and plays on the same | W05-season (`harmonycheck.ts season 3`) | FAIL (the managed side makes no substitutions; injuries -72%, morale -19%, money -15%, appearances -17%; save and load fine) |
| 82 | Same: player ratings | The adapter's match ratings by position on the old engine's scale and spread (mean within 10%, spread within 25%) | W06-ratings (`season 3`) | PASS (every position within 10% on mean, 25% on spread) |

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

The record breaks no law the checks know (R01 to R40 and B01 all pass, 24 Nov). What is open in the engine is realism and reach, not law: the levers that do nothing and the figures out of line with real rugby (round 5 section below, and scripts/tmp/requests.md, 24 Nov items 10 to 12).

## Penalties a match (R31, for the owner to decide)

320 matches (300 skeleton, 20 real) after GAMEPLAY's round 4 (f5318296), penalties and free kicks, both sides together:

| Per match | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 19 | 20 | 23 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Matches | 2 | 1 | 11 | 12 | 32 | 36 | 29 | 43 | 37 | 33 | 31 | 12 | 23 | 9 | 6 | 2 | 1 |

Mean 11.53, median 11, 5th percentile 7, 95th percentile 17. 3 matches have fewer than 6 and 9 have more than 17: 12 of 320 (3.8%) outside his 6 to 17. The question for him stands: is 6 to 17 a band every match must sit in, or the range the average should sit in?

## Eyes list (refreshed 25 Nov, round 8)

Open each link on the dev server; `from` is seconds on screen. These are the preview's record of the fixture (the same match the game would play for that seed and fixture); when ANIMATION's live screen lands the same moments should look the same there. Found with `npx vite-node scripts/harmonycheck.ts eyes` on the working tree at 14:10.

| | Moment | Where | Link | What to look for |
|---|---|---|---|---|
| 1 | A try build-up at clip pace | Real 4242 (Leicester RFC v Glasgow RFC), minute 37, play 305 | `/lp-record.html?rec=4242&from=193` | The whole move, from its first phase, at the 1.9.16 clips' pace; only a ball lying at a ruck wound on; a ticker line for every phase |
| 2 | A line break run down by the cover | Real 4242 (Leicester RFC v Glasgow RFC), minute 2, play 21 | `/lp-record.html?rec=4242&from=5` | The break at clip pace, the cover chasing across and the named man making the tackle |
| 3 | A maul | Real 4242 (Leicester RFC v Glasgow RFC), minute 27, play 211 | `/lp-record.html?rec=4242&from=132` | The lineout, the maul forming round the jumper, driven, and the ball out or the drive over |
| 4 | A switch or loop | Real 4242 (Leicester RFC v Glasgow RFC), minute 1, play 7 | `/lp-record.html?rec=4242&from=0` | The runner changing angle (switch) or the passer going round (loop), and the ticker naming it |
| 5 | A close finish | Real 4242 (Leicester RFC v Glasgow RFC), minute 76, play 626 | `/lp-record.html?rec=4242&from=465` | From 75:00 slower, at about 2x, to the whistle |
| 6 | A card period | Real 4242 (Leicester RFC v Glasgow RFC), minute 45, play 409 | `/lp-record.html?rec=4242&from=293` | The card flashes, 14 men for ten minutes, the return said and seen |
| 7 | An interception | Real 3 (Leicester RFC v Cape Town RFC), minute 73, play 496 | `/lp-record.html?rec=3&from=441` | The pass, the interceptor, the ball turning round with no jump, the flash |
| 8 | A dead ball | Real 4242 (Leicester RFC v Glasgow RFC), minute 36, play 298 | `/lp-record.html?rec=4242&from=189` | The kick goes over the try line and the dead-ball line before the 22 drop-out |
| 9 | The ticker in fast forward | Real 4242 (Leicester RFC v Glasgow RFC), minute 12, play 83 | `/lp-record.html?rec=4242&from=68` | Lines flicking through, each about the play on screen or the one before |
| 10 | A flash: a penalty goal | Real 4242 (Leicester RFC v Glasgow RFC), minute 19, play 152 | `/lp-record.html?rec=4242&from=94` | The flash with the kick, up long enough to read, the ball between the posts over the bar |

## Round 5 (24 Nov): realism, levers, boundaries, ticker

### Fundamentals against real rugby (item 72)

`npx vite-node scripts/harmonycheck.ts realism 60`: 60 real fixtures (Leicester's first fixture in a new game on seeds 1 to 60; engine as saved 14:53), against docs/match-sim-sources.md (commit 77b49a5f). The real band is the range of the sources' own figures; the verdict allows 20% either side of it; a figure with no source is not judged. Per match, both sides, unless stated.

| Figure | Ours | Real | Verdict (band widened 20%) | Source |
|---|---|---|---|---|
| Yellow cards a match | 0.97 | 0.53 to 2.40 | in line | s1: 0.53 6N 2017, 0.64 RWC 2019; Top 14 2024-25 0.6 to 1.2 a team |
| Red cards a match | 0.05 | 0.12 to 0.18 | LOW | s1: URC 2024-25 0.12, RWC 2019 0.18 |
| Line breaks a match | 4.58 | 9.60 to 10.70 | LOW | s3: 6N 2026 9.6, Prem 2022-23 10.5, URC 2025-26 10.7 |
| Offloads a match | 6.77 | 10.00 to 15.00 | LOW | s3: 6N 2026 10 (medium-low); RWC 2023 under 15 |
| Tackles a match (named tacklers on stopped carries) | 275.57 | 258.00 to 344.00 | in line | s4: RWC 2019 129 a team, URC 2025-26 344 |
| Tackle completion % | - | no source | | no record: the record has no missed tackles (s4: 84% to 89%) |
| Carries a match | 188.62 | 228.00 to 230.00 | in line | s4: RWC 2019 and 2023, 114 to 115 a team |
| Rucks and mauls a match | 168.52 | 158.00 to 164.00 | in line | s4: RWC, 79 to 82 rucks a team |
| Ruck retention %, side in possession | 94.72 | 92.00 to 98.00 | in line | s2: RWC 2019 94% (92% to 98% by team) |
| Turnovers won a match (ruck, interception, lineout steal, against the head) | 8.00 | 10.60 to 16.80 | LOW | s2: 5.3 to 8.4 a team, RWC 2023 and 6N 2026 (definitions differ) |
| Conversion success % | 80.85 | 75.00 to 83.00 | in line | s5: RWC 2019 75%, 6N 2017 83% |
| Penalty goal success % | 81.91 | 76.00 to 89.00 | in line | s5: RWC 2019 76%, 6N 2017 80%, Prem 2022-23 84% to 89% |
| Drop goal success % | 33.33 | 35.00 | in line | s5: RWC 2019 6 of 17 |
| Penalty goals kicked a match | 2.72 | 2.00 to 2.43 | in line | s10: 6N 2026 2.0; s5: Prem 2022-23 2.43 |
| Drop goals a match | 0.12 | 0.07 to 0.13 | in line | s10: Prem 2024-25 0.07, RWC 2019 and 6N 2017 0.13 |
| Own lineout won % | 86.54 | 87.00 to 91.00 | in line | s6: 6N 2017 87%, RWC 2019 88% to 91% |
| Own scrum won % | 93.35 | 84.00 to 95.00 | in line | s6: RWC 2019 93% to 95%, RWC 2023 84%, Prem 85% to 88% |
| Scrums ending in a penalty or free kick % | 16.51 | 27.00 to 33.00 | LOW | s6: RWC 2019 27%, 6N 2022 one in three |
| Scrum penalties a match | 1.92 | 3.10 to 3.70 | LOW | s6: RWC 2019 3.7, RWC 2023 3.1 |
| Mauls a match | 2.80 | 8.30 to 12.30 | LOW | s6: ROE 2025, Super Rugby 8.3 to Rugby Championship 12.3 (unit unclear) |
| Scrums a match | 15.55 | 10.20 to 14.40 | in line | s8: 6N 2025 10.2 to RWC 14.4 |
| Lineouts a match | 24.15 | 24.00 to 28.10 | in line | s6, s8: 6N 2017 24, domestic leagues 28.1 |
| Possessions a match | 79.62 | 84.80 to 100.00 | in line | s7: RWC 84.8 to 85.5; 6N 2025 about 50 a team |
| Phases (rucks) a possession | 1.91 | 1.80 to 3.00 | in line | s7: RWC 2023 1.8, RWC 2019 3.0, Prem 2.7 to 2.9 |
| Points per 22 entry | 1.88 | 1.49 to 3.40 | in line | s7: 6N 2024 and 2026, Italy 1.49 to Ireland 3.4 (team range) |
| 22 entries a match | 24.03 | no source | | no source |
| Tries from a lineout % | 37.56 | 47.00 to 49.00 | LOW | s7: 6N 2017 47%, RWC 2019 49% |
| Tries from a scrum % | 22.39 | 16.00 to 20.00 | in line | s7: RWC 2019 16%, 6N 2017 20% |
| Tries from an opposition kick % | 17.91 | 15.00 | in line | s7: RWC 2019 15% |
| Tries from a turnover % | 8.71 | 11.00 to 12.00 | LOW | s7: 6N 2017 11%, RWC 2019 12% |
| Tries from a restart % | 9.70 | 6.00 | HIGH | s7: RWC 2019 6% |
| Tries from a penalty or free kick tap % | 3.73 | 2.00 | HIGH | s7: RWC 2019 2% |
| Penalties and free kicks a match | 11.62 | 17.00 to 22.90 | LOW | s10: RWC 2019 17, 6N 2017 21, Prem 2022-23 22.9 (the owner chose 11 to 12, 20 Nov) |
| Penalties sent to touch % of penalties | 60.78 | 67.00 | in line | s10: RWC 2019 67% of penalty options |
| Knock-ons a match | 13.25 | 7.00 to 14.00 | in line | s11: about 7 knock-on scrums (6N 2025, low); handling errors about 7 a team (low) |
| Kicks from hand a match | 40.17 | 46.00 to 60.00 | in line | s12: RWC 2019 46, URC 2021-22 46, 6N 2026 about 30 a team |
| Kicks out on the full a match | 1.65 | no source | | no source (s12: not found) |
| Replacements used a match | 8.12 | 15.60 | LOW | s14: RWC 2019 15.6 |
| Injury stoppages a match | 0.37 | no source | | no source (s13 gives 3.0 time-loss injuries a match, a different measure) |
| Home win % | 43.33 | 58.90 to 71.50 | LOW | s9: pooled 58.9 to 63.9, Prem 65.6 and 69, Top 14 71.5 |
| Home points margin | -0.52 | 4.60 to 6.80 | LOW | s9: pooled +4.6 to +6.7, Prem 2024-25 +6.8 |
| Tries a match | 6.85 | 5.97 to 8.00 | in line | s9: Prem 2022-23 3.36 + 2.61; spec 4: RWC 2019 6.3, Prem 2024-25 8.0 |
| Points a match | 53.88 | 40.00 to 56.30 | in line | spec 4: RWC 2019 40, Prem 2024-25 56.3 (the game band is 48 to 53) |
| Ball in play, minutes | 35.10 | 33.40 to 35.70 | in line | spec 4: RWC 2019 35:44, Oval Insights 33.4 to 35.3 |

What is out of line, in plain words: about half the line breaks and a third of the mauls real rugby has; too few scrum penalties, offloads, turnovers and red cards; half the replacements; tries come too little from lineouts and too much from restarts; and no home advantage at all (43% home wins over these 60, though 60 fixtures of one club is about 6 points either way). Penalties are below Test rugby because the owner chose 11 to 12 on 20 Nov. In line: tackles, carries, rucks, ruck retention, goal kicking, set-piece success, scrums and lineouts a match, possessions, phases, points per 22 entry, knock-ons, kicks, tries, points, ball in play.

### The manager's levers (item 66)

`npx vite-node scripts/harmonycheck.ts levers 80`: fixture 1 (Leicester v La Rochelle, Leicester at home and managed), match seeds 2000 to 2079, each played with and without the call. "Acts" is a paired t of 2 or more the way rugby says; "weak" is the right way but not clearly; with 80 pairs an effect on the final margin smaller than about 4 points cannot be told from chance, so the levers are also measured on what they act on directly (kicks, scrums, goal kicks, penalties).

| Lever | From | Measure | Without | With | Change a match | Matches changed after | Paired t | Wanted | Changed before | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| strength x1.12 (any change of World) | 40:00 | margin after the call | -4.35 | 0.88 | +5.22 | 80/80 | 2.6 | + | 0 | acts |
| bench: props and hooker on at 55:00 | 55:00 | own points after 55:00 | 6.49 | 7.53 | +1.04 | 80/80 | 1.4 | + | 0 | weak (1 substitution(s) refused (not on the field)) |
| third-choice 10: the No. 10 off at 1:00 for the No. 23 | 1:00 | margin after the call | -6.36 | -8.49 | -2.13 | 80/80 | -1.0 | - | 0 | weak |
| bench: props and hooker on at 55:00 (the scrum) | 55:00 | own scrums won or penalty won, minus lost, after 55:00 | 1.65 | 1.71 | +0.06 | 80/80 | 0.4 | + | 0 | weak (1 substitution(s) refused (not on the field)) |
| third-choice 10 (goal kicking) | 1:00 | own kicks at goal missed minus made | -2.98 | -2.04 | +0.94 | 80/80 | 3.2 | + | 0 | acts |
| tactics: kicking 15 to 90 | 20:00 | own kicks from hand after the call | 14.68 | 18.65 | +3.98 | 80/80 | 5.6 | + | 0 | acts |
| tactics: aggression 90 | 20:00 | penalties conceded after the call | 5.15 | 5.00 | -0.15 | 80/80 | -0.5 | + | 0 | weak |
| tactics: tempo 90 | 20:00 | own carries after the call | 69.66 | 74.35 | +4.69 | 80/80 | 2.0 | + | 0 | acts |
| team talk: fire at half-time | 40:00 | margin after the call | -4.09 | -4.65 | -0.56 | 80/80 | -0.4 | any | 0 | weak |
| team talk: criticise at half-time | 40:00 | margin after the call | -4.09 | -5.65 | -1.56 | 80/80 | -1.0 | any | 0 | weak |
| penalty call: always posts | 0:00 | own kicks at goal | 1.40 | 2.41 | +1.01 | 53/80 | 6.7 | + | 0 | acts |
| penalty call: always corner | 0:00 | own lineouts after a penalty to touch | 3.26 | 5.13 | +1.86 | 80/80 | 8.4 | + | 0 | acts |

Every lever leaves every play before the call the same (0 changed before, every row) and changes the match after it. Two do nothing measurable: the front row off the bench (scrums t 0.4; fromMatch.ts says it does not model fresh legs), and aggression 90 (penalties conceded t -0.5). The team talks cannot be told from nothing at 80 pairs. A yellow card costs the carded side 0.44 points a minute against 0.01 with 15 men (318 cards, item 73). GAMEPLAY's docs/match-sim-manager-levers.md was not written, so its rows could not be checked; this table is the independent one.

### Boundaries, ticker, pace (items 64 to 71, 48 to 51)

On 7 real fixtures including the owner's 4242: every kick to touch (122), out on the full (12), carried into touch (21), try (48), goal over (59) and goal missed (13) crosses the right line on screen; every dead ball (11 of 11) stops 5.2 m past the try line, short of the dead-ball line 8 m past it. Ticker: 1.2 to 1.5 new lines a second in fast forward and 0.6 to 0.9 at clip pace (after thin()); every flash line there and up at least 2 s; no line ever ahead of the picture.

Thresholds that are mine and need his yes: 1.2 s as the longest silence with the ball in play, 2 s for a flash to stay up, 70 and 48 characters for a line, 2% of the time for a line more than one play behind, 15% either side of clip pace, the 20% allowance on the realism bands, a paired t of 2 for a lever to "act".

## Round 6 (24 Nov): checks brought in line with the lead's rulings, and what still fails

Changed in `scripts/harmonycheck.ts`: T02 counts a held line as on screen and lets a flash stay up; T05 caps by register (`reg` tick 70, full 90; `flash` 48); P04 fails only a play of a try's possession faster than 2.5x; P01 allows about 25 s a try beyond 6; B02 judges a touchdown in-goal at the dead-ball play's `out`, apart from a ball that ran dead; B01 also catches a touchdown grounded beyond the dead-ball line. F01 and the sameness comparison now run on a balanced set: one round of league fixtures from several leagues in new games for four clubs, nobody managed, both benches run by the game (`realism 120`, nine leagues). New modes: `spot 400` (three rows of docs/match-sim-manager-levers.md re-measured on its own fixture, 4242) and `clubs 8 12` (how much the clubs decide a match's style). My earlier type-check of these files had silently never run (TS5112); it does now, and they are clean apart from the missing Node types.

The questions asked, answered:
- Try build-ups in fast forward from their first play: REFUTED on the current pitch. No play of any try's possession runs faster than 2.5x in the 7 sampled matches (42 tries); every build-up play has a line but one.
- Dead balls stopping short: REFUTED. Every ball that ran dead crosses the dead-ball line on screen (6 of 6) and every touchdown in-goal is shown where it was grounded (3 of 3). One record contradiction was seen at 19:00 (real 6 play 263: landed 9.9 m past the try line, beyond the 8 m dead-ball line, yet "touched down"); the record changed under me and the last run does not have it.
- Lines more than one play behind, 2.2% to 4.1% of the time: CONFIRMED, and the cause is found. All of it is in fast forward (4.8% to 7.9% of fast-forward time, 0.0% to 0.2% at clip pace). feed() shows at most 3 lines a second and fast forward goes past 4 to 6 plays a second, so the shown line is two or three plays old.
- The half-time talk doing nothing: REFUTED at 400 paired seeds. Praise against criticise on 4242: second-half points 15.19 against 13.71 (paired t -3.1). docs/match-sim-manager-levers.md calls it dice at 2,000 pairs; the two disagree and GAMEPLAY should re-run that row. The other two rows checked agree with the doc: the fresh front row at 55:00 (scrums 1.40 to 1.84, t 4.8; doc 1.63 to 1.93) and aggression 20 v 80 (penalties 5.30 to 5.65, t 2.7; cards 0.34 to 0.72, t 7.7; doc 5.4 to 5.7 and 0.34 to 0.63).
- Clubs reading as different: YES in how they play, NO in what results. Over 8 pairings x 12 match seeds, the share of each figure's spread explained by which two clubs are playing (intraclass correlation): mauls 0.63 (5.6 to 16.6 a match by pairing), offloads 0.58 (3.3 to 13.3), kicks from hand 0.42 (33 to 53), carries 0.42, passes a carry 0.33, home margin 0.25, line breaks 0.20, tries 0.05, penalties 0.02. The sameness score does not see this (one pairing 55.0, twenty pairings 55.3) because it compares outcomes (try types, scoring order, wordings), and outcomes barely depend on the clubs. A watcher would see Saracens maul and kick and another side offload; he would not see the scorelines or the try types tell them apart.

Realism on 120 balanced league fixtures (prem 16, top14 16, urc 16, srp 16, champ 16, prod2 16, jl1 8, natl1 8, mrc 8): 4 of 40 sourced figures out of line, all small: drop-goal success 43.8% (real 35%), tries from a restart 7.4% (6%), tries from a penalty tap 2.9% (2%), and penalties 12.1 a match (Test rugby 17 to 22.9; the owner chose 11 to 12). Now in line: line breaks 12.3, offloads 10.9, mauls 8.6, scrum penalties 3.6, turnovers 10.7, red cards 0.13, replacements 15.9, home wins 55.8% with a margin of +4.4 (the round 5 "no home advantage" came from sampling only Leicester's fixtures). Carries are 184 a match against 228 to 230, inside the widened band but low.

## Round 8 (25 Nov): the owner's decisions, and the wiring

His decisions of 25 Nov, as checks: match length "1.C" (P01 is now a report, a warning only above 12 minutes); line breaks "Only big ones" (P03 asks clip pace only of `bigBreak()` breaks); the captain effect yes, out-of-position costs yes (accepted design, items 74 and 75); home advantage "Leave it" (the game's band, item 76); disc size yes (item 77); wiring yes (items 78 to 82). T01 and T04 now count every play from a run line's `run[0]` to `run[1]` as said.

The wiring checks (W01 to W06) call the session as GAMEPLAY wrote it: `startSim2(state, fx, seed, opts)`, `runUntil`, `pending` and `answer`, `apply`, `finish()`, with `sim2Seed` for the game's own seed. `npx vite-node scripts/harmonycheck.ts wiring 20` runs W01 to W04 (about 30 s); `season 3` runs W05 and W06 (about 6 minutes) and the main run reads its last result from scripts/tmp/harmony-season.json.

What they found on the adapter as it stood at 14:04:
- W01: in 19 of 20 managed matches with scripted decisions the stored fixture is the watched match exactly: score, tries, every scorer and his minute (stoppage time stored as 40 and 80, as the game does), cards, substitutions (named by the man on), injuries, and the scorers' season tries in competitive matches. One minute is wrong: seed 11, the try at play 285 (minute 43) is stored at minute 45. Earlier drafts stored every second-half event at minute 40; that is fixed.
- W02: through the session, a tactics call at 50:00 leaves every play before it the same and changes all 20 matches after it.
- W03: in four managed weeks, all 220 other fixtures have the same result whether the managed match was played by the old engine or the new: the new engine does not move the week's dice. W04: fingerprint passes.
- W05, three seasons for Leicester with every home match watched, new engine against old (figures a season):

| Figure | Old engine | New engine | Change | Flag |
|---|---|---|---|---|
| points | 45.00 | 42.67 | -5% |  |
| position | 6.33 | 5.67 | -11% | OFF BY MORE THAN 10% |
| yellow | 9.67 | 9.67 | +0% |  |
| red | 0.00 | 1.33 | +133% | OFF BY MORE THAN 10% |
| injuriesInMatch | 8.33 | 2.33 | -72% | OFF BY MORE THAN 10% |
| injuredNow | 2.33 | 1.00 | -57% | OFF BY MORE THAN 10% |
| bannedNow | 0.00 | 0.00 | +0% |  |
| condition | 91.66 | 90.75 | -1% |  |
| morale | 6.19 | 5.01 | -19% | OFF BY MORE THAN 10% |
| balance | 3755252.00 | 3183579.33 | -15% | OFF BY MORE THAN 10% |
| apps | 565.67 | 470.00 | -17% | OFF BY MORE THAN 10% |
| tries | 83.67 | 74.67 | -11% | OFF BY MORE THAN 10% |
| playerPoints | 669.00 | 644.67 | -4% |  |
| Position | Old: ratings n, mean, sd | New: n, mean, sd |
|---|---|---|
| LP | 76, 6.21, 1.14 | 39, 6.11, 1.20 |
| HK | 76, 6.21, 1.13 | 38, 6.17, 1.16 |
| TP | 76, 6.26, 1.17 | 38, 6.06, 1.19 |
| LK | 114, 6.24, 1.12 | 77, 6.29, 1.18 |
| FL | 114, 6.28, 1.22 | 78, 6.29, 1.31 |
| SH | 68, 6.18, 1.22 | 39, 5.99, 1.15 |
| FH | 72, 6.36, 1.20 | 38, 6.50, 1.37 |
| CE | 112, 6.29, 1.17 | 76, 6.29, 1.44 |
| WG | 76, 6.39, 1.22 | 76, 6.37, 1.38 |
| N8 | 38, 6.30, 1.23 | 38, 6.13, 1.30 |
| FB | 38, 6.32, 1.25 | 38, 6.17, 1.10 |

  Save and load: the saved text reads back (save.ts readImport) and plays the next three weeks the same as the game that was not saved. The biggest cause found: the manager's side never uses its bench in the session, even with `assistantBench: true` (seed 301: 0 changes for Leicester, 8 for the opponent), while the old engine's watched match does. The in-match injuries are also far fewer (the traced match had none). Three seasons is a small sample for the table figures (position, red cards); the bench and injury gaps are far beyond it.
- W06: the adapter's match ratings by position are within 10% of the old engine's means and 25% of its spreads in every position.

## Final status (25 November 2026, round 8, 14:20)

Run: `npx vite-node scripts/harmonycheck.ts` on eb4952ae and the working tree (toResult.ts 14:04, commentary 13:41, pitch 13:24). HARMONY FAILED on 3 of 81 rules: 78 pass, none not run. Quick test 32 of 32. `wiring 20`, `season 3`.

Checklist totals: 63 PASS, 3 FAIL (items 72, 78, 81), 1 REPORT (48), 3 ACCEPTED (74, 75, 77), 7 NEEDS HIS EYES (3, 5, 7, 19, 36, 46, 63), 5 RETIRED (34, 35, 47, 58, 59). 82 items.

What truly fails:
1. Item 81, W05 (GAMEPLAY): the managed side never uses its bench in the session, even with the assistant holding it (seed 301); a season on the new engine has 17% fewer appearances, 72% fewer in-match injuries, morale 19% lower and 15% less money than on the old.
2. Item 78, W01 (GAMEPLAY): one stored minute wrong in 20 managed matches (seed 11, play 285, minute 43 stored as 45).
3. Item 72, F01 (GAMEPLAY): on 30 balanced fixtures, no drop goals, kicks from hand 36 a match (real 46 to 60), carries 181 (228 to 230), tries from scrums 24% (16% to 20%).
Not run: nothing. The live screen itself is not tested by machine yet: the checks drive the session the screen is to use.

## Final status (24 November 2026, round 6, 19:25)

Run: `npx vite-node scripts/harmonycheck.ts` on the working tree (round 6 commits 8186ae37, 080911e2, 28c22083, plus uncommitted engine changes saved 19:05 and pitch changes saved 19:21). 89 s. HARMONY FAILED: 68 rules pass, 7 fail. Quick test: `npx vitest run tests/simharmony.test.ts`, 32 of 32 pass. Separately: `realism 120` (4 out of line), `spot 400` (3 of 4 doc figures confirmed, the half-time talk disputed), `clubs 8 12`.

Checklist totals: 54 PASS, 7 FAIL (items 48, 50, 67, 68, 70, 71, 72; item 62 passes on its own measure, but see round 6 on club identity), 7 NEEDS HIS EYES (3, 5, 7, 19, 36, 46, 63), 5 RETIRED (34, 35, 47, 58, 59). 73 items.

What truly still fails:
1. Item 50, P03 (ANIMATION): line breaks shown at 3.0x, not clip pace: real 10 play 390, real 11 play 229 (lineBreak/hauledDown); 1 to 5 key moments a match.
2. Item 70, T04 (COMMENTARY): the line two or more plays behind in fast forward, 4.8% to 7.9% of fast-forward time (feed() caps at 3 lines a second).
3. Item 71, T05 (COMMENTARY): key flashes up to 88 characters (real 10: "Scrum penalty to Cardiff RFC, in their own half. Joaquin Moro is pinged for not binding."), 11 to 15 a match; try, goal and card flashes are all 48 or fewer.
4. Item 48, P01 (ANIMATION): real 4242 runs 11.27 minutes with 9 tries (ceiling 10.25), with a close finish at 2x.
5. Item 68, T02 (COMMENTARY): no dead air anywhere, but a line stays up 2.6 to 3.7 s at clip pace 0 to 15 times a match.
Also: item 67 (1 build-up play with no line, real 4242 play 136) and item 72 (4 small realism misses).
