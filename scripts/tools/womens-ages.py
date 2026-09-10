#!/usr/bin/env python3
"""
---- GIVE THE WOMEN'S SQUADS A SQUAD'S AGE PROFILE ----

The owner's PWR sheet carried names and clubs. It did not carry ages, so ages
were assigned - and assigned as a FLAT DRAW between 18 and 33. Counted across
all 2,096 women's players, every single year from 18 to 33 held between 100 and
157 players, and the mean rating at every one of those ages was 61. Nobody was
34. Nobody was 38.

Two things are wrong with that and both are visible in play.

  A SQUAD IS NOT A UNIFORM DISTRIBUTION. It is a bell around the mid-twenties
    with a development tail below and a long tail of experience above. The
    women's game in particular keeps players well into their thirties.
  AGE AND ABILITY WERE UNCORRELATED. Which is how an 18-year-old lock came to
    be rated 84 and paid £9.6k a week, reported by the owner from a live save.
    In the men's database, which was built from real ages, mean rating climbs
    from 64 at twenty to 75 at thirty-two. That curve is what a career looks
    like, and the women's data had a flat line instead.

So ages are redealt here, per club, from a real squad's shape, and paired with
ability rather than drawn independently of it: the players nearest their prime
get the ages nearest twenty-seven, and the youngest and the oldest shirts go to
the fringe of the squad, shuffled inside blocks so the result is a tendency
rather than a ranking. Deterministic from the player's own name, so the same
squad is dealt the same way every time this runs.

WHAT THIS DOES NOT DO is make the ages TRUE. They are still the game's
judgement, exactly as the header of each data file says. Two spot checks
against public sources put the old figures out by two and three years
respectively, and there is no sheet to fix that from - only per-player
research, which is a separate job.

Run: python3 scripts/tools/womens-ages.py [--apply]
"""
import glob
import hashlib
import json
import re
import sys

LINE = re.compile(
    r"^(?P<head>\s*\{ name: '(?P<name>(?:[^']|\\')+)', pos: ')(?P<pos>\w+)(?P<mid>', age: )(?P<age>\d+)(?P<tail>, nat: .*)$")

# Real ages and positions, one player at a time, each with the source it was
# checked against. A player in here is never dealt an age - hers is a fact.
VERIFIED = {k: v for k, v in json.load(open('scripts/tools/womens-verified.json')).items()
            if not k.startswith('_')}
CLUB = re.compile(r"id: W \+ '(?P<id>[^']+)'")
Q = re.compile(r", q: (\d+)")

# What a women's club squad actually looks like, by age. A bell centred just
# under the men's peak (the women's game turns professional later and keeps
# players longer at the top end), a real development tail at 18-20, and a top
# end that runs to 38 rather than stopping dead at 33.
SHAPE = {
    18: 0.035, 19: 0.045, 20: 0.050, 21: 0.055, 22: 0.060, 23: 0.065,
    24: 0.070, 25: 0.075, 26: 0.080, 27: 0.080, 28: 0.075, 29: 0.070,
    30: 0.060, 31: 0.050, 32: 0.043, 33: 0.035, 34: 0.025, 35: 0.016,
    36: 0.008, 37: 0.005, 38: 0.003,
}
PRIME = 27
# HOW FAR ABILITY IS ALLOWED TO LIE ABOUT AGE, in rating points.
#
# The pairing puts the best players nearest their prime, which is the tendency
# that was missing. Applied strictly it becomes a LADDER: every veteran in the
# game turns out to be a fringe player, and the thirty-six-year-old who is still
# one of the best forwards in the league - the women's game is full of them -
# cannot exist. The men's database, built from real ages, has men rated 84 and
# 85 at thirty-five and thirty-six.
#
# So each player's place in the queue is nudged by a deterministic amount drawn
# from her own name. Twelve points is enough for a good player to land at either
# end of the age range now and then, and not enough to undo the tendency.
JITTER = 12


def h01(s: str) -> float:
    return int(hashlib.sha1(s.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def ages_for(n: int, seed: str) -> list[int]:
    """n ages drawn from SHAPE by SYSTEMATIC SAMPLING, so a squad of 35 gets a
    squad's spread rather than 35 independent dice.

    The first cut rounded the proportions per club by largest remainder, and it
    put nobody at all past 35: p(37) is 0.005, which over a squad of thirty is
    0.15 of a player, and 0.15 never wins a remainder. Every one of those
    fractions was swept up by 34 and 35 instead, in every club, so the tail the
    redeal existed to create was cut off two years short.

    Walking the cumulative distribution at n evenly spaced points from a
    per-club offset fixes that exactly: each club lands its points wherever its
    own offset puts them, and across sixty-odd clubs the rare years get their
    share for the same reason a systematic sample of anything does."""
    total = sum(SHAPE.values())
    cum: list[tuple[float, int]] = []
    run = 0.0
    for a in sorted(SHAPE):
        run += SHAPE[a] / total
        cum.append((run, a))
    off = h01(seed)
    out = []
    for i in range(n):
        u = (i + off) / n
        out.append(next(a for c, a in cum if u < c))
    return out


def redeal(players: list[tuple[str, int]], seed: str) -> dict[str, int]:
    """players is [(name, quality)]; returns name -> age."""
    ages = sorted(ages_for(len(players), seed), key=lambda a: (abs(a - PRIME), a))
    order = sorted(players, key=lambda p: -(p[1] + (h01(p[0]) - 0.5) * JITTER))
    return {name: ages[i] for i, (name, _) in enumerate(order)}


def main() -> int:
    apply = '--apply' in sys.argv
    moved = 0
    for path in sorted(glob.glob('src/data/leagues/w_*.ts')):
        lines = open(path).read().split('\n')
        # club boundaries
        starts = [i for i, l in enumerate(lines) if CLUB.search(l)]
        bounds = list(zip(starts, starts[1:] + [len(lines)]))
        for a, b in bounds:
            rows = [(i, LINE.match(lines[i])) for i in range(a, b)]
            rows = [(i, m) for i, m in rows if m]
            if not rows:
                continue
            squad = []
            for i, m in rows:
                if m.group('name') in VERIFIED and 'age' in VERIFIED[m.group('name')]:
                    continue   # her age is a fact, not a hand to be dealt
                qm = Q.search(lines[i])
                squad.append((m.group('name'), int(qm.group(1)) if qm else 60))
            deal = redeal(squad, lines[a]) if squad else {}
            for i, m in rows:
                name = m.group('name')
                fact = VERIFIED.get(name, {})
                new = fact['age'] if 'age' in fact else deal[name]
                pos = fact.get('pos', m.group('pos'))
                if new != int(m.group('age')) or pos != m.group('pos'):
                    moved += 1
                lines[i] = f"{m.group('head')}{pos}{m.group('mid')}{new}{m.group('tail')}"
        if apply:
            open(path, 'w').write('\n'.join(lines))
    print(f"{'rewrote' if apply else 'would rewrite'} {moved} ages and positions "
          f"({len(VERIFIED)} players are pinned to a checked source and were left alone)")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
