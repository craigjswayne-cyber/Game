# 2.0.0 match: acceptance checklist

What "commentary, graphics and animation in harmony" means, item by item, and how each item is proved. Every item comes from the owner's own words in `scripts/tmp/REBUILD.md`, the team rules in `scripts/tmp/AGENTS.md`, or the approved spec `docs/match-sim-spec.md`.

How to run the checks:
- `npx vite-node scripts/harmonycheck.ts` runs every automatic check on 300 skeleton matches (seeds 1 to 300) and 20 real fixtures (seeds 1 to 20, built as `scripts/simread.ts real` builds one). It prints one row per rule and a last line, HARMONY PASSED or HARMONY FAILED. Add `--why` to group the failures by cause.
- `npx vite-node scripts/harmonycheck.ts dump <seed> <from> <to> [real]` prints the plays and the commentary lines of one match, with the failures in that range.
- `npx vitest run tests/simharmony.test.ts` is the quick version (40 seeds, record only, one test per rule).

Status words: PASS (the automatic check passes), FAIL (it fails; the request is in `scripts/tmp/requests.md`), NOT RUN (the part it checks does not exist yet), NEEDS HIS EYES (no machine can judge it; the owner watches).

Two allowances below are mine, not the owner's, and he should confirm them: 10% of matches may fall outside 6 to 17 penalties (item 29), and "about 4 minutes" is read as 3.5 to 4.5 minutes (item 34).

## The checklist

