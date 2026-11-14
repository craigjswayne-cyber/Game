# PHASE: Rugby Manager 1.9.13: release notes

**IN PROGRESS, ON HOLD (owner, 14 Nov 2026: "1.9.13 but there may be more to
come have it fixed and on pause").** Do not build or upload until the owner
says it is ready. The store "What's new" text is written when it is.

Version 1.9.13, Play versionCode 72. Baseline: 1.9.12, code 71.

## What changed for players

- **Sheets clear the bottom bar on iPhone.** A bug report from Quins (iPhone,
  Safari, 390x746, 1.9.11): "When you open filters or try to loan a player
  the navigation banner at the bottom blocks search and offer loan button."
  The Transfer Centre's filter and loan sheets were drawn inside the
  screen's scrolling area, and Safari clips a pinned box to the area it sits
  in, so the bottom bar covered Show and Offer. 1.9.12 moved the half-time
  squad sheet to the app's top level for the same reason; now every sheet in
  the game is drawn there (18 in all).

- **Every career asks He or She, the men's game included.** The Home card
  was remembered per phone, so once it had been answered in any career, a new
  one (often a men's career after a women's one) never asked. Each career now
  asks once, with the last answer already selected. It changes only how the
  game talks about and to the manager: a men's world is still all men.
- **A Stats tab, beside Fixtures and Table.** For the clubs in the chosen
  competition, this season: top try scorers, points, tacklers, tackle success
  (new: missed tackles are now counted, 30 tackles to qualify), goal kickers
  (10 kicks to qualify), average rating, Player of the Match awards, drop
  goals, discipline (a red counts as two yellows), and the teams that score
  the most tries and concede the fewest points a game. The boards that sat
  under the Team of the Week moved here; that page has a Season stats button.
- **Every match names its Player of the Match.** It was kept only for your own
  games. Week Results now shows it under every score, and a tap opens the
  player.
- **A player on loan to you cannot be loaned out again.** Send on loan, Send
  down and contract talks no longer appear for a player on loan to you (the
  game already refused the loan; the button should not have been there).
- **Only some loans come with an option to buy.** About one loan in five has
  an option to buy, and the loan sheet says so before you sign. The rest
  have none: the parent club will only talk about a permanent move once the
  player has played 8 games for you and is happy (morale 7 or more). The
  8-week wait, the window, "crucial to them" and the money all still apply.
  A loan signed before 1.9.13 keeps the option it had.
- **The Job Centre badge stops nagging.** The game always keeps 2 to 4 jobs
  open somewhere, so a manager in work saw a red number on World almost every
  week. In work, it now shows only jobs you have not seen, and clears when you
  open the Job Centre. Out of work it counts every open job, as before.

## Not changed

- The match engine and its results: nothing new is drawn. Missed tackles,
  every match's Player of the Match and a loanee's games are counted from
  what the match already holds (`scripts/fingerprint.ts`).
- Saves: the new fields are optional. A season under way rates tackles from
  the day 1.9.13 first opens it.

## Tests

- New: `scripts/sheetroot.mjs` (browser). At 390x746 the filter and loan
  sheets sit at the app root, not inside the scrolling screen, their
  buttons are what a tap lands on, and Escape still closes them. It fails
  on 1.9.12 and passes on 1.9.13.
- New: `tests/jobbadge.test.ts`, `tests/leaders.test.ts`,
  `tests/loanoption.test.ts`; `scripts/ui1913.mjs` (browser: loanee buttons,
  the Stats tab, Week Results' Player of the Match, the Job Centre badge);
  `scripts/mgrgender.mjs` now checks that a second, men's career is asked.
- Chromium does not clip the way Safari does, so the harness checks the
  structure that prevents the bug. Confirm on an iPhone in Safari before
  release.
