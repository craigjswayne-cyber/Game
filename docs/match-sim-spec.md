# The match simulation: specification (2.0.0)

Status: APPROVED by the owner, 20 November 2026, 23:16 ("1. Approved. 2. Aim between 6-17. 3. I'd include last gasp tackles to stop a try or interception score"). Stage 1 may start. Nothing in `src/game` has been changed. This goes to the owner for approval before any engine code is written.

Owner's decisions, 20 November 2026: "2.0.0 is the next iteration of the game. Hold until new engine. Every managed match, other games don't. I want this doing proper."

Why: the engine decides a match in four-minute blocks and writes lines afterwards, and the pitch acts the lines out. The owner, the same evening: "There is still no connection with players, commentary & graphics." A reconstruction cannot be made true. The match has to be played, and everything else has to read from it.

## 1. The current engine, read from the code

### 1.1 How a match runs

- `matchEngine.ts` `simMatch(state, fx, rng, detail)` plays a whole match. `match/begin.ts` `beginMatch` builds the live context, `match/control.ts` `stepTick` advances it one block and reports `play`, `HT`, `BRK` or `FT`, and `match/finalize.ts` `blowHalfTime` and `blowFullTime` settle it.
- A block is four minutes. `match/tick.ts` `simTick` stamps it `tick * 4 + rng(0..3) + 1`. There are 20 blocks.
- In each block the engine rolls for outcomes. A try is one roll per side from `TRY_BASE = 0.0730`, moved by team rating, pressure, fatigue, the scoreline (`TRAIL_FROM`, `NIL_LIFT`), cards and tactics. Penalties, cards, injuries, kicks from hand (`kickplay.ts`) and kicks at goal (`scoring.ts`, `kicking.ts`) are rolled in the same block.
- Field position is one number, `ctx.field`, 0 to 100. There is no ball, no carrier, no ruck and no phase count.
- Commentary is written by `live.ts` `pushLine` with a key and values. Scores, cards, substitutions and injuries are events. Most other lines are colour, drawn from a pool by `match/commentary.ts` and `match/lines.ts` without reference to who has the ball. Measured over eight matches: about one line in five skips a step the laws require, and 8% contradict the play around them.

### 1.2 What a result depends on (the inputs)

The new engine must take every one of these, or the game around it changes.

| Input | Where it lives |
| --- | --- |
| The two match-day 23s and their positions | `SideCtx.lineup`, `onPitch`, `units` (`match/side.ts`, `match/field.ts` `recomputeSideUnits`) |
| Player ratings on the day | `SideCtx.ratings`, `finalR` |
| Energy and fatigue, minute by minute | `SideCtx.energy`, `match/energy.ts` `drainEnergy`, `LATE_FLOOR` |
| Tactics: style, tempo, kicking, zone plan, ruck commitment | `SideCtx.tempoF`, `drainF`, `aggF`, `ruckSecure`, `ruckContest`, `styleMisfit` |
| Team talks before the match and at half-time | `control.ts` `applyPreTalk`, `applyTeamTalk`, `SideCtx.talkF`, `talkR`, `talkShift` |
| Substitutions, by the manager and by the AI | `control.ts` `makeSubstitution`, `subs.ts` `aiAutoSubs`, `applyFinishers` |
| Front-row cover and uncontested scrums (Law 3) | `subs.ts` `checkFrontRow`, `frontRowCoverEnds` |
| The referee | `referee.ts` `refFor`, `SideCtx.refPenF`, `penRisk`, `cardRisk` |
| Weather and surface | `LiveCtx.weather`, `surface` |
| Home advantage, crowd, derby | `LiveCtx.hfa`, `derby`, `referee.ts` `homeCrowdLean` |
| Cards and men off the field | `SideCtx.binned`, `yellowUntil`, `sent`, `short` |
| The manager's live calls | `LiveCtx.decision` and `scoring.ts` `resolveDecision` (posts, corner, tap); `control.ts` `applyTacticsChange` |
| The match random stream | `LiveCtx.rng` (results) and `crng` (commentary only) |

