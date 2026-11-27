# What the manager's decisions do to a match (new engine), 24 November 2026

Owner, 24 Nov: "Make sure everything in the game is affected by the decisions of the manager. This can't be a preset result."

## How this was measured

One real fixture: Leicester (the manager's side, at home) v Glasgow, from a new game on seed 4242, in the first week Leicester play. Each lever is two versions of the same match: only that one decision differs, and every match is played on the same seed in both versions (paired), so the difference is the decision and not the dice. Script: `scripts/tmp/gp/levers.ts`. Raw output is in `scripts/tmp/gp/levers.log` (the first full run) and `scripts/tmp/gp/levers2.log`.

- New engine: 2,000 matches each way. At that size a win-rate difference under about 2 points is within the dice.
- Old engine: 600 matches each way, for decisions made before the kick-off only. In-match decisions in the old engine were not re-measured here; the spec records its sizes (team talks move the win rate between 40.1% and 51.6%, substitutions are worth 1.3 points, the game plan 4.9).
- Columns: win % for the manager's side (first version, then second), the change in points for and against, and the match numbers that decision should move.
- Rows marked * were measured on the final engine of this round. The others come from the first full run, on the same day's engine before three last changes: the kicker measured against the side's kickers, styles re-balanced, and penalty timing.

## Where each decision lives and how each engine uses it

| Decision | Where it lives | Old engine | New engine |
|---|---|---|---|
| Who starts where (the 23) | `club.tactic.lineup`, `userPicked` | `teamUnits` reads each shirt's attributes, the specialist shirts (prop, hooker, 9) and partnerships | the same units, and now the named man in each play (`World.man`): the carrier's carrying, the tackler's tackling, the kicker's boot, the jackal's rucking, his own legs |
| Captain | `club.captain`, `vice` | the referee's word with him (discipline.ts): words and warnings only | not used, as in the old engine apart from those words |
| Goal kicker | `tactic.kickers` | `goalKicker`, `kickChance` | the same functions (`World.goalP`) |
| Style, tempo, kicking, aggression dials | `tactic.style`, `tempo`, `kicking`, `aggression` | units, energy drain, penalty risk, card risk | the same units and dials, and the decisions in play (`World.style`): how often a side kicks, goes wide, drives, takes quick taps, ruck speed, and how readily it is carded |
| Attack and defence styles | `tactic.atkStyle`, `defStyle` (or the coach's philosophy) | `styleTick`: try lean, matchup, fit | the same `styleTick` try lean, and the shapes played, kicks, width, offloads, line speed |
| Kicking style and exit | `tactic.kickStyle`, `exit` | territory | kinds of kick, and how often a side kicks from its own 22 |
| Zone plans | `tactic.zones` | territory and try leans | kick rate by zone, mauls and pick and go in their 22, width |
| Called moves | `tactic.moveMain` and others (`callsOf`) | `moveInPlay` try lean | the break chance off first-phase set-piece ball |
| Pre-match talk | `applyPreTalk` | `talkF` per man, folded into units | the same function through a Decision (`{ kind: 'talk', pre: true }`) |
| Half-time talk | `applyTeamTalk` | the same | the same function through a Decision |
| Substitutions | `makeSubstitution`, the bench | fresh tanks, units rebuilt, the late-game floor | the same functions; fresh legs for the man on; the old engine's late-game floor and tired-defence rules, ported this round |
| Penalty calls | `tactic.penaltyCall`, live calls | posts, corner, tap | the same calls; standing or asked |
| Week's preparation | `state.matchPrep` | units, energy drain | the same units and drain |
| Coaches and facilities | `state.staff`, facilities | units, goal bonus | the same |
| Form, condition, sharpness, morale | on each player | units, kick nerve | the same units, and each named man's own figures |
| Chemistry | `state.chem` | units for partnerships | the same units |
| Shouts during the match | none in the game | none | none |

## Measured effects (new engine, 2,000 paired matches each way; old engine where measured)

| Decision (first version v second) | New: win % | New: points for / against | What it moved (new) | Old: win %, for / against |
|---|---|---|---|---|
| * First-choice 10 v the squad's weakest 10 | 47.1 to 37.4 (-9.8) | -2.6 / +1.9 | goal kicking 86% to 80%; kick length 25.6 to 24.3 m; tries 3.75 to 3.48 | -9.3; -4.0 / +2.0 |
| * Loosehead and left wing swapped | 47.1 to 37.9 (-9.2) | -2.5 / +1.3 | scrum penalties against 0.66 to 0.86; metres a carry 3.30 to 3.10 | -2.2; -2.2 / +0.6 |
| Lock and outside centre swapped | -8.9 | -2.0 / +1.5 | metres a carry 3.31 to 3.22 | -4.0; -2.3 / +1.3 |
| * Best goal kicker on the tee v the worst | 47.1 to 44.0 (-3.2) | -1.6 / -0.3 | goal kicking 86% to 71% | -2.1; -1.6 / -0.2 |
| Best leader as captain v the worst | -0.3 (dice) | +0.2 / -0.2 | nothing | -0.8 (dice) |
| * Tempo 20 v 80 | 46.0 to 41.1 (-4.9) | +0.7 / +3.1 | ruck 5.7 to 4.4 s; tries 3.64 to 3.75 | -4.7; +0.1 / +2.2 |
| * Kicking 20 v 80 | 48.8 to 44.9 (-3.9) | -1.7 / +0.2 | kicks 14.3 to 22.4 a match | +0.7; +0.6 / +0.3 |
| * Style (forwards) 20 v (expansive) 80 | 44.6 to 48.6 (+4.0) | +2.5 / +0.6 | wide carries 24% to 31%; mauls 3.3 to 0.4 | +1.6; +1.4 / +0.1 |
| * Aggression 20 v 80 | 45.9 to 47.8 (+1.9) | +0.5 / -0.8 | penalties conceded 5.6 to 6.0; cards 0.38 to 0.70 | -1.6; +0.7 / +0.2 |
| Line speed 20 (drift) v 80 (blitz) | +3.0 | -2.6 / -3.8 | breaks conceded 2.8 to 3.1; intercepts 0.07 to 0.34; turnovers won 3.1 to 3.8 | +1.0; -0.1 / -0.8 |
| Attack style direct v width | -9.3 | +0.4 / +4.7 | wide 21% to 35%; offloads 2.7 to 4.6 | -6.1; +0.5 / +2.6 |
| * Attack style offload v kick | 49.5 to 44.2 (-5.3) | -4.8 / -2.8 | kicks 14.2 to 24.5; offloads 11.2 to 2.1 | -0.6; -3.0 / -2.8 |
| * Defence style drift v blitz | 47.1 to 46.6 (dice) | -4.0 / -4.1 | breaks conceded 2.9 to 3.7; turnovers won 2.7 to 3.5 | -4.7; -0.3 / +1.2 |
| * Own 22: kick long v run it | 47.7 to 45.8 (-1.9) | -0.2 / 0.0 | kicks from own 22 4.2 to 2.5 | -6.0; -1.0 / +2.4 |
| * Their 22: drive v spread | 47.9 to 48.9 (+1.0) | +0.3 / +0.4 | mauls 5.1 to 0.5 | +0.3 |
| No called move v the crash ball | +0.7 (dice) | +0.2 / 0.0 | breaks off first-phase ball 0.20 to 0.27 | -0.9 (dice) |
| Preparation: fitness v attack | -0.5 (dice) | +0.2 / +1.3 | late tries 1.23 to 1.15 | -1.1 (dice) |
| No coaches v every coach at level 3 | +7.2 | +1.6 / -1.1 | goal kicking 85% to 87% | +9.1; +1.9 / -3.0 |
| XV form 3 v 8 | +24.9 | +5.7 / -6.0 | tries 3.71 to 4.34; conceded 4.17 to 3.35 | +15.7; +4.4 / -5.0 |
| * XV condition 75% v 100% (rest) | 24.9 to 47.1 (+22.3) | +4.8 / -6.0 | tries 3.12 to 3.75 | +19.9; +5.5 / -6.3 |
| XV morale 3 v 9 | +10.0 | +2.1 / -2.1 | goal kicking 84% to 88% | +5.4; +1.2 / -1.9 |
| Chemistry wiped v every pair at 60 games | +1.4 (dice) | +0.4 / -0.7 | | -2.3 (dice) |
| * Pre-match talk: calm v fire | 50.6 to 55.0 (+4.5) | +0.7 / -1.2 | | not measured |
| * Half-time talk: praise v criticise | 44.3 to 44.0 (dice) | 0.0 / +0.7 | | not measured |
| * Never replace anyone v the bench from 50:00 | 47.1 to 51.6 (+4.5) | +1.1 / -0.8 | | spec: +1.3 points |
| * Every penalty to the posts v to the corner (whole match) | 42.6 to 55.9 (+13.3) | +3.1 / -1.9 | penalty goals 2.2 to 0; close tries 0.47 to 1.10 | not measured |
| * Kicking 20 v 85 from 60:00 | 48.8 to 47.0 (-1.8) | -0.8 / +0.2 | kicks after 60:00 +5.3 | not measured |

## What this says

- **Every decision the old engine uses now bites in the new one.** What is bought or set before the match (selection, coaches, form, condition, morale, dials) bites at about the old engine's size or more. The in-match decisions (subs, calls, talks, tactics) change the match from the minute they are made, and only from then; the tests in `tests/simskeleton.test.ts` prove each kind.
- **Larger than the old engine:** out-of-position selection (-9 against -2 to -4), form and morale (1.6 to 1.8 times), and the corner call (+13 points of win rate). The corner looks too strong: a lineout near the line converts too often. That is a balance call for the owner.
- **Different from the old engine:** blitz against drift (new no change, old -4.7); the offload style against the kicking style (new -5.3, old -0.6); and the kicking dial (new -3.9, old +0.7). In the new engine kicking more gives the ball away more than the territory pays back.
- **Does nothing in either engine:** the captain (only the referee's words use him), and chemistry and called moves (small, within the dice at 2,000).

## Round 6 (24 November, later): the out-of-line levers fixed and re-measured

Same fixture and method, new engine, 2,000 paired matches each way. "Round 5" is the table above; "now" is the engine after this round's tuning to the sourced real figures. The old engine's figure is repeated for comparison.

| Decision | Round 5 | Now | Old engine | What changed |
|---|---|---|---|---|
| Every penalty to the posts v to the corner | +13.3 | +7.4 | not measured | The near-line lineout converts less (held up 15% to 25%, goal-line carries 0.5 to 0.3 of their metres, defenders infringe and counter-ruck more on their line). Our lineout inside 7 m is still worth 3.7 points against about 3.0 in the Premiership study (docs/match-sim-sources.md section 7, arxiv 2512.00312). That study also has the corner beating the posts from range, so "always the corner" winning is not wrong in itself. |
| Form 3 v 8 (whole XV) | +24.9 | +14.4 | +15.7 | A change of form across a whole fifteen is damped (`FORM_DAMP` 0.32 in fromMatch.ts); a man in form against his team-mates still counts in full. |
| Morale 3 v 9 | +10.0 | +5.8 | +5.4 | Unit exponents times 0.8 (fromMatch.ts `UNIT_EXP`). |
| Loosehead prop and left wing swapped | -9.2 | -12.5 | -2.2 | Not fixed: see below. |
| Lock and outside centre swapped | -8.9 | -11.6 | -4.0 | Not fixed: see below. |
| Drift v blitz | -0.5 | -1.7 | -4.7 | The old engine's defence penalty lean is back (a blitz gives away more at the breakdown); breaks conceded 7.8 to 9.7, turnovers won 4.1 to 5.1. |
| Kicking 20 v 80 | -3.9 | +0.3 | +0.7 | A kick's territory is worth more to the side kicking (`COMP_KICK` 0.123 to 0.26). |
| Best captain v worst | -0.3 | -2.0 | -0.8 | New, a design choice. His leadership rating (12 is the middle; captains average about 13) means 5% fewer penalties given away in his own 22 per unit, a 0.8% lift to the carry when behind, and a poor captain gets a late close penalty call wrong a quarter of the time per unit. |
| Chemistry wiped v every pair at 60 games | +1.4 (dice) | knock-ons 6.3 to 5.2 a match | -2.3 (dice) | New: the key partnerships (9 and 10, the centres, the front row, the locks) drop up to 15% less. The lever changes both sides' partnerships, so the win % is not a clean read. |
| No called move v the crash ball | +0.7 (dice) | first-phase breaks 1.11 to 1.56 | -0.9 (dice) | First-phase ball off a won set piece with a called move gains 8% more ground. |
| Bench front row on at 55:00 v none | not measured | +3.7; own scrum results after 55:00 (won and penalties won, minus lost) 1.63 to 1.93 | not measured | New: the front rows' legs decide the scrum (`FRONT_LEGS`). |
| Aggression 20 v 80 | +1.9 | -2.3; penalties conceded 5.4 to 5.7, cards 0.34 to 0.63 | -1.6 | Cards follow the dial and the referee's patience. |
| Half-time talk: praise v criticise | dice | -0.6 (dice); second-half points 14.7 v 14.7 | not measured | Still can't be told from the dice at 2,000 here: the old engine's talk model moves this XV very little. |
| The bench from 50:00 v none | +4.5 | +8.3 | spec +1.3 points | Larger with this round's fatigue and front-row legs. |

Why out-of-position selection is still costly: with the named man switched off entirely (`World.man`), the prop and wing swap still costs -11.0 and the lock and centre swap -8.8, and with the styles switched off -11.1 and -7.7. So it is not counted twice through the man. It comes through the units. The game's own `teamUnits` already charges a non-prop at prop (`SPEC_PROP` 0.84), and this round scrums end in a penalty or free kick 30% of the time (the sourced figure), up from 16%. A weak scrum now gives away far more. I left it there: a wing at loosehead is the absurd case, and the owner can say if a lock at 13 should cost less.

## Round 7 (24 November, evening): talks, positions and the style levers

Same fixture (Leicester v Glasgow, seed 4242, Leicester at home), new engine, paired seeds. The number of pairs is given for each table. At 1,500 pairs the dice alone move a win % difference by about 2 either way, so a gap under 2 is not a finding.

### Team talks

A half-time talk is now heard at the real score (it was read at 0-0 before, so the room could not tell a lead from a deficit) and acts as a spell: what the old engine's talk does to the units, times 3 (`TALK_GAIN`), felt at once and gone 20 minutes later (`TALK_SPELL_S` 1200). A pre-match talk stays all match at a quarter of the old engine's effect (`PRE_TALK_GAIN` 0.25; at full size the best and worst pre-match talks were 12.9 win % apart). 2,000 pairs, against no talk:

| Half-time talk | Win % | Second-half points | Penalties against after half-time | Win % when ahead at half-time (none 70.5) | Win % when behind (none 23.9) |
|---|---|---|---|---|---|
| None | 47.2 | 14.83 | 3.12 | 70.5 | 23.9 |
| Calm | +1.8 | 15.34 | 3.08 | 71.3 | 26.5 |
| Fire | -0.5 | 14.64 | 3.13 | 68.8 | 24.9 |
| Demand | -1.4 | 14.65 | 3.11 | 70.5 | 21.7 |
| Faith | -1.6 | 14.83 | 3.18 | 67.0 | 23.1 |
| Praise | -1.7 | 14.80 | 3.10 | 68.1 | 22.7 |
| Criticise | -1.9 | 14.79 | 3.15 | 70.7 | 19.9 |

Best to worst at half-time: 3.7 win % (calm against criticise). The right talk depends on the score: behind, fire and calm lift the side and criticism costs 4 points of win %; ahead, praise and faith cost 2 to 3.5. Penalties do not move with the talk.

| Pre-match talk | Win % against none | Tries | Penalties against |
|---|---|---|---|
| Fire | +2.4 | 3.66 to 3.73 | 5.74 to 5.57 |
| Faith | +1.7 | 3.74 | 5.58 |
| Calm | +1.3 | 3.68 | 5.71 |
| Expect | -0.5 | 3.65 | 5.81 |

Best to worst before kick-off: 2.9 win %.

### Out of position

Each player's familiarity with his shirt now comes from the game's own data (`effAt`: his position 1, a listed second position 0.92, a near position 0.8, anything else 0.55). The units already charge a side for a man in the wrong shirt, and they are steeper here than in the old engine, so part of that loss is handed back: the share kept is set by the least familiar man (`SHIRT_KEEP`: 0.25 for a second position, 0.3 for a near one, 0.55 for anything else, and all of it for a non-specialist at prop, hooker or nine). The same share applies to that man's own edge in the jobs his shirt gives him. The loss is measured through the old engine's own modifiers, so a plan that no longer fits the reshuffled XV is counted too.

| Swap (each man out of position) | Round 6 | Now | Old engine | Pairs |
|---|---|---|---|---|
| Loosehead prop and left wing (a non-prop at prop) | -12.5 | -10.1 | -2.2 | 2,000 |
| Lock and outside centre | -11.6 | -6.5 | -4.0 | 2,000 |
| Fly-half and inside centre | -7.2 | +0.8 | not measured | 1,500 |
| Fullback and right wing | -7.2 | -2.6 | not measured | 1,500 |
| The two centres | -2.8 | +1.8 | not measured | 1,500 |
| The two flankers | -1.9 | +0.1 | not measured | 1,500 |

### The four style levers by squad

Two versions of Leicester's squad: every forward one point up and every back one point down on all attributes ("pack-heavy"), and the other way round ("backs-heavy"). Their lean, backs against pack, is about 1.2 standard deviations of the Premiership's spread each way (the real Premiership runs from -1.3 to +1.5). Win % change from the first setting to the second, 1,500 pairs each.

| Lever | Pack-heavy | Backs-heavy | Leicester as it is | Old engine (Leicester) | Old engine, pack / backs (800) |
|---|---|---|---|---|---|
| Style dial, forwards 20 v expansive 80 | -8.8 | +5.8 | -2.3 | +1.6 | -4.0 / +2.7 |
| Line speed, drift 20 v blitz 80 | -0.7 | +4.2 | -0.7 | +1.0 | +0.1 / +0.3 |
| Attack style, direct v width | -19.4 | +4.5 | -7.5 | -6.1 | -14.1 / -0.1 |
| Their 22, drive v spread | +3.0 | +4.6 | +2.7 | +0.3 | +0.6 / -1.5 |

Against a narrow defence (Glasgow set to choke) attack width moves towards width: pack-heavy -12.2, backs-heavy +9.2. Line speed with Leicester as it is: +4.9 against a direct Glasgow and +6.5 against a wide one (measured before the dial change below, so these show the direction only).

What changed:
- A tight carry and a maul lean on the pack and a wide carry on the backs (`FIT` in fromMatch.ts, 2% a standard deviation of lean, four times that inside their 22).
- The old engine's style dial and line speed no longer also move the units (`dialLean`, `DIAL_NEUTRAL`). This simulation plays those dials out itself, so they were being counted twice. What a plan the squad cannot play costs in the old engine (`styleMisfit`) still applies.
- A blitz now shuts down a wide carry (`BLITZ_WIDE` 0.25) and gives up a little on a tight one (`BLITZ_TIGHT` -0.04). It used to be 0.1 off every carry.
- The plan for their 22 applies only inside their 22 (`PlayStyle.in22`), so the rest of the field no longer pays for it.
- The compensations for the blitz, the pack and the corner were re-set in the even world (calib.ts).

Not yet right:
- Attack width is far too costly for a pack-heavy squad (-19 against the old engine's -14), and on average across these two squads direct beats width by 7 points, about the same as the old engine's lean. Width also gives away 2.5 to 4.5 more points a match whatever the squad.
- Spreading it in their 22 still beats driving for both squads (+3 and +5). Driving gives only about 0.7 more mauls a match, and a maul or pick and go near their line converts too seldom here. That is the same shortfall as in tries from lineouts.
- A zero-ruck try step (more tries off set-piece strike moves and turnover ball) was not tried this round.

## Round 8 (25 November): the managed match on the new engine

A watched Extended match is now played by the new engine (src/game/sim/toResult.ts), and its record becomes the game's result. Changes that affect the levers:

- **The manager's bench is his own,** as in a watched old-engine match. The assistant runs it only when he has handed it over (`assistantBench`, the game's own instant and resume paths). Before this fix, the assistant's bench never ran for the managed side, so a season of watched matches had 17% fewer appearances than the old engine.
- **He chooses who covers an injury.** The match waits at the next dead ball. The default is the game's like-for-like pick.
- **Injuries happen at the old engine's rate.** A man is hurt in contact at 0.0095 a carry, up from 0.002: about 1.6 men off injured a match, both sides, against the old engine's 1.66.
- **A line break names the defender beaten.** His mark is charged a missed tackle, and his season's tackle success rate counts it.

Three seasons of Leicester, every home match watched, new engine against old (`harmonycheck.ts season 3`), figures a season:

| Figure | Old engine | New engine, before round 8 | New engine, now |
|---|---|---|---|
| Appearances | 566 | 470 (-17%) | 581 (+3%) |
| In-match injuries | 8.3 | 2.3 (-72%) | 9.3 (+12%) |
| Morale | 6.2 | 5.0 (-19%) | 5.6 (-9%) |
| Balance | 3.76m | 3.18m (-15%) | 3.48m (-7%) |
| League points | 45.0 | 42.7 | 49.3 |
| Tries | 83.7 | 74.7 | 75.0 (-10%) |
| Yellow cards | 9.7 | not measured | 12.3 |
| Red cards | 0.0 | 1.3 | 1.0 |

Red cards are left at the sourced rate: about 0.12 a match against the sources' 0.12 to 0.18. At the old engine's count of none, the realism row fails.

Not fixed this round (measured at 1,200 pairs on the squads of the round 7 table):
- **Attack style, direct v width:** -18.9 for a pack-heavy squad, +0.3 for a backs-heavy one. Taking the width preset's style dial back to 50 still leaves -12.5. A narrow ruck commitment or a balanced kicking style makes no real difference. The cost is in how width plays (fewer mauls, wide carries), and width gives away 3 to 4 points a match whatever the squad.
- **Their 22, drive v spread:** spreading it still wins by about 3 for both squads. A stronger near-line maul for a strong pack (gain times the maul contest to the power 2.5 inside the 22) moved nothing, because driving adds only about 0.6 mauls a match. That change was taken out again.

## Round 9 (25 November, evening)

Measured with scripts/tmp/gp/sources.ts: 2,000 paired matches a setting, Leicester v Glasgow, on the round 7 pack-heavy and backs-heavy squads. The script counts from the record where the points come from.

**Attack style, direct v width.** Before this round, width cost a pack-heavy squad 18 win % and gave a backs-heavy one 4. What the record showed:
- Width cut the side's mauls from 7.6 a match to 0.95, because the style's lean on the maul was squared.
- With the mauls went the ground a lineout drive wins: 30 to 45 seconds a match less in their half, for either squad.
- With the old engine's lean on the style taken out (the width field alone, no preset dials), it is only -5 / +1. Most of the rest comes from the preset's dials, mainly the style dial at 84, which the old engine charges a pack squad up to 6% of its attack for.

Changes:
- A style's maul lean counts once, not squared, and near their line every side drives some (`MAUL_NEAR_MIN` 0.7).
- A tapped penalty and the break after a turnover pay less (`PEN_TAP` 0.07 to 0.04, `TURN_B` 1.8 to 1.3).
- Set-piece strike moves in their 22 pay more (`LAUNCH_B_22` 12 to 14), so tries move toward the lineout.

Now (2,000 pairs each):
- Pack-heavy: win 60% to 47%. Points for 30.6 to 27.6, against 26.6 to 29.8. Ruck turnovers conceded +0.6 a match.
- Backs-heavy: win 50% to 55%. Points for 27.0 to 31.4 (line breaks +1.9), against 27.5 to 29.4.
- Averaged over the two squads, direct is still better by about 4, with a swing of 18 between them. Neither is yet in the target range (within 2 on average, a swing of 4 to 8).
- Width still gives away about 2 to 3 points a match against either squad, through time spent in their half and ruck turnovers. The swing comes mostly from the old engine's style-misfit charge.

**Their 22, drive v spread.** Driving gives 5 pick-and-goes a match in their 22 against 2.2, and 0.6 more mauls, but it scored no more tries, because a pick and go was decided by the backs' carrying against the tackle. Now it is decided by the two packs (the maul contest squared, `PICK_VS`). Drive v spread, now: pack-heavy 0.0, backs-heavy +2 win % for spread.

**Why a managed side scored fewer tries over the season runs.** The session's default penalty answer was always the posts. Over 8 of Leicester's home fixtures × 15 seeds, a managed side answering every call with the posts scored 2.42 tries a match against 2.89 with the side's own call (16% fewer), and took 3.0 kicks at goal against 1.5. Only home matches were on the new engine, so the season figure was about 10% down. With nobody managed or through the session, Leicester scores the same (2.95 v 2.99, 8 fixtures × 30). The default is now the side's own call (`session.defaultCall()` and `answerDefault()`).

**Try origins on the 30 balanced fixtures (harmonycheck):** from turnovers now inside the real 11 to 12%. From restarts 8.0% (real 6) and from tapped penalties 2.5% to 3.8% (real 2) wobble between runs. Carries sit at about 181, on the edge of the real band.

**Red cards:** the rate is one constant, `K.P_RED` (0.013 of a penalty's card roll), about 0.12 a match. A second yellow is now a red (Law 9); it was a second yellow before.

## Round 10 (overnight 26 to 27 November)

No lever was retuned this round. Things that change how levers read:
- **The referee now varies by fixture** (the game's own panel). A strict referee gives about twice the yellow cards of a lenient one, so the aggression dial costs more under a strict whistle. To keep the aggression lever's own size, the discipline contest now counts its price to the power 1.8 (`DISC_EXP`). The test "aggression 95 gives away more penalties and more cards than 20" passes again.
- **The other coach now changes how his side plays when chasing, protecting, a man up or in rain.** Late-game levers (the bench from 50:00, a late tactics change) now meet an opposition that answers back.
- **A man on a yellow plays more carefully.** Second yellows fell from 0.033 a match to 0.007, the old engine's rate.
- **Attack style, direct v width, is unchanged: -13 win % for a pack-heavy squad, +3 for a backs-heavy one.** Taking back half of the old engine's style-misfit charge moved it by under 1, so that change was taken out.
