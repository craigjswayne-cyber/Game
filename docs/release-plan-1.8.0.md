# Release plan: 1.8.0 to release-ready

Written 27 Sep 2026 from everything reviewed this week: the owner's feedback on
the match animation, the "How Football Manager's Match Engine Works" video, the
fm-arena development thread, the Steam "ME mechanics" thread, the Gemini deep
research PDF and the pasted FM "algorithm" summary. Each item says who does it,
what "done" means, and where it came from.

Size: S = under a day, M = a few days, L = a week or more.

---

## Where we are (branch `claude/rugby-game-animation-ideas-qusfd5`)

Done and pushed:

- Match view: commentary + live stats, pitch only for highlights (Key /
  Extended). Clips baked with real movement limits; `hlprobe` checks 211 real
  clips at 60 fps (fastest player 12.0 m/s, every try grounded over the line,
  TMO reviews play).
- One match engine: a watched match and the same fixture played silently are
  now the same match (`detailprobe`, 120 of 120). Before: 0 of 120.
- Bottom nav in the Sainsbury's style; stats moved up under the commentary;
  landscape phones fit the stage (e2e at 844x390 could not tap Skip).
- Tokens, French typography, a Spanish wording fix, dead pitch CSS and strings
  removed.

Not yet shipped: nothing from 1.8.0 is on `main` or the live site.

---

## 1. What only the owner can do

| # | Action | Why |
|---|--------|-----|
| O1 | Play the test build (artifact) through at least one full match on a phone, portrait and landscape, with Highlights on Key and on Extended | The animation was the reason for this round; it needs your eyes, not a probe |
| O2 | Decide scope: which of section 2 goes in 1.8.0 and which waits (my recommendation is marked) | Balance changes move every save's future |
| O3 | Review the new store screenshots once regenerated (step R4) | The match screen in the listing no longer exists |
| O4 | Store accounts: confirm the Play account, keystore, domain/asset-links and iOS wrapper status from `docs/release-readiness.md` (items 1-4 of its sign-off) | Only you hold these |
| O5 | Approve the PR into `main` when the gate (section 3) is green | `main` is what deploys |
| O6 | Optional: allow fm-arena.com, steamcommunity.com and scribd.com in the environment's network settings if you want me to read sources directly | I could not open any of the links |

The real-player-names risk (release-readiness 1b) was decided in August and
stays an accepted risk; nothing to do unless you change that decision.

---

## 2. Engineering work, in order

### Recommended for 1.8.0 (release blockers or near it)

**E1. Explain-the-upset stats (S).** Source: Steam thread. Add rows to the live
stats and full-time sheet: points per 22 visit, kicks at goal made/attempted,
turnovers conceded in their 22. Done when: a side that dominated and lost can
see why on one screen; strings in all six languages; statsprobe covers the new
rows.

**E2. Training drain fix (M).** Source: fm-arena thread. Today training adds
attributes for free (`season.ts:1025`, `season.ts:1269`) and each summer takes
a quarter back (`ageing.ts:121`), so gains quietly vanish, and a man at his
ceiling keeps growing. First a probe measuring it over three seasons; then
training that moves the rating with the attribute, and at the ceiling costs
a little elsewhere. Done when: the probe shows trained attributes stick, no one
passes his potential, and growthprobe / drift keep the world mean.

