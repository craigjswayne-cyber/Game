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

## Release hardening (audit round, 16 to 17 Oct 2026)

A full audit of the codebase (code review, security, testing, performance,
tech debt and accessibility) before upload. Everything it found is fixed in
this build, with a probe for each fix that fails without it.

**For players**
- **A week can no longer half-turn.** If anything goes wrong while the week
  is being settled, the career is put back to its last save and a notice says
  so; nothing half-done is ever written (`store.settleWeek`,
  `scripts/settleguardprobe.ts`).
- **Promises made in the summer window are kept, not broken on arrival.** A
  promise was due by week 44, so one made in weeks 45 to 48 was judged broken
  the next Saturday with no game played. It now carries into the new season
  (`model.pledgeDue`, `rollover.carryPledges`, `scripts/pledgeprobe.ts`).
- **Purchases are spent once and saved before they say so.** A full phone could
  grant a Full Fitness, an injection or a second ground and keep the credit;
  and the effect could be lost if the phone closed the app straight after.
  The credit is now taken first, given back if the career refuses it, and the
  career is on disk before the confirmation (`ui/purchase.spendCredit`,
  `scripts/spendprobe.ts`).
- **Continue answers the tap at once.** Turning the week takes a second or
  more on a budget phone; the button now says "Turning the week..." straight
  away instead of looking frozen.
- **Opens faster and runs lighter.** A first frame paints before the script
  runs, and on a 4x-throttled CPU the title screen is ready in 964 ms against
  1,154 ms before (first paint 908 to 276 ms). Screens load the first time
  they are opened, the dictionaries ship as JSON, the pictures are a fifth of
  the size (3.1 MB to 0.65 MB WebP) and are no longer held decoded all
  session, the Load screen reads only each save's label, saves are written
  when the phone is idle, and the live match no longer redraws the whole app
  for each line or simulated minute.
- **The same seed plays the same on every phone.** Two shuffles and seventeen
  tie-breaks depended on the browser engine or the phone's language.
- **Accessibility (WCAG 2.1 AA).** Text contrast meets 4.5:1 on every screen
  in every palette (158 places fixed), a clear focus ring, every table row,
  header and form control works from a keyboard and has a name, no text
  smaller than 11px and all type follows the phone's text size, 44px tap
  targets on chips, and the live match announces score changes, tries, cards
  and full time to screen readers.

**Security**
- CI runs with a read-only token and every action pinned to a commit;
  Dependabot watches actions and npm.
- The page's Content-Security-Policy now also locks connections, fonts,
  media, objects, base and form targets.
- Android builds set `allowBackup="false"`.
- Discord bot: `/setup` checks Manage Server itself, and the role picker only
  hands out roles with no permissions below the bot's own.
- `npm audit`: 0 vulnerabilities (Vite 8 removed the esbuild dev-server issue).

**Under the hood**
- Vite 8, Zustand 5, TypeScript 6.0. React stays on 18.3: React 19 measured
  270 ms slower to first paint at 4x CPU on the same code, for nothing a
  player would see. TypeScript 7 typechecks the tree, but typescript-eslint
  does not support it yet.
- `noUnusedLocals` and `noUnusedParameters` on; 229 needless exports made
  local and 35 dead functions and constants removed, with the 24 strings only
  they used.
- ESLint with jsx-a11y on `src/ui`.
- **Tests that can fail.** Two probes printed FAILED and still exited 0; the
  suite now fails any harness that prints a FAIL line, and every probe in
  `scripts/` must be in a suite list (`orphancheck.mjs`). The old `qa/` and
  `qa2/` probes CI never ran are in the suite or deleted; a dedicated season
  rollover probe asserts the new season. `npm test` (vitest) runs the fast
  deterministic checks. The website deploy now waits for the Gate, pull
  requests get a browser smoke run, and the soaks run weekly. See
  `docs/testing.md`.
- **The engine in modules.** No runtime import cycles (23 before).
  `matchEngine.ts` (7,972 lines) is a 48-line facade over 22 modules in
  `src/game/match/`; `season.ts` is down to the weekly settle (2,331 lines)
  with nine subsystems in `src/game/season/`; the 900-line `migrate()` is
  eighteen named steps; `theme.css` is twenty partials in `src/ui/styles/`.
  Every old import path still works. Pure moves: the sim fingerprint, a
  full-state hash over 70 weeks of two careers and the built CSS are all
  identical before and after.

**The last of the audit list**
- **Continue no longer freezes the phone.** The week settles in slices
  (`season.weekSteps`): the same code in the same order with the same dice,
  handing the screen back between matches. In Chromium at 4x CPU the longest
  block while a week turns went from 965 to 1,433 ms to 211 to 342 ms. A
  "Turning the week..." veil holds every tap until it is done, the save is
  held for the half-turned career, and a failure rolls back as before.
- Kick Off shows the match before the 7.7 MB pre-match copy is written.
- The page's security policy now allows scripts and styles from the game
  only; the Discord bot works on servers only and takes one bug report per
  member every two minutes; `npm audit` is 0 in the game, the bot and both
  shells (uuid 11 under Capacitor's Xcode tooling).
- The big files are modules: `MatchDay.tsx`, `HighlightClip.tsx`,
  `model.ts`, `rollover.ts` and `store.ts` are short facades over
  `screens/matchday/`, `highlight/`, `model/`, `rollover/` and `store/`; the
  nineteen copies of the tap-outside sheet are one `Veil`. 135 needless
  exports and 15 unchecked casts gone. No runtime import cycles.
- Tests: browser harnesses pick a free port, 25 of them run on every pull
  request, a manual release check runs the soaks and the full browser list,
  `suite.sh area <name>` runs one area, 202 probes share one assertion helper,
  and `npm test` covers the save queue, the week settle, purchases, promises
  and the save list (65 tests).

**Still to come** (none blocks this release)
- The repository split (art masters to Git LFS; the bot, marketing and design
  in their own repositories), right after this release.
- React 19 and TypeScript 7 wait on the startup cost and on typescript-eslint
  respectively.
