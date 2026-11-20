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

- [ ] Tests lower scoring, set against real Test averages.
- [ ] Bust-ups in derbies and rivalries: rare yellows, the odd red under a strict referee.
- [ ] Pre-match rituals in formation for every nation that has one (only NZ has a line today).

## Stage 4: full club player audit (owner: do it all)

- [ ] League by league, men's then women's, starting with the English top flight.

## Log

- 21:29 start. 21:40 Stage 1 screens built and checked in the browser walk (17 of 17).
- 21:45 Stage 2 mechanism in, England men done (36/36 found). WebFetch only takes addresses a search returned; RFU news pages refuse.
- 21:46 France and Ireland men in. Next: Scotland, Wales, Italy.
- Six Nations unions all in. Next: South Africa, New Zealand, Australia, Argentina, Fiji, Japan.