### 1.3 What a match writes (the outputs)

Every one of these is read somewhere else in the game. The new engine must write all of them.

| Output | Read by |
| --- | --- |
| `fx.played`, `homeScore`, `awayScore`, `homeTries`, `awayTries`, `motm` | Tables, bonus points, fixtures, news, awards |
| `fx.events` (watched matches only) | Live screen, match report, score card, stats, evidence, media, coach notes (`ui/screens/matchday/*`, `game/evidence.ts`, `game/media.ts`, `game/coachfix.ts`, `season/news.ts`) |
| Per-player match ratings, tackles, missed tackles, minutes | `SideCtx.ratings`, `tackles`, `missed`, `onAt`; player form and development |
| Tries, points, kicks at goal and made, kicks from hand, charge-downs, penalties conceded | `SideCtx.tries`, `kicksAt`, `kicksMade`, `handKicks`, `chargedDown`, `pens`, `consPens` |
| Possession and territory | `SideCtx.poss`, `ctx.field` |
| Cards, suspensions, injuries | `discipline.ts`, `injuries.ts`, the squad screens |
| Energy left at full time | Next week's fitness |
| World ranking moves for Tests, grudges, gate money | `finalize.ts` `blowFullTime` |

### 1.4 What the game is held to today

`scripts/bandcheck.ts` runs eight game worlds and fails unless: points a game are 48 to 53, tries 6.0 to 6.6, home wins 51% to 57%, draws 1.3% to 3.0%. `scripts/fingerprint.ts` pins the exact results of six matches. About 310 other scripts in `scripts/` pin one behaviour each (the value of the bench, of a plan, of a team talk, of a strict referee).

Measured this week on the current engine: best XV wins 48.0%, three stars weaker 31.5%, second XV 14.0%. Team talks move the win rate between 40.1% and 51.6%. Substitutions are worth 1.3 points and the game plan 4.9. Referees: strict 6.8 penalties a match, fair 5.8, lenient 4.9.

## 2. The record

The new engine plays the match and writes one entry per thing that happens. Everything else reads the entries.

### 2.1 An entry

```ts
interface Play {
  n: number            // order in the match
  t: number            // match clock, seconds (0 to 4800 plus stoppage)
  kind: PlayKind
  side: 0 | 1          // the side this is about (0 home)
  ball: 0 | 1          // the side with the ball when it ends
  x: number; y: number // where it ends, metres: x 0 to 100 from the home line, y 0 to 70
  who?: number         // the main player (id): the carrier, the kicker, the thrower
  vs?: number[]        // the players against him: the tacklers, the jackal, the chaser
  with?: number[]      // the players with him: the clean-out, the lifters, the receiver
  result: PlayResult   // what came of it
  cause?: PlayCause    // why play stopped or changed hands, when it did
  gain?: number        // metres up the field
  phase?: number       // the count of phases in this possession
}
```

### 2.2 The kinds

Restarts: `kickoff`, `dropout22`, `goalLineDropout`, `scrum`, `lineout`, `penaltyTap`, `freeKickTap`.

Open play: `carry`, `pass`, `offload`, `tackle`, `ruck`, `maul`, `lineBreak`, `kick` (with a type: box, up-and-under, grubber, chip, cross-field, clearance, touch-finder, long), `catch`, `chase`, `chargeDown`.

Stoppages: `knockOn`, `forwardPass`, `intoTouch`, `outOnFull`, `deadBall`, `heldUp`, `unplayable`, `penalty`, `freeKick`, `advantage`, `advantageOver`.

Scores: `try`, `penaltyTry`, `conversion`, `penaltyGoal`, `dropGoal` (each with made or missed where it applies).

Officials and the bench: `yellowCard`, `redCard`, `tmoReview`, `tryDisallowed`, `substitution`, `injury`, `hia`, `halfTime`, `fullTime`.

### 2.3 What may follow what

