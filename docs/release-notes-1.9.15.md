# PHASE: Rugby Manager 1.9.15: release notes

**DRAFT, not merged, not uploaded.** Started 19 Nov 2026 from the owner's
international list, then an overnight QA of the international game (owner:
"test all features, all teams for multiple seasons ... internationals should
be harder than the club coaching ... nobody should be able to breeze it").
The store "What's new" text is in `docs/store-listing.md`.

Version 1.9.15, Play versionCode 78. Baseline: 1.9.14, code 77.

## What changed for players

### The owner's list

- **A national coach with no club can pick the Test XV and bench.** The
  match-day screen sent an out-of-work manager back to Home, so a coach with
  only a country could never pick the side (urgent).
- **The squad covers every position.** The coaches' squad fills every shirt
  first (three looseheads, three hookers, and so on) and the desk names the
  positions still short.
- **The media reacts to every squad announcement**, with social posts in six
  languages.
- **No Job Centre on a national coach's bottom bar** (it is under World).
- **No value, wage or deal desk** on a player's page for a nation-only coach,
  and **no caps count** on the squad desk (the uncapped marker stays).
- **Test dates** are printed for the day the Test is played.
- **Board Funding and Infrastructure** boxes fit the screen.
- **No transfer requests from the international stage.** A club player left
  out by his own club's coach is still unhappy, but does not ask to leave.

### The camp, the squad and the Tests

- **The camp opens the week before every window**, so no Test is played
  before the squad exists. The autumn and the Northern Championship get the
  camp week they had on paper. The other side has a full squad for the first
  Test too (England had met an empty Fiji and won 71-0).
- **The window review stays until read**, and a coach appointed mid-window
  gets that window's target and review.
- **Fair reactions to selection.** "Left out" means the coach could have
  picked them: not someone playing abroad, without a club, kept at the club
  by the two-jobs rule, or already sent home. A recall gives back exactly what
  the drop took. A squad that plays a Test has been announced.
- **The dressing room reaches the pitch.** The coach's own Test side now
  plays with its morale, as a club side does, so the announcement, the camp
  decisions and promises kept or broken matter on the day. Only the coach's
  side: a world with no national coach plays as before.
- **Full-time advice in Test terms**: the Test XV, the national plan's dials
  and the camp focus, not the club's Roles tab or infrastructure.
- **Camp events vary** from window to window (one kind repeated all season).

### Harder at the top

- A world top-five side gets no relief on a clean-sweep target, and a window
  against sides all well below it asks for every Test.
- A missed target costs more (-4 or -8); an underdog's miss costs less (-2).
- A draw with a weaker side counts against you, a defeat by a side well below
  costs more, and an expected win is worth +1, not +2.5.
- Winning a title adds to the union's confidence; the summer no longer lifts a
  failing coach back up.
- The union's terms are judged: from the first full season, a nation inside
  the ranking it set at the appointment is a credit at the annual review, and
  one well outside it a debit, and the letter says so.
- Measured over 4 seasons on 38 careers: a top men's nation coached by
  someone who does nothing is now sacked in 6 of 10 runs, against 2 of 10 for
  an engaged coach (before: 2 and 2). The women's top sides now feel pressure
  (lowest union confidence 22 to 57; it was 53 to 89).

### The World Championship, as it will really be played

- **24 nations, six pools of four**, the real 2027 draw for 2027 (World
  Rugby). The top two in each pool and the four best third-placed sides go to
  a **round of sixteen**, then quarter-finals, semi-finals, a **bronze final**
  and the final. The women's tournament also plays a bronze final.
- On the real dates: from the weekend of 2 October to the final on Saturday
  13 November 2027.
- **Hong Kong China and Zimbabwe** join the game: names in six languages,
  flags, kits, anthems, name pools and world ranking points.
- The Nations screen shows **the pools and the bracket**; the women's Test
  competitions have their own tabs.
- The post-tournament verdict judges a seed against the round it should
  reach; the celebration names the nation.

### The British & Irish Isles XV

- The series is decided on the three Tests, and the Isles coach coaches the
  Saturday Tests, not the midweek provincial games.
- The host keeps its squad for the whole series.
- **The tour party is the coach's to pick**: drop and call up on the desk as
  for his own country. That summer his country really is the assistant's: no
  camp to name, no target and no review of his.
- Tours on the real years: 2029 New Zealand, 2033 South Africa, 2037
  Australia; women's 2031, 2035, 2039.
- Provincial games show the club's name, with no anthems or world ranking,
  under "Tour match", and the Isles XV no longer shows "world no. -". An
  unanswered invitation lapses two weeks before the party leaves.

### World and rankings

- Rankings weight every World Championship match double and nothing else.
- Northern Championship: a Grand Slam is worth 3 bonus points and ties are
  split on points difference.
- Thin nations call up their real players before generating anyone, and a
  women's nation's generated players are rated from the women's game.
- Autumn and women's summer Tests rotate opponents with no repeats.
- Northern Championship venues alternate year to year, two or three home
  games each.
- Summer Tests are played in a World Championship season too.
- Canadian names for Canadian players.

### Words

- Letters name the nation, not its code ("SACKED: ENG relieve you").
- "Southern Championship", not "the The Southern Championship".
- French, Spanish and Italian: a woman head coach is named as one, women
  players are women, "sélectionneur du Angleterre" is gone, and the World
  Championship verdict agrees with every nation.
- A national coach with no club is not called "Unemployed".
- Small fixes: the Annual and Home no longer print codes, the Offers contract
  year, New Zealand's Star Player tag, "Squad named in 161 days".

## For the owner to decide

- **Upset rate.** Favourites win close Tests less often than in real rugby
  (about 70% where real rugby is nearer 90%). This is the match engine, which
  is not changed without your say.
- **Tier-two nations** (Georgia, Portugal, Spain, Uruguay, Chile, Romania,
  Namibia, Hong Kong China, Zimbabwe) play the World Championship but have no
  Test programme in between.
- **Squad size** is 32 for every window; a real World Cup squad is 33.

## Checks

Run on 20 Nov 2026 (local, then CI on PR #114):

- Unit tests: 431 passed. Typecheck, lint, text lint, token lint, CSS audit,
  orphan check, i18n probe and language parity pass.
- Engine fingerprint unchanged after every change.
- Engine probes: all passed locally after fixes (chaosprobe re-seeded, wsoak,
  talkprobe, newsprobe, readslike and countryprobe updated or fixed for the
  new calendar), with the rest covered by CI's eight shards.
- Browser harnesses: all passed locally (natonlyui and dualroleui updated
  for the camp opening a week early and the automatic announcement).
- Calendar invariant passes in both worlds, every kind of year, with the
  World Championship on its new dates.
- Probes written tonight: the 2027 World Championship plays through to a
  champion with no pool rematch in the last sixteen; the Isles tour hosts are
  New Zealand 2029, South Africa 2033, Australia 2037.
