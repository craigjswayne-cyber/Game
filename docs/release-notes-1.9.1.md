# PHASE: Rugby Manager 1.9.1: release notes

Version 1.9.1, Play versionCode 59 (confirm 58 is accepted on the Console
first), iOS MARKETING_VERSION 1.9.1 (from `package.json`). Baseline: 1.9.0,
code 58. Package and bundle id, signing, product ids and permissions are
unchanged.

## Security

- **Capacitor 8.5.0 to 8.5.3** in both shells (`packaging/android`,
  `packaging/ios`). 8.5.0 is affected by GHSA-rvm3-566m-v7fv (critical, CVSS
  9.3): a link activated inside the app's WebView could load remote content at
  the app's own origin through Capacitor's internal HTTP proxy path. The game
  renders no user-supplied links, so exposure was low, but the fix is a patch
  release. `npm audit --omit=dev` is clean in both shells. Both store builds
  have to be rebuilt to carry it.

## What changed for players (owner's feedback round, 16 Oct 2026)

**The American season** (`calendar.ts`, `schedule.ts` buildMrcCup)
- The MRC plays its ten league rounds first (weeks 4 to 17), its semi-finals
  and final straight after (20, 21), then the new **MRC Cup** with the same
  six clubs: two pools of three seeded so the best two are apart, home and
  away in each pool (four games each), the pool winners hosting the other
  pool's runners-up in the semi-finals (34), and a final (35). The cup keeps
  clear of every Test window and draws from its own stream, so nothing else in
  the world moves. A career saved mid-season gets the new shape at the next
  summer, the same way the MRC itself arrived.

**Dreams** (`dream.ts` canReachCup)
- "Win the Continental Cup" and the league-and-cup double are only offered at
  a club that can ever enter the cup: the English, French and United
  Provinces top flights, and the English and French tiers below them, which
  can go up. Not the MRC, Japan or the Pacific. A save that already chose one
  at such a club is given "win the league" instead.

**Injuries in a watched match** (`matchEngine.ts` coverInjury, injWait)
- When one of your men goes down, nobody comes on until you pick who. The
  match waits for you; the side is a man short until you do. With nobody
  left who can come on it plays on short as before, and a front-row shirt
  with no front-rower left still means uncontested scrums.
- This also fixes the replacement appearing in the pitch animation before the
  injury notice: he is no longer put on the pitch before you have seen it.
- A match reopened mid-injury replays to the same point (`noscumprobe`).
  Matches begun on 1.9.0 and resumed replay as they were played.

**Mauls held up** (`kickToCorner`, HighlightClip 'heldup')
- A maul from the corner can now be held up over the line: no try, a
  goal-line drop-out (the current law; the line used to say "win the scrum"),
  and its own clip, the drive stalling just over the line with the ball held
  off the grass, captioned HELD UP. One in ten drives that would have scored
  is held up, more than one in four in the last quarter of a game within a
  score. The corner scores exactly as often as before outside those moments.

**Smaller fixes**
- Title screen: the far posts on the STARTING XV sheet are now the near ones,
  turned upside down (`scripts/art/posts_match.py`).
- Leadership panel: an injured man shows a small red cross, not "- injured".
- The round's table (results) and the nations' tables show bonus points.
- Team of the Week: "N of yours made the fifteen" now counts the Dream Team's
  XV, not the round's top fifteen ratings (`dreamxv.ts`).
- Capital letters on the team talk reactions line, the day subtitles, "No
  games", the academy coach line and the player screen's help text, in every
  language that has capitals.
