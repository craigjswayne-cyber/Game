# PHASE: Rugby Manager 1.9.12: release notes

Version 1.9.12, Play versionCode 71. Baseline: 1.9.11, code 70. Two player
reports: one from Bristol in Premiership Women's Rugby (iPhone in a Safari
tab, 10 Nov 2026) with three points in it, and one in French on loans,
statistics, training and scrums.

## What changed for players

- **Women's players are no longer called "he".** Three player stories kept
  their women's text where the game looks for the manager's pronoun instead
  of the world's: a training injury ("so he misses the next one"), two
  around-the-grounds stories about props, and the opposition report's "The
  men who matter". So a women's career with the manager left on "he" read
  them about men, and a men's career with the manager on "she" read "The
  women who matter" about men. Nine more player lines had no women's text at
  all: a contract renewal reply, the transfer request lines in the history,
  four set-move descriptions and a scouting question. All are fixed in the
  six languages where the language needs it.
- **The game asks how the press should refer to you.** The choice has been
  in Settings since v1.5.3, but a career started on "he" and nothing said so.
  Home now shows a He / She card until one is picked, here or in Settings.
  It also appears once in a career already under way, on a device that has
  never answered.
- **Shirt 1 can be reached in the match-day squad.** The sheet opened from
  the half-time and 60' touchline was drawn inside the touchline panel, which
  is itself a scrolling list, and mobile Safari is known to misplace fixed
  overlays inside scrolled containers. It is now drawn at the app root, with
  nothing scrolling around it. Its heading also sits above the player list
  instead of floating inside it, so nothing can cover the loosehead.

- **A player on loan to you cannot be transfer-listed.** The button was there
  and did nothing (no club ever bid for a listed loanee). It is gone, and a
  loanee arrives off any list his parent club had him on.
- **A loan can be terminated.** A player on loan to you has an "On loan from"
  card on his page, with "Terminate the loan" first on it, after four weeks (the same floor as recalling one of yours). He goes back
  that day and the wage share stops; a cut-short loan pays none of the
  development a full one does. Buying him during the loan was already there
  (after eight weeks, in a window, if his club will sell) and is unchanged.
- **Kicks and tackles are counted.** Conversions and penalties taken as well
  as made, with the rate ("Cons 8/10 (80%)"), and tackles, on every player's
  season. World > Team of the Week adds Top Tacklers and Top Goal Kickers (by rate,
  at least 10 kicks) under the team itself, with the try and points
  boards. All of them build through the season and start again from nothing
  at the summer, with every other season figure. In a season already under
  way the rate starts from the day 1.9.12 is first opened, and the tackle
  count from zero.
- The leaderboard titles in French, Spanish and Italian now read in the
  feminine in the women's game ("Meilleures marqueuses d'essais").

## Not in this release

From the French report: kick distances, training groups and a training load
per player, and scrum weight with each player's weight. Each is a new system
rather than a fix.

## What was not reproduced

The shirt 1 report is the third of its kind, and Chromium has never shown
it: at 390x844, at both larger text sizes, opened at half time and at the
60' break, shirt 1 was on screen and could be tapped. What Chromium did show
is that the sheet sat inside the scrolling touchline panel at both breaks
(subreach.mjs now fails on that: 4 failures on the 1.9.11 layout). Both
fixes remove what Safari could get wrong, but neither has been seen on an
iPhone.
Check it on one before release: half time, Match-Day Squad, scroll to the
bench and back up.

## Checks

- `tests/playerpronoun.test.ts`: each fixed line reads her in the women's
  world and him in the men's, under either manager pronoun, with no
  masculine marker in French, Spanish, Italian or Afrikaans (30 failures on
  the 1.9.11 text).
- `scripts/subreach.mjs`: the sheet has no scrolling ancestor, and a tap on
  the middle of shirt 1 reaches the row when the sheet opens and after
  scrolling to the bench and back.
- `scripts/mgrgender.mjs` section 5: the Home card.
- `tests/loansendback.test.ts`: a loanee arrives unlisted, cannot be sent
  back inside four weeks, goes back after, with no development payoff.
- `tests/kickstats.test.ts`: every kick made was a kick taken, tackles only
  for men who played, a season under way never reads over 100%, and the
  season close starts every count again. Twelve
  weeks of a men's career: conversions 72%, penalties 75%, a median 8 tackles
  per 80 minutes, flankers top.
- Unit tests 277/277, typecheck, lint, subjectprobe, langparity, i18nprobe,
  englishprobe, subsprobe, injurysheet, tabletprobe, nobenchprobe,
  telemetryui, teamtalkui, a11yprobe, e2e, langprobe and womensui pass.

## Before uploading

- Play: confirm 70 (1.9.11) is the highest accepted code on the Console, or
  use one more than the highest.
- App Store: set the build number in Xcode one higher than the 1.9.11 upload.
  What's new is in `docs/store-listing.md`.
