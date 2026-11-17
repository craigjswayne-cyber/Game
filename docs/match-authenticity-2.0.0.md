# Live pitch 2.0.0: what a real match looks like

Owner, 17 Nov 2026: "it needs to look and feel like a rugby game", "Do more
research before we continue", "We need to build and build to give this a super
authentic match feel."

This is the reference the live pitch is built against. Each section says what
real rugby does (with where it comes from), what the pitch does today, and what
gets built. Numbers are from World Rugby's own reports, the Laws, and published
analysis. Where no number exists it says so.

## 0. The shape of a real match (the targets the whole thing is tuned to)

World Rugby's Rugby World Cup 2019 report, per match, both sides together:

| Thing | Per match |
| --- | --- |
| Ball in play | 45% of 80 minutes (about 34 to 36 minutes) |
| Passes | 273 |
| Rucks and mauls | 174 |
| Kicks from hand | 45 |
| Scrums | 14 |
| Lineouts | 25 |
| Penalties and free kicks | 17 |

There are about four times as many breakdowns as scrums and lineouts together.
A typical side makes about 90 passes and 60 carries a match, concedes 10 or 11
penalties and makes about 7 handling errors.

What that means for us: a match is mostly phase play (carry, ruck, pass), and
the engine only writes about 139 lines. The pitch has to fill in the phases
between lines, and those have to look right, because they are most of what is
on screen.

## 1. Attack shape (pods)

Real:
- The standard phase shape is 1-3-3-1: one forward in each 15 metre channel,
  two pods of three forwards in the middle of the field. Common variants are
  1-3-2-2 (Japan 2019, Ireland), 2-4-2 (wider, more ball movement) and 1-4-2-1
  (South Africa, 2025). Shapes have got more compact over time.
- A pod of three has a ball player with three choices: carry, a short pass to
  the man beside him (tip on), or a pass behind the pod to a back (out the
  back). So a playmaker stands behind each pod.
- Attack has two lines: a flat one (the pods) and a deep one (the backs).
- The athletic forwards (hooker, back row) take the wide channels, the heavy
  ones the middle pods.
- On slow ball teams play close to the ruck (New Zealand played 53% of slow
  ball within 10 metres of it); on quick ball they go wide.

Pitch today: one pod of three, a pair, loose backs. No tip on, no out the back,
no named shape per club. Depth was wrong (fixed in this pass).

Build:
1. Shapes as data: 1-3-3-1, 1-3-2-2, 2-4-2, each a set of forward channels.
   Each club gets one from its tactics.
2. Pod play: the middle man gets it from the 9 and carries, tips on, or plays
   out the back to the 10 (or 12, 15) standing behind.
3. Edge forwards hold the 15 metre channels; back row and hooker go there.
4. Slow ball plays tight, quick ball goes wide.

## 2. Defence

Real:
- Offside line at a ruck is the last foot. The line stands flat on it.
- Next to the ruck stand a guard (pillar) and a second man (post, bodyguard)
  each side. After every tackle the defence folds: men get up, run round the
  ruck and fill the line, wide first, with two always close to the ruck.
- Blitz (rush): the line shoots up together to hit the receiver early. Used
  on slow ball or a flat, static receiver. Leaves space behind and outside.
- Drift: the line comes up then slides out, using the touchline as a defender.
  Used when outnumbered.
- Most teams now mix them: inside men rush, outside men drift.
- Backfield: the old pendulum is full-back plus one wing back, swinging to
  the ball's side. Since 50:22 teams often hold two back, and wider. The
  defending 9 sweeps behind the line. A wide man can sit at half depth.
- A kick-off needs choices too: four back leaves 11 in the line.

Pitch today: a line with guards, but it was not flat and it backed away in
front of the carrier (fixed in this pass). No fold, no named system.

Build:
1. Fold after each tackle: visible movement round the ruck.
2. Rush and drift as real behaviours, per club, with the trigger (slow ball).
3. Backfield pendulum: 15 and one wing, swinging with the ball; second man
   back when the attack is in kicking range.
4. Men mark a man: numbering up from the inside.

## 3. Rucks and the breakdown

Real:
- The average ruck clears in about 3 seconds. Over half are under 3 seconds.
  Ireland averaged 2.78 seconds in one Six Nations match, Scotland 4.46.
  Possession sides get 57% of rucks under 3 seconds, defensive sides 34%.
- Attack commits about 2.5 players to a ruck.
- Order of events: tackler brings him down and must release and roll away;
  the first defender to arrive (the jackal) goes for the ball on his feet; the
  first attacking support clears him out; a ruck forms; the 9 plays it.
- Defences contest some rucks and leave others to keep men in the line.
  One sample: sides contested 62% to 84% of rucks.
- An isolated carrier with slow support is when a jackal wins it.