The laws machine built for the pitch (`src/ui/livepitch/law.ts`, on XState) already holds the states of the ball (waiting for a kick-off, in play, in touch, waiting for a scrum, penalty given, try scored, waiting for a drop-out) and the only moves allowed from each. It moves into the engine and becomes the rule the simulation runs on: the engine cannot produce a sequence the machine refuses. It also stays as a test over whole matches.

Rules the record must keep, each one a test:

- Every scrum has a `knockOn`, `forwardPass`, `unplayable` or a penalty option before it, and the put-in goes against the side that caused it.
- Every lineout has an `intoTouch`, `outOnFull` or a kick to touch before it. The throw is against the side that put it out, except after a penalty kick to touch and a 50:22.
- Every score is followed by a kick-off by the side that conceded.
- A kick at goal that misses and goes dead is a 22 drop-out.
- The ball only changes hands through a kick, a set piece won against the feed, a turnover with a named player, a penalty or a score.
- Every entry starts where the last one ended, unless a kick moved the ball.

## 3. How the match is played

### 3.1 The loop

1. A restart puts the ball in play (kick-off, drop-out, scrum, lineout, tap).
2. The side with the ball makes a DECISION.
3. The decision is a CONTEST between named players.
4. The contest has a RESULT, which moves the ball and the clock and writes one entry.
5. The laws machine says what may come next: another phase, or a stoppage and a restart.

The clock is real. Each kind of play costs seconds of ball in play (a phase about 6 to 9, a kick and chase about 8), and each stoppage costs dead time (a scrum about 70, a lineout about 35, a kick at goal about 60, a try and conversion about 90). The constants are tuned until ball in play lands near 35 minutes of the 80.

### 3.2 The decision

The side with the ball chooses one of: pick and go, carry off nine, carry off ten, go wide, kick (box, up-and-under, grubber, cross-field, clearance, touch), drop at goal.

The choice is weighted, never fixed. The weights come from things the game already has:

| What moves the weights | Where it comes from today |
| --- | --- |
| The manager's style, tempo and kicking setting | Club tactics, `SideCtx.tempoF`, `aggF`, the zone plan and `styles.ts` |
| Where on the field | The record's `x`: own 22, own half, their half, their 22 |
| The phase count | Long possessions kick more and force more |
| Score and time | Chasing a game late plays more; protecting a lead kicks more (`TRAIL_FROM`, `lateHold` lines today) |
| Weather and surface | Rain and wind raise kicking and tight carries |
| Who is on the field | A side with 14 narrows up; a side against 14 goes wide |
| A penalty | The manager's own call when it is his side (posts, corner, tap), as now; the AI's call from `aiPenaltyCall` |

### 3.3 The contests

Every contest is one roll between two strengths, with named constants to tune. The strengths are built from what the engine already computes, so selection and tactics keep their meaning.

| Contest | Attack strength | Defence strength | Results |
| --- | --- | --- | --- |
| Carry | The carrier's own carrying and power, lifted by the side's `units.attack` | The nearest tacklers' tackling, lifted by `units.defence` | Dominant carry, gain line, held, dominant tackle, line break, offload, knock-on, turnover in the tackle |
| Ruck | Support arriving, `units.breakdown`, `ruckSecure` | The jackal, `units.breakdown`, `ruckContest` | Quick ball, slow ball, turnover, penalty either way, unplayable |
| Pass and wide play | Handling of the men in the line, `units.attack`, weather | Line speed and drift from the defence's tactics | Clean, behind the man, knock-on, forward pass, intercept |
| Kick | The kicker's kicking, `units.kicking`, wind | The back three's positioning and catching | Distance, bounce or on the full, touch, dead, caught, contested, charged down |
| Chase and catch | Chasers' pace and aerial skill | The catcher's aerial skill under pressure | Caught, knocked on, regathered by the kicking side |
| Scrum | `units.scrum`, front-row fatigue | The same | Clean ball, penalty either way, free kick, against the head, reset |
| Lineout | `units.lineout`, the thrower | The other side's jumpers | Won clean, won scrappy, stolen, not straight, penalty |
| Maul | The pack's weight and `units.lineout` | The other pack | Metres, try, held up, pulled down (penalty or card), stopped |
| Kick at goal | The kicker's goal kicking, `units.goal`, distance and angle from the record's real spot, wind | none | Over, wide, post |

