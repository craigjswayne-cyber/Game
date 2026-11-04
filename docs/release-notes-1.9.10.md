# PHASE: Rugby Manager 1.9.10: release notes

Version 1.9.10, Play versionCode 69. Baseline: 1.9.9, code 68. The owner's
round of 3 Nov 2026: "players can ask to retrain in positions occasionally or
the manager can advise this. But it isn't always successful. Forwards / backs
should rarely train in the opposite positions", and more depth in training.

## What changed for players

**Position retraining**
- A player can now learn a new position. He asks in the office ("I want to
  learn number 8, boss"), and "Start on it in training" starts it; or you
  start it yourself from his page: Attributes > Retrain as.
- Each position in the picker carries the coaches' read: likely to work,
  could go either way, unlikely, or a long shot.
- It takes one personal-plan place for its weeks (8 next to his own
  position, 12 further within the forwards or the backs, 16 across), and he
  trains it instead of a plan or the squad session.
- At the end it lands or it does not. A success adds the position to the
  ones he plays (at 92% of his rating, as for any position he is listed
  for); a failure costs a little morale and that position cannot be tried
  again until next season. You are told in the inbox either way.
- The odds: a neighbouring position about 60%, further within his unit about
  30%, a forward to a back or the other way about 5% and never better than
  one in eight. Younger players, ones who asked, a good assistant coach and
  attributes that suit the new position all help; over 30 it is harder.
- A player told to retrain, rather than asking, takes it a little badly.
- The Training screen lists who is retraining, how far along, and a Stop.
- "Work on it in training first", the old answer to a player asking to play
  a position he already has, did nothing. That ask now offers to try him
  there or not, and the learning ask is the one that trains.

**Training load**
- Training has a load: Light, Normal or Hard. Normal is the week every career
  has always had.
- Hard lands more from the training focus and personal plans, and costs
  condition and more training-ground injuries. Light gives the legs back and
  lands less. Measured over three seasons at Northampton with the Attack
  focus: light 47 attribute gains, 2 training injuries, squad condition 94.7;
  normal 86, 5.3, 92.6; hard 140, 6.3, 92.2.
- No load is a free win. Over 8 seasons each at Northampton and Bath, league
  points in the season itself: light 50.8, normal 53.0, hard 51.0, all within
  the noise of each other. Hard's extra growth is what carries into the next
  season. A first version of hard (x1.6 injuries, -4 recovery) cost 5 to 9
  points a season and was softened to x1.35 and -2.
- Training shows what last week did: the load, the attribute gains and how
  many were hurt in training.
- Your club only. AI clubs train as they always have.

## Not changed

- The match engine, and the world's random stream (the retrain roll is a
  hash, and the load only scales rolls that already happen):
  `scripts/fingerprint.ts` holds it.
- Saves: the new fields are optional and cleaned on load.

## Tests

- New: `tests/retrain.test.ts`, `scripts/retrainui.mjs` (browser).
