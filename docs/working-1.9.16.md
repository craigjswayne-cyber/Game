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
- [ ] Run countryui / natonlyui / testsheet / dualroleui / intlstageui harnesses.
- [ ] Version bump to 1.9.16 (code 79), release notes, store text.

Browser walk used to check these by eye: `scripts/shots1916.mjs` (untracked;
384x832, the owner's S25 Ultra), shots in /home/claude/tools/shots.

## Stage 2: real national squads and caps (research first)

- [ ] Autumn 2026 squads, men's and women's, from each union's own announcement.
- [ ] Real caps (replace `deriveCaps` for named internationals).
- [ ] Nationality and position checks for every international.

## Stage 3: match feel (changes results: measure before and after)

- [ ] Tests lower scoring, set against real Test averages.
- [ ] Bust-ups in derbies and rivalries: rare yellows, the odd red under a strict referee.
- [ ] Pre-match rituals in formation for every nation that has one (only NZ has a line today).

## Stage 4: full club player audit (owner: do it all)

- [ ] League by league, men's then women's, starting with the English top flight.

## Log

- 21:29 start. 21:55 Stage 1 screens built and checked in the browser walk (17 of 17).
