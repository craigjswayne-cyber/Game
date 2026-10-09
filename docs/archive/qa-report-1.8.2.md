# QA report: 1.8.2, 30 Sep 2026

Branch `claude/rugby-game-animation-ideas-qusfd5`. Play version code 41.
1.8.2 folds in the planned mastery release. The headline: five attack and
five defence styles, and a playbook the opposition learns to read.

## What was done

- **Styles** (`styles.ts`, `StylesSection.tsx`). Five attacks (direct, pods,
  width, kick, offload) and five defences (drift, blitz, pendulum, man,
  choke), each a preset over the existing dials plus a small effect of its
  own, with a balanced matchup table (measured against the table: r 0.97).
  Fit is read from the XV. AI coaches lean by philosophy and by league.
  Drawn pickers on the Game Plan tab; the dials stay on Fine Tune. Pods
  offers three shapes: 1-3-3-1, 2-4-2 and carries round the 9.
- **The manager's desk** (`desk.ts`, `Desk.tsx`). Home is Today: what holds
  Continue (answered in place where it can be), the match with the analyst's
  line, one line each on development, finance, tactics, the dressing room
  and the season, and one question still to be answered. Season objectives
  stay on Home as their own card (owner). The studio mark is on the title
  screen only (owner).
- **Recruitment detective work** (`recruit.ts`, `ScoutReport.tsx`). Reports
  grow with knowledge, split "What we know" and "Still unknown", carry a
  calibrated confidence (within 1.5 points of measured) and a style-fit line;
  real rival interest is told from agent talk; agents remember how their
  clients were treated. Unhappy players come cheaper (owner): at morale 3 or
  after asking to leave, fee x0.85 and terms x0.92; the 6% talk premium now
  applies only to settled players.
- **The career arc** (`rivalcoach.ts`, `repute.ts`, `chairman.ts`,
  `ambitions.ts`, `erastory.ts`). Rival coaches with your record against
  them, reputation traits read from how you manage, job profiles that set
  the board's aim (big clubs, fallen giants and newcomers expect one place
  higher, owner kept it), hidden chairman types, up to three ambitions and
  era stories.
- **The dressing room** (`room.ts`, `culture.ts`). Splits over selection on
  a sheet the manager picked, a hidden club culture, renew-now or wait,
  rest or rush a returning man, an academy loan answer, and assurances when
  a starter's position is signed for.
- **Development projects** (`devproject.ts`, `devnews.ts`). Hidden learning
  traits described in plain words, weekly growth drivers, a ceiling that
  moves by up to 6 and reads as a band until 23, intake picks, projections
  revised, breakthroughs and stalls.
- **Season priorities, form and form traits** (`seasonplan.ts`,
  `formtraits.ts`). Rank the competitions and pick a rotation intent; the
  assistant rests for the day's best side, so ranking a competition first
  pays in it (+12.4 net over 56 pairs). A form trend arrow; four hidden
  form traits, never named.
- **Tactical depth** (`conditions.ts`, `habits.ts`). Weather by place and
  date (wet: handling errors +44%), the conditions card with half-time
  words, specialist positions and uncontested scrums, six hidden traits,
  surface and contact injuries (Gloucester added to the artificial pitches,
  owner), league flavour.
- **Playbook and analyst** (`armsrace.ts`, `analyst.ts`). Four playbook
  slots with familiarity, the tape opponents keep, coaches who adapt to
  overuse; analyst confidence calibrated (high 89% right, mid 72%, low 41%).
  Nine new moves with diagrams and clip tracks.
- **Clips** (`clipPlays.ts`, `HighlightClip.tsx`). The chase after a break,
  moves from real set pieces, defence and pods shaped by style, no one
  overrunning into in-goal, the referee out of the way.
- **Four more rewarded favours** (`rewarded.ts`), opt-in, store build only:
  the agent's inside word, a second opinion, tape room night, the sponsor's
  team night. No new in-app purchases (owner).
- **Smaller calls:** drawn flags (Ireland a white shamrock, owner), the
  "Fragile" injury verdict now "Long injury record" and the word banned on
  screen, the Season Ahead card listing each date once, pages kept under
  three screens on a phone.

## The evidence

Final pass on the merged head: see the addendum in
`docs/release-readiness.md` for the counts. The QA branch before it ran 292
of 293 (224 of 225 engine probes, 64 of 64 browser harnesses, tsc,
textlint, cssaudit, build); the one failure was perfprobe's week timing on a
loaded shared machine, which fails the same way on main.

Balance (bandcheck, pooled): 49.8 points a game, 6.32 tries, home wins
52.4%, draws 1.4% (band floor), all inside their bands. The fingerprint was
rebaselined twice with written reasons (styles, tactical depth) and never
by a new draw on the shared stream.

## Still open, and not a blocker

- **Law 3:** the World Rugby site is blocked from the build machine. The
  uncontested-scrum handling matches published summaries; the owner is to
  check the red-card (13 men), sin-bin pairing, injury (14 men) and HIA
  points against the official text.
- **Page depth:** team selection, the scouted player and the estate page
  sit just under three screens on a phone.
- **Move clips** take up to about 0.5 s to build on a slow phone.
- **perfprobe** week timing fails on the shared machine, as on main.

## What still needs the owner

- Play Console: Data safety says eight optional rewarded placements now;
  update it if the old wording is entered.
- The in-game privacy handbook entry (`handbook.a79`) predates adverts.
- Keep or change the daily rewarded cap of 10.
- Keep or remove the small news links and the scouts' closing line.
- Check the highest accepted code on the Console before uploading 41.
