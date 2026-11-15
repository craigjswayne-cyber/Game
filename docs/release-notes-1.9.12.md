# PHASE: Rugby Manager 1.9.12: release notes

Version 1.9.12, Play versionCode 74 (71, 72 and 73 were earlier builds, never rolled out to production). Baseline: 1.9.11, code 70. Two player
reports: one from Bristol in Premiership Women's Rugby (the iPhone app,
10 Nov 2026) with three points in it, and one in French on loans,
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
  is itself a scrolling list, and Safari's engine (which the iPhone app runs on) is known to misplace fixed
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

- **Afrikaans reads like South African Afrikaans, not Dutch.** 176 lines
  rewritten after a native speaker's feedback, then a paid native proofread:
  68 of the proofreader's edits to menus, setup, Home, Settings, Today, the
  shop and Pro Manager, and three of her word choices carried across the
  whole game (Raad for the board, span for the squad, vloedligte), about 400
  lines. Eleven of her edits wait on answers to follow-up questions, as do
  the short labels she queried; details in `docs/afrikaans-review/README.md`.
  Her second round of answers (11 Nov) is in too: weeks are `wk`, versus is
  `vs`, wage share is salarisverdeling, and the legacy screen is Bestuurder
  se Erfenis on every line. Her last two answers (12 Nov) closed the list:
  wage room is Beskikbare salaris and the national-team badge is INT.

- **Matches read more like real results** (the owner's scan of two simulated
  seasons in each game, 10 Nov 2026):
  - A side was held scoreless in about 1 league match in 18; it is now about
    1 in 75. A side three scores down, or still without a point after the
    first half hour, now gets back into the game, the other half of the
    rule that already slowed the side in front. Blowouts (40 points or
    more) fall from 9.0% to 6.5%. Points and tries per match barely move
    (49.6 to 49.2 points, 6.5 to 6.4 tries).
  - Home sides win 55.7% of league matches, up from 53.6%.
  - Player of the Match is counted in every competitive club match. It was
    counted only in the manager's own, so nobody at another club had any.
  - Japan's clubs no longer go broke: nine or ten of the twelve were in debt
    within two seasons. They are company clubs, and the company now covers
    their losses: one club in debt after three seasons.
  - Sarries in the women's Premier Division opened with 50 senior players
    against a limit of 46, so that job could sign nobody. A club over the
    limit now sends its youngest fringe players to its academy.
- **The women's game in every language.** 36 player lines that were written
  for a man in French, Spanish, Italian, Afrikaans or Japanese now have
  their women's form (a captain was "le joueur le plus ancien").

- **Scouting is rebuilt** (the owner, 12 Nov 2026: "assess the whole
  scouting system", then "transform it all"). One chief scout, as before,
  with more for him to do:
  - **The report shows the attributes.** Tap a man on the Scouting screen
    and his numbers are on the sheet as the file reads them: a figure where
    the scouts are sure, a range where they are not. "Compare with" puts
    your best player in the same shirt beside him.
  - **Scout in person.** The chief scout can watch one man per level (up to
    three) and comes back with the full file, exact numbers and character,
    in a few weeks (three weeks from a proper report at level 2). The men
    being watched have their own list on the Scouting screen.
  - **Each source has a ceiling.** Measured on 1.9.11, every player in the
    manager's own league had a full file by the end of a season for
    nothing; now none do. The shortlist and your own league stop at a
    proper report (74 of 100), a league under the network's watch at 84,
    playing against a side at 89. The full file is the scout's own work.
  - **Files go stale.** A man nobody is watching loses a little each week
    (faster for a young player, who is still changing), down to what his
    league's tape gives.
  - **A brief with a specification.** A commissioned search can ask for a
    player for now or for the future, a maximum age and a maximum fee. If
    nobody fits, the scout says so before any money is spent.
  - **How sure he is, and his record.** Every verdict says whether the scout
    is sure, fairly sure or guessing, and the Scouting screen keeps his
    record: how many of his judgements have held up.
  - **Sort and filter the list**: newest, verdict, age or fee; by position;
    only players inside the transfer budget.
  - **Rivals in the hunt.** When another club is after a man on the
    shortlist or on the scout's watch, the chief scout rings once per spell
    of talk, with his read of whether it is genuine or agent talk.
  - **The file on the next opponent.** Knowing their squad well firms up the
    analyst's read by up to five points, and the opposition report says so.
  - Careers under way keep every file they have; from then on the new rules
    apply. Nothing in a save needs converting.
  - Checked by `tests/scoutrules.test.ts` (19 tests) and
    `scripts/scoutscreen.mjs` (the sheet on an iPhone-sized screen).

- **A tester's four reports** (12 Nov 2026, on an iPhone):
  - **Zach Mercer is at Toulon**, where he has played since 2025-26. The
    squad files had him at Gloucester, a season behind. Albert Tuisue (to
    Provence) and James Venter (to Gloucester from the Sharks) were behind
    in the same way and are put right with him.
  - **Gloucester are a tougher side.** They were top of the real table after
    four rounds of 2026-27 and seventh of ten in the game on their best 23.
    Reputation 78 to 81, and the men carrying the run rated up (Kleyn, Lake,
    Byrne, Seb Atkinson, Fasogbon and others): now third or fourth on the
    same measure, behind Bath and Sarries.
  - **The scout sheet reaches the attributes.** Its second button said
    "Player page" and opened the Profile tab, so the tester went through
    "Make an offer" to find the numbers. It now says "Attributes" and opens
    that tab.
  - **A screen no longer stays zoomed in.** A zoom (a stray pinch, or iOS
    zooming to a text box) used to stay through every screen after it, on a
    shell that does not scroll. Now each change of screen puts the page back
    to its own size and its own top; pinch-zoom still works where it is
    wanted. "Make an offer" scrolls the game's own column and never the
    page, and the two text boxes with writing under 16px (the Medical search
    and the training search), which is what makes iOS zoom, are 16px.
    Not seen on an iPhone: Chromium shows the zoom being reset, the column
    scrolling and the page staying put (`scripts/pagereset.mjs`), but the
    tester's exact stuck screen was not reproduced.

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
- `tests/gloucester2627.test.ts`: Mercer at Toulon once, Tuisue and Venter
  moved, Gloucester in the top half on their best 23 and not the best.
- `scripts/pagereset.mjs`: a 1.6x zoom is gone on the next screen with no
  maximum-scale left behind; the scout sheet's Attributes button opens the
  Attributes tab; Make an offer moves the column and not the page.
- `scripts/nobenchprobe.mjs` stages only on a match with nobody already
  down (it collided with a real early injury about one run in twenty).
- Unit tests 297/297, typecheck, lint, subjectprobe, langparity, i18nprobe,
  englishprobe, subsprobe, injurysheet, tabletprobe, nobenchprobe,
  telemetryui, teamtalkui, a11yprobe, e2e, langprobe and womensui pass.

## Before uploading

- Play: confirm 70 (1.9.11) is the highest accepted code on the Console, or
  use one more than the highest.
- App Store: set the build number in Xcode one higher than the 1.9.11 upload.
  What's new is in `docs/store-listing.md`.
