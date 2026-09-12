# The women's game: dimensional audit and 20-season soak

**Run:** `npx tsx scripts/wsoak.ts` (about 35 seconds, 20 seasons)

`scripts/soakhealth.ts` has played twenty seasons at Leicester since v1.2. It had never once
been run in the women's world, so half the game had shipped without anybody playing it to the
end. This is that half.

It is written as a **dimensional** audit rather than a second health check. The question is not
"does it crash" - it does not - but "does every part of this world still do in season twenty
what it did in season one". Seven dimensions, each one something a manager would notice, none
of them covered by any existing probe.

## What it found

### 1. The Celtic Provinces Cup never crowned anybody — FIXED

Six clubs, `playoffTeams: 2`. `maybeCreateKnockouts` in `season.ts` had branches for 4, 6 and
8, so a 2 fell through into the eight-team one, which seeds from `order[0]` through `order[7]`
off a table that is six long.

Every April the competition manufactured four quarter-finals, **two of them against
`undefined`**. No engine can play those, so they sat unplayed for ever, `qf.every(f => f.played)`
never came true, the semi-final gate never opened, and twenty seasons passed with the
competition crowning nobody — while a manager in that league watched his fixture list say
"undefined" from week 40 onwards.

Fixed two ways:

- a two-team play-off is now a final, drawn from the top two on the last knockout week;
- `mkFx` refuses to write a tie that is missing a team at all, so the next competition whose
  `playoffTeams` does not match a branch loses its play-off rather than its fixture list, and
  this probe sees a missing champion instead of a ghost.

### 2. Five of the twelve women's nations have almost no club players — BY DESIGN

At boot: South Africa **0**, Italy 4, Japan 4, Canada 11, USA 12, against England 1,857 and
France 1,304.

This is not a defect. The women's club world is England, France, the Pacific and the Celtic
provinces, and nobody in it is South African. The emerging-nations path written for Georgia and
Uruguay on the men's side (`season.ts`, "EMERGING NATIONS NEED A SQUAD AND SOMEBODY TO FIGHT
FOR IT") fills those squads when a window opens: RSA goes from 0 players to 104 inside one
season, and all 51 women's Tests in season one were played with real scores.

It is worth knowing that a manager who takes the South Africa women's job is coaching an
entirely generated squad. The men's world has that for Canada and the USA only.

**A note on measuring it.** The first version of this probe counted heads in August and duly
failed on RSA and JPN — wrongly. A clubless generated player is not carried through a summer,
which is correct, so the August count is zero by design. The probe now counts at a Test week.

### 3. There is no women's World Championship — BY DESIGN, and on the working list

The men's world crowns `wc` five times in twenty seasons. The women's world has no equivalent,
and `dream.ts` `WORLD_COMPS` handles it properly: `w: ['cc']`, so no dream that needs a World
Cup is ever offered in this world.

It is still a real gap in the sport as it exists — the Women's Rugby World Cup was played in
England in 2025 — and it is a substantial feature rather than a fix: a pool draw, knockout
weeks, and a calendar that already carries six women's Test windows. Not built here. It belongs
on the working list.

## The seven dimensions, and what they hold

| # | Dimension | What it asserts |
|---|---|---|
| 1 | The trophies | Every league and cup crowns a champion in at least 19 of 20 seasons. The two Test series crown nobody, like the men's Autumn and Summer tours. |
| 2 | The fixture list | No fixture is ever created without two real teams. Nothing is left stranded behind the calendar. |
| 3 | The rosters | No orphaned players, no dangling club references, every club can still field all eleven positions, smallest squad 30+. |
| 4 | The Test world | At a Test week, all twelve nations have a squad to pick from. No Test was played 0-0 by two empty squads. |
| 5 | The economy | Median budget above £500k, median value below £8m, no club in an unrecoverable hole, at least a fifth of clubs able to pay for a median player. |
| 6 | The prose | No raw translation key and no unfilled placeholder ever reached the inbox. |
| 7 | The save | Under 12MB after twenty seasons, and growing less than 1.6x from its season-five size. |

## Measured, season 20 (seed 20260804, Gloucester RFC)

```
save          5.78MB, 1.15x its season-five size
players       4,740
budget med    £3.05m        (men's world, same span: £5.15m)
value med     £2.61m        (men's: £2.60m)
deepest hole  -£9.9m        (men's: -£9.4m)
clubs able to pay for a median player   55 of 64
news          250 live items, 0 raw keys, 0 unfilled placeholders
rosters       0 orphans, 0 bad refs, smallest squad 55
Tests         every nation fielding, no blank scorelines
```

The economy sits level with the men's world on every measure except budget, where the men's
clubs pull ahead over twenty seasons because their reputation ceiling is higher. Nothing in the
women's world compounds, drifts or starves.

## What is deliberately not covered

- **Match-engine fidelity** — `journeyprobe` and the drama probes already play whole matches in
  both worlds.
- **The UI** — `soakui.mjs` drives the screens; it has not been pointed at a women's save, which
  is the obvious next piece of work here.
- **A women's World Championship** — see 3 above.
