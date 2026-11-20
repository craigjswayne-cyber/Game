# PHASE: Rugby Manager 2.0.0: release notes (draft)

**IN BUILD, NOT READY.** Started 16 Nov 2026 from two clips of another rugby
manager's match view (owner: "V2.0.0 of Phase Rugby Manager - in game should
be evolved into this. This is exactly what I want" and "I dont care its a
rival. We need to just get better and better by taking ideas from
everywhere"). On the branch `v2.0.0-live-pitch`; nothing merged, nothing
uploaded. The version number in `package.json` and the Play versionCode are
not bumped yet: that is the owner's call when it ships.

## What changes for players

- **The whole match on the pitch.** In Match Settings, **Extended** now plays
  the full eighty minutes on a live pitch (owner: "Extended should be where
  you watch full match"). Every line of commentary is played out in real
  time: scrums, lineouts, mauls, rucks, carries, passes, box kicks, high
  balls, kicks to touch, restarts, goal-line drop-outs, penalties, kicks at
  goal, tries. All thirty players are on it, in their shirt numbers and their
  club's colours, with the referee.
- **The full pitch, upright, never moving.** Owner, on the first pass: "the
  moving camera tracker should not happen - i prefer the original style where
  you see the full pitch" and "stay vertical - its key for the phone". Try
  line to try line up the screen, the home side attacking upwards. With the
  phone on its side the pitch turns with it.
- **Smooth, and it never cuts.** Owner, on the first pass: "The animation is
  incredibly jumpy"; on the second: "Its quite glitchy" and "The whole 80
  mins should be played but sped up when there's nothing really happening".
  Every player has a top speed and has to run to where he is going. When the
  match moves on, the players run there in fast forward (two chevrons show in
  the corner); nothing is ever teleported after kick-off. Quiet play in
  midfield is wound on at about three times real time; a called move, a try,
  a kick at goal and anything in the 22 are played at real time.
- **Your moves, run as drawn.** Owner: "I didnt see any of the moves". When a
  called move is run the pitch plays the Playbook's own lines for it (the
  same keyframes the Playbook preview uses), with each runner's line dashed
  ahead of him and the move's name on screen.
- **Everyone in his place.** Owner: "players look out of [position]". The
  wings stay on their own wings, a defence has its forwards close to the
  ruck and its backs wide, the men at a breakdown are the men who were
  nearest it, and a kick-off has the pack on the side it is kicked to.
- **A try you can see.** Owner: "tries seem a bit unclear". The scorer is on
  his own over the line with a gold ring, rings spread from the ball, and the
  banner sits in the other half of the pitch.
- **Square posts.** Owner: "The posts look wonky".
- **The moment, called.** A try lands with TRY, +5, the scorer, his club and
  the minute, and confetti in his colours. Conversions, penalty goals, drop
  goals, cards and a try ruled out get their own. A label names the play
  (Scrum, Lineout, Box kick, High ball, Phase 6, Turnover), a called move is
  named when it is run, and a dashed arrow shows the line a man is running on
  to the ball. The side attacking is written on the in-goal it is attacking.
- **A ground round the pitch.** Stands behind the posts with a crowd in both
  clubs' colours, crowd down the touchlines, posts with their height, and
  advertising boards carrying your club's own sponsors and the game's other
  invented brands. Nothing real is on them.
- **Speed.** Slow, Normal and Fast still work: they play the pitch at 0.85,
  1 and 1.6 times that. A full match is about six and a half minutes at Normal
  and about four at Fast. Skip and Key Moments are as before.
- **Key is unchanged.** Commentary, live stats, and the highlight clip for
  tries. It is still the default (see Decisions).
- **Six languages.** Every word on the pitch is in English, French, Spanish,
  Italian, Japanese and Afrikaans.

## How it is built

- `src/ui/livepitch/phase.ts` reads each match event into a phase from what
  the event already carries: its commentary key, where the engine had the
  ball, whose line it is and who did it.
- `shapes.ts` places the thirty for each phase; `sim.ts` moves them (bodies
  with a top speed and an acceleration, passes, kicks, cuts); `LivePitch.tsx`
  draws it.
- It reads the match and writes nothing back. It draws no random numbers from
  the match stream, so no result, save or fingerprint can move.

## Checked

- `tests/livepitch.test.ts`: on two whole matches every line's play finishes,
  nobody moves faster than a sprint between two frames except across a cut,
  a match is between four and twelve minutes, and every label has words.
- `npm test`: 53 files, 366 tests pass, plus the two above. Typecheck, lint
  and `scripts/i18nprobe.ts` pass.
