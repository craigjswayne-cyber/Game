# PHASE: Rugby Manager - full test prompt, baseline v1.6.2

A prompt to hand to a code LLM with GitHub access. Its job is to test every
aspect of the game against the 1.6.2 baseline, prove what it finds, fix what it
breaks, and leave the repository greener than it found it.

Everything above "The prompt" is context for whoever is running it. Paste
everything below the rule into a fresh session.

Its sibling, `docs/audit-prompt-v1.6.2.md`, is the variant that audits and then
hands the fixes to a second session rather than fixing in place. Use that one
when the reading and the fixing are meant to be separate jobs.

## When to run this

Before a store upload, after a merge that touches the engine or the shell, or
whenever nobody can honestly say when the whole game was last exercised. It
assumes `scripts/suite.sh` is expected to pass; its job is to find what a green
suite does not see, and to check the claims the release notes make.

## What it is designed to defeat

The failure mode of "test everything" prompts is a shallow tour: tidy
observations, nothing reproduced, nothing fixed. This one names every surface
the game has, gives each an exit criterion, and refuses findings that are not
backed by a reproduction or a measurement.

---

## The prompt

You are the QA lead for **PHASE: Rugby Manager**, a rugby union management game
for mobile, currently at **version 1.6.2 (Android versionCode 31)**. The bar is
the best of the genre: a paid product a stranger judges in ten minutes and a
devotee plays for two hundred hours. Assume it goes to the closed track this
week and your name is on the build.

Be adversarial. Your job is not to confirm the game works. The suite already
claims that. Your job is to test every aspect of it, find what the suite cannot
see, prove it, fix it, and prove the fix.

### 1. The repository, and your GitHub access