Every strength is multiplied by the same things as now: the player's energy (`energy.ts`, with `LATE_FLOOR` for an empty tank), the team talk (`talkF`, `talkShift`), home advantage (`hfa`), morale and chemistry already folded into `ratings` and `units`.

Discipline: each contest has a small chance of a penalty, scaled by the referee (`refPenF`, strict 1.07, fair 0.98, lenient 0.92), the side's aggression (`aggF`) and its count so far (`consPens`, which already drives warnings and cards). Cards come from the offence, the place on the field and the count, as `discipline.ts` does now.

Injuries: a small chance on every tackle and ruck, by position and fatigue, feeding the existing `injuries.ts` so the squad screens are unchanged.

### 3.4 What is new for the manager

Nothing is taken away. Two things appear because the match is now real:

- More penalty decisions. The game counts about 6 penalties a match today (both sides together; `scripts/tmp/refp.ts`), where Test rugby has about 17 penalties and free kicks. The new engine produces the real number. Most are routine (kick to touch from your own half) and the game takes those itself; the manager is asked only when it is a real choice, as now.
- Real player numbers. Carries, metres, tackles made and missed, turnovers won, lineouts taken, all counted from what happened.

## 4. Real rugby numbers (Test level, verified)

From World Rugby's RWC 2019 statistical report, summary table, per match:
https://resources.world.rugby/worldrugby/document/2022/01/26/9106cf21-9a5f-4b99-b386-3f13eaeb6183/RWC_Analysis_2019-1-.pdf

| Per match | RWC 2019 | RWC 2015 | RWC 2011 |
| --- | --- | --- | --- |
| Ball in play | 45% (35 min 44 s) | 44% | 44% |
| Passes | 273 | 282 | 262 |
| Rucks and mauls | 174 | 178 | 162 |
| Kicks | 45 | 39 | 41 |
| Scrums | 14 | 13 | 17 |
| Lineouts | 25 | 26 | 24 |
| Penalties and free kicks | 17 | 22 | 21 |
| Points | 40 | | |
| Tries | 6.3 | | |
| Penalty goals | 2.4 | | |

From Stats Perform, RWC 2023: ball in play 34 min 18 s.
https://www.statsperform.com/resource/revolutionising-rugby-a-statistical-analysis-on-how-the-game-has-evolved/

### Club level

Gallagher Premiership 2024-25, regular season, from the final table (10 clubs, 18 matches each, 90 matches): 5,067 points and 716 tries, which is 56.3 points and 8.0 tries a match.
https://africa.espn.com/rugby/table/_/league/267979/season/2025

Across the professional leagues tracked by Oval Insights, as reported by Sam Larner: 26.24 points per team per match in the current season (52.5 a match), up from 23.27 in 2021-22 (46.5 a match). Ball in play 33.4 minutes in 2021-22, 35.3 in 2023-24, 33.5 now.
https://samlarner.substack.com/p/points-of-order

Still to find for club level: rucks, scrums, lineouts, penalties and cards per match, and figures for the URC, Top 14, Super Rugby and the women's leagues in the game.

### What this says about the game today

Scoring: the game's band of 48 to 53 points and 6.0 to 6.6 tries sits between Test rugby (40 points, 6.3 tries) and the Premiership (56 points, 8.0 tries). It is defensible as it stands.

Penalties: the game counts about 6 penalties a match, both sides together (4.9 with a lenient referee to 6.8 with a strict one), where Test rugby has about 17 penalties and free kicks. The block engine only counts penalties that matter to its score. The new engine produces the real number (section 3.4).

## 5. Two engines, one set of odds

Owner's decision: every match the manager is in charge of runs on the new engine. Every other fixture stays on the current block engine.

That is only fair if the two agree. The rule: the same two sides, with the same team sheets and tactics, must win at the same rate and score the same on both engines.

The test (`scripts/paritycheck.ts`, to be written in stage 2):

