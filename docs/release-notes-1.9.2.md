# PHASE: Rugby Manager 1.9.2: release notes

Version 1.9.2, Play versionCode 61, iOS MARKETING_VERSION 1.9.2 (from
`package.json`). Baseline: 1.9.1, code 60. Package and bundle id, signing,
product ids and permissions are unchanged. The owner's feedback round of
18 Oct 2026 is in `docs/feedback-1.9.2.md`.

## What changed for players

**Squads for 2026-27** (`verified.ts` THE 2026-27 WINDOW, `additions.ts`
WINDOW_2627, `captains.ts`)
- Every club's squad, captain and star player checked against the real
  2026-27 season (2026 for the Pacific). 157 players moved club, 56 left the
  game's leagues and 206 were added. Gloucester's captain is Dewi Lake and
  Tomos Williams is at Saracens.
- The Championship and Pro D2 have their real 2026-27 line-ups, and the
  Major League Rugby clubs carry their real 2026 rosters (Charlotte stays
  made up). Pro D2 plays 30 rounds by borrowing two cup weeks.
- Clubs that moved: Tochigi RFC (Honda Heat, now in Utsunomiya) and
  Washington RFC (Old Glory DC, now in Fairfax).
- Players who have died are kept out of every squad (`DECEASED`).
- The new-game wizard shows the squad the career will actually build.
- A career saved on an earlier version keeps its own leagues and squads.

**The real pitches** (`conditions.ts`)
- Every club plays on its real ground's surface: 26 artificial, 36 hybrid,
  the rest grass (and grass wherever no source could settle it). It used to
  be a guess. Sources are in `docs/research/pitch-surfaces-2026.md`.
- The world's injury count is held where it was (`INJ_NORM` 1.028): the
  ground changes who gets hurt, not how many.

**Match day**
- A head injury assessment stops the match and asks you: keep the
  assistant's stand-in or send someone else on, free, at the stoppage.
- Team talks matter more: the right talk is worth up to 12% per player, and
  a wrong one against a stronger side costs up to 1.75 times as much.
- Everyone on the pitch gets 10 energy back at half time; the drain is a
  little steeper so a side's average energy over 80 minutes is unchanged.
- The replacements sheet colours every player by energy from the first
  minute: green 70 and over, amber 40 to 69, red under 40.
- Referees: everyone named in full, Sara Cox (strict, like Luke Pearce) and
  Aimee Barrett-Theron (quick to card) join Hollie Davidson, and the
  referee's dot on the pitch is full size so it no longer reads as the ball.
  The card setting is scaled across the panel so scoring holds.
- The referee note says what the number counts: penalties a side gives away
  before a card.

**Transfers**
- Demand more: 60% of the time the bidder raises by 10% to 20%.
- Listing a fringe player never raises his asking price.
- A scout's ceiling range never closes to a single number for a player
  rated near the top.

**Save slots**
- One career for free players, four with Pro Manager. A free player who
  already has more keeps every career playable. The web build keeps four.

**A new look**
- New fonts: Saira Condensed for headings and scores, Libre Franklin for
  reading text.
- Cards open on a coloured header band instead of a stripe down the side;
  lists of figures are flat rows.
- Headings in normal case, player ratings as a number out of 99, menus
  grouped under short headings, no arrows in button text, plainer wording,
  and instructions behind a small "?" button.
- About 1,300 lines in six languages rewritten where a spaced hyphen stood
  in for a dash.
- The loading screen before the game starts uses the title screen's art.
- The light and dark switch moved to Settings.
- The manager's name takes a capital on each word.
- Tablet: the gap between the match card and the Store matches the rest.

**Adverts**
- Each rewarded advert logs how many adverts the network showed, to find
  where the extra adverts after one tap come from (AdMob settings, owner).

## Fixes found in testing

- An injury and a head assessment in the same minute no longer mix up
  which replacement the injury sheet names.
- A missed penalty moves the match clock whether or not it is shown, so a
  watched match and the same match played silently end on the same minute.
- Young players' growth from minutes played is recentred for the new squads
  (`MINUTES_CENTRE`); the gap between a regular starter and a bench player
  is unchanged.

## Balance

Fingerprint rebaselined for the referees, half time and team talks, and
again for the squads, each with a before and after band check. The final
band check: 49.6 points and 6.50 tries a game, 53.6% home wins, 1.7%
draws, 7.8% blowouts, all inside their bands.

## Testing

PENDING: engine probes, unit tests, linters and the browser suite on the
final commit.
