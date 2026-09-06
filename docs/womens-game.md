# The women's game — how it integrates

Written 6 September 2026, at the owner's request: *"lets start by building the
women's leagues... THERE IS NO CROSS WITH ANY OF THE MENS TEAMS, THEY MUST STAY
SEPERATE IN THE GAME... DO A DEEP BIT OF RESEARCH ON HOW TO INTEGRATE IT."*

This is the research and the decisions that came out of it. What is built so far
is at the end, with what is left.

---

## 1. The central decision: two worlds, not one filtered world

The owner's rule is that the two games never mix. There are two ways to build
that and only one of them is safe.

**One world, filtered.** Put the women's clubs into the same save as the men's
and teach every system to respect gender. Tempting, because the job market, the
press and the Hall of Fame would then span both for nothing.

**Two worlds, one per save.** A save holds one game. The men's clubs are not
hidden from a women's career; they were never built.

The measurement that settles it: **the engine reads the whole world in 94
places** — `Object.values(state.clubs)`, `state.players`, `state.comps` — across
**23 engine files** (`ai.ts`, `agency.ts`, `scout.ts`, `season.ts`, `rollover.ts`,
`records.ts`, `living.ts`, `jobs.ts`, and the rest). Filtering means 94 guards
that must be right today and stay right for ever. The transfer market alone
would sign a woman to a men's club the first time one was missed, in a save the
player cannot repair.

Two worlds needs **none** of those 94 changed.

The save cost points the same way, more quietly. Measured on this build:

| | |
|---|---|
| Fresh men's save | **5.26MB** |
| of which players | 4.88MB (**93%**), 6,587 of them |
| clubs / comps / fixtures | 0.11MB / 0.02MB / 0.22MB |
| Ten-season save | 8.04MB, against perfprobe's **12MB** ceiling |

Adding the women's competitions to the *same* world would take a fresh save to
roughly 6.6MB and a ten-season one to about 10.5MB. It would fit — with nothing
left for the next league. Two worlds, one at a time, cost nothing.

**Decision: a save holds one world and a world has one gender.** The separation
is a property of how the save is made, not a rule the code has to keep
remembering, so it cannot rot.

## 2. Moving between the two games

The owner: *"YOU CAN TAKE A JOB FOR A DIFFERENT GENDER BUT THE GAMES ARE
SEPERATE."*

Under two worlds this is exactly what happens in life. A coach who crosses over
takes their **name, record, trophies, finishes and reputation** and takes nothing
else — no squad, no staff, no shortlist, no scouting knowledge, no half-built
stand. Those belong to the club they left, and in the other game they never
existed.

So a cross-gender move rebuilds the world at the other gender and carries the
manager across. `CARRIED_ACROSS` in `src/game/gender.ts` is the list, and it is
the same list a real CV carries.

Trophies keep their `compId`, which will be a men's id in a women's career. That
is correct: a trophy cabinet is a history, and history does not re-sort itself
when you change job.

**Not built yet** — see §7.

## 3. The three seams

Two worlds is a strong design with exactly three places where a world is built
or rebuilt. All three take the gender, and two of them would fail *silently*
without it:

| Seam | What it does | What happens without the gender |
|---|---|---|
| `newGame(..., gender)` | builds the world | the wrong world |
| `save.ts` `migrate()` | **injects any league the build knows and the save lacks** — how a v1.1 career gained Japan | pours all **52 men's clubs** into a women's career the first time it is loaded, unrepairably |
| `rollover.ts` | rebuilds every competition each August | replaces the women's leagues with the men's in season two |

Neither of the last two would throw. `scripts/genderprobe.ts` drives all three
and reads every id in the result, which is why they are caught rather than
trusted. It found both on its first run, along with two more (§4).

## 4. What the probe caught that the design did not predict

1. **The men's cups and Test calendar built as empty competitions with men's
   ids** inside a women's save. `buildChampionsCup` filters on `prem/top14/urc`
   and `buildInternationals` runs the men's windows — no women's club matches,
   so they built empty rather than not at all. Now guarded in both `newgame.ts`
   and `rollover.ts`.
2. **Generated players in the women's world were given men's names.** Squad
   fill, academy intake, regens and youth all call `regenName`, which knew
   nothing about gender. Seventeen call sites, now threaded.

Both were invisible to typechecking and neither would have crashed.

## 5. Names

`regenName(rng, nat, taken, gender)`. Surnames are not gendered and are shared,
so a Welsh player is a Prosser or a Gwynne either way. Women's first-name pools
per union live beside the men's in `nations.ts`, sized to match (36 per union
with a domestic league, 28 otherwise) because the arithmetic that once produced
seventeen Freddie Browns does not care which game it is in.

**Coaches and staff are a separate question and get a separate answer.** Men's
professional rugby is coached almost entirely by men and the game models that by
not asking. The women's game is not the mirror of that: PWR head coaches are a
real mix. `staffGender()` is a coin in the women's game and not a question in the
men's. Making every women's club's coach a woman would be as wrong as leaving
them all men.

