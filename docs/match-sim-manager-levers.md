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