Pitch today: tackled man, two or three over the ball, 9 at the base, fixed
0.8 second wait, no contest, no variation.

Build:
1. Ruck length drawn per ruck around 3 seconds, quicker for possession sides.
2. Jackal contest: a defender over the ball, cleaned out or wins it.
3. Two or three attackers by default; more when contested.
4. Outcomes: quick ball, slow ball, turnover, penalty (holding on, not
   rolling, offside, hands in).
5. Draw men in the ruck smaller so it reads as a ruck, not a pile of discs.

## 4. Passing

Real:
- The 9 passes from the base. Ball goes through hands along the line: each
  man passes to the next, who is deeper and running on to it.
- Types: short pop, tip on, out the back, miss pass (skips a man), switch
  (runner cuts back), loop (passer runs round the receiver), offload in the
  tackle, long cut-out.
- Half of tries come from three or fewer passes.

Pitch today: one direct pass from the 9 to whoever carries, however far.

Build:
1. Ball through hands: chain passes, each to a man running on.
2. Offloads keep a move alive without a ruck.
3. Miss pass and switch in phase play, not only in called moves.

## 5. Scrums

Real (Laws):
- Backs who are not the 9 stay 5 metres behind the last foot of their scrum.
- The defending 9 stands beside the other 9 or 5 metres back.
- About 14 a match. Outcomes: clean ball, penalty, free kick, reset, a wheel,
  the number 8 picking from the base, a push-over near the line.
- Backlines start about 10 metres apart, so a scrum is the best strike
  platform. Open side and blind side matter for the move.

Pitch today: a pack shape, ball out to the 9, backs roughly placed.

Build: 5 metre offside lines, the put-in and hook, the shove (one pack going
forward), 8 pick, 8-9, resets and penalties, strike moves off it, defending
back row breaking off.

## 6. Lineouts and mauls

Real (Laws):
- Line stands between 5 and 15 metres in from touch. Everyone not in it is 10
  metres back. The thrower's opposite stands 2 metres from the line in the
  5 metre channel. A receiver (usually the 9) stands 2 metres off the line.
- Once the ball is caught the 10 metres goes and both sides come up.
- About 25 a match. Options: front, middle or tail ball; off the top to the
  9; catch and drive (maul); a peel round the front or back; shortened lines
  (4, 5 or 6 men) with spare forwards in the backline; quick throw.
- The defence chooses to jump against it or stay down and defend the maul.

Pitch today: a line, a throw, a pass to the 9, a basic maul.

Build: 10 metre lines, lifts (two lifters and a jumper as a unit), throw to
front, middle or tail, off the top or drive, shortened lines, the steal,
maul moving with men joining, peel.

## 7. Kicking

Real:
- About 45 kicks from hand a match. Most are 15 to 35 metres. Over four in
  ten go 20 metres or less.
- Box kick: by the 9 from a ruck, high, about 30 metres at most so the chase
  can contest it. The chasing wing starts wide and bends in at the catcher.
  Two support men stay close for the loose ball.
- Exit: getting out of your own 22, by box kick, long kick to touch, or a
  kick down the middle with a chase.
- 50:22: kick from your own half that bounces into touch in their 22 gives
  you the throw. Backfield defenders stand wider because of it.
- Others: grubber, chip, cross-field kick to the wing, up and under, kick
  to touch from a penalty, drop goal.
- Receiving: catch, then run, pass infield, or kick back. The few seconds
  after a kick are the best counter-attack chance because the chase is spread.
- A chaser inside 5 metres means kick back; 10 metres or more means run.
- A mark can be called inside your own 22.

Pitch today: one kick shape with a chase template.

Build: each kick type with its own chase and its own receiving shape; the
aerial contest; kick tennis; counter-attack by the back three; 50:22; mark.

## 8. Restarts

Real (Laws): kick-off must go 10 metres; receivers stand 10 back; kickers'
team behind the ball. Chase line is seven forwards split either side of the
kicker with wings on the edges. Kicks go high to the 10 metre area in front of
or behind the 22, left or right, rarely the middle. Receivers lift a catcher.
22 drop-out and goal-line drop-out are the other restarts.

Pitch today: kick-off with a pack on the kick side.

Build: chase line, receiving pods with lifters, the catch, the exit that
follows; 22 and goal-line drop-outs.

## 9. Penalties and free kicks

Real (Laws): offenders go back 10 metres. Penalty options: kick at goal, kick
to touch (you keep the throw), tap and go, scrum. Free kick: no kick at goal,
and since July 2024 no scrum option; tap or kick. Quick taps catch a defence
that is not back 10. Advantage is played first. About 17 a match.

Pitch today: a pause, then the next thing.

Build: the referee's signal, the defence retreating 10, each option shown as
what it is, quick tap, advantage played before the whistle.

