# PHASE: Rugby Manager 1.9.4: release notes

Version 1.9.4, Play versionCode 63. Baseline: 1.9.3, code 62. The owner's
round of 20 Oct 2026, from a device test of 1.9.3.

## What changed for players

**Type**
- The screen title in the bar at the top ("Northampton RFC", "Job Centre",
  "Match Day") and the PHASE RUGBY MANAGER wordmark on the title screen are
  in bold Space Grotesk.
- Home tiles: the line under each label ("Aidan Pugh: a flying month", "Not
  convinced", "70%") is in the text face; the small label above keeps the
  serif.

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

**Condition**
- Every player now has his own condition. Before, everybody who played the
  full eighty finished on the same floor, so a whole XV read 35% (71% after
  a friendly). After a match, his stamina, how well he played and the knocks
  he took move his number. Over the week, his age, his stamina, a fitness
  week, a heavy personal plan and his own body do. The physio and the gym
  still add on top. The average is where it was, so the game is no easier or
  harder; only who is fresh changes. Every club plays by the same rules.

**Fixes**
- A replacement who had been injured, banned or called up since the team
  sheet was named could still be sent on. The bench is checked at kick-off
  now, as the starting fifteen always was; an unfit name is covered for that
  match only and the manager's sheet is kept.
- A manager out of work no longer gets knockout record stories about the
  club that sacked him.

**Balance** (bandcheck, four worlds, 9,336 league games, before and after):
49.5 -> 49.7 points, 6.48 -> 6.52 tries, 54.4% -> 53.1% home wins,
2.0% -> 1.8% draws, 8.4% -> 8.7% blowouts. Every band holds. Fingerprint
rebaselined (one of six re-deals).

## Testing

tsc -b, eslint, cssaudit, unit tests (review ask schedule), the browser
harnesses touching the changed screens, on the production build.