- A whole match played in the real game on Extended and Fast, through the
  talk reactions, a kickable penalty, an injury replacement, half-time and
  the 60-minute break: no stall, no console errors.
- Phone upright (390x844), phone on its side (844x390), tablet both ways.
- On Key, `hlliveprobe` and `feedprobe` pass against a build.
- NOT yet run: the full browser suite, the soaks, a real phone.

## Match engine (changes results)

- **Quick taps in open field.** A penalty out of kicking range is no longer
  always a kick to touch. A side that plays at tempo sometimes taps and goes
  (about one in ten for a slow side, four in ten for a quick one). It keeps
  the ball and makes less ground than the kick would.
- **Not back ten.** After a quick tap the defence can be caught inside ten
  metres: another penalty against them and the mark goes ten metres on. How
  often is the defending side's aggression dial. It counts towards the
  referee's patience, so it can lead to a card. Same for the manager's side
  and the AI's.
- Fixed-seed baseline rebaselined for this (one of six matches moved);
  the league balance check holds.

## Decisions for the owner

- **Make Extended the default?** Today a player only sees the pitch if he
  picks Extended in Match Settings. A new player would never know it is
  there.
- **Version and store.** Bump to 2.0.0 and the next versionCode when ready;
  store text and screenshots want redoing round the pitch.
- **A real phone.** Frame rate and battery on an older Android have not been
  measured.

## The live pitch, 18 to 19 November 2026

What changed on the Extended match view. The match engine's results and scoring odds are unchanged (the sim fingerprint passes).

- The ground is a painted stadium: twelve of them, chosen by the home colour, day or night, rain or snow. Rain and snow fall.
- The match screen is the pitch, then the buttons, then one line of commentary with the last one sliding up. The line waits until the pitch has reached the play it describes.
- Play flows from one line to the next from where the ball actually is. Scrums and lineouts form where play takes them.
- Two speeds, with the chevrons up while it winds on. A whole match is about four and a half minutes.
- The kick-off is received in pods and caught; the chase comes up as a line.
- Tries are played the way the words describe them: from close in, off a maul, out wide, through the line, a kick in behind, from long range, and the overlap against a side a man down. The defence contests them.
- A try is grounded where the kick that follows makes sense; conversions are taken in line with it and further back the wider it was.
- A side down to fourteen shows a plate by the touchline; the side a man up stretches the play.
- Tactics changed during the match now reach the pitch (they were read once at kick-off). The kicking dial, the zonal plan and each selected player's pace show too.
- Movement: a spring on every man's place, separation between men in open play, gentler starts and stops.

Not done: aggression and player roles on the pitch; match length is above the 3.5 minutes asked for.

## The live pitch, 19 November 2026 (day)

Owner's notes on the full-match video, and the day's list.

- The ball never travels forward between team-mates: a pass no longer follows a receiver who has run past the passer.
- The dashed move lines, the carrier arrows and the gold "Move" label are gone.
- A lineout forms where the kick crossed the touchline, never within five metres of a goal line.
- A missed penalty goal that goes dead is a 22 drop-out: a commentary line in six languages (words only, results unchanged) and the pitch plays it.
- Out on the full and the 50:22 are drawn and labelled; the other side's lineout follows a kick out on the full.
- Defenders step up to the ball carrier. A try-scoring break goes through the line and the defence turns and chases in lanes.
- Tries are scored on the side of the field the ball is on; the scorer stays where he grounded it.
- A kick at goal is taken from its mark, the kicker walking out with the ball.
- The set piece breaks up once the ball is well clear of it.
- One kick-off, not two. The score and the try line wait until the pitch has grounded it.
- Tired players are up to a tenth slower; fresh replacements are not.
- A few live stats under the commentary. Bigger, clearer text: the name under the score word, shirt numbers, the pitch label, the 14-man plate, both commentary lines.
- A trial ceiling on the wind-on speed (`?lpcap=`), off by default.

Measured, not changed: selection (best XV wins 48.0%, three stars rested 31.5%, second XV 14.0%), team talks (51.6% best, 45.7% none, 40.1% worst in even games), substitutions (+1.3 points from four fresh men), game plan (+4.9 points), referees (strict 2.04 yellows a match, lenient 0.76).

## The live pitch, 19 to 20 November 2026 (night)

Owner's notes on the 5pm full-match video.

