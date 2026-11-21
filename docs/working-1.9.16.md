# 1.9.16 working list

Owner, 20 Nov 2026: "Do it all. Update every half hour. Until the jobs are
fully complete." Branch `v1.9.16`, off main at 1.9.15. Nothing is merged or
uploaded until the owner says so. The 2.0.0 live pitch branch is not touched.

## Stage 1: fixes (no change to results)

- [x] Drop anyone from the draft sheet; the 23 floor applies once the squad is
      announced. A draft drop is a clean undo (no sting, no "sent home").
      `country.ts natDrop`, `tests/intl1916.test.ts`, `countryprobe.ts`.
- [x] Counter reads "16 of 32 named, 23 minimum" (`legacy.coNameIt`, 6 languages).
- [x] Injured, abroad and clubless men stay on the call-up list, greyed, with
      the reason; red injury mark with weeks (`natBarOf`, `InjuryMark`).
- [x] Red mark on injured men in the squad list, the Test XV and the bench.
- [x] Name search on the call-up list.
- [x] Injury said at the top of the player page.
- [x] Call up / Drop from the player page (`data-nat-call`).
- [x] Match-day: the watch options keep a 14px margin on the Test page.
- [x] Live stats bars wear the nations' kit colours.
- [x] Live stats panel scrolls inside itself, never under the system buttons.
- [ ] Masthead button still says "NAME n MORE" (to the 23 minimum): decide wording.
- [ ] Check `natSquad` flag clears at window end (test).
- [x] countryui / natonlyui / testsheet / dualroleui / intlstageui harnesses pass (PW_CHROMIUM=/usr/bin/google-chrome).
- [ ] Version bump to 1.9.16 (code 79), release notes, store text.

