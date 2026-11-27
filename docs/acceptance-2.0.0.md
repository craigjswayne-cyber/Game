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
| 43 | "There is still no connection with players, commentary & graphics" (20 Nov, 22:06) | Every man named in a play is on the side it says and on the field (through substitutions); every man named in the words is in that play, or the one it gives as the reason, or is its offender | R26-names, C05-line-player (round 9: also items 83 and 84's rulings) | PASS |
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
| 72 | "Check all the fundamentals of the game, making sure it's as realistic as possible from what you can see and from what data you have" (24 Nov) | Our per-match figures on real fixtures within the range the sources give, widened by 20%; no source, no verdict | Realism table below (`harmonycheck.ts realism`) | FAIL (round 9: 4 of 40 on 30 balanced fixtures: tries from turnovers 16%, from restarts 8.7%, from tapped penalties 3.6%, penalties 12.0 by his choice; drop goals, kicks from hand, carries and tries from scrums now in line) |
| 73 | "A card costs" (coordinator, 24 Nov, on the manager's levers) | A side with a man in the bin does worse a minute than with 15 | M02-card-cost | PASS |
| 74 | The captain effect (owner, 25 Nov, decision 3: yes, it stays) | A captain's leadership changes his side's discipline in its own 22 and a late call, as docs/match-sim-manager-levers.md describes | Accepted design | ACCEPTED (25 Nov) |
| 75 | Out-of-position costs as in round 7 (owner, 25 Nov, decision 4: yes, they stay) | A man out of position costs his side as measured in docs/match-sim-manager-levers.md | Accepted design | ACCEPTED (25 Nov) |
| 76 | Home advantage (owner, 25 Nov: "Leave it": it stays at the game's band, 51% to 57%) | Home wins in the game's band | F01 realism table (balanced set) | PASS (55.8% home wins on 120 balanced fixtures, round 6) |
| 77 | Disc size of v7 (owner, 25 Nov, decision 6: yes, it is fine) | | Accepted | ACCEPTED (25 Nov) |
| 78 | GO: "wire the new engine and pitch into the real match screen (Extended), with the manager's decisions, on the work branch only" (owner, 25 Nov, decision 7: yes): the stored result | The result the game stores for a watched Extended match is the match that was watched: score, tries, every scorer and his minute, cards, substitutions, injuries, and the season stats they feed | W01-stored (20 managed matches, scripted decisions: posts, a tactics change at 30:00, the No. 8 off at 50:00) | PASS (round 9, 717f62db: 20 of 20 exactly as watched) |
| 79 | Same: "This can't be a preset result" (24 Nov), through the real session | A decision at 50:00 through the session leaves every play before it the same and changes the match after it | W02-session-decisions | PASS (20 of 20 changed after the call, none before) |
| 80 | Same: the rest of the game untouched | With the new engine playing the managed match, every other fixture of that week has the same result as with the old engine's watched match; scripts/fingerprint.ts still passes | W03-rest-untouched, W04-fingerprint | PASS (220 other fixtures identical; fingerprint passes) |
| 81 | Same: the season still works | A season with every home match watched on the new engine: table, cards, injuries, condition, morale, money and player stats within 10% of the old engine, judged beyond the noise (round 9: a figure fails when it is off by 10% and its paired difference is outside the 95% band); the saved game reads back and plays on the same | W05-season (`harmonycheck.ts season N`); yellow cards a match on both engines from the same state (`harmonycheck.ts cards 5`) | FAIL on red cards only (8 seasons: 0.25 a season on the old engine, 1.75 on the new, beyond the noise; GAMEPLAY's stated choice, the sources' 0.12 to 0.18 a match: a ruling is needed). Everything else is within 10% or inside the noise; yellow cards are not higher (613 paired matches, below); save and load fine |
| 82 | Same: player ratings | The adapter's match ratings by position on the old engine's scale and spread (mean within 10%, spread within 25%) | W06-ratings (`season 3`) | PASS (every position within 10% on mean, 25% on spread) |
| 83 | C05 ruling (coordinator, 25 Nov, round 9): "accept (a) a half-time or full-time summary line naming a man from earlier in the match (standout, deciding scorer, player of the match), checked true against the record so far, and (b) the defender named in a line break's `beat` field" | A whistle summary names a man who is in the record, and every number it gives (tries, turnovers won, tackles, carries and metres, the deciding score's man, kind and minute, the game's player of the match) is the record's; a beaten defender is in the play's `beat`, on the field and not in the bin | C05-line-player (`summaryClaimWrong`) | PASS (with both switches on in a trial copy: 50 named whistle lines and 225 named beaten defenders on 20 real fixtures, all true; 13 of 13 altered claims caught) |
| 84 | The screen cannot drift from the session (coordinator, 25 Nov, round 9) | Sim2Live.tsx and stream.ts get plays and results only through the store's session, never by simulating on their own | W07-screen-session: import, source and run-time proof | PASS (committed tree and working tree) |

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

## Round 9 (25 Nov): C05 ruling, GAMEPLAY's fix table, yellow cards, the screen

Run on the committed tree (73284195; src/game is clean, and the working tree differs only in ANIMATION's UI files and tests).

**C05 (item 83).** A whistle summary (decidedTry, decidedKick, motm, standTries, standSteals, standTackles, standCarries) may name a man from earlier in the match. Its claim is held to the record up to the whistle (`summaryClaimWrong`): every count it gives must equal the record's, and so must the deciding score's man, kind and minute. A beaten defender in a play's `beat` counts as in that play, with the usual on-the-field checks. I tried it on a copy of commentary.ts with both switches on (`HARMONY_COMM=/abs/path/scripts/tmp/commentary-named.ts`). C05 passes on 300 seeds and 20 real fixtures, with 50 named whistle lines and 225 named beaten defenders. Every altered claim was caught (13 of 13). COMMENTARY is told to turn `NAMED_SUMMARY` and `NAMED_BEAT` on.

**GAMEPLAY's fix table, `season 3` re-run (confirmed exactly).** Figures a season, old engine against new:
- appearances 566 against 581;
- in-match injuries 8.3 against 9.3;
- morale 6.2 against 5.6;
- balance 3.76m against 3.48m;
- tries 83.7 against 75.0;
- yellow cards 9.7 against 12.3.

`wiring 20`: W01 20 of 20, W02 20 of 20, W03 220 of 220, fingerprint passes.

**Noise.** Three seasons cannot tell 10% from nothing. Leicester's yellow cards on the old engine alone were 5, 15 and 9 in the three seasons. W05 now fails a figure only when it is off by more than 10% and its paired difference (seasons paired by seed) is outside the 95% band (t on n - 1 degrees of freedom). Re-run on 8 seasons:

| Figure (a season) | Old engine | New engine | Change | 95% band of the difference | Verdict |
|---|---|---|---|---|---|
| points | 46.38 | 46.00 | -1% | 12.41 | |
| position | 5.75 | 5.75 | +0% | 3.09 | |
| yellow | 10.25 | 11.63 | +13% | 3.31 | within the noise |
| red | 0.25 | 1.75 | +600% | 1.00 | OFF |
| injuriesInMatch | 12.63 | 10.75 | -15% | 4.29 | within the noise |
| injuredNow | 2.63 | 1.75 | -33% | 2.06 | within the noise |
| bannedNow | 0.00 | 0.25 | | 0.39 | within the noise |
| condition | 92.01 | 92.20 | +0% | 2.22 | |
| morale | 6.40 | 5.91 | -8% | 1.41 | |
| balance | 4,166,968 | 3,848,798 | -8% | 2,995,827 | |
| apps | 564.13 | 567.25 | +1% | 27.22 | |
| tries | 79.63 | 70.63 | -11% | 12.13 | within the noise (but -10% and -11% in both runs: worth watching) |
| playerPoints | 636.00 | 620.00 | -3% | 103.08 | |

Ratings (W06) on 8 seasons: every position within 10% on mean and 25% on spread. The new engine's means are 0.06 to 0.22 lower in every position. Save and load: fine.

**Yellow cards, measured properly (`cards 5`).** 613 managed matches: new games for Leicester, Toulouse, Leinster and Northampton, five seeds each (901 and up), every managed match to the end of the league. Each match was played on both engines from the same state, with the assistant holding the bench on the new. Per match:

| | Old engine | New engine | New - old (paired t) |
|---|---|---|---|
| Yellow cards, managed side | 0.775 | 0.612 | -0.163 (t -3.2) |
| Yellow cards, opponent | 0.804 | 0.649 | -0.155 (t -3.2) |
| Red cards, managed side | 0.018 | 0.078 | +0.060 (t 4.8) |
| Red cards, opponent | 0.015 | 0.072 | +0.057 (t 4.9) |

The managed side is carded less at home (0.63 against 0.76), less away (0.59 against 0.79), and less for every one of the four clubs. On the new engine both sides concede penalties at about the same rate (managed 5.29, opponent 5.59) and are carded at the same rate per penalty (0.116). The managed side's card price at kick-off is a little higher (cardRisk 0.0139 against 0.0129, its tactics' aggression), and the engine reads it.

So the new engine does not card the managed side more. It cards both sides about 20% fewer yellows (1.26 a match in all, inside the sources' 0.53 to 2.40). The season's +28% and +13% are season-to-season drift: three or eight seasons of about 12 home matches each, with each engine's seasons running their own course. Red cards are up on both sides, as GAMEPLAY chose (0.15 a match, in the sources' 0.12 to 0.18; the old engine's 0.03 is below them).

**The screen (item 84, W07).** Proof at three levels:
- **Import and source:** Sim2Live.tsx and every one of the 39 UI files it reaches by import have no value import of skeleton, fromMatch, world, toResult, matchEngine's simulators, match/*, dice or rng. Their code names none of the simulator's entry points and never steps an engine (`.runUntil(`, `.step()`). The screen takes only `fromSim2`, `StreamFeed` and types from stream.ts, and makes its one session as `fromSim2(live.sim2!, …)` with `live = useStore(s => s.liveMatch)`. In stream.ts, MatchSim, worldFromMatch and mulberry32 appear only inside `standInSession`, and nothing in src calls it; only tests/simstream.test.ts does.
- **Run time:** `fromSim2` over a `startSim2` session hands back the session's own plays array, through the screen's own calls (`playOut`), to the same result.
- **Tested against breakage:** four planted breaches were each caught on a copy of the tree: a MatchSim import, the stand-in in place of the store's session, a MatchSim inside fromSim2, and a `.runUntil` on the screen.

It passes on both the committed tree and the working tree.

**My own check errors found this round.** R37 took the No. 8's injury replacement at minute 16 for the manager's substitution (seed 3). It now looks only from the call on, and accepts a refusal because he is already off. Yellow-card causes are in the play's `result`, not `cause`.

## Overnight audit, interim (27 Nov, 03:30 UTC; engine fe485f15, commentary 8d8a328f, screen 0a023fa1)

In short (details in the sections below):
- **Referees:**
  - 12.14 penalties and free kicks a match (owner: 11 to 12), with 5th to 95th percentile 7 to 17 (inside 6 to 17);
  - by referee, 10.4 to 13.7 a match;
  - strict referees give 1.71 yellows a match, lenient 0.50;
  - the warning comes one penalty short of his limit every time (0 faults in 480 matches).
- **The other coach:** 1,772 changes in 480 matches, every one with a true reason at that moment and none for the managed side. Turned on and off over 300 paired managed matches it adds no strength the sample can see: +0.8 win points (plus or minus 5.3), margin -0.37 (t -0.5).
- **Wind:**
  - every kick, goal kick and conversion is tagged right for the end and the half;
  - kicks go about 12% further with the wind and 11% shorter into it;
  - goal kicks from 40 m and more go over 71% of the time with the wind against 59% into it.
  - Fault: a penalty kicked to touch has no wind (772 in 480 matches; first seed 1100001, play 72).
- **Set pieces:** lineout calls, scrum options within 7 m, the 5 m law, pushovers and kick-off calls are all right. Second yellows 0.008 a match and straight reds 0.035, at the old engine's rates.
- **Bands (balanced set, 480 matches):** points 51.6 and home wins 56.4% are in. Tries 6.72 (95% interval 6.53 to 6.91) are just over 6.6, and penalties 12.14 just over 12.
- **Commentary:** facts against the game state for 40 managed matches with `contextFromGame` (about 2,400 lines): 0 faults. The held-back named whistle lines pass C05's truth checks, and COMMENTARY is told to turn `NAMED_WHISTLE_MORE` on.
- **Wiring:** `wiring 20` all pass; every kickable penalty prompts (89 of 89); a reload goes to Home with the match completed.
- **Season** (16 paired seasons): yellow cards are 23% below the old engine, beyond the noise. The balance is 33% lower, just beyond the noise. It is not the match path (same state, same money); the seasons run apart. Everything else is within range.
- **Licensing:** the strings themselves are clean. Real referees' and players' names are now on screen every match, with judgements attached ("strict", "the culprit"). Also flagged: "LIONS:" at internationals.ts:225, "Little" and "Greater Twickenham", "Sauvez Sapiac", the final venues, competitions that echo real ones, "Sarries" and "Quins", and 139 club and ground rows that are, or echo, real ones. Full list below.
- **Screen at 03:10** (build of 01:01): the "Knock-on" plate at the top of the pitch lay over Munster's 11 and 13 at 2:00 (/tmp/ov/plate2.png); the animation agent is now putting every plate through one placement rule (plates.ts). Pre-match 10.6 s, and "Skip" gets the kick-off on screen in 0.6 s.
- **The screen at 1f608b2b** (build of 05:24, seen in Chrome as a player, Leicester v Munster at Normal; pictures /tmp/ov/plate1 to 12.png and score1 to 3.png). Every plate (knock-on, penalty, yellow card, penalty goal, try, conversion, turnover, touch, drop-out) now sits small at the foot over the near stand, clear of the ball and the men: 12 of 12 seen. The try scorer's tag ("Hodnett") is on the man at the ball, the one the record and the plate name (John Hodnett, 15'). Skip gets the kick-off on screen in 0.5 s.
- **The lead's question on 3 of 117 maul tries** (seeds 6, 10, 11: the picture grounds the ball with the maul's carrier, while the record names the man next to him): the record is the result and must win. With the engine frozen, the picture should put the named man on the ball at the grounding (the tag already follows the record). Until then it is a picture fault, not an accepted difference.
- **Final runs (05:30 on 1f608b2b, repeated 06:11 on 23c6c06b with the same result):**
  - Main run: 81 of 82 rules. Every pitch row (P01 to P07, S01 to S03) and every ticker row (T01 to T05) passes. Only F01 fails (30 fixtures: red cards and penalties are the owner's choice; drop goals, tries from kicks, turnovers and taps are GAMEPLAY's).
  - `wiring 20`: W01 to W04 and W07 all pass (46 screen files).
  - Quick test: 32 of 32.

### Detail

`npx vite-node scripts/harmonycheck.ts overnight 120 4 10 30`: 480 matches of the balanced set (120 fixtures, four seeds each) and 300 paired managed matches with the other coach on and off. Every figure is counted from the record, not from skeleton.ts's own sums. Output: scripts/tmp/harmony-overnight.json.

**Referees.**
- Penalties and free kicks: a mean of 12.14 a match, with the 5th to 95th percentile at 7 to 17 (owner: a mean of 11 to 12, spread inside 6 to 17). The mean is 0.14 above his band. The extremes are 2 and 23.
- By referee the mean runs from 10.4 (Brace) to 13.7 (Barrett-Theron).
- By style: strict referees give 1.71 yellows a match, fair 0.92 and lenient 0.50. A strict referee gives 3.4 times a lenient one's yellows; GAMEPLAY said about twice.
- The warning comes at the side's penalty one short of his limit every time: 0 faults in 480 matches, and never on a free kick.

**Cards.** Second yellows 0.008 a match (old engine 0.007). Straight reds 0.035 (owner's rate, 0.038).

**Bands (balanced set).** Points 51.6 (48 to 53), home wins 56.4% (51 to 57), tries 6.72 (6.0 to 6.6): tries are 0.12 above the band.

**The other coach.**
- 1,772 changes in 480 matches: man up 603, chasing 548, protecting 329, front row 182, rain 98, scrum on top 12.
- Every one has a true reason at that moment: 0 faults. That covers the score and the clock, a man binned, sent off or hurt and waiting for cover, the weather, and the scrum penalty counts.
- The managed side never gets one.
- On and off over 300 paired managed matches: the coached side's win rate is 58.0% off and 58.8% on (+0.8 points, 95% interval plus or minus 5.3), and its margin changes by -0.37 a match (t -0.5). Nothing before the first change differs. No strength is added that this sample can see.

**Wind.**
- Every kick from hand, penalty goal and conversion carries the right `with` or `into` tag for the wind, the end and the half: 0 faults. The ends change at half-time, and the direction is one value per match.
- Lengths with the wind against into it: clearance 39.5 against 31.6 m (calm 35.4), box 23.7 against 19.2.
- Penalty goals from 40 m and more: 71% with the wind against 59% into it.
- Fault: a penalty kicked to touch (the corner or down the line, skeleton.ts corner()) has no wind on its length and no tag. That is 772 of them in 480 matches; first prem Exeter v Sarries, seed 1100001, play 72.

**Heat.** 108 of 480 matches are hot days. The faster drain is not visible in the record beyond the flag.

**Set pieces.**
- Lineout calls: front 3,416 (stolen 4.4%, 20% inside their 25), middle 4,150 (7.6%, 14%), tail 2,845 (9.6%, 8%).
- Scrum options come only within 7 m of their line: shove 43, eight pick 34, back-row move 26. Pushover tries come only from a shove, each followed by its try: 7 in all, 0.015 a match.
- No scrum is set less than 5 m from a goal line (Law 19). Kick-off calls are right for the score and the clock.

**Wiring and the season on the frozen engine.**
- `wiring 20`: W01 20 of 20, W02 20 of 20, W03 220 of 220, fingerprint passes. W07 passes on ANIMATION's working tree, and now also reads the commentary worker the screen starts (43 files).
- Every kickable penalty to the managed side stops the match for his call: 89 of 89 in 20 managed matches. The two penalties with no prompt were penalty tries.
- `season 3` and `season 8`, and eight more seasons on seeds 309 to 316: 16 paired seasons in all, Leicester, every home match watched in Extended, with the other coach now reacting. Two figures are off by more than 10% beyond the noise:
  - yellow cards 9.9 a season on the old engine against 7.6 on the new (-23%, 95% band 1.8). This matches round 9's 613 paired matches (0.61 against 0.78 a match). The owner ruled on red cards only.
  - the club's balance at the league's end, 4.27m against 2.85m (-33%, band 1.35m).
- Everything else is inside its band: points -7%, position, injuries, morale -7%, appearances, tries -5%. The ratings stay within W06 (new means 0.06 to 0.2 lower).
- Save and load: fine.
- In round 9, eight seasons on the same seeds had the balance at -8%. The old engine's figures are the same as then, so the move is the new engine's.
- Where the money goes. It is not the match path: from the same state (seed 304, week 8), the old and the new engine's home match give the same week's money to the pound (2.19m). The new engine also scored 18-21 where the old scored 40-50.
  - Ordinary home weeks earn the same on either engine, about 0.6m. The gap comes from a few lumpy weeks (a sportsman's dinner, a concert, a sale) that land in one engine's season and not the other's, because the seasons have run apart.
  - So it is the knock-on of different seasons, just beyond the noise over 16 seasons. It is not a wiring fault, but it is worth watching.

**The screen (interim, 01:30, ANIMATION's build of 01:01 on port 5191; re-run at 06:30).** Driven in Chrome as a player: a new career, Leicester, Extended, kick-off (/tmp/ov/screen.mjs).
- The pre-match block runs 10.6 s before the kick-off. "Skip" ends it at once: the first play is on screen 0.6 s after the tap.
- Plates: the event plates ("Knock-on", "Penalty") sit at the top of the pitch, and when play is there they cover men. At 2:00 the "KNOCK-ON / LEICESTER" plate lay over Munster's 11 and 13 (screenshot /tmp/ov/plate2.png). The ball was clear of it. Eyes item.
- Frame gaps on this shared two-core machine: at full CPU the median gap is 16.7 ms (60 a second) and 13% of gaps run over 17.5 ms. With the CPU throttled four times, half the frames are late.

**The commentary's facts (`ctxaudit 40`).** I ran 40 managed matches through the session, at points through the season, for four clubs. Each had the context built with `contextFromGame` at kick-off, and the commentary came from a copy with every switch on (scripts/tmp/commentary-named.ts). About 2,400 lines of 77 kinds were checked against the game state worked out separately.
- **What was checked:** form, table positions and gaps, round, crowd and capacity, the last meeting, team news (debuts against career appearances before the match, milestones, returns, old clubs, absentees), the referee, the weather, the next fixture, and season and career tries.
- **After full time:** the table and bonus points, against the points the game itself gives when the week is played on.
- **Co-commentator:** its numbers over each spell, as the commentary resets it.
- **Other lines:** pointers only to the managed side, and crowd lines only at real events.

The whole match also went through checkLines with the team sheet (C01 to C09, including the new named whistle lines). Result: 0 checkLines failures. Three fact faults, all checks of mine, now fixed:
- injury weeks read after the match;
- debuts counted after the game had added this match;
- "penalties conceded" counted with free kicks.

C05 now also accepts:
- pre-match lines naming a man in either 23;
- the other coach's line on the side the record names;
- a first touch on the man's own side;
- the co-commentator, duels and full-time block as lines about the match so far.

**Interim status (01:30 UTC).** Main run on fe485f15, 8d8a328f and ANIMATION's working tree: 81 of 82 rules pass. F01 (realism, 30 fixtures) is the one that fails, and red cards and penalties there are the owner's choice. The remaining items, to be re-run on ANIMATION's files at 06:30, are the pitch rows, the screen checks and the full run.

### Licensing sweep (27 Nov, for the owner; nothing changed; part of the overnight audit, interim)

What I swept: every English string a player can read in the new work and on the match screen (en.json `sim.`, `sim2.` and `lp.`: 2,295 keys), and the names those lines fill in. The names are clubs, grounds, competitions, final venues, referees, derbies and players.

The judgements below come from my own knowledge of the real names; I have not checked them against a source. The lead should confirm each one before anything is renamed.

**The strings themselves are clean.** None of the 2,295 keys holds a proper name. A scan for real clubs, grounds, competitions, broadcasters, kit makers, sponsors and "Lions" finds only "TMO" (lp.tmo, "TMO check"), which is the sport's own term. Every name on screen comes from the game's data.

**Most exposed, now on screen every match:**
1. **Real people.**
   - **Referees:** the panel in src/game/match/referee.ts, lines 76 to 97, is real referees by name: Luke Pearce, Karl Dickson, Matthew Carley, Christophe Ridley, Angus Gardner, Nika Amashukeli, Andrea Piardi, Paul Williams, Ben O'Keeffe, Nic Berry, Hollie Davidson, Andrew Brace, Pierre Brousset, Sara Cox and Aimee Barrett-Theron. The new pre-match lines name him ("preRef", "refKnown"), and so do the warning and repeat-offence lines. Each one is also given a style the record acts on ("strict", "lenient", "short fuse"), so a real official is described as fussy or card-happy.
   - **Players:** the squads in src/data/leagues/*.ts (about 4,000 entries) and the captains in src/data/captains.ts are real players. Every line naming a man uses them. The new lines go further: storylines, milestones, "the culprit" (most penalised) and duel verdicts say things about named real men.
2. **"Lions":**
   - src/game/season/internationals.ts:225, the news subject `LIONS: ... make the tour`;
   - src/game/schedule.ts:503 and :896, the tours "British & Irish Isles Tour of ..." and "Women's British & Irish Isles Tour of ...", which echo the British & Irish Lions (id 'lions');
   - en.json:3305 compLions, :3601 natLions and :5727 theLionsTour read "Isles Tour" (the keys say Lions; the text does not);
   - src/game/save.ts:642 to 644 holds the old names, only to rename old saves.
3. **Final venues** (src/game/model/competition.ts:50 to 56):
   - "Greater Twickenham" (Twickenham Stadium);
   - "Grand Stade de Paris" (Stade de France);
   - "Cardiff National Stadium" (the Principality, once the Millennium, Stadium);
   - "Marseille Stadium" (the Vélodrome);
   - "Edinburgh Stadium" (Murrayfield);
   - "Crocker Park" (Croke Park);
   - "Greater London Stadium" (the London Stadium).
4. **"Sauvez Sapiac":** en.json:3139 (also af.json:3138, ja.json:2993) and the challenge text en.json:5721. Stade Sapiac is Montauban's real ground, and the line reads as a real supporters' campaign.

**Competitions** (src/game/newgame.ts:207 to 214, src/game/schedule.ts):
- English Premier Division (the Premiership);
- French Elite 14 and French Elite 2 (Top 14, Pro D2);
- United Provinces Championship (United Rugby Championship);
- Pacific Championship (Super Rugby Pacific);
- Japan Division One (Japan Rugby League One);
- English National One (National League 1);
- Continental Cup, and The Hemispheric Championship at schedule.ts:756 (the Champions Cup);
- Northern Championship at :564 (the Six Nations);
- The Southern Championship at :585 (The Rugby Championship);
- Pacific Islands Cup at :604 (the Pacific Nations Cup);
- World Championship at :408 (the World Cup).

These are generic descriptions rather than the real marks, but each points clearly at one competition. The preRound and introCup lines say them.

**Derbies** (src/game/rivalries.ts:6 to 32, said by preDerbyName):
- "The East Midlands Derby", "The West Country Derby", "The London Derby" and the rest are the descriptions the real fixtures go by;
- "The Oldest Fixture - the Richmond Derby" (line 28) is the real Richmond v London Scottish fixture.

**Sponsors** (src/game/commercial.ts:181): made up as far as I can tell. "Fenwick Dairies" shares a name with the Fenwick department stores; low risk.

**Clubs and grounds the ticker names** (introVenue, preCrowd, preFull and every team name). Most clubs are their real city or province plus RFC or RC, which looks like the design's own choice. Listed here are the ones that go further than that, with the line each is defined on:

| Club or ground (as the ticker shows it) | File and line | Is, or closely echoes |
|---|---|---|
| Ealing Sports Ground (ground of Ealing RFC) | src/data/leagues/champ.ts:118 | Trailfinders Sports Ground (Ealing) |
| Castle Park (ground of Doncaster RFC) | src/data/leagues/champ.ts:119 | Castle Park (real, Doncaster Knights) |
| Butts Lane Arena (ground of Coventry RFC) | src/data/leagues/champ.ts:120 | Butts Park Arena (Coventry) |
| Goldington Road (ground of Bedford RFC) | src/data/leagues/champ.ts:121 | Goldington Road (real, Bedford Blues) |
| Hartpury RFC (club) | src/data/leagues/champ.ts:124 | Hartpury University RFC (real) |
| Gillmore's Ground (ground of Hartpury RFC) | src/data/leagues/champ.ts:124 | Gillman's Ground (Hartpury) |
| Richmond RFC (club) | src/data/leagues/champ.ts:125 | Richmond FC (real) |
| The Athletic Ground (ground of Richmond RFC) | src/data/leagues/champ.ts:125 | the Athletic Ground (real, Richmond and London Scottish) |
| Kingsey Road (ground of Chinnor RFC) | src/data/leagues/champ.ts:126 | Kingsey Road (real, Chinnor) |
| Sixwell Stadium (ground of Worcester RFC) | src/data/leagues/champ.ts:135 | Sixways (Worcester) |
| Dellingham Park (ground of Ampthill RFC) | src/data/leagues/champ.ts:136 | Dillingham Park (Ampthill) |
| Clifton Road (ground of Rotherham RFC) | src/data/leagues/champ.ts:138 | Clifton Lane (Rotherham Titans) |
| Blackheath RFC (club) | src/data/leagues/champ.ts:141 | Blackheath FC (real) |
| Well Hall (ground of Blackheath RFC) | src/data/leagues/champ.ts:141 | Well Hall (real, Blackheath) |
| Kumagaya Rugby Stadium (ground of Saitama RFC) | src/data/leagues/jl1.ts:73 | Kumagaya Rugby Stadium (real) |
| Mitsuzawa Stadium (ground of Yokohama RFC) | src/data/leagues/jl1.ts:77 | Mitsuzawa Stadium (real) |
| Komazawa Stadium (ground of Setagaya RFC) | src/data/leagues/jl1.ts:81 | Komazawa Stadium (real) |
| Sale FC (club) | src/data/leagues/natl1.ts:86 | Sale FC (a real club, exactly) |
| Heywood Road (ground of Sale FC) | src/data/leagues/natl1.ts:86 | Heywood Road (real, Sale FC) |
| Old Bath Road (ground of Reading RFC) | src/data/leagues/natl1.ts:87 | Old Bath Road (real, Reading) |
| Brickfields (ground of Plymouth RFC) | src/data/leagues/natl1.ts:88 | Brickfields (real, Plymouth Albion) |
| Billesley Common (ground of Birmingham RFC) | src/data/leagues/natl1.ts:89 | Billesley Common (real, Moseley) |
| Silver Leys (ground of Bishop's Stortford RFC) | src/data/leagues/natl1.ts:91 | Silver Leys (real, Bishop's Stortford) |
| London Caledonians RFC (club) | src/data/leagues/natl1.ts:93 | London Scottish (on its real ground, the Athletic Ground) |
| The Athletic Ground (ground of London Caledonians RFC) | src/data/leagues/natl1.ts:93 | the Athletic Ground (real, Richmond and London Scottish) |
| The Recreation Ground (ground of Camborne RFC) | src/data/leagues/natl1.ts:100 | the Recreation Ground (real, Camborne / Bath) |
| Dings RFC (club) | src/data/leagues/natl1.ts:101 | Dings Crusaders RFC (real) |
| Abbeydale Park (ground of Sheffield RFC) | src/data/leagues/natl1.ts:102 | Abbeydale Park (real, Sheffield) |
| Recreational Sports Centre (ground of Bath RFC) | src/data/leagues/prem_a.ts:8 | the Recreation Ground (Bath) |
| Ashford Gate (ground of Bristol RFC) | src/data/leagues/prem_a.ts:65 | Ashton Gate (Bristol Bears) |
| Beachy Park (ground of Exeter RFC) | src/data/leagues/prem_a.ts:108 | Sandy Park (Exeter Chiefs) |
| Kinshome (ground of Gloucester RFC) | src/data/leagues/prem_a.ts:157 | Kingsholm (Gloucester) |
| Quins Rugby (club) | src/data/leagues/prem_a.ts:204 | Harlequins (its nickname, "Quins") |
| Little Twickenham (ground of Quins Rugby) | src/data/leagues/prem_a.ts:206 | the Twickenham Stoop, and Twickenham |
| Welford Street (ground of Leicester RFC) | src/data/leagues/prem_b.ts:8 | Welford Road (Leicester Tigers) |
| The Gardens (ground of Northampton RFC) | src/data/leagues/prem_b.ts:87 | Franklin's Gardens (Northampton Saints) |
| Salford City Stadium (ground of Sale RFC) | src/data/leagues/prem_b.ts:145 | Salford Community Stadium (Sale Sharks) |
| Sarries RFC (club) | src/data/leagues/prem_b.ts:179 | Saracens (its nickname, "Sarries") |
| Hendon Park (ground of Sarries RFC) | src/data/leagues/prem_b.ts:181 | the StoneX Stadium, Hendon (Saracens) |
| Stade des Alpes (ground of RC Grenoble) | src/data/leagues/prod2.ts:315 | Stade des Alpes (real, Grenoble) |
| Stade Sapiac (ground of RC Montauban) | src/data/leagues/prod2.ts:319 | Stade Sapiac (real, Montauban) |
| Stade Amédée-Domergue (ground of RC Brive) | src/data/leagues/prod2.ts:354 | Stade Amédée-Domenech (Brive) |
| Stade Raoul-Berrière (ground of RC Béziers) | src/data/leagues/prod2.ts:355 | Stade Raoul-Barrière (Béziers) |
| Stade Maurice-Davy (ground of RC Provence) | src/data/leagues/prod2.ts:356 | Stade Maurice-David (Provence) |
| Stade Charles-Mathieu (ground of RC Oyonnax) | src/data/leagues/prod2.ts:357 | Stade Charles-Mathon (Oyonnax) |
| Stade Michel-Bendicourt (ground of RC Colomiers) | src/data/leagues/prod2.ts:358 | Stade Michel-Bendichou (Colomiers) |
| Stade du Pré-Fleuri (ground of RC Nevers) | src/data/leagues/prod2.ts:359 | Stade du Pré-Fleuri (real, Nevers) |
| Parc des Sports Aguillon (ground of RC Biarritz) | src/data/leagues/prod2.ts:360 | Parc des Sports Aguiléra (Biarritz) |
| Stade Armandin (ground of RC Agen) | src/data/leagues/prod2.ts:361 | Stade Armandie (Agen) |
| Stade Maurice-Boyer (ground of RC Dax) | src/data/leagues/prod2.ts:363 | Stade Maurice-Boyau (Dax) |
| Parc des Sports et de l'Amitié (ground of AS Narbonne) | src/data/leagues/prod2.ts:372 | Parc des Sports et de l'Amitié (real, Narbonne) |
| Stade Jean-Alaric (ground of RC Aurillac) | src/data/leagues/prod2.ts:374 | Stade Jean-Alric (Aurillac) |
| Stade Chansy (ground of RC Angoulême) | src/data/leagues/prod2.ts:376 | Stade Chanzy (Angoulême) |
| Edendale Park (ground of Auckland RFC) | src/data/leagues/srp_a.ts:8 | Eden Park (Auckland) |
| Waikato Stadium (ground of Waikato RFC) | src/data/leagues/srp_a.ts:46 | Waikato Stadium (real, Chiefs) |
| Addington Stadium (ground of Canterbury RFC) | src/data/leagues/srp_a.ts:82 | Addington (Christchurch, real) |
| Wellington Stadium (ground of Wellington RFC) | src/data/leagues/srp_a.ts:158 | Wellington Regional Stadium (real) |
| North Harbour Stadium (ground of Pacific RFC) | src/data/leagues/srp_a.ts:196 | North Harbour Stadium (real) |
| Bruce Stadium (ground of Canberra RFC) | src/data/leagues/srp_b.ts:8 | Bruce Stadium (real, Brumbies) |
| Moore Park Stadium (ground of New South Wales RFC) | src/data/leagues/srp_b.ts:88 | Allianz Stadium, Moore Park (Waratahs) |
| Perth Oval (ground of Perth RFC) | src/data/leagues/srp_b.ts:125 | Perth Oval (real) |
| Laucala Bay Stadium (ground of Fiji RFC) | src/data/leagues/srp_b.ts:162 | the National Stadium, Laucala Bay (Fiji) |
| Stade Ernest-Vallon (ground of RC Toulouse) | src/data/leagues/top14_a.ts:8 | Stade Ernest-Wallon (Stade Toulousain) |
| Stade Chaban-Delmar (ground of RC Bordeaux) | src/data/leagues/top14_a.ts:48 | Stade Chaban-Delmas (Bordeaux) |
| Stade Marcel-Deslandes (ground of RC La Rochelle) | src/data/leagues/top14_a.ts:85 | Stade Marcel-Deflandre (La Rochelle) |
| Stade Marcel-Michelot (ground of RC Clermont) | src/data/leagues/top14_a.ts:121 | Stade Marcel-Michelin (Clermont) |
| Stade Meyol (ground of AS Toulon) | src/data/leagues/top14_a.ts:158 | Stade Mayol (Toulon) |
| Stade Jean-Baudin (ground of AS Paris) | src/data/leagues/top14_a.ts:232 | Stade Jean-Bouin (Paris) |
| Stade Pierre-Favre (ground of RC Castres) | src/data/leagues/top14_b.ts:8 | Stade Pierre-Fabre (Castres) |
| Stade Jean-Daubert (ground of RC Bayonne) | src/data/leagues/top14_b.ts:44 | Stade Jean-Dauger (Bayonne) |
| Stade de Gerland (ground of RC Lyon) | src/data/leagues/top14_b.ts:82 | Stade de Gerland (real, Lyon) |
| Stade du Hameau (ground of RC Pau) | src/data/leagues/top14_b.ts:159 | Stade du Hameau (real, Pau) |
| Stade Aimé-Giraud (ground of RC Perpignan) | src/data/leagues/top14_b.ts:196 | Stade Aimé-Giral (Perpignan) |
| US Vannes (club) | src/data/leagues/top14_b.ts:231 | RC Vannes |
| Stade de la Rabine (ground of US Vannes) | src/data/leagues/top14_b.ts:233 | Stade de la Rabine (real, Vannes) |
| Leinster RFC (club) | src/data/leagues/urc_a.ts:6 | Leinster Rugby |
| Lansdowne Road (ground of Leinster RFC) | src/data/leagues/urc_a.ts:8 | Lansdowne Road (real, now the Aviva Stadium) |
| Munster RFC (club) | src/data/leagues/urc_a.ts:47 | Munster Rugby |
| Thormond Park (ground of Munster RFC) | src/data/leagues/urc_a.ts:49 | Thomond Park (Munster) |
| Ulster RFC (club) | src/data/leagues/urc_a.ts:87 | Ulster Rugby |
| Ravenhill (ground of Ulster RFC) | src/data/leagues/urc_a.ts:89 | Ravenhill (real, Ulster) |
| Connacht RFC (club) | src/data/leagues/urc_a.ts:128 | Connacht Rugby |
| The Sportsground (ground of Connacht RFC) | src/data/leagues/urc_a.ts:130 | The Sportsground (real, Connacht) |
| Scotsworth Stadium (ground of Glasgow RFC) | src/data/leagues/urc_a.ts:171 | Scotstoun (Glasgow Warriors) |
| Stadio Monaco (ground of Treviso RFC) | src/data/leagues/urc_a.ts:249 | Stadio Monigo (Benetton) |
| Stadio Sergio Lanfranco (ground of Parma RFC) | src/data/leagues/urc_a.ts:287 | Stadio Sergio Lanfranchi (Zebre) |
| Loftus Field (ground of Pretoria RFC) | src/data/leagues/urc_b.ts:8 | Loftus Versfeld (Bulls) |
| Green Point Stadium (ground of Cape Town RFC) | src/data/leagues/urc_b.ts:49 | Green Point Stadium (real, Cape Town) |
| Kingsway Park (ground of Durban RFC) | src/data/leagues/urc_b.ts:90 | Kings Park (Sharks) |
| Elliston Park (ground of Johannesburg RFC) | src/data/leagues/urc_b.ts:128 | Ellis Park (Lions) |
| Cardiff Arms Field (ground of Cardiff RFC) | src/data/leagues/urc_b.ts:166 | Cardiff Arms Park |
| St Helena's (ground of Swansea RFC) | src/data/leagues/urc_b.ts:202 | St Helen's (Swansea) |
| Stradley Park (ground of Llanelli RFC) | src/data/leagues/urc_b.ts:240 | Stradey Park (Llanelli) |
| Rodney Park (ground of Newport RFC) | src/data/leagues/urc_b.ts:277 | Rodney Parade (Newport) |
| Ravenhill (ground of Belfast RFC) | src/data/leagues/w_celt.ts:50 | Ravenhill (real, Ulster) |
| Donnybrook Park (ground of Dublin RFC) | src/data/leagues/w_celt.ts:90 | Donnybrook Stadium (Dublin) |
| Stradley Park (ground of North Wales RFC) | src/data/leagues/w_celt.ts:209 | Stradey Park (Llanelli) |
| Scotsworth Stadium (ground of Glasgow RFC) | src/data/leagues/w_celt.ts:252 | Scotstoun (Glasgow Warriors) |
| Recreational Sports Centre (ground of Bath RFC) | src/data/leagues/w_champ.ts:68 | the Recreation Ground (Bath) |
| Richmond RFC (club) | src/data/leagues/w_champ.ts:106 | Richmond FC (real) |
| The Athletic Ground (ground of Richmond RFC) | src/data/leagues/w_champ.ts:108 | the Athletic Ground (real, Richmond and London Scottish) |
| London Hibernians RFC (club) | src/data/leagues/w_champ.ts:154 | London Irish |
| Exeter University RFC (club) | src/data/leagues/w_champ.ts:234 | Exeter University RFC (real) |
| Claro Road (ground of Harrogate RFC) | src/data/leagues/w_champ.ts:556 | Claro Road (real, Harrogate) |
| Novocastrians RFC (club) | src/data/leagues/w_champ.ts:594 | Novocastrians RFC (a real club, exactly) |
| Crow Trees (ground of Blaydon RFC) | src/data/leagues/w_champ.ts:716 | Crow Trees (real, Blaydon) |
| Shaw Lane (ground of Barnsley RFC) | src/data/leagues/w_champ.ts:796 | Shaw Lane (real, Barnsley) |
| Stade Ernest-Vallon (ground of RC Toulouse) | src/data/leagues/w_e1.ts:65 | Stade Ernest-Wallon (Stade Toulousain) |
| Stade Sainte-Germaine (ground of RC Bordeaux) | src/data/leagues/w_e1.ts:112 | Stade Sainte-Germaine (real, Le Bouscat) |
| Stade Ernest-Argelas (ground of RC Blagnac) | src/data/leagues/w_e1.ts:167 | Stade Ernest-Argelès (Blagnac) |
| Stade Sabathier (ground of RC Montpellier) | src/data/leagues/w_e1.ts:263 | Stade Sabathé (Montpellier) |
| Stade des Alpes (ground of RC Grenoble) | src/data/leagues/w_e1.ts:303 | Stade des Alpes (real, Grenoble) |
| Stade de Gerland (ground of RC Lyon) | src/data/leagues/w_e1.ts:351 | Stade de Gerland (real, Lyon) |
| Stade Meyol (ground of AS Toulon) | src/data/leagues/w_e1.ts:398 | Stade Mayol (Toulon) |
| Stade Marcel-Deslandes (ground of RC La Rochelle) | src/data/leagues/w_e1.ts:484 | Stade Marcel-Deflandre (La Rochelle) |
| Stade Yves-Manoir (ground of RC Colombes) | src/data/leagues/w_e2.ts:43 | Stade Yves-du-Manoir (real, Colombes) |
| Stade Jean-Baudin (ground of AS Paris) | src/data/leagues/w_e2.ts:83 | Stade Jean-Bouin (Paris) |
| Stade Michel-Bendicourt (ground of RC Colomiers) | src/data/leagues/w_e2.ts:136 | Stade Michel-Bendichou (Colomiers) |
| Stade Jean-Daubert (ground of RC Bayonne) | src/data/leagues/w_e2.ts:216 | Stade Jean-Dauger (Bayonne) |
| Stade Amédée-Domergue (ground of RC Brive) | src/data/leagues/w_e2.ts:256 | Stade Amédée-Domenech (Brive) |
| Stade du Hameau (ground of RC Pau) | src/data/leagues/w_e2.ts:301 | Stade du Hameau (real, Pau) |
| Edendale Park (ground of Auckland RFC) | src/data/leagues/w_pac.ts:32 | Eden Park (Auckland) |
| Waikato Stadium (ground of Waikato RFC) | src/data/leagues/w_pac.ts:75 | Waikato Stadium (real, Chiefs) |
| Addington Stadium (ground of Canterbury RFC) | src/data/leagues/w_pac.ts:118 | Addington (Christchurch, real) |
| Wellington Stadium (ground of Wellington RFC) | src/data/leagues/w_pac.ts:162 | Wellington Regional Stadium (real) |
| Laucala Bay Stadium (ground of Fiji RFC) | src/data/leagues/w_pac.ts:205 | the National Stadium, Laucala Bay (Fiji) |
| Perth Oval (ground of Perth RFC) | src/data/leagues/w_pac.ts:249 | Perth Oval (real) |
| Moore Park Stadium (ground of New South Wales RFC) | src/data/leagues/w_pac.ts:290 | Allianz Stadium, Moore Park (Waratahs) |
| Bruce Stadium (ground of Canberra RFC) | src/data/leagues/w_pac.ts:366 | Bruce Stadium (real, Brumbies) |
| Gillmore’s Ground (ground of Gloucester RFC) | src/data/leagues/w_pwr.ts:57 | Gillman's Ground (Hartpury) |
| Sarries RFC (club) | src/data/leagues/w_pwr.ts:100 | Saracens (its nickname, "Sarries") |
| Hendon Park (ground of Sarries RFC) | src/data/leagues/w_pwr.ts:102 | the StoneX Stadium, Hendon (Saracens) |
| Quins Rugby (club) | src/data/leagues/w_pwr.ts:208 | Harlequins (its nickname, "Quins") |
| Little Twickenham (ground of Quins Rugby) | src/data/leagues/w_pwr.ts:210 | the Twickenham Stoop, and Twickenham |
| Ealing Sports Ground (ground of Ealing RFC) | src/data/leagues/w_pwr.ts:264 | Trailfinders Sports Ground (Ealing) |
| Beachy Park (ground of Exeter RFC) | src/data/leagues/w_pwr.ts:310 | Sandy Park (Exeter Chiefs) |
| Loughborough RFC (club) | src/data/leagues/w_pwr.ts:365 | Loughborough Lightning |
| Welford Street (ground of Leicester RFC) | src/data/leagues/w_pwr.ts:414 | Welford Road (Leicester Tigers) |
| Heywood Road (ground of Sale RFC) | src/data/leagues/w_pwr.ts:471 | Heywood Road (real, Sale FC) |

Club names that are also the name of a real club (city or town plus RFC): Doncaster RFC (src/data/leagues/champ.ts:119); Coventry RFC (src/data/leagues/champ.ts:120); Bedford RFC (src/data/leagues/champ.ts:121); Cornwall RFC (src/data/leagues/champ.ts:122); Nottingham RFC (src/data/leagues/champ.ts:123); Chinnor RFC (src/data/leagues/champ.ts:126); Caldy RFC (src/data/leagues/champ.ts:127); Ampthill RFC (src/data/leagues/champ.ts:136); Rotherham RFC (src/data/leagues/champ.ts:138); Reading RFC (src/data/leagues/natl1.ts:87); Plymouth RFC (src/data/leagues/natl1.ts:88); Bishop's Stortford RFC (src/data/leagues/natl1.ts:91); Cambridge RFC (src/data/leagues/natl1.ts:94); Bury St Edmunds RFC (src/data/leagues/natl1.ts:99); Camborne RFC (src/data/leagues/natl1.ts:100); Sheffield RFC (src/data/leagues/natl1.ts:102); Tonbridge RFC (src/data/leagues/natl1.ts:103); St Albans RFC (src/data/leagues/w_champ.ts:274); Beckenham RFC (src/data/leagues/w_champ.ts:314); Eastleigh RFC (src/data/leagues/w_champ.ts:354); Ivybridge RFC (src/data/leagues/w_champ.ts:394); Thurrock RFC (src/data/leagues/w_champ.ts:434); Lichfield RFC (src/data/leagues/w_champ.ts:474); Harrogate RFC (src/data/leagues/w_champ.ts:554); Kenilworth RFC (src/data/leagues/w_champ.ts:634); Cheltenham RFC (src/data/leagues/w_champ.ts:674); Blaydon RFC (src/data/leagues/w_champ.ts:714); Bury St Edmunds RFC (src/data/leagues/w_champ.ts:754); Barnsley RFC (src/data/leagues/w_champ.ts:794); Buckingham RFC (src/data/leagues/w_champ.ts:834).

## Final status (25 November 2026, round 9, 16:30)

Run: `npx vite-node scripts/harmonycheck.ts` on 73284195 (src/game clean; ANIMATION's uncommitted UI changes in the tree). HARMONY FAILED on 2 of 82 rules: 80 pass, none not run. Quick test 32 of 32. `wiring 20` (W07 included), `season 8`, `cards 5`.

Checklist totals: 66 PASS, 2 FAIL (items 72, 81), 1 REPORT (48), 3 ACCEPTED (74, 75, 77), 7 NEEDS HIS EYES (3, 5, 7, 19, 36, 46, 63), 5 RETIRED (34, 35, 47, 58, 59). 84 items.

What truly fails:
1. Item 81, W05: red cards, 1.75 a season against 0.25 (both sides carded red about four times as often). GAMEPLAY's deliberate choice, inside the sources' band. It needs a ruling: accept it as design, or hold it to the old engine.
2. Item 72, F01 (GAMEPLAY), 30 balanced fixtures. Too many tries from turnovers (16%; real 11 to 12%), from restarts (8.7%; real 6%) and from tapped penalties (3.6%; real 2%). Penalties are 12 a match, which the owner chose.
Not run: nothing. The eyes list stands as in round 8.

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
