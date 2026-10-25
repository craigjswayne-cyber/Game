# PHASE: Rugby Manager 1.9.6: release notes

Version 1.9.6, Play versionCode 65. Baseline: 1.9.5, code 64 (uploaded
24 Oct 2026). The owner's round of 25 Oct 2026 and two player reports from
France.

## What changed for players

**Pro Manager and adverts**
- Pro Manager plays no adverts at all. The gold favour buttons (the agency's
  file, the physio's favour and the rest) now grant their favour straight
  away for a Pro manager, with the same limits as before. A Pro manager in
  France was shown an advert by "Ask the agency for their file".
- A rewarded spot that had gone stale or was refused is fetched again on the
  same tap, so "No spot is available right now" comes up far less often.
- When the day's ten spots are used, the game says so, instead of "try again
  later".

**Transfers and scouting**
- A new career starts with six cheap fringe players on the transfer list in
  your own league, one per club, across different positions.
- Another club's player shows "?" for his rating until he has had a proper
  scouting report (a week or so on your shortlist, two matches against him,
  or the agency's file). Your own players always show theirs. Lists sorted by
  ability put unscouted men at the bottom.
- "The squad is full" now says when seniors you moved down to the academy are
  taking senior places: they still count towards the 46, which is why a
  French manager with 45 in his first team could not sign anyone.

**Old boys**
- The old boys are gone from every screen: the match preview card, the
  opposition report, the desk thread, the news stories and the commentary
  line about a man facing his former club, and the full-time line. Stories
  already in a save still read as they did.

## Not changed

- `scripts/fingerprint.ts` is unchanged: the match stream is the same as
  1.9.5 (the hidden lift for a man facing his former club stays).
- No balance constants.

## Owner's question: one 20-second injury advert

The "one long, one short" adverts are AdMob ad pods (two videos in one
rewarded impression). They are on by default and turned off in AdMob, not in
the game: AdMob > Apps > the app > Ad units > the rewarded unit > Advanced
settings > untick Ad pods. Google states the countdown runs 5 to 30 seconds
depending on the advert, so a fixed 20 seconds cannot be set.

## Tests

- New: `tests/proadfree.test.ts`, `tests/openlist.test.ts`,
  `tests/squadfull.test.ts`.
- `memoryprobe` and `memoryauditprobe` now hold that a man you let go is met
  and not named; `formerui` holds that the preview and full-time card carry
  no old boys line.