## 10. Turnovers and interceptions

Real: turnovers come from the jackal, a counter-ruck, a strip in the tackle,
a knock-on, a pass that goes to ground, a lost lineout or scrum, a charge
down, or an intercept. Attack off a turnover is the most dangerous attack
because the defence is not set; teams either go wide at once or kick into an
empty backfield.

Pitch today: possession just changes.

Build: each turnover shown as its cause; the transition (the new attack goes
immediately, the old attack scrambles back); the intercept as a read and a
sprint the other way.

## 11. Styles (per club, from tactics)

Attack: tight and direct (pick and go, one-out runners), expansive (wide,
offloads), kick-heavy territory, structured pods, off-9 or off-10 play.
Defence: rush, drift, mixed; contest every ruck or fan out; two or three in
the backfield.
The ball in play gap between styles is real: 27 minutes in one 2023 World Cup
match, 42 in another.

Pitch today: `sim.rush` exists but is not wired to the club.

Build: read each club's tactics into shape, ruck speed, contest rate, kick
rate and defence system, so two clubs look different on the pitch.

## 12. Things not on the owner's list that a real match has

- Mauls from open play and the choke tackle (held up).
- Advantage being played.
- Cards: 14 men changes every shape; a sin-binned man leaves and returns.
- Substitutions, injuries, blood and head-injury replacements.
- The TMO check and the wait.
- Tries: grounding, the dive in the corner, push-over, penalty try.
- Conversions from where the try was scored, and the kicking tee routine.
- Drop goals.
- Offloads and line breaks with support runners.
- Knock-ons, forward passes, balls into touch, quick throws.
- The referee and assistant referees' positions.
- Fatigue late on: slower rucks, wider gaps.
- Weather: wet ball means more kicks and more handling errors.
- Half-time and full-time: the walk off.
- Captain's choices at penalties (posts or corner) by score and clock.
- Goal-line stands and pick-and-go near the line.
- The crowd and the bench reacting.

## Build order

1. Phase play core: attack depth, flat defence that holds, fold, ball through
   hands, ruck with a contest and a real length. (In progress.)
2. Pods and shapes per club; rush and drift per club.
3. Kicking game: box kick and chase, exits, receipt and counter, 50:22.
4. Set piece: scrum then lineout and maul, with the Laws' offside lines.
5. Restarts, penalties, free kicks, advantage, quick taps.
6. Turnovers, intercepts, transitions.
7. Cards, subs, TMO, late-game fatigue, weather.
8. Pacing: match length.

## Sources

- World Rugby, RWC 2019 Statistical Report:
  https://resources.world.rugby/worldrugby/document/2022/01/26/9106cf21-9a5f-4b99-b386-3f13eaeb6183/RWC_Analysis_2019-1-.pdf
- World Rugby Laws, Law 10 (offside), Law 12 (restarts), Law 20 (penalty and
  free kick), July 2024 changes: https://passport.world.rugby/laws-of-the-game/
- World Rugby breakdown guidelines: https://world.rugby/the-game/laws/guidelines/15/detail
- Rugby Coach Weekly, 1-3-3-1 framework: https://www.rugbycoachweekly.net/rugby-coaching/the-1-3-3-1-attacking-framework
- The42 on attack shapes: https://www.the42.ie/article.php?id=6499204
- Sportplan, drift v blitz: https://www.sportplan.net/drills/Rugby/trends/defensive-systems-drift-blitz-2025-01.jsp
- Planet Rugby on modern defence: https://www.planetrugby.com/news/to-blitz-or-not-to-blitz-how-the-best-teams-in-the-world-defend-in-the-golden-age-of-rugby
- Sam Larner on backfield cover: https://samlarner.substack.com/p/tactics-defending-the-midfield-scrum
- Rugby World and Opta on ruck speed: https://www.rugbyworld.com/tournaments/rugby-six-nations/six-nations-analysis-creating-chaos-through-ruck-speed-136603
- Framesports on ruck speed, kick length and the average match:
  https://framesports.ai/blog/how-quick-is-quick-ball/
- The Roar on players per ruck: https://www.theroar.com.au/2013/12/18/the-ruck-contest-is-the-crucial-battle/amp/
- Hudl on slow ball v the rush: https://www.hudl.com/blog/all-blacks-vs-springboks-how-to-beat-the-rush-defence
- The Rugby Site on the kick chase: https://www.therugbysite.com/blog/kicking/how-to-construct-an-effective-kick-chase-game
- Rugby World on kick-offs: https://www.rugbyworld.com/?p=120112
- The Rugby Site on lineout defence: https://therugbysite.com/blog/defence/what-is-the-best-defence-at-lineouts
- Sportplan on counter-attack: https://www.sportplan.net/drills/Rugby/trends/counter-attack-from-kicks-transition-2025-05.jsp
