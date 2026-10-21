# PHASE: Rugby Manager 1.9.4: release notes

Version 1.9.4, Play versionCode 63. Baseline: 1.9.3, code 62. The owner's
round of 20 Oct 2026, from a device test of 1.9.3.

## What changed for players

**Type**
- Barlow throughout (owner, 21 Oct 2026: option C of a four-way font
  trial). Headings, scores, the screen title in the bar at the top and the
  PHASE RUGBY MANAGER wordmark are Barlow Semi Condensed; everything you
  read or tap is Barlow. Space Grotesk, Source Serif 4 and Hanken Grotesk
  are gone. The landing page uses the same two faces. Self-hosted as
  before (latin and latin-ext, OFL), so the game still starts offline.
- Home tiles: the line under each label ("Aidan Pugh: a flying month", "Not
  convinced", "70%") is in the text face; the small label above keeps the
  display face.

**Home**
- Today, Needs your decision: the answers to a question sit one under
  another, full width, in the same style.

**Match day**
- The team sheet before kick-off shows names and fitness only; ratings stay
  on the Team tab's Starting XV.

**Careers**
- The Job Centre says "They sacked you: unlikely" for a club that sacked you,
  instead of counting the weeks. The wait still holds, so the old job cannot
  simply be taken straight back.
- The sacking sheet's three answers sit close together.

**Adverts and reviews**
- Google's advert consent form is asked for as soon as the app has loaded on
  first launch, instead of waiting for the first advert. A returning player
  who already answered sees nothing.
- The store review card is asked for after 8 competitive matches, again 30
  matches later and once more 60 after that, never more. Google shows it only
  to a build installed from Google Play, so a test install from Android Studio
  never sees it.

## Second round (owner, 20 Oct 2026, same build number)

**Look**
- The thin club-colour strip under the green action button is gone.
- Gold-highlighted cards (the day room's Tomorrow, The Stakes, This Week's
  Preparation, the Assistant's game plan, the Academy) have a gold title
  band instead of a brown one. Danger Man's band is a solid red.
- Academy: the header band runs edge to edge and the two lines under it are
  spaced apart.
- Tactics: the whole pitch shows on a phone, try line to try line.

**Team tables**
- Selection: each player's ability sits right next to his form rating.
- General Info, Stats and Contracts: every heading sits over its column.
  NAT, MOR and STATUS are centred, VALUE lines up whether or not a player
  has a trend arrow, MOTM fits its column and WAGE /WK is no longer cut off.

**Fixes**
- A replacement who had been injured, banned or called up since the team
  sheet was named could still be sent on. The bench is checked at kick-off
  now, as the starting fifteen always was; an unfit name is covered for that
  match only and the manager's sheet is kept.
- A manager out of work no longer gets knockout record stories about the
  club that sacked him.

**New careers**
- A first-season checklist on Home: pick your starting XV, set your game
  plan, play your first match, sign a player, check your academy. Each step
  is a button to the screen, ticks itself when done, and the card has a
  Skip. Shown on careers started on this version only, in all six languages.

**Team sheet**
- Condition is coloured: green from 85%, gold from 68%, red below, the same
  bands as the fitness ring on the Squad lists.

**Under the hood**
- The player tables (the four Team tabs, the team sheet, the Academy squad
  and the Transfers market) share one table, so a heading and its column can
  no longer drift apart.
- The stylesheets are regrouped by component. Checked element by element on
  252 screens in both themes and three sizes: nothing looks different.

## Third round (owner, 21 Oct 2026, same build number)

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

**Balance**
- bandcheck, four worlds, 9,336 league games: 49.5 points a game, 6.48
  tries, 53.8% home wins, 1.6% draws, 9.1% blowouts. Every band holds.
- autopilotprobe, 54 seasons: picking your side is worth 5.9 points a season
  over leaving it on autopilot (5.1 before), autopilot wins 4 titles in 54,
  and a well-run big club's board falls into crisis in 4 seasons of 36
  against 16 when nobody manages it.
- Fingerprint rebaselined (one of six re-deals). windowprobe's first run
  keeps its manager in work so the countdown has both windows to read.
- rewarded182probe leaves the captain out of the 23 altogether: on the
  bench the new condition let him come on and turn an ankle, and a hurt man
  is rightly not asked about being dropped.

## Testing

tsc -b, eslint, cssaudit, unit tests (review ask schedule), the browser
harnesses touching the changed screens, on the production build. Third
round: the fast engine suite, all 104 browser harnesses, autopilotprobe,
bandcheck, stanceprobe and trustprobe.