- 200 pairings spread across every league in the game, strong against weak and evenly matched.
- 2,000 matches of each pairing on each engine, with nobody managing.
- Compared: home win rate, draw rate, mean points for each side, mean tries, and the spread of winning margins.
- Tolerance: win rate within 1.5 points, points within 1.0, tries within 0.2, per pairing band (close, comfortable, mismatch).

What is tuned to meet it: the contest constants in 3.3 only. The block engine is not touched, so the rest of the world and every existing check script stay exactly as they are.

A managed match with the manager's hand on it (talks, substitutions, plan, live calls) must then be worth what it is worth today. Those sizes are in section 1.4 and each has its own script already.

## 6. Saves, speed and tests

Saves:
- `MatchEvent` stays. Old saved matches keep their events and every screen that reads them keeps working.
- A managed match on the new engine stores its record on the fixture beside the events, and its commentary lines are still written as `MatchEvent`s (one per entry worth saying), so the match report, news, media and evidence code read what they read today.
- The save version goes up once, at the switch-over. The existing save tests cover loading older careers.

Speed (measured 20 November 2026, `scripts/tmp/speed.ts`): the current engine takes 7.8 ms a match silent and 8.5 ms watched, and a whole week of the world takes about 0.4 seconds. The new engine only runs the manager's own matches, so it has room: the budget is 150 ms a match, which nobody will notice.

Tests, each one a script or a unit test that fails the build:
1. Laws: no whole match contains an illegal sequence (the machine in 2.3).
2. Shape: over 1,000 matches the averages land on the targets in section 4, within a stated tolerance each.
3. Balance: `bandcheck` bands hold for managed matches.
4. Parity: section 5.
5. Levers: selection, talks, substitutions, plan, referee each move results by the sizes in 1.4.
6. Words: every commentary line shown in 100 matches is checked against the entry it was written for (side, player, place, result). None may contradict it.
7. Determinism: the same seed gives the same match, on replay and after a reload.
8. Everything that exists today still passes: `npm test`, `fingerprint` (rebaselined once at the switch-over, with every changed result listed), and the check scripts.

## 7. How a match is watched (owner, 20 November 2026, 22:51)

"The modes you should get: skip the whole match; key moments (scoring, red cards, yellow cards); extended (show the whole game but on fast forward but slow down for the key moments) so its not super long."

| Mode | What is shown |
| --- | --- |
| Skip | The result and the report. The match is still played in full by the engine. |
| Key moments | Every score and every card, each with the play that led to it. |
| Extended | The whole match from the record, wound on, at life speed for the key moments. |

What Extended means in numbers. A match has about 35 minutes of ball in play (section 4). Dead time (walking to a lineout, a scrum setting, a kicker lining up) is not shown at length. If open play is wound on about eight times, 35 minutes takes about four and a half minutes; key moments at life speed add about a minute. So an Extended match is about five to six minutes.

This is not the fast-forward that was removed on 20 November. That one hurried thirty men between two unrelated places. Here every man is doing what he really did, one phase after another, so wound on it reads as a real match played quickly. The winding-on speed is set by eye in stage 5, with the owner.

Key moments (see section 8 for the owner's final list): tries, kicks at goal, cards, line breaks, turnovers in either 22, tries held up or ruled out, and the manager's own penalty calls.

## 8. Decided by the owner, 20 November 2026

1. The specification is approved.
2. Penalties: "Aim between 6-17." The target is 11 to 12 penalties and free kicks a match, both sides together, between the game's 6 today and Test rugby's 17. Routine ones (a kick to touch from a side's own half) are taken by the game; the manager is asked only when it is a real choice.
3. Key moments in Extended and in Key moments mode: tries, kicks at goal, cards, line breaks, turnovers in either 22, tries held up or ruled out, the manager's own penalty calls, and, added by the owner, a last-gasp tackle that stops a try and an interception that leads to a score.

## 9. Still open

1. Which of the new player numbers go on the match report.
2. Club-level figures for rucks, scrums, lineouts, penalties and cards, and for the URC, Top 14, Super Rugby and the women's leagues (to be found during stage 1).