Repository: **`craigjswayne-cyber/Game`** (https://github.com/craigjswayne-cyber/Game).
You have GitHub access through the GitHub MCP tools (`mcp__github__*`) and a
local clone at the working directory. Use the MCP tools for anything that
touches GitHub itself: reading and writing files on a ref, listing and reading
Actions runs and job logs, opening and reviewing pull requests, reading and
replying to review comments.

**The baseline is not `main`.** As of this writing:

| ref | version | note |
|---|---|---|
| `origin/main` | 1.5.6 | behind by 71 commits |
| `claude/rugby-game-llm-prompt-ei0zyx` | **1.6.2** | the 1.6.2 release commit `5741ae9` and everything after it |

Confirm this yourself before you start: `git log --oneline -5`, then
`grep '"version"' package.json` on each ref, and `git rev-list --count
origin/main..HEAD`. If `main` has moved to 1.6.2 or beyond since, say so and
work from whichever ref actually carries 1.6.2 or later. Never assume the table
above is still true.

Rules for the repository:

1. **Work on the designated branch.** Commit there, push there
   (`git push -u origin <branch>`). Create it from the 1.6.2 baseline if it
   does not exist. Never push to `main`.
2. **Never force-push a branch you did not create**, never rewrite published
   history, never merge your own pull request, never approve one.
3. **Do not open a pull request unless you are asked for one.** If you are, fill
   in the repository's template if one exists.
4. **Do not touch `packaging/android/version.json`.** A version code is spent by
   the first Play track that takes a bundle, and 31 is not yet spent. Changing
   it is the one mistake that costs real money and cannot be undone.
5. **CI is the Gate** (`.github/workflows/ci.yml`). The `engine` job runs on
   every push and every pull request: typecheck, textlint, tokenlint, cssaudit,
   a build, ipprobe, and `suite.sh fast` in two shards. The `browser` job runs
   on `main`, nightly at 03:00 UTC, and on `workflow_dispatch`. Use
   `mcp__github__actions_list` and `mcp__github__get_job_logs` to read your own
   runs rather than guessing, and `mcp__github__actions_run_trigger` to
   dispatch the browser job against your branch when you have changed UI.
6. **Every push you make must leave the Gate green.** If you turn it red, that
   is the next thing you work on, ahead of whatever you were doing.

### 2. What 1.6.2 is, and the four claims you must verify first

1.6.2 carries three releases that were finished and never uploaded (1.5.9,
1.6.0, 1.6.1). Its store copy makes four specific promises to players. Each one
is a regression test you owe before anything else, because a release note that
is false is worse than a bug:

1. **Back goes back.** The Android hardware and gesture Back used to close the
   app from anywhere. It must now navigate back through the game's own history,
   and only leave the app from the place a player expects to leave it.
   Commit `d67a483`.
2. **The app answers a tap.** A tester reported a one to two second delay. The
   cause was twenty-six different actions each rewriting an entire career to
   move a bookmark. Measure tap-to-paint latency on a fresh career and on a
   late-career save, and show the write count per interaction. Commit `d69f717`.
   The claim in the copy is "nothing is saved less, it is saved less often":
   prove both halves, including that a kill mid-session loses no more than one
   interaction's worth of progress.
3. **Purchases cannot be lost.** Restore at boot on a fresh install, a grant on
   `owned` and on nothing else, all five purchase endings handled, the receipt
   never written into the save. `scripts/moneyprobe.ts`, `scripts/storeprobe.mjs`.
4. **Old careers land on the right week.** A save written before the week
   mapping changed (week 45 converted to week 0) must migrate, play and settle
   on the correct week. Commit `18f0144`.

Also verify the possession strip animates on the compositor and not the main
thread (`02de1c6`), and that the five store description blocks are within their
character caps (471, 496, 475, 494, 224 against 500; Apple 3,730 of 4,000).

### 3. Ground rules you must not break

These are how this codebase stays trustworthy. Violating one is a worse outcome
than finding nothing.

1. **Every fix ships with a probe that fails on the old code.** Build a git
   worktree at the pre-fix commit, copy the new probe in, and show it failing
   before you claim the fix works. A fix without a failing-before demonstration
   is a guess. Fold the probe into `scripts/suite.sh`.
2. **Treat a red probe as a claim about the probe until proven otherwise.** The
   running score in `docs/audit-handoff.md` is ten probe bugs to one engine
   bug. Instrument before you diagnose. The tells: a number that moved when it
   could not have, a failure rate too low for a broken invariant, a yardstick
   snapshotted once and compared against many samples, a fixed band with no
   relation to the sample's noise floor, detection by aggregate over a log that
   is trimmed, a boundary `<=` where `<` belongs.
3. **A probe that measures nothing must fail.** No bare `catch` that lets a
   harness report PASSED on zero measurements. No walkthrough with no
   assertions. Bound loops by progress, not by a magic iteration count. Give a
   statistical assertion enough sample, and assert the property rather than a
   perfect record.
4. **Determinism is a feature.** New systems derive from `mulberry32` over a
   seed or id hash, never from the shared match rng, and must not change
   match-stream draw counts. If `scripts/fingerprint.ts` moves, that is either
   a deliberate mechanical change (run `bandcheck` first, then rebaseline in
   the same commit with a comment saying what moved and why) or a leak you have
   just found.
5. **Every new balance dial is mean-neutral by measurement.** Measure the world
   mean, add the correction constant, hold it with a probe. "It should roughly
   cancel out" is not a measurement.
6. **No em dashes anywhere in game-facing text or docs.** `scripts/textlint.ts`
   enforces house style: no em dashes, no mojibake, no `.short}'s` possessive.
   Colour lives only in `src/ui/tokens.css` (`tokenlint`). Every token must
   resolve and every `vh` needs a `dvh` companion (`cssaudit`).
7. **Never rebuild `dist` or edit `src` or `scripts` while a suite is running.**
   The gate becomes meaningless and you will not know which state failed.
8. **Report faithfully.** If a band drifts, say so with the number. If you
   skipped something, say what and why. A clean report that hides a drift is
   the one unforgivable outcome.
9. **The three standing promises**, which no fix may weaken: the game is
   offline (no network calls at all, `scripts/netprobe.ts` fails the build if
   one appears), it collects nothing, and it reproduces nothing official
   (`scripts/ipprobe.mjs` greps the shipped bundle for 121 real club,
   competition, sponsor, venue and governing-body marks).

### 4. The environment

```bash
npm ci
npm run dev                              # vite dev server
npm run build                            # tsc -b && vite build, into dist/
npx tsc -b --noEmit                      # typecheck

./scripts/suite.sh fast                  # engine probes only, no browser (~18 min)
./scripts/suite.sh                       # fast + browser harnesses (~40 min)
./scripts/suite.sh all                   # everything, soaks included (hours)

npx vite-node scripts/bandcheck.ts       # engine probes are TypeScript
node scripts/tapsize.mjs                 # browser harnesses are .mjs
```

`scripts/` holds 191 TypeScript engine harnesses and 70 `.mjs` browser
harnesses, plus `scripts/lib/` and `scripts/tools/`, which are libraries rather
than probes. Browser harnesses need a build and Chromium;
they look at `/opt/pw-browsers/chromium` and honour `PW_CHROMIUM`:

```bash
export PW_CHROMIUM=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
```

Read `docs/testing.md` before you run anything: it says what each tier is for
and, more usefully, what it does not cover. Read `docs/audit-handoff.md` for
the standing lessons, `docs/i18n.md`, `docs/monetisation.md`,
`docs/match-drama.md` and `docs/release-readiness.md` for the surfaces they
own. Treat every one of those documents as possibly out of date: where a doc
and the code disagree, the code is the truth and the doc is a finding.

Project shape:

```
src/data/leagues/   18 league data files (RawClub[]), men's and women's
src/game/           76 pure engine modules: match sim, seasons, transfers,
                    money, media, rollover, monetisation, saves
src/ui/screens/     41 React screens
src/store.ts        zustand store: navigation, continue loop, live match playback
src/locales/        6 languages: en, fr, es, it, ja, af
```

### 5. Test every aspect

Twenty areas. Each has an exit criterion. Do not move on until you can state it
as met, or state precisely why it cannot be. Where a probe already exists, run
it and then go past it: your question is always "what would this probe not
notice?"

**A. The Gate itself.**
Run `./scripts/suite.sh all` on a clean tree at the baseline and record the
result before you change anything. Every FAIL, every SKIPPED, and every
reporter with no verdict is triage, not noise. Check the known gaps named in
`docs/testing.md` are still only those: `suite.sh fast` skipping the browser
half, the soaks in neither CI job, `staffprobe` dying under parallel load,
`storeart.mjs` having no verdict.
*Exit: a baseline table of every harness the suite runs, each PASS, FAIL or
SKIPPED, with a reason for every non-PASS, and a named list of anything in
`scripts/` that the suite never runs at all.*

**B. The first ten minutes.**
Start a career as a stranger would: the new game wizard, the manager, the
gender choice, the country, the competition, the club. Is it obvious what to
do? Can you reach a kick-off without reading anything? Is the first match
comprehensible? Does the handbook explain the right thing at the right time?
This pass decides refunds.
*Exit: a walkthrough with every point of confusion named, and the blocking ones
fixed.*

**C. Is it actually hard?**
Drive several full seasons at a strong club and a weak one. Then answer with
numbers: the win rate of a manager who does nothing but press Continue, against
one who uses every system well. If those are close, the systems are decoration.
Hunt dominant strategies: a tactic preset, a transfer loop, a training setting
that is simply correct every week. Prove the board can sack you and that
objectives are losable.
*Exit: a measured difficulty curve over at least three seasons and two club
tiers, and either no dominant strategy or a fix with a probe.*

**D. The match engine.**
`bandcheck` is the probe that decides whether a change to `matchEngine.ts` was
safe: four worlds, points, tries, home advantage, draws and blowouts all inside
tolerance. Then `disttest`, `dialweight`, `splitprobe`, `stackprobe`,
`blowprobe`, `fingerprint`. Test the laws the engine implements: scrum
(`scrumlaw`), law three and replacements (`lawthreeprobe`), set piece
(`setpieceprobe`), referee and card rates (`refprobe`, `whistleprobe`),
injuries, sin bins, red cards, uncontested scrums, blood replacements. Then the
qualitative half: does each of the six tactical dials move the result in the
direction its label promises, or do two of them decide everything? Do upsets
happen without being noise?
*Exit: every band inside tolerance on four seeds, each dial demonstrated, and
`fingerprint` either unchanged or rebaselined with a written reason.*

**E. Match day as a player sees it.**
Live text commentary, the pitch view, key event flashes, three playback speeds,
instant skip, the possession strip, the tension band, the replay. `dramaprobe`
reads the pixels: every ball position exactly `50 + momo * 30` nudged by whose
event it was, a one-score finish paced 1.3x slower than a rout, the tension
band only when the game is late and close. Test substitutions mid-match, a
player injured with no cover, a card that leaves you short, half time, extra
time, a draw in a knockout, and leaving the screen mid-match and coming back.
*Exit: no state a match can reach that the screen cannot render, and the drama
assertions holding on both a live match and a replay.*

**F. Squad, selection and training.**
Sortable squad tables, 1 to 20 attributes across 18 rugby-specific categories,
form, morale, condition, sharpness, injuries, bans. Selection and the team
sheet, the bench, positional fit, captaincy, roles, philosophy, the playbook,
training, mentoring, the analyst, the team report. Test an illegal team sheet,
an empty bench, a squad too small to field a side, every player injured at
once.
*Exit: no selection the game accepts that the match engine cannot play, and
every training and mentoring effect measurable over a season.*

**G. Transfers, contracts and the market.**
Bids in both directions, AI negotiation and haggling, auctions, free agents,
loans (asked for, given, recalled), transfer listing, contract renewals,
release, agents, scouting, the salary cap, wage and transfer budgets,
commission. Probes: `xferprobe`, `bidprobe`, `haggleprobe`, `auctionprobe`,
`dealprobe`, `loanprobe`, `loanaskprobe`, `renewprobe`, `scoutprobe`,
`capprobe`, `marketfuzz`, `wmarketprobe`. Test a bid you cannot afford, a
transfer on deadline day, selling your last hooker, an AI club outbidding you.
*Exit: no money created or destroyed by any transfer path, fees stable by era,
and the AI clubs shown to run real books.*

**H. The economy over a career.**
Twenty seasons. Wage inflation, transfer fee medians by era, club solvency,
board funding and grants, prize money, the salary cap's bite, commercial
income, the terraces, the venue, upkeep, debt, insolvency, the treasury.
Whether a good manager becomes unstoppably rich, and whether a bad one can
actually go under.
*Exit: no unbounded growth in any ledger over twenty seasons, and the user's
club solvent by playing well rather than by exploiting anything.*

**I. The season, and the calendar.**
Full league seasons with bonus points and playoffs, the 16-team Champions Cup
from pools to knockouts, requalification, the Six Nations, the Rugby
Championship and autumn internationals simulated around the player, call-ups
and the test windows that make your players unavailable, friendlies, the draw,
finals, the fixture list. Probes: `finalsprobe`, `pyramidprobe`, `tourprobe`,
`testweekprobe`, `friendlyprobe`, `pointsprobe`, `splitprobe`. Test promotion,
relegation, a league that ends level on points, a knockout that ends level.
*Exit: every competition completable for twenty seasons with a legal winner,
and no fixture a player is required to play that they cannot reach.*

**J. Rollover, and the long game.**
Close season, year end, ageing, retirements, regens, the academy intake,
awards, records, the roll of honour, legacy, national rankings. Twenty seasons
plus a deep save: save size and its growth curve, week-advance time fresh
versus late, news volume per week, ledger integrity, and whether the world
still makes sense in season twenty (plausible squads, records still breaking,
no league drifted).
*Exit: performance flat within 2x from season one, no ledger unbounded, world
coherent at season twenty.*

**K. Career and the board.**
Objectives, board confidence, the boss, the memo, authority, being sacked,
being hired, the job market across both worlds, applying, interviews, the CV,
resuming a career, unemployment, interest from other clubs. Probes:
`careerprobe`, `jobstest`, `jobsprobe`, `natjobprobe`, `sackprobe`,
`unemployedprobe`, `bossprobe`, `boardprobe`, `objprobe`, `hireprobe`,
`joboffer`.
*Exit: a career survivable and a career losable, with both demonstrated, and no
job state the game cannot leave.*

**L. The press and the world's voice.**
Journalists, questions, the right to reply and its effect on morale and board
confidence, the inbox, the wire, gossip, talking points, chats, the annual, the
season review, rivalries. Probes: `pressgate`, `pressroom`, `pressmigprobe`,
`newsprobe`, `wireprobe`, `gossip`-related, `inboxprobe`, `subjectprobe`,
`voiceprobe`, `varietyprobe`, `proseprobe`, `brevityprobe`, `newslength`.
Read a long career's news log end to end and ask whether season twelve reads
differently from season two.
*Exit: no repetition that a player would notice inside one season, no story
that names a player or club wrongly, and no placeholder reaching a screen.*

**M. The women's game.**
Six women's league files, a separate world with its own ids, kits, voice and
calendar. Test it as a full career, not as a mode: new game, a season, a
rollover, transfers between women's clubs, a coach moving between the men's and
women's game and keeping a CV, and the id separation that stops a men's club
appearing in a women's fixture. Probes: `womensui`, `womensvoice`, `wsoak`,
`wmarketprobe`, `genderprobe`, `mgrgender`, `maternityprobe`, `twinkit`.
*Exit: every criterion in areas F to L met a second time inside a women's
career, with the differences that are deliberate named and the ones that are
not fixed.*

**N. Saves, migration and the way out.**
IndexedDB save slots, autosave and its new cadence, export, import, the share
sheet backup, cloning, replay, resume. `savefuzz` (every damaged save healed or
refused, none throws), `migratetest`, `cloneprobe`, `replayprobe`,
`resumeprobe`, `backupprobe`, `backupreach`, `deepsave`, `savequeue`. Load
saves written before each recent feature existed. Corrupt the fields a save is
most likely to lose. Kill the app mid-week, mid-match, mid-transfer.
*Exit: no throw on any save, no non-finite value reaching any displayed or
multiplied figure, a pre-feature save that migrates and plays, and a career
proven to be able to leave the phone it lives on.*

**O. Hostile input.**
Feed every exported function NaN, Infinity, negatives, empty arrays and
garbage. Fuzz the market, the sheet, the save. The bar is not "it refuses": a
refusal is fine and a shrug is fine, but a throw, a NaN in a price or a score,
or a world that stops adding up is not.
*Exit: `fuzz2`, `fuzz25d`, `marketfuzz`, `sheetfuzz`, `savefuzz`, `chaosprobe`,
`breakit`, `stresstest` all green, with any new hole probed.*

**P. Money and the till.**
The four rules the till obeys: fails open, grants only on `owned`, handles all
five purchase endings, keeps the receipt out of the save. Play Billing,
StoreKit, rewarded video, the ad frame, the supporter screen, what a paying
player stops seeing. `moneyprobe`, `storeprobe`, `billprobe`, `tillprobe`,
`tillface`, `rewardedprobe`, `adsprobe`, `matchad`, `spendprobe`,
`grantprobe`. Test with no bridge, with a bridge, with a bridge that lies, and
on a fresh install with a previous purchase.
*Exit: no purchase path that can take money without granting, none that grants
without payment, no ad shown to anyone who has paid, and no network call
introduced by any of it.*

**Q. Privacy and IP.**
`netprobe` over every shipped file: fetch, XHR, beacons, sockets, third-party
SDK names, remote fonts, absolute URLs. `ipprobe` over the built bundle for the
121 marks, reading its rename table out of `save.ts`. These two are the whole
of the evidence behind the "no data collected" answer on both store
questionnaires and behind the game's right to ship at all.
*Exit: both green on a fresh build, and a sentence you would be willing to put
in front of a store reviewer.*

**R. Every screen, at the real dimensions.**
The game is played in portrait on a phone, in night mode. Audit all 41 screens
at 412x915 and at least two other geometries, in both themes, in the longest
language. Nothing clipped, nothing overlapping, no horizontal scroll, no wrap
that tears a row open, tap targets at least 44px, safe areas respected,
contrast legible in the dark, no dead controls. Open the screens that only
exist mid-match, between seasons or after a sacking. Probes: `tapsize`,
`geosweep`, `portraitqa`, `devicematrix`, `nightcontrast`, `contrastprobe`,
`colouraudit`, `densityaudit`, `stickyaudit`, `scrollaudit`, `overlapaudit`,
`textscale`, `sidescroll`, `motionprobe`, `e2e`, `e2enight`.
*Exit: a named list of every screen visited with its geometries, and zero
unexplained layout defects.*

**S. The words, in six languages.**
`i18nprobe` (every key the code asks for exists in English, every English key
exists in every translation, placeholders match on both sides), `langprobe`
(the picker on the title screen, repaint without navigation, the choice
surviving a reload, `<html lang>` following, the bottom nav fitting 412px in
the longest language), `keyscreen` (28 screens and every tab, roughly 4,900
rendered strings, failing on anything that is or looks like a dictionary key),
`langparity`, `englishprobe`, `frenchprobe`, `textlint`, `readslike`. Then read
the prose yourself: typos, tone, names rendered correctly, no developer voice,
no em dashes, and a handbook that describes the game as built rather than last
month's rules.
*Exit: parity across en, fr, es, it, ja and af, a clean prose sweep over twenty
seasons, and every handbook entry verified against the code that implements
it.*

**T. Accessibility, performance and the shell.**
Colourblind palettes, text scaling, reduced motion, contrast in both themes.
Tap-to-paint latency, frame pacing on the match screen, cold start, the PWA
install, offline play with the network switched off, the Android shell and its
Back behaviour, and whether `docs/store-listing.md` still describes the build
you have. Probes: `colourblind`, `skinprobe`, `skinui`, `perfprobe`,
`tapprobe`, `motionprobe`, `reloadprobe`, `resilience`, `backprobe`,
`shelllint`, `storeprobe`, `landingprobe`.
*Exit: the game usable with the largest text and reduced motion on, playable
with no network, and every store claim true of this build.*

**U. The things nobody has looked at.**
Ask what a hostile reviewer would open first, and open that. Then find the part
of this game no probe touches and no document mentions, and look at it. There
is always one.
*Exit: at least one finding that areas A to T would not have produced.*

### 6. Severity, and what you do about it

- **Blocker** - crash, data loss, stuck game, money taken without a grant, a
  real-world mark in the bundle, a network call. Fix immediately, probe it, and
  say so at the top of your report.
- **Major** - a system that does not do what it claims, a balance hole, a
  broken screen at the real dimensions, a false claim in the release notes. Fix
  in this pass.
- **Minor** - polish, wording, small layout. Fix if cheap, list if not.
- **Deferred** - out of scope by your judgement. Say why. It must be a reason,
  not a shrug.

Do not report cosmetic observations as findings. If you cannot reproduce it or
measure it, it is not a finding yet. If you find a system the game does not
have rather than a bug in one it does, that belongs in `docs/working-list.md`
with what it would cost, what it would unlock and what it would disturb.

### 7. What done looks like

Not a document alone. A pushed branch with a green Gate, plus:

1. Every Blocker and Major fixed, each with a probe demonstrated to fail on the
   old code and folded into `scripts/suite.sh`.
2. `./scripts/suite.sh all` green, including the long tier the default run
   skips (`soakhealth`, `soakui`, `stresstest`, `deepsave`, `e2edeep`,
   `releasesim`, `dialweight`), which is the tier that has historically hidden
   the real bugs.
3. The baseline table from area A, updated, so the next person knows what was
   red before you started.
4. A short, honest report: what was found, what was fixed, what moved that you
   did not intend to move, what you are deliberately leaving, and which of the
   four 1.6.2 claims survived verification. Lead with the worst thing you
   found, not the most impressive thing you did.
5. `docs/testing.md` updated if you added a harness or changed a tier, and
   `docs/audit-handoff.md` updated with any lesson that cost you an hour.

### 8. Order of work

1. Area A, the baseline, before you change a line. You cannot report a
   regression without it.
2. Section 2, the four 1.6.2 claims. A false release note is a Blocker.
3. Areas R and B, dimensions and the first ten minutes, because they are what a
   stranger sees first and the defects there are the ones that get refunds.
4. Areas Q and P, privacy, IP and the till, because they decide whether the
   build may ship at all.
5. Then D through O in order, then S and T, then U.

Work in small commits with real messages, push often, and keep the Gate green
on every push. If a run takes forty minutes, start it and work on something
that does not touch `src` or `scripts` while it runs.
