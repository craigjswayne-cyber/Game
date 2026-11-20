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
