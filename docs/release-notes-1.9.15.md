# PHASE: Rugby Manager 1.9.15: release notes

**Not uploaded.** The first part was merged on 20 Nov 2026 (PR #114); the
owner then asked for the rest in the same version ("Fix everything in
1.9.15"), so a second pull request adds the section "Added on 20 November"
below. Started 19 Nov 2026 from the owner's
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
- **A men's World Championship squad is 33**, as World Rugby names it. Every
  other window, and the women's tournament, stays at 32.
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

## Added on 20 November (owner: "Fix everything in 1.9.15")

### The Nations Trophy

- **The tier-two nations play Tests between World Championships.** World
  Rugby's Nations Cup (2026), renamed as every competition here is: twelve
  nations in its real pools. Americas & Pacific: Canada, Chile, USA, Uruguay,
  Tonga, Samoa. Europe, Africa & Asia: Georgia, Portugal, Spain, Romania,
  Hong Kong China, Zimbabwe.
- Every nation plays the six of the other pool: three in November (Europe,
  Africa and Asia at home), three in July (the Americas and the Pacific at
  home). A champion in each pool, with a title, a celebration and the union's
  credit for the coach whose nation wins one.
- Its own tab on the Nations screen, with both pools; the November and July
  windows each have a camp, a union target and a review.
- Not played in a World Championship season. **One difference from the real
  one:** the real Nations Cup plays July then November of one calendar year,
  which spans two of our seasons, so ours plays November then July within one.
- Namibia is not in the real Nations Cup and is not in ours.

### Screens

- **Four tables fit a 320px phone**: Fixtures, a club's Squad tab, the
  Transfer list and Training's Condition tab scrolled sideways. At 360px and
  narrower the Form column steps aside (it is on every player's page) and long
  competition and injury names wrap.
- **Rival Watch** on Home: the rival's name has a line of its own, not
  "Northampto...".
- **Buttons big enough to tap** at 320px: Season Review's Back, the two board
  requests and the campus map's plots on Infrastructure, Scouting's league
  chips. A crash on an empty results page had hidden them from the checks.
- Native phrasing in French, Spanish, Italian, Japanese and Afrikaans. A
  coach with no club no longer sees their old club's desk on a player's page. Training
  fits 320px. News is dated the day it is filed. Older saves name every nation
  with its article in French, Spanish and Italian.

### Matches

- **Starve them of ball works.** The plan kicked so little (kicking 10) that
  it gave the other side territory: over 1,120 matches their tries went up and
  the plan cost 2.45 points a match. It now kicks at 30, with tempo 30 and ruck
  numbers 75: their tries fall 0.17 a match, the fewest of the plans, it is
  worth +0.60 a match, and it is still the only plan that cuts the kicking.
- **A touchline call is the last thing said.** A penalty call around the hour
  had the 60-minute line or the other coach's late change after it, so the
  commentary ran on while you decided.

### Checks that could not tell the versions apart

- Two release-check probes failed on 1.9.15 and on 1.9.14 alike. The autopilot
  probe now plays 72 seasons, not 36 (1.9.14: 28 crises sleepwalking, 10
  engaged; 1.9.15: 25 and 8). The contract-end probe reads each world's worst
  affordable share and takes the mean of 18 worlds (1.9.14 29.1%, 1.9.15 26.8%,
  bar 35%).

## For the owner to decide

- **Upset rate.** Favourites win close Tests less often than in real rugby
  (about 70% where real rugby is nearer 90%). This is the match engine, which
  is not changed without your say.

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
