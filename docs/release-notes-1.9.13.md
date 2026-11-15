# PHASE: Rugby Manager 1.9.13: release notes

**READY (owner, 15 Nov 2026: "Yes if all tasks are complete ... MERGE").**
It was held from 14 Nov while more was added. The store "What's new" text is
in `docs/store-listing.md`. Both native apps need a fresh `npm install` and
`scaffold.sh` for the Haptics plugin.

Version 1.9.13, Play versionCode 75. Baseline: 1.9.12, code 74 (1.9.13 was first written up as 72, before 1.9.12 shipped on 74).

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
- **Three more banner spots for free players**, each at the very bottom of a
  read-only page: the Stats tab, the league table and the fixtures list (on
  the Fixtures screen). Pro Manager shows none. They use the Home banner's
  ad unit until their own units are created in AdMob
  (`packaging/shell/ads.json`).

**The owner's feature round** (15 Nov 2026: "we do 1-7")

- **Arm round the shoulder.** A third thing to say when you call a player in,
  beside Praise and A quiet word. It is the safe word for a bad run: it lifts a
  player out of form (a struggling hothead most of all, who expected a
  rollicking), does no harm to one in form, and a mercenary shrugs it off.
  It uses one of the week's two conversations, like the others.
- **Search by personality and trait.** Two new transfer filters. They only
  find players your scouts know well enough: a full report for personality,
  a detailed one for a trait, as on the player's page.
- **Your season in the 22.** Rugby's version of xG is visits to the
  opposition 22 and the points each one brings. The match screens have shown
  it since 1.8.0; the Stats tab now adds your season of it, against your
  opponents', from every competitive match you play.
- **Haptics on iPhone.** iPhones felt nothing on a try or a card, because
  Safari's engine has no vibration API. Both apps now include Capacitor's
  Haptics plugin (8.0.2), so iPhone uses its Taptic Engine and Android its
  motor; the website keeps the browser's buzz. **This needs a new native
  build of both apps** (run scaffold.sh in each), not just new web files.
  Haptics have their own switch in Settings (on by default); the match
  screen's Sound and buzz toggle still turns both off together.
- **The physio's report.** On Medical: the players closest to breaking down
  and why (tired legs, just back from injury, past 1,300 minutes, heavy
  minutes for a young body, 32 or older, injury-prone once known), using the
  same factors the injury rolls use, and the training load the physio
  recommends this week, with a button to set it.
- **What the fans think, and why.** On Finances > The Board: fan mood and
  what moved it this season, split into results, signings and the squad,
  club decisions, and you and the press. Every change to fan mood is now
  booked under its cause as it happens, so the four add up to the season's
  movement.
- **The dressing room in the inbox.** An alert, once per spell and opening
  the player, when a back who has scored goes six games without a try, when
  a regular's morale drops below 4, or when a regular's form genuinely
  slumps. At most two a week; measured at 10 to 15 a season.

**The feedback report counts what happened** (two player reports, 6 and 15 Nov)
- Offers read as never opened in both reports, by managers who are bid for
  about twenty times a season. Continue opens Offers, the press room, the
  board, the country desk and match day without going through the store's
  navigation, which is where a visit is counted; all five are counted now.
- "Tactics changed in a match" counted every step of a slider drag (1,025 in
  25 matches, 41 a match). It now counts one change per stoppage used.
- "Loan made" counted every loan offer tapped, refused ones included. It now
  counts loans that happened, in and out.
- **Offered again as a career grows** (owner: "add it for the end of season
  3, 5 and 10 and 20"): after seasons 1, 3, 5, 10 and 20, each once. A
  career that jumps past one (one season to four) is asked once, at three.
- **New in the report**, still counts only, nothing named:
  - PLAY TIME: time played, sessions and the average session, and the five
    screens most time went to. A stretch on one screen counts at most five
    minutes (an idle phone); a gap of half an hour starts a new session.
  - CAREER: the win-draw-loss record, trophies, clubs managed, the last five
    league finishes with their tier, board confidence, fan mood, in debt or
    not, squad size, and Pro or free.
  - SETTINGS: haptics, sound, night mode and text size.
  - Four new actions: office chats, retraining started, the physio's load
    set, and the character filters used.
  The heaviest report possible still fits an email (1,791 of 1,800).

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
- New: `tests/usagecounts.test.ts` (Offers counted from Continue; one slider
  drag in a stoppage is one change).
- New for the feature round: `tests/armround.test.ts`, `tests/haptics.test.ts`,
  `tests/physio.test.ts`, `tests/fans.test.ts`, `tests/alerts.test.ts`, and
  `scripts/ui1913.mjs` checks Arm round the shoulder (and the office row at 320px), the
  character filters, the 22 card, the physio report and the fans card.
- New: `tests/jobbadge.test.ts`, `tests/leaders.test.ts`,
  `tests/loanoption.test.ts`; `scripts/ui1913.mjs` (browser: loanee buttons,
  the Stats tab, Week Results' Player of the Match, the Job Centre badge);
  `scripts/mgrgender.mjs` now checks that a second, men's career is asked.
- Chromium does not clip the way Safari does, so the harness checks the
  structure that prevents the bug. Confirm on an iPhone in Safari before
  release.
