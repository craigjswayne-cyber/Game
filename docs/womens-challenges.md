# The four women's challenges

The men's game has offered four pinned challenges since launch: Sauvez Sapiac, The Energy Project,
Break the Dynasty and The Cornwall Dream. Until this release the women's game offered none, so the
wizard simply hid the section when you picked the women's world. It now offers four of its own,
built the same way: each is pinned to one club, each has a win condition checked in
`challengeCheck()` in `src/game/rollover.ts`, and each is drawn from something that actually
happened.

`Challenge` in `src/game/newgame.ts` gained an optional `gender` field. `challengesFor(gender)`
returns the challenges for one world; a challenge with no `gender` set is a men's challenge, which
keeps the four originals as they were.

## The structural fact that shapes all four

**There is no promotion into Premiership Women's Rugby.** PWR is a closed licence league of nine
clubs under RFU Regulation 6 Appendix 1; a club joins by winning a licence tender, not by winning
the Championship. Ealing and Leicester came in that way for 2023-24; Wasps tendered and were
refused. That is why none of the four women's challenges is "get promoted" — the men's Cornwall
Dream has no women's equivalent, and pretending otherwise would have been a lie about the sport.

## The four

| id | Club | Title | Win condition in code |
|---|---|---|---|
| `threepeat` | Bristol (PWR) | Stop the Three-Peat | Win the Premier Division once |
| `ealing` | Ealing (PWR) | The Ealing Project | Win the Premier Division twice |
| `licence` | Sale (PWR) | Keep the Licence | Finish in the top four |
| `grudge` | Lichfield (Championship) | The Lichfield Grudge | Win the Championship |

### Stop the Three-Peat — Bristol

Gloucester-Hartpury won PWR in 2022-23, 2023-24 and 2024-25. Bristol Bears have never won it; they
reached the 2024 final and lost it 36-24. The challenge is to take a first title and end the run,
which is the women's counterpart to Break the Dynasty on the men's side.

### The Ealing Project — Ealing

Ealing Trailfinders Women were founded in 2023 after the club was awarded a PWR licence in December
2022 on the back of a reported £20m-plus investment. They finished fourth in 2025-26 and lost the
final. Money and a licence, no trophy: the challenge is to win the league twice and make the project
look like it was worth it. Two titles rather than one, because one would be a lower bar than
Bristol's and this is the richer squad.

### Keep the Licence — Sale

Sale Sharks Women finished bottom of PWR in 2024-25, ninth of nine on four points. Nobody is
relegated from a licence league, so the pressure is not a drop, it is the next licence review.
A top-four finish is the challenge: prove the place.

### The Lichfield Grudge — Lichfield

Lichfield finished second in the Women's Premiership in 2016-17 and were then denied a place when
the Premier 15s was chosen by tender in the summer of 2017. Their appeal failed. They have been in
the second tier ever since with no promotion to climb out through. The challenge is to win the
Championship anyway.

## What is verified and what is not

**Verified enough to build on:** the licence structure and the absence of promotion; Ealing's and
Leicester's licence awards for 2023-24 and Wasps' refusal; Gloucester-Hartpury's three straight
titles; Bristol's 2024 final defeat; Sale finishing bottom in 2024-25; Lichfield's 2017 tender
rejection and failed appeal.

**Not verified:** Bristol's, Leicester's and Sale's exact 2025-26 finishing positions; Lichfield's
and Richmond's current divisions. None of the four challenges depends on those, and the English
copy in `challenges.*` was written to avoid asserting them.

## Where the strings live

`challenges.threepeat` / `threepeatDesc`, `challenges.ealing` / `ealingDesc`, `challenges.licence` /
`licenceDesc`, `challenges.grudge` / `grudgeDesc`, in all six locales. They carry no gendered
siblings: the copy is about a club, not about the manager.

`scripts/challengetest.ts` runs every challenge in `CHALLENGES` for two passive seasons and checks
that completion only ever fires when the real condition holds. It used to build each career with
`newGame`'s default men's world, which for a women's club id produced a world the club is not in and
a crash inside `seedKnowledge` rather than a message. It now takes the world from the challenge.