Browser walk used to check these by eye: `scripts/shots1916.mjs` (untracked;
384x832, the owner's S25 Ultra), shots in /home/claude/tools/shots.

## Stage 2: real national squads and caps (research first)

- [x] The mechanism: `src/data/intl2026.ts` (squad + caps per union), laid over a
      new world by `applyIntl2026` (newgame.ts); `sq26` men are picked first by
      the federations in season one (`federationPick`); `scripts/intlaudit.ts`
      checks it and lists names the world cannot find.
- [x] England men: squad of 36 in, 27 caps checked, 9 to confirm.
- [x] France men (41, 3 caps to confirm) and Ireland men (36, all caps checked).
- [x] Scotland men (37, all caps), Wales men (39, 10 caps to confirm), Italy men (34, all caps).
- [x] New Zealand men (36, all caps), Australia men (33, all caps), South Africa men (37 named, 31 caps to find).
- [x] Argentina men (33; caps are one Test late for the 23 who played Ireland, to correct).
- [x] South Africa caps, Fiji (65) and Japan (54) from the Nations Championship squad pages (current caps: to
      correct for autumn appearances; Fiji and Japan are whole-season squads, autumn party to narrow).
- [ ] Men still to do: Samoa, Tonga, USA, Canada; the 23 open caps in ENG/FRA/WAL/RSA (use the championship site).
- [~] WOMEN: 2026 is the WXV Global Series (12 unions), not WXV 1/2/3. In: ENG, SCO, AUS, RSA (all caps), USA (no caps).
      To do: FRA, IRE, WAL, ITA, NZL, CAN, JPN, USA caps. 7 nationalities corrected.
- [~] PWR 2026-27: all 52 internationals checked are at the right club. Full club lists still to check.
- [ ] BIG FINDING: only 4 of Japan's 54 internationals exist in the game. The Japanese league's 'real' players are
      mostly invented names (e.g. no Dylan Riley, Jack Cornelsen, Naoto Saito). Fiji: 34 of 65. This is Stage 4
      work (rebuild the JL1 squads from each club's real list). Also Boan Venter is SCO in the game, a Springbok in fact. Then the ten women's unions.
- [ ] Player audit list so far (wrong union or not in the world): see the
      `missing:` lines of `npx vite-node scripts/intlaudit.ts` and the research log.
- [ ] Every other union: see docs/research/intl-squads-2026.md for the order,
      the sources that work here and what is still open.
- [ ] Decide: old saves keep estimated caps (only new careers get the real ones).
- [ ] The coach's own desk could mark the real squad's men (not built).
- [ ] Engine baselines: real caps move player values, so fixed-seed references
      and balance probes need a run and a note before release.
- [ ] Nationality and position checks for every international.

## Stage 3: match feel (changes results: measure before and after)

- [!] Tests lower scoring: NOT DONE, on the evidence. Measured over 3 worlds x 2 seasons the game gives
      50.5 points and 6.56 tries a Test (club league 49.0 and 6.40). The 2026 Six Nations had 111 tries in
      15 matches, 7.4 a game (Opta via The Analyst; Planet Rugby). Real Tests are higher scoring than the
      game's, so lowering them would be wrong. Owner told 22:12; waiting for what he saw.
- [x] Bust-ups: in a derby or grudge match one scuffle in five escalates (`incidents.ts bustUp`); lenient
      referee warns, fair one bins the instigator, strict one bins one from each side and sends the puncher
      off 18% of the time. Own random stream, so other scuffles are unchanged. Measured on 4 worlds,
      6,708 matches: points 49.95 to 50.03, yellows 1.45 a game unchanged, reds 303 to 330. Six languages.
- [x] Test rivalries are now derbies (12 pairs in rivalries.ts), so bust-ups and derby heat reach Tests. Tests added.
      Measured: 41 of 400 derbies had a bust-up (10%), 49 yellows and 1 red from them.
- [ ] Bust-up ANIMATION: none (commentary and cards only). Owner asked 22:23. Belongs on the 2.0.0 live pitch.
- [!] TIGHTER, TENSER TESTS (owner 22:15): MEASURED, NOT CHANGED. Real 2026 Six Nations (15 results, Wikipedia):
      54.8 points a game, mean margin 15.9, median 11, 33% decided by 7 or fewer, 40% by 21 or more.
      The game's Six Nations Tests (136 games, 4 worlds x 2 seasons, /home/claude/tools/sixn.ts): 46.9 points,
      mean margin 15.1, median 14, 35% within 7, 33% by 21+. Top-eight v top-eight: 48.9 points, margin 15.3.
      So the game's Tests are already as close as the real ones and lower scoring. Tightening the numbers would
      move away from reality. If Tests do not FEEL tense, that is presentation (commentary, crowd, late-game
      cues), not margins. Owner told; waiting for his call.
- [ ] Pre-match rituals in formation for every nation that has one (only NZ has a line today).

## Stage 4: full club player audit (owner: do it all)

- [ ] League by league, men's then women's, starting with the English top flight.

## Log

- 21:29 start. 21:40 Stage 1 screens built and checked in the browser walk (17 of 17).
- 21:45 Stage 2 mechanism in, England men done (36/36 found). WebFetch only takes addresses a search returned; RFU news pages refuse.
- 21:46 France and Ireland men in. Next: Scotland, Wales, Italy.
- Six Nations unions all in. Next: South Africa, New Zealand, Australia, Argentina, Fiji, Japan.
- 21:50 Ten of sixteen men's unions in (ENG FRA IRE SCO WAL ITA NZL AUS RSA ARG): 382 players, 329 with checked caps.
- 21:51 `scripts/intlaudit.ts` FAILS on Argentina on purpose: only 20 of the 33 named Pumas are in the world
  (missing: Leonel Oviedo, Rodrigo Martinez, Tomas Rapetti, Efrain Elias, Tomas Lavanini, Juan Martin Scelzo,
  Simon Benitez Cruz, Tomas Albornoz, Justo Piccardo, Faustino Sanchez Valarolo, Mateo Soler; Boris Wenger and
  Gonzalo Garcia only exist as namesakes of other unions). NEXT: add the missing internationals to
  `src/data/additions.ts` at their real 2026-27 clubs (rules at the top of that file), fix the wrong unions
  (Sela, Janse van Rensburg, Tatafu, Benson, Burke, Kane James, Hennessey), then carry on with Fiji and Japan.
- 22:15 Owner (22:10 to 22:13): use https://nationschampionshiprugby.com/en/the-championship for the top 12 men's
  squads (team pages at /en/teams/<code>; /en/teams/aus/squad lists position, caps, age, club; caps there are
  CURRENT, i.e. after the autumn Tests so far). Also wants: all squads announced for WXV 1, 2 and 3 (women's),
  and the PWR club squads for 2026-27 ("they should all have been announced now with the opening weekend").
- 22:15 `tests/fingerprint.test.ts` fails as expected (real caps, new players, bust-ups all move results).
  REBASELINE in scripts/fingerprint.ts with a note ONCE, when the data work is finished, not before.
- 22:15 Bath's squad is the club's published list: adding a man there filled the senior squad and broke the
  free-agent tests, so Opoku-Gyamfi was taken back out. Check squad room before adding to any club.
- 22:24 Twelve Nations Championship unions in the file: 538 men named. intlaudit passes, with FIJ and JPN reported as THIN.
- 22:30 Owner 22:23: "use real names to fill teams if you have that data" and "let's get the things that aren't right".
  Done: 31 real Japan internationals now replace generated men in their League One clubs (jl1.ts REAL; JPN 35/54),
  Doge and Rabitu (Drua), Sowakula (Clermont), Boan Venter RSA. Argentina caps corrected to pre-autumn.
  LESSON: the championship page's club column can be stale (Saito, Nasilasila); verified.ts wins on clubs.
  STILL NOT RIGHT: RSA/FIJ/JPN caps are current (take off autumn appearances: need SA v ITA 7 Nov, v FRA 13 Nov,
  and the Fiji and Japan November team sheets); Fiji and Japan autumn parties not narrowed; fingerprint rebaseline.
- 22:55 Owner 22:48: "Yes to those features. Internationals need to feel the tension." BUILT (src/game/match/tension.ts):
  a Test in its last quarter with 7 or fewer in it gets stakes commentary (leading, chasing, level), crowd lines,
  a once-only last-ten call, pressure-kick lines before shots at goal, and a pulsing ONE SCORE IN IT / ALL SQUARE
  tag under the clock (Live.tsx, .tense-tag). Commentary stream only: tests prove a Test scores the same watched
  or silent. Six languages. Sampled on a real Test week: 31 of 90 Tests carried tension lines (20 finished within 7).
  NOT YET SEEN ON SCREEN: the scoreboard tag needs a browser look at 384x832.

### 23:22 UTC: the close-Test marker, seen on a phone-sized screen
- Found while checking: the game has had a close-game band on the scoreboard since 1.1.1 ("A kick in it, 14 minutes left"). The tag built at 22:50 would have sat on top of it in a Test, two messages for one thing, and it read the match's running score, not the score on screen. Removed the tag and its two wording keys in all six languages.
- Now one band. A Test wears it from the 60th minute whenever seven or fewer are in it, and it pulses. Club games are as they were.
- Checked in a browser at 384x832 with a staged 16-13 at 66 minutes: one band, marked as a Test, pulsing, inside the screen. Walk now 19 of 19. The walk's fly-half picks were also fixed to England-based men (the real squads moved who was next in line).

### 23:33 UTC: women's squads complete (12 of 12 unions), 34 nationalities and 6 positions corrected
- See docs/research/intl-squads-2026.md, "Women, second pass". Audit passes; Wales added to the thin list (30 of 39 in the world).
- tests/records.test.ts failed on the branch: the fixed-seed league match now has a penalty try (7 points, no scorer). The test now
  allows for penalty tries. Not a game bug.
- Owner asked for a tick-box list of 1.9.14 and 1.9.15 changes: published as an artifact (134 checks).
- Full unit suite: 444 of 445; the one failure is the fingerprint, to be rebaselined once at the end.

### 01:30 UTC, 21 Nov: owner's second list (13 points)
1. Save slot still says Northampton after resigning to coach England only. FIXED 01:32 (save.ts saveLabel, tests/savelabel.test.ts).
2. "Start as an international coach" on the first page: PAID, in the style of the store button; the club route stays free.
3. Bid bug: 30k player, minus 100k, shows 100k. "Check all bidding". FIXED 01:33 (src/game/bidstep.ts; fee stepper,
   wage stepper, and the seller's floor/counter rounding, which was 50k at every size). tests/bidstep.test.ts, tests/cheapbid.test.ts.
4. No free agents at the very start: add some average ones; a free-agent filter in Transfers. (Measured: a new game has 8.)
5. Pro challenges: do they work and do what they promise?
6. Pre-season setup in Training: check it and its effect on the game.
7. Kicking at goal: the placement looks too far back; it should be where the angle is best.
8. Far too much text in the briefing: rethink the presentation.
9. Match day: KICK OFF at the bottom sits too low; bring it closer to the bottom sub.
10. Dressing room options: top buttons not aligned with the bottom ones.
11. Backroom staff: far too much space. Name lists (rankings etc) grow when names are long; they should all cut with "..." like game time.
12. With Pro, where the ability is shown the "?" must go.
13. A "rate our game" prompt at a high (a derby win or similar), once per game, if they have not already rated.
- 01:35 Owner on point 2: international start is its OWN one-off purchase, "same price as it currently is in the store".
- 01:45 Free agents: the 8 at the start were hidden teenage gems, so no senior was free. 33 senior free agents now seeded (three a position, ability 45 to 70, ages 23 to 33, own rng stream, last in newGame). Transfers page has a one-tap Free agents chip with a count, and a toggle in the filter sheet (six languages). Full suite 465 of 466 (fingerprint, expected). Owner 01:40: check in every half hour and be ready to merge at the end.
- 02:00 Layout batch, each seen at 384x832 (scripts/shots2.mjs, shots in /home/claude/tools/s3 before and s4 after):
  - Dressing room sheet: watch chips, caption and "The room" started at x=12, heading, tiles and Say nothing at x=26. Now all 26 to 358.
  - Backroom staff: card was 136px with three stacked buttons; now role and cost on one line, name (ellipsis), buttons in a row. 5 posts a screen, was 3.5.
  - Briefing: 3 screens to 1.4. Danger man, head to head and game plan stay open; conditions, opposite number, finishers, record and
    partnerships are one-line summaries that open on a tap (BriefSum, .brief-fold). Nothing removed.
  - Names in tables: one line with an ellipsis on phones (reverses the 1.8.4 wrap rule, at the owner's request).
  - Bottom Kick Off: gap above it cut from 10 to 2.
- 01:50 Owner: use multiple agents, ready to merge in the morning. Three agents running (caps and PWR; Pro challenge and pre-season probes;
  goal-kick placement and ritual formations). They do not commit; I check and commit their work.
- 02:10 Rate-the-game ask on a high (reviewask.ts reviewHigh/highDue, ReviewAsk.tsx, GameState.rateAsked): once a career, after a derby win,
  a final or knockout win, an upset or a 20-point win, on the next quiet screen; counts as one of the device's three asks. tests/reviewhigh.test.ts.
- 02:10 Start as an international coach (owner's point 2): the EXISTING store product (PINNACLE_SKU, "Become an International Coach"), a second door.
  game/intlstart.ts, store.startIntl, screens/IntlStart.tsx, store-card button on the title screen (only where there is a store, or already owned).
  tests/intlstart.test.ts (10, including a full season from that start); scripts/intlstart.mjs in a browser with a stand-in store: no store no door,
  cancelled payment starts nothing and prints the reason, bought lands as England head coach with no club, owned is not charged twice. PASSED.
- 02:10 Agent work checked in: Fiji and Japan men's caps to before the autumn (France and Ireland Tests; Wales and England Tests), PWR 2026-27 squads
  checked per club (17 added, 3 moved, 5 released), see docs/research/intl-squads-2026.md. Goal kicks: conversions were always drawn 15m out and missed
  ones 22 to 42m out; now on the best-angle point (11m under the posts, about 25m for a try 10m in from touch), penalties at the mark
  (ui/highlight/goalkick.ts). Pre-match challenges: NZL arrowhead, FIJ block, SAM leader and rows, TGA broad block, facing side in an arc on halfway
  (ui/ritual.ts, TestDay.tsx RitualPitch). Engine fingerprint output identical before and after both. Full suite 513 of 514 (fingerprint, expected).
  NOT YET SEEN IN A BROWSER: the ritual pitch and the kick clips.
- 02:08 Three more agents started on the club audit (men FIJ JPN; women WAL CAN USA IRE; women ITA JPN RSA FRA). Log: docs/research/club-audit-1916.md.
- 02:21 scripts/rowprobe.mjs: every named table row is the height of its neighbours with 40-character names, 13 screens at 360, 384 and 412: 78 checks pass. hlprobe.ts and hlliveprobe.mjs pass after the goal-kick change. Release notes drafted (docs/release-notes-1.9.16.md).
- 02:27 BUG FOUND AND FIXED by a new test (tests/natsquadflag.test.ts, the open "check natSquad clears" item): when a window opens the
  week another closes (the autumn Tests after the southern championship), the new squad was written over the old list and a man in the
  old squad but not the new kept natSquad for the rest of the season. His club could not pick him and no coach could call him up.
  14 men a season in the test world (Albornoz, Tupou, Snyman...). season/internationals.ts now sends the old camp's men home when the
  next is named over it, for the AI federations and for the manager's own camp. Changes results (those men play for their clubs again):
  inside the one fingerprint rebaseline.
- 02:27 Club audit, women (two agents, checked: tsc, intlaudit, dataaudit, genprobe pass): 18 real players added at clubs in the game,
  36 caps filled, 7 rows corrected (nationality, position, spelling). Wales is no longer thin (36 of 39). Italy 20/38, Canada 25/36,
  USA 14/36, South Africa 3/30 and Japan 2/30 stay thin because their domestic clubs are not in the game (confirmed against LEAGUE_DEFS;
  every player listed with her club in docs/research/club-audit-1916.md). Open for the owner: 10 players whose club in the game differs
  from the 2026 squad lists (verified.ts), listed in that doc.
- 02:27 genprobe counts and the w_pwr club comments updated for the 17 PWR additions (399 real, women's database 2134).
