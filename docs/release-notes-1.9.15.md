# PHASE: Rugby Manager 1.9.15: release notes

Owner's round of 20 Nov 2026, from playing 1.9.14 as a national coach.
Version 1.9.15, Play versionCode 78. Baseline: 1.9.14, code 77.

## What changed for players

- **A national coach without a club can pick the Test side (urgent).**
  Owner: "ive picked my squad but i cant select my xv and subs for my game
  in international mode". A manager who holds only a country was sent back to
  Home every time the match day screen opened: the guard that keeps an
  out-of-work manager off the club's desk screens counted the match day as one
  of them. In a week with a Test, the match day screen is now the Test's, and
  the XV, the bench, the captain and the game plan can all be picked. A
  manager with a club and a country was not affected.
- **The coaches' squad covers every position.** Owner: "if you dont have any
  lp for example in the squad, make sure more lps are in the call up". "Take
  the coaches' squad" took the best players in order, so it could name a
  squad with no loosehead. It now names three props on each side, three
  hookers, four locks, three flankers, two number 8s, three scrum-halves, two
  fly-halves, three centres, three wings and two full-backs first, then the
  best of the rest. The squad desk also says which shirts are short of cover.
- **Social media reacts to each squad announcement.** Owner: "media should
  react to each squad announcement with a social media update of responses".
  The announcement shows posts from a pundit, supporters and a former
  international on the debuts, the recalls and the names left out. The same
  squad always gets the same posts; nothing in the world's random stream moves.
- **The Job Centre leaves a national coach's bottom bar.** Owner: "the job
  centre keeps coming up when im an international coach only". It is under
  World, with its badge.
- **No fees for the international game.** Owner: "fees etc should be nothing
  to do with the international game". For a manager who holds only a country,
  a player's page no longer shows value, wage or the transfer and contract
  desk.
- **No caps count on the squad desk.** Owner: "remove the number of caps the
  internationals have". The call-up list keeps the "uncapped" marker, which
  the debuts depend on.
- **Test dates on the day they are played.** Owner: "said squad is open to
  pick on international but it changed date?". The campaign card, the Home
  tile and the Tests list printed the Saturday the game week is counted from,
  which for a Test week is a day already gone, while the Test itself is played
  Friday to Sunday. Each now prints the Test's own date. A national coach with
  no club is no longer told an assistant takes the club match.
- **The Board Funding box fits the screen.** Owner: "Board Funding box goes off
  the screen". The box (and the Infrastructure store box beside it) was 100%
  wide plus a card's margins, 24px past the right edge.
- **The Announce button appears as soon as the squad is legal.** Calling a
  player up or taking the coaches' squad did not redraw the campaign card or
  the "Name N more" button until another screen did.

## Answered, no change needed

- **Do players retire and leave the call-ups?** Owner: "does the game evolve
  enough so that Owen farrell retires and he cant be called up again". Yes:
  every summer players of 34 and over may retire (a fifth to nearly a half each summer
  at 34 and 35, three in five at 36 and 37, all at 38), and a retired player
  is removed from the world, so the call-up list moves on with the years.
  Young players develop into it.

## Tests

- New: `scripts/natonlyui.mjs` (browser: a coach with only England and no
  club reaches a Test, picks a shirt from the squad, has no Jobs button on the
  bar, sees no value or wage on a player's page, the coaches' squad covers
  every shirt, the announcement shows social media posts). It fails on 1.9.14.
- Run here: typecheck, lint, text and token lints, CSS audit, orphan check,
  421 unit tests, the engine fingerprint (unchanged), the country probe, the
  international stage and country browser harnesses.
