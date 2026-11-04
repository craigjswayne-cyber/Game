# Feature carousels: captions and notes

Six carousels, one feature each, 1080x1350 (4:5). Post the PNGs in `out/<carousel>/`
in number order. Rebuild with `node docs/launch/social/carousels/build.mjs` (needs
`npm install` first). Copy follows `docs/voice-bible.md`: no emoji, no em dashes.

Link in bio: https://phaserugbymanager.com (the Play link is on it).

---

## 1. Match day (7 slides)

```
Penalty, four minutes in. Posts, corner or tap?

PHASE: Rugby Manager gives you the touchline. Live commentary, team talks, head injury calls, and a coach who names two things to fix at full time.

Free on Google Play. App Store coming soon. Link in bio.

#rugby #rugbyunion #rugbymanager #mobilegames #sportsgames
```

## 2. Transfers (6 slides)

```
The agent wants more. The cap says no.

Two windows, free agents, loans by length and wage share, two marquee slots and a board with an opinion of you. Break a promise and every agent hears about it.

Free on Google Play. Link in bio.

#rugby #rugbyunion #rugbymanager #transfers #mobilegames
```

## 3. Academy (5 slides)

```
Give a 17-year-old a first-team debut. The academy staff keep the team sheet.

Bring your scholars through, give them minutes, and see who ends up a regular. Some of them get capped.

Free on Google Play. Link in bio.

#rugby #rugbyunion #academy #rugbymanager #mobilegames
```

## 4. The world remembers (7 slides)

```
You released him in the summer. Today he scored against you.

PHASE keeps a record of what you did and brings it back: released players, broken promises, a knock you played someone through. Season one is still there in season fifteen.

Free on Google Play. Link in bio.

#rugby #rugbyunion #rugbymanager #mobilegames #sportsgames
```

## 5. Tactics (6 slides)

```
Five ways to attack. Five ways to defend. Use one move too often and the opposition will be set for it.

Free on Google Play. Link in bio.

#rugby #rugbyunion #rugbytactics #rugbymanager #mobilegames
```

## 6. Two games, one app (5 slides)

```
Men's and women's rugby in one app. 15 leagues, 177 clubs, and the women's game built the same way rather than bolted on.

Plays offline, no account, six languages.

Free on Google Play. Link in bio.

#rugby #womensrugby #rugbyunion #rugbymanager #mobilegames
```

---

## What was checked, and against what (Nov 2026, v1.9.10)

| Claim | Source |
|---|---|
| Penalty options and wording | `matchday.opt*` in `src/locales/en.json`, seen live in the build |
| Team talk, "how they took it" | captured from the build |
| HIA replacement does not use a change | captured from the build |
| Two fixes, checked next week | `src/game/coachfix.ts`, full-time screen ("before next Saturday") |
| Released player scores, captains a rival; grudge; agents; knock | `mem.*` strings in `en.json`, fired by `src/game/memory.ts` |
| Academy debut stories | `mem.acadRegular`, `mem.acadIntl` |
| Five attack, five defence styles | `ATK_STYLES`, `DEF_STYLES` in `src/game/styles.ts` |
| "Teams are reading your..." | `desk.memRead`, `src/game/tacmemory.ts` |
| Two marquee players | `MARQUEE_SLOTS = 2`, `src/game/cap.ts` |
| 9 + 6 leagues, 113 + 64 = 177 clubs | `LEAGUE_DEFS('m')` and `LEAGUE_DEFS('w')` counted in the build |
| Offline, no account, six languages | README, store listing |
| Free on Play, App Store coming soon | `landing/index.html` |

**Store listing is out of date on club numbers.** `docs/store-listing.md` and the README
say 107 men's clubs and 171 in total. The build has 113 and 177 (the 2026-27 squads
added clubs). The carousels use the build's numbers. Update the listing, or change
slide 2 of carousel 6, so they match.

## Names in the images

The screenshots are the real game, but every player and club name was swapped for a
generated one before capture (`capture.mjs`), and the clubs are invented towns
(Calder, Harrow, Wexmoor and so on). An advert implies endorsement more strongly than a
game database does, and `docs/release-readiness.md` already flags name and likeness as
the open risk, so the marketing keeps real names out. The CTA slide says so in small
print.
