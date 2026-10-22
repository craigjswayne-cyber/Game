# PHASE: Rugby Manager 1.9.5: release notes

Version 1.9.5, Play versionCode 64. Baseline: 1.9.4, code 63 (uploaded
21 Oct 2026). The fixes from the 1.9.4 release audit of 21 Oct 2026;
`docs/archive/release-audit-v1.9.4.md` has the evidence for each.

## What changed for players

**Matches**
- A knockout tie that ends level after extra time and is decided on tries or
  kicks in a watched match stays decided. The week's processing used to play
  a second extra time over it, put points on the record the screen never
  showed and could send the other side through.
- A late penalty answered at a held half-time whistle is stamped in the first
  half: the commentary no longer read 41', 42' and then a 40' half-time line.
- A national Test team sheet is held to the same kick-off rule as a club's:
  a banned man no longer starts, and an injured replacement is no longer named.

**Careers**
- Moving to a new job leaves the old board's promises behind: a building it
  agreed to pay for, its backroom staff fund and its reprieve from the sack no
  longer follow the manager to the new club, and a build the old club paid for
  now opens there.
- Out of work, the manager can no longer sign, bid, renew, release, lend or
  ask the board for a building on the old club's account.
- Tries and kicks in friendlies and Test matches no longer count in a
  player's season tally, top scorer lists or records.
- A club in the English Women's Premier Division, the Women's Pacific
  Championship, the French Women's Division 1 or the Celtic Provinces Cup is
  treated as a top-flight club: no more "fallen" label for a champion, and a
  women's career counts its top-flight seasons.
- No takeover stories about the club that sacked you.

**Saves**
- A save file with club or competition ids named after the browser's own
  object names is refused at import instead of quietly corrupting the game.
- Damaged saves are healed rather than lost: an empty player record, a
  non-numeric id, a position or career row in the wrong shape.
- An old save (from before the MRC league) migrates the same the second time
  as the first.
- Opening another career within a second of a change no longer loses that
  change from the career you were leaving.

**Adverts**
- Only one rewarded advert can play at a time. Two favour buttons tapped
  together could play an advert and give nothing, or with some plugins pay
  twice.

**Screens**
- Condition colours agree with the figure: 84.6% printed as 85% is green.
- The match-day sheet warns about a replacement who has gone out on loan or
  on leave, instead of swapping him at kick-off without a word.
- The Game Time "Due" column is wide enough for the Italian "Attese" and the
  Afrikaans "Verwag" in full.
- Tab stays inside an open dialog for keyboard users.
- On the website, the fonts are kept for offline play.

## Owner's round (22 Oct 2026, same build number)

- Tab bars scroll instead of squeezing: on Competitions, Nations, Dream Team
  and Handbook in every language, and on Squad, Finances, Team Report,
  Tactics and Training on small phones, the labels ran over one another.
- The pre-season checklist ("Your pre-season") goes once the three
  pre-season friendlies are played, done or not.
- The Saves screen offers no Delete on the career you are playing (it was
  written straight back by the next autosave). Load another first.
- News: a read story no longer shows how many days it has left in the inbox.

## Tests and probes

- 20 new unit test files (29 in all, 180 tests), listed in
  `docs/testing.md`.
- `optionsprobe` measures each option over 240 matches instead of 120; the
  4-point line is unchanged.
- `feedbackui` taps a trophy celebration away before the season review, as a
  player does; it failed whenever the test career won something.
- `adsprobe`, `offlineprobe`, `injurygate`, `sidescroll` (every tab label fits its tab), `exportui` and `a11yprobe`
  carry the new checks; `scripts/compaudit.ts` is a new engine probe that
  replays every season's competitions and books in both worlds.

## Not changed

- No balance constants. `scripts/fingerprint.ts` is unchanged: the match
  stream is the same as 1.9.4.
