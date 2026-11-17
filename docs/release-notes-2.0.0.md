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