| # | His complaint or rule (date) | What must be true | How it is checked | Status |
|---|---|---|---|---|
| 1 | "Laws followed" (AGENTS.md) | Every play is a move the laws machine (`law.ts`) allows from the state before it | R01-laws, R02-shape | PASS |
| 2 | 0:11 "knock-on plate with no Northampton man near ball" (20 Nov) | A knock-on is only by the side with the ball, or by a man under a kick; after a carry it is the carrier himself, at the place of the ball | R06-knockon | PASS |
| 3 | Same, on the pitch | The plate shows the side whose man is at the ball, and he is at it | Needs the pitch schedule and a recording | NEEDS HIS EYES |
| 4 | 0:18 "carrier sideways then backwards" (20 Nov); "no player running backwards with the ball" (AGENTS.md) | No carry goes wide (more than 10 m across) and ends more than 2 m behind where it started | R09-backwards | FAIL |
| 5 | Same, on the pitch | No man runs back with the ball between record points | A recording, frame by frame | NEEDS HIS EYES |
| 6 | 0:18 "defence passive" (20 Nov) | Every carry that is stopped names its tackler, so the pitch knows who must close on him | R30-tacklers (real fixtures) | PASS |
| 7 | Same, on the pitch | The named tacklers move to the carrier and make the tackle | A recording | NEEDS HIS EYES |
| 8 | 0:24 "50/22 on a kick caught in the 22 then thrown forward" (20 Nov) | A 50:22 is only called for a kick in open play, from the kicker's own half, that bounces into touch inside the other 22; and only words for a real one say "50:22" | R13-5022, C03-line-kind | PASS |
| 9 | "Laws followed": the 50:22 law the other way | Every kick that is a 50:22 in law is called one (otherwise the wrong side throws in) | R14-5022-missed | FAIL |
| 10 | 0:27 "Treviso kick out but their own throw" (20 Nov) | The side that put the ball in touch never throws in, except after a penalty kicked to touch or a 50:22 | R12-throw | PASS |
| 11 | 1:00 "kick to touch label with no kick shown" (20 Nov) | Words that say a kick to touch only appear where the record has one (at the kick, or as the reason at the lineout) | C03-line-kind | PASS |
| 12 | Same, on the pitch | The kick is shown before the lineout | A01-schedule-cover, then a recording | NOT RUN |
| 13 | 0:08 "All the territory is with Northampton when Northampton have only just kicked off" (20 Nov, 22:06) | No territory or momentum line in the first ten minutes of a half; every percentage said is the record's own figure (within 3 points), worked out by the checker separately from the commentary | C06-line-territory | PASS |
| 14 | 0:09 "penalty for a breakdown without a breakdown ever taking place" (20 Nov, 22:06): the words | A breakdown penalty is only said after a ruck | C07-line-breakdown | PASS |
| 15 | Same: the record | Every penalty and free kick has its offence in the play before it (ruck, scrum, lineout, maul) | R15-penalty-cause | FAIL |
| 16 | 0:13 "turnover again after the Northampton player randomly running all over the place" (20 Nov, 22:06) | The ball changes hands only by a catch, a turnover at the ruck with the man named, a set piece won against the feed, a penalty, a restart or a score; words only say turnover where the record has one | R04-possession, R05-actor, R17-turnover, C03-line-kind | PASS |
| 17 | Key moment "an interception that leads to a score" (20 Nov, 23:16) | The record can hold an interception, with the man named | Not in the record yet (requested by COMMENTARY, item 6) | FAIL |
| 18 | 0:14 "ball randomly flies back" (20 Nov, 22:06): the record | Every play starts where the last ended unless a kick moved it, and the metres gained match the change in place | R07-continuity, R08-gain | FAIL (R08) |
| 19 | Same, on the pitch | The ball never moves backwards on screen unless the record has a pass, a kick or a forward pass that is called | A recording | NEEDS HIS EYES |
| 20 | Every play on the pitch (spec 2.3) | x 0 to 100, y 0 to 70; nothing in open play sits on a touchline | R03-pitch | FAIL |
| 21 | Restarts after scores (spec 2.3) | A conversion after every try and only after a try; a kick-off by the side that conceded after every score; a penalty try is 7 with no conversion | R18-restart-score, R29-score | PASS |
| 22 | Second half (Law 12) | Kicked off by the side that did not kick off the first half | R22-restart-half | PASS |
| 23 | "Missed penalty kick at goal restarts with a 22 drop-out" (brief, 21 Nov; spec 2.3) | A missed kick at goal or drop goal is followed by a 22 drop-out by the defending side | R19-restart-miss | PASS |
| 24 | Dead ball and held up (Law 21) | A kick that runs dead: 22 drop-out; a kick touched down by the defence or a try held up: goal-line drop-out; always by the defending side | R20-restart-dead, R21-restart-heldup | PASS |
| 25 | Every restart has a reason (20 Nov, 20:50 lawscan: "play after a score with no kick-off", "missed kick with no drop-out") | Every kick-off and drop-out has its reason before it; a kick-off goes 10 m; a 22 drop-out crosses the 22 | R23-restart-cause | PASS |
| 26 | Scrums and lineouts (spec 2.3) | A scrum has a knock-on, forward pass, bad throw, unplayable ball or penalty before it, the put-in against the side at fault, and is not within 5 m of a goal line or touch; a lineout follows the ball going out, on that touchline, at that place | R10-scrum, R11-lineout | PASS |
| 27 | "Kicks at goal from where the penalty was" (brief, 21 Nov) | The kick at goal is taken at the penalty mark | R16-goal-spot | PASS |
| 28 | Cards: ten minutes, numbers on the field, return (brief, 21 Nov) | A card follows a penalty against that side and names one of its men; he is never named in play while off; his return is said at the first play after ten minutes, with the right count of men | R24-cards, R25-binned, C09-line-binback | PASS |
| 29 | Penalties: "Aim between 6-17" (20 Nov, 23:16) | Penalties and free kicks average 11 to 12 a match; no more than 10% of matches outside 6 to 17 | R32-pen-mean, R31-pen-range | PASS |
| 30 | Kicks out on the full "about 1 or 2 a game" (brief, 21 Nov) | Mean 1.0 to 2.0 a match | R33-outonfull | FAIL |
| 31 | Clock (spec 3.1, "the clock is real") | The clock never goes backwards | R27-clock-mono | FAIL |
| 32 | Same | The clock moves by exactly the live and dead seconds the record gives, so the pitch can schedule from it | R28-clock-sum | FAIL |
| 33 | The score | Try 5, conversion 2, penalty goal 3, drop goal 3; tries and final score agree with the plays | R29-score | PASS |
| 34 | "About 4 minutes for an Extended match" (AGENTS.md) | The schedule for a whole match is 3.5 to 4.5 minutes | A04-length | NOT RUN |
| 35 | "Fades only for lineouts, conversions, kicks at goal, after half-time. Scrums, kick-offs, 22s: players form up in view" (20 Nov, 20:23; AGENTS.md) | The schedule fades only on those plays | A03-fades | NOT RUN |
| 36 | Same, on the pitch | Scrums, kick-offs and 22s form up on screen with no fade | A recording | NEEDS HIS EYES |
| 37 | The pitch plays the record and nothing else (AGENTS.md "the one idea") | The schedule covers every play once, in order, never back in time | A01-schedule-cover, A02-schedule-time | NOT RUN |
| 38 | "Manager decisions must change the match from that minute on" (AGENTS.md): strength | A change from minute M leaves every play before M the same, and moves the result after it | R35-decision (100 seeds: 0 changed before minute 40, side 0's margin after it up 5.21 points a match) | PASS |
| 39 | Same: substitutions, tactics, team talks, penalty calls | The simulation takes these as inputs at a minute and the record shows them (a substitution play) | No input exists yet (request to GAMEPLAY, item 9) | FAIL |
| 40 | "There is still no connection with players, commentary & graphics" (20 Nov, 22:06) | Every man named in a play is on the side it says, in the starting XV, on the field; every man named in the words is in that play (or the one it gives as the reason) | R26-names, C05-line-player | PASS |
| 41 | "Everything that happens is clear on the pitch and in words" (AGENTS.md) | Every score, card, penalty, scrum, lineout, kick-off, half-time and full time has a line; every line points at a real play, in order; its side, its kind and its score agree with the play | C01, C02, C03, C04, C08 | PASS |
| 42 | The shape of a real match (spec section 4, approved 20 Nov) | Ball in play 32 to 38 min, tries 6.0 to 6.6, points 48 to 53, scrums 11 to 17, lineouts 22 to 29 | R34-shape-rates | PASS |
| 43 | "Perfect speed, perfect movement" of the 1.9.16 highlight clips (AGENTS.md) | The new pitch feels as good | A recording | NEEDS HIS EYES |
| 44 | "Vertical phone, full pitch in view, no moving camera; fast-forward between key moments, slow for key moments" (AGENTS.md; 20 Nov, 22:51) | So on screen | A recording | NEEDS HIS EYES |

## Final status (21 November 2026, 23:45)

Run: `npx vite-node scripts/harmonycheck.ts` (300 seeds + 20 real fixtures, 22 s). Result: HARMONY FAILED. 36 rules pass, 8 fail, 4 not run (no `src/ui/livepitch/fromRecord.ts` yet). Commentary: 88,403 lines over 320 matches, all nine commentary rules pass.

Checklist totals: 23 PASS, 10 FAIL, 4 NOT RUN, 7 NEEDS HIS EYES (44 items; items 3, 5, 7, 19, 36, 43, 44 need his eyes).

Open failures, worst first (full detail in `scripts/tmp/requests.md`):
1. Item 9, R14: a real 50:22 is not called, so the wrong side throws in. 57 of 320 matches. Seed 6, play 63.
2. Item 4, R09: a carry goes wide and ends behind where it started. 309 of 320 matches. Seed 1, play 5 (19 m across, 4.8 m back).
3. Item 31, R27: the clock goes back at half-time. 297 of 320. Seed 1, play 316 (2612 s to 2407 s).
4. Item 15, R15: a penalty after a kick with no offence in the record. 170 of 320. Seed 5, play 175.
5. Item 32, R28: scrum and lineout dead time is not written in the record. Every match. Seed 1, play 2 (58 s not accounted for).
6. Item 18, R08: the gain written is not the metres moved. 228 of 320. Seed 1, play 52; seed 7, play 491 (penalty kicked to touch from 0.9 m out).
7. Item 30, R33: 0.44 kicks out on the full a match, target 1 to 2.
8. Item 20, R03: open play rounded onto the touchline. 8 of 320. Seed 27, play 195.
9. Items 17 and 39: no interceptions, and no input for substitutions, tactics or team talks.
10. Items 12, 34, 35, 37: the pitch schedule (`fromRecord.ts`) does not exist yet.

All the open record failures are GAMEPLAY's. None is COMMENTARY's: where the record is thin (a penalty after a kick) the words say only what the record holds.
