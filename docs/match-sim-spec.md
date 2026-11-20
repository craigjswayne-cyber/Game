# The match simulation: specification (2.0.0)

Status: DRAFT, stage 0. Nothing in `src/game` has been changed. This goes to the owner for approval before any engine code is written.

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

## 3. Still to write in stage 0

3. The decision model (what the side with the ball does next) and the contest model (who wins a carry, a ruck, a kick chase, a scrum, a lineout), as formulas with named constants, and where each input in 1.2 enters.
4. Club-level target numbers for the leagues in the game, with sources. The Test-level numbers are in section 4.
5. Parity: managed matches run on the new engine and every other fixture on the current one, so the same side must win at the same rate and score the same on both. The design of that test, and what is tuned to meet it.
6. Saves, speed and the test plan.

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

Penalties: Its own count this week was about 6 penalties a match (4.9 to 6.8 by referee), where Test rugby has about 17 penalties and free kicks. Whether the game's figure is per side or per match is to be confirmed in the code before anything is tuned to it; either way the engine only counts penalties that matter to its score.
