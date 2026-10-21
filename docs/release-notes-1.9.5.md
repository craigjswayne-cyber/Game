# PHASE: Rugby Manager 1.9.5: release notes

Version 1.9.5, Play versionCode 64. Baseline: 1.9.4, code 63. The owner's
round of 21 Oct 2026: the varied condition held back from 1.9.4, built with
a real cost for tired legs.

## What changed for players

**Every player has their own condition**
- A whole XV no longer reads one number after the full eighty (35% from 1 to
  15, or 71% after a friendly). After a match a player's condition moves
  with his stamina, how well he played and the knocks he took. Over the week
  it moves with his age, his stamina, a fitness week, a heavy personal load
  and his own body; the physio and the gym still add on top. Every club
  plays by the same rules.
- Friendlies keep their floor: nobody leaves one under 48%.

**Tired legs cost something**
- A player used to kick off with the same energy at 20% condition as at
  33%, so an unrotated side paid nothing more for its most tired men. Under
  that point he now starts shorter: half the shortfall stays with him (33%
  and up is unchanged; 20% starts at 45 rather than 50).

## Balance

- bandcheck, four worlds, 9,336 league games: 49.5 points a game, 6.48
  tries, 53.8% home wins, 1.6% draws, 9.1% blowouts. Every band holds.
- autopilotprobe, 54 seasons: picking your side is worth 5.9 points a season
  over leaving it on autopilot (5.1 before), autopilot wins 4 titles in 54,
  and a well-run big club's board falls into crisis in 4 seasons of 36
  against 16 when nobody manages it.
- Fingerprint rebaselined (one of six re-deals). windowprobe's first run
  keeps its manager in work so the countdown has both windows to read.

## Testing

tsc -b, eslint, cssaudit, the fast engine suite, the browser harnesses,
autopilotprobe, bandcheck, stanceprobe and trustprobe.