- The pop-up for a score or a card is a small plate at the bottom centre of the pitch, every row centred, with a bar in the side's colour. The same plate names what needs explaining, with the side whose ball it is: turnover, knock-on, penalty, out on the full, 50:22, drop-outs, held up, charged down, TMO check.
- A card a side is carrying sits under its name in the top bar.
- A kick to touch bounces in the field before it goes out. Any kick into touch is followed by the other side's lineout where it went out (the kicking side's after a 50:22).
- A scrum out of open play says why: "Knock-on." in the scrum commentary (six languages, words only) and on the plate, and the ball is seen spilled forward.
- A turnover is seen: the carrier goes down and the other side's nearest man comes away with the ball.
- The second half starts with a kick-off, taken by the side that did not start the match, both sides in their places.
- The kick-off catcher runs the ball back; nobody stands still after the catch. A restart after a score is kicked from halfway, not from wherever the kicker had got to.
- From a scrum the scrum-half puts the ball in, and a front-five forward does not run off it: the number 8 picks up first.
- The run-in to a try is watched, not wound on. A carrier whose run ends in open grass is run down by the two nearest defenders.
- Offside at kicks (law 10): only players behind the kicker chase; those in front wait for the line.
- No kick at goal from a silly angle. The ball is lobbed to the kicking mark and the kicker walks out to it.

Engine, deliberately, fingerprint rebaselined (three of the six fixed results changed):

- A kick out on the full about once a match: 0.44 a match before, 1.29 after, over 300 matches.
- A strict referee blows a little more and a lenient one a little less. Penalties a match over 1,500: strict 6.4 to 6.8, fair 6.1 to 5.8, lenient 5.5 to 4.9, all referees 6.10 to 6.02.

## The live pitch, 20 November 2026 (morning)

Owner: "The movement still isnt accurate - players jumping around the pitch randomly - the ball not moving correctly".

Measured on screen over a whole match (scripts/tmp/screen.ts): three or more men moving faster than 17 m/s for 42.7% of the time watched, and the ball over 45 m/s for about 40 seconds. The cause was the wind-on: 139 seconds a match shown at four to 6.6 times life speed, 105 of them thirty men being hurried to a set piece.

- A stoppage dissolves to the formed set piece (kick-off, drop-out, lineout, scrum, conversion, penalty goal). Live play never cuts.
- Nothing is wound on faster than 1.18 times watching speed. A gap in open play is crossed in one or two carries.
- After: three or more men over 17 m/s 0% of the time; ten or more men over 12 m/s 8.6% (42.1% before); the ball over 45 m/s under half a second a match.
- A drop goal is kicked out of play (ruck, pass to the fly-half, drop kick), and its plate no longer fills the pitch (its class collided with a tactics-board rule).
- At a restart only the three nearest forwards come in behind the catch; the receiving pods are opened out.
- Match length: about 2.2 to 2.7 seconds a line in the real game.

## The live pitch, 20 November 2026 (afternoon)

Owner, 09:38: "The movement still isnt accurate - players jumping around the pitch randomly - the ball not moving correctly."

Cause: between plays the pitch wound on at 4 to 6.6 times speed, so players crossed the field faster than anyone can run.

Changes:
- Stoppages (scrum, lineout, kick-off, drop-out, kicks at goal) dissolve to the formed set piece. Nobody is fast-forwarded into place.
- One watching speed throughout (2.05). Player top speed capped at 8.25 m/s.
- A scrum forms where the knock-on happened.
- A lineout more than 12 m upfield of the ball is preceded by a visible kick to touch.
- Attacking back line stands a quarter flatter, so a pass wide no longer travels about 15 m backwards.
- Dead time cut: shorter hang on kick-offs and goal kicks, shorter wait after a try.
- A kick-off is shown after every score. The engine writes a restart line for about three scores in four; the pitch plays the rest.
- `?lpbase=` sets the watching speed for review (1 is life speed).

Measured on the same test match, per watched second (the probe used at 1pm under-read speeds; these are the corrected figures):

| | 7am build | Now |
|---|---|---|
| 3+ players over 22 m/s | 40.9% | 0% |
| 3+ players over 17 m/s | 44.9% | 4.2% |
| 10+ players over 12 m/s | 49.0% | 21.1% |
| Frames with the ball over 45 m/s | 1313 | 29 |
| Ball jumps | 3 | 0 |

Real match length: 385 s for 144 lines including about 65 s of pause screens, about 2.2 s a line (7am build about 2.0).

No engine change this afternoon: results and scoring odds are unchanged (fingerprint passes).

Known and not fixed: at a penalty kick at goal the defence stands on the goal line as at a conversion; both sides stand in one flat column for a moment after a turnover; the pack is tight at the first ruck after a kick-off; drop goal staging is untested; 5 of 14 lineouts still dissolve more than 12 m from the ball.