**E3. Exploit ladder (M).** Source: video (FM Arena method), PDF (set-piece
exploits), Steam thread (corner cheat). Thousands of matches per setting with
identical squads: every tactic dial, kicking style, breakdown slider, the lineout
drive and kick-to-corner, plus an attribute ladder (is any one attribute
decisive, like FM's pace?). Include the AI counter-coaches and check whether AI
clubs get an equivalent of the user's staff boost. Done when: a report lists
the spread per setting and nothing dominates; anything that does is fixed or
written down as intended.

**E4. "One engine" line in the help (S).** Source: video, Steam thread. One
plain sentence: every match, watched or not, runs on the same engine, and
AI coaches' reactions are announced in the commentary.

### 1.8.1 (owner: everything remaining)

**E5. Growth scaled by the gap to potential (M).** fm-arena: the gap is the
growth rate. Today a 50/95 kid and a 50/60 kid grow alike.

**E6. Diminishing returns on high attributes (S-M).** 17 to 18 should cost more
than 8 to 9.

**E7. Professionalism softens the no-minutes penalty (S).** fm-arena thread.

**E8. Hidden Consistency and Big Matches traits (M).** PDF. Revealed by
scouting; big matches = finals and derbies (already flagged).

**E9. AI sets up by the user's reputation (M).** PDF: a promoted side's second
season should feel harder for a visible reason.

**E10. Real pace in the clips (S).** Quick players visibly outrun the cover.

**E11. Rewatch highlights of past matches (M).** Store the user's events;
clips are built from events alone.

### 1.8.1 or later (to confirm)

**E12. Two-layer match engine (L).** The per-player breakdown engine from
`design/match-engine-csharp`, so highlights show what actually happened and
mental attributes can gate technical ones. Needs its own calibration round.

---

## 3. The release gate (engineering, then owner)

| # | Step | Done when |
|---|------|-----------|
| R1 | Full suite in `all` mode (soaks included) on the final commit | SUITE-SUMMARY result PASS |
| R2 | Device matrix, geosweep, portraitqa, tapsize, textscale in the browser battery | Included in R1; screenshots checked by eye for the match screen and nav |
| R3 | Release audit refresh: append a 1.8.0 addendum to `docs/release-readiness.md` with the evidence | Every sign-off line re-verified at the release commit |
| R4 | Regenerate store art (`scripts/storeart.mjs`) in all languages | New match screen and nav in every screenshot; owner reviews (O3) |
| R5 | Release notes for 1.8.0 (the repo has no changelog file or in-game "what's new" yet; the store listing's release notes, six languages) | Owner reads them; any new in-game strings pass langparity and i18nprobe |
| R6 | Update the test artifact to the release build | Owner plays it (O1) |
| R7 | PR into `main`, CI green, owner approves (O5) | Merged |
| R8 | Deploy and verify the live site: version stamp, a match with a highlight, nav | Checked on the live URL |
| R9 | Store builds (TWA / Android / iOS shells) if selling this version | Needs O4 |

---

## Progress (27 Sep 2026)

- E1 done: points per 22 visit and kicks at goal, read off the ticker (an
  older leak that showed a try or kick before its line is closed with it).
- E2 done: training redirects (trainPoint), plans +1 rating a summer below
  potential; level vs rating -0.6 (was +7.2), 1 in 20 above potential (14).
- E3 done: units blended (tackling 9.0% -> 5.7% of strength, 2.5x -> 1.9x the
  third; decisions, agility, work rate now read), the scrum wins penalties,
  tap and go reads the place, the maul call trimmed (+4.5 -> +2.8). Bands
  hold (50.7 pts, 6.48 tries). Measured exactly by ladderprobe.
- E4 done: Handbook entries on one engine and on when the pitch comes on.
- Also: the ticker's Highlights mode renamed Big moments; release notes and
  store description rewritten; store art regenerated; test artifact v9.
- Suite on the final engine: 159 pass; the 4 failures were probes whose
  samples could not resolve their own thresholds (autopilot, kickbreak,
  wmarket) and a load race (motion) - each widened or fixed and re-run green.
- In progress: the soak and long-run list (releasesim, stresstest, deepsave,
  dialweight, soakhealth, soakui, e2edeep).

## 4. Decisions (owner, 27 Sep 2026)

- **Scope: E1-E4 are 1.8.0; everything remaining is 1.8.1.**
- **Training: "redirect + small boost".** A trained point is paid for at
  once by a point elsewhere (ageing.ts trainPoint), a trained attribute stops
  near what his position plays at for his potential, and a man on a personal
  plan gains one rating point a summer while below potential.
- Correction to E8: hidden Consistency and Big Match temperament already
  exist (attributes.ts, read by teamUnits since round 25D-2); they are never
  shown by design. What is left for 1.8.1 is whether scouting hints at them.
- The ticker's Highlights mode is renamed (done: Big moments).
- Still open: the store question below, and whether the two-layer engine
  (E12) is in 1.8.1 or a later release.

## 5. Decisions still needed

1. Store release with 1.8.0, or web only first?
2. E12 (two-layer engine) in 1.8.1, or its own release?