## 6. Real players

The owner supplied a squad list on 6 Sep 2026 ("Full PWR Player List & Current
Club 26/27", a Google Sheet) after the first pass had to fall back on generated
depth. **Every name and every club in `w_pwr.ts` is now real and comes from that
sheet**: all 375 contracted players across the nine clubs, and the per-club
totals match the sheet's own squad-size column exactly, club for club
(38/44/35/44/45/37/46/50/36).

Worth recording how it was read, because the obvious route does not work here.
This environment's network policy blocks `en.wikipedia.org` and `docs.google.com`
outright (`EGRESS_BLOCKED`), so neither the Wikipedia transfers page nor the
sheet's own htmlview could be fetched. The **Google Drive connector** reaches it,
because it does not go through the egress proxy. `read_file_content` truncates a
sheet this size at about five clubs; `download_file_content` with
`exportMimeType: text/csv` returns the whole thing.

**What the sheet does not carry, and is therefore the game's judgement:**
position, age, rating, nationality and goal-kicking. 92 players are capped
internationals whose position and union are a matter of record and are stated
explicitly. The other 283 get a position from the squad shape, an English
passport and a rating drawn from the club's reputation. A player wearing the
wrong number is a data fix, not a bug.

Two things the sheet corrected that memory had wrong, which is the argument for
using it rather than recall: **Ellie Kildunne is at Bristol for 26/27, not
Harlequins**, and **Marlie Packer is at Harlequins, not Saracens**. A third:
Zoe Aldcroft is not in the 26/27 league at all, so she is not in the game.

**The season is 2026-27**, where the men's database is 2025-26. The sheet's
25/26 column only covers players still in the league, so building 25/26 from it
would silently drop the 124 who left. A complete current season beats an
incomplete old one, and the two worlds never meet, so nothing compares them.

## 7. What is built, and what is not

**Both games run 2026-27.** `BASE_YEAR` in `model.ts` is the one constant, moved
from 2025 at the owner's request ("both should run 26/27"). The two cycles that
had to keep landing on their real years still do, because both are computed from
the absolute year rather than the season index: the World Championship is 2027
and 2031, the Lions 2029 and 2033. They simply arrive a season sooner in a
career. A pre-v1.5 save keeps its season number and gains a year on its label.

**Built and passing `scripts/genderprobe.ts`:**

- `src/game/gender.ts` — the type, the `w:` id prefix, `genderOf`, `staffGender`
- `gender` on `GameState`, defaulting old saves to the men's game
- `LEAGUE_DEFS(gender)`, and all three seams passing it
- `src/data/leagues/w_pwr.ts` — the nine PWR clubs and all 375 real players,
  real towns and grounds under the same renaming rules as the men's database
  (`docs/ip-rename-map.md`)
- `src/data/leagues/w_pac.ts` — the women's Pacific Championship: Super Rugby
  Aupiki and Super W in one nine-club table, 279 real players from the owner's
  screenshots. Eight players contracted in PWR are dropped from it, because a
  southern professional really does play both winters and a game season is not
  two hemispheres'
- women's name pools for all 17 unions; 17 name-generation sites threaded
- the men's cups and Test calendar guarded out of the women's world
- the choice on the main menu, in all five languages

**Not built yet, in the order I would do it:**

1. **France (Élite 1)**. Needs a squad list the way PWR and the Pacific did:
   search names only 10 of its 20 clubs and the pages are blocked, so it wants
   the owner's sheet or screenshots rather than guesswork.
2. **The women's international game, behind the paid option.** This is its own
   piece of work because the calendar genuinely differs: the Women's Six Nations
   sits in a different window from the men's, WXV is not the Rugby Championship,
   and the World Cup is on its own cycle. It needs `AUTUMN_WEEKS`,
   `SIX_NATIONS_WEEKS` and the rest to become per-gender. The SKU fits the
   existing `NC_SKUS` non-consumable pattern in `monetise.ts` cleanly.
3. **The cross-gender move** (§2).
4. **A European women's club cup**, once there are two leagues to feed it.

## 8. Risks

- **The men's game must not shift.** Every existing 1.3.1 career has to generate
  identically. `staffGender` short-circuits before touching the rng in the men's
  game and `regenName` defaults to `'m'`, so the men's random stream is
  untouched — but the full suite is the proof, not the reasoning.
- **A women's world is small.** Nine clubs and ~590 players against 101 and
  6,587. Systems tuned for a big world — the transfer market, the job market,
  regens, the academy — will feel different in it, and some may need tuning
  rather than just working. More likely to show as *odd* than as *broken*.
- **`text=New Career`** is clicked by **52 browser harnesses**. The men's button
  keeps that exact string for that reason, and the women's button is deliberately
  worded so it does not contain it — two buttons matching the same substring
  would fail Playwright's strict mode and break all 52 a different way.
