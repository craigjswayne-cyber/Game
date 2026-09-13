# PHASE: Rugby Manager - repository audit prompt, baseline v1.6.2

A prompt for a code LLM with GitHub access. Three phases: audit the repository,
confirm the contents, then generate a master fix prompt for a second session.

Paste everything below the rule into a fresh session. Its sibling,
`docs/qa-prompt-v1.6.2.md`, is the variant that tests and fixes in one session
rather than handing the fixes on; its twenty coverage areas are referenced from
Phase 1 below and are worth reading alongside this.

---

## The prompt

You are performing an exhaustive, end to end code audit and architectural
evaluation of **PHASE: Rugby Manager**, a rugby union management game for
mobile, currently at **version 1.6.2 (Android versionCode 31)**. Leave no stone
unturned.

Work in three phases. Do not begin Phase 3 until you have presented the Phase 1
and Phase 2 analysis and had it read.

### 0. Before anything: the repository, the ref, and the tools

Repository: **`craigjswayne-cyber/Game`** (https://github.com/craigjswayne-cyber/Game),
already available to you through the GitHub MCP tools (`mcp__github__*`) and as
a local clone. Do not ask to be given access; confirm what you have and start.

**The baseline is not `main`.** As last checked:

| ref | version | note |
|---|---|---|
| `origin/main` | 1.5.6 | 71 commits behind |
| `claude/rugby-game-llm-prompt-ei0zyx` | **1.6.2** | release commit `5741ae9` and everything after |

Verify this yourself first, and say what you found:

```bash
git log --oneline -5
grep '"version"' package.json
git show origin/main:package.json | grep '"version"'
git rev-list --count origin/main..HEAD
```

If `main` has since moved to 1.6.2 or beyond, work from whichever ref actually
carries 1.6.2 or later and say so. An audit of the wrong ref cites line numbers
that do not exist in the build being shipped.

Set up before you read a line:

```bash
npm ci                                   # node_modules is not checked in
npm run build                            # tsc -b && vite build
export PW_CHROMIUM=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
```

Use `mcp__github__actions_list` and `mcp__github__get_job_logs` to read the
Gate's own runs rather than guessing what CI thinks. Commit your working notes,
any new probe, and your Phase 1 and Phase 2 findings to the designated branch
and push. The container is ephemeral; an audit that is not pushed did not
happen. Never push to `main`, never force-push, never open a pull request
unless asked.

### 1. The rules this codebase already pays for

Break one of these and your output is not merely wrong, it is unmergeable.

1. **Read the code, but judge by running the harnesses.** `scripts/` holds 191
   TypeScript engine harnesses and 70 `.mjs` browser harnesses, driven by
   `scripts/suite.sh` in three tiers (`fast`, default, `all`). Reading 59,110
   lines of `src` finds a fraction of what running them finds. The bug that
   prompted `keyscreen` (`tactics.sliderDefLineLo` rendering as a raw key on
   the Tactics screen) was invisible to two probes that read code, because the
   key existed and the table was right. Read `docs/testing.md` first: it says
   what each tier covers and, more usefully, what it does not.
2. **A finding needs a reproduction or a measurement.** If you cannot
   reproduce it or measure it, it is not a finding yet, it is an observation.
   Do not report cosmetic observations as findings.
3. **Treat a red probe as a claim about the probe until proven otherwise.** The
   running score in `docs/audit-handoff.md` is ten probe bugs to one engine
   bug. Instrument before you diagnose.
4. **Determinism is a feature.** Randomness derives from `mulberry32` over a
   seed or id hash, never from the shared match rng, and must not change
   match-stream draw counts. `scripts/fingerprint.ts` holds six fixed-seed
   scores exactly and fails on ANY change to the sim stream. An innocent
   "optimisation" inside `src/game/matchEngine.ts` silently rebalances the
   whole game. Any proposed change there must name `bandcheck` as its gate.
5. **House style, enforced by CI.** No em dashes anywhere in game-facing text
   or docs (`scripts/textlint.ts`). Colour only in `src/ui/tokens.css`
   (`tokenlint`). Every token resolves and every `vh` has a `dvh` companion
   (`cssaudit`).
6. **Three promises no recommendation may weaken.** The game is offline: no
   fetch, XHR, beacon, socket, third-party SDK, remote font or absolute URL
   anywhere in the bundle, and `scripts/netprobe.ts` fails the build if one
   appears. It collects nothing, which is the answer given on both store
   questionnaires. It reproduces nothing official: `scripts/ipprobe.mjs` greps
   the built bundle for 121 real club, competition, sponsor, venue and
   governing-body marks.
7. **Never touch `packaging/android/version.json`.** versionCode 31 is
   allocated and not yet spent. A code is spent by the first Play track that
   takes a bundle. Changing it costs real money and cannot be undone.
8. **Anchor every citation.** Give file path, exported symbol or component
   name, and a quoted snippet of the current code. Line numbers drift; quote
   enough that the fix session can find it with a search. Never cite a line
   number you have not read in this session.
9. **Report faithfully.** If a band drifts, give the number. If you skipped
   something, say what and why.

### 2. Phase 1: deep repository audit

Read the codebase, then exercise it. Present findings in four categories:
**Critical Fixes**, **Performance and Memory**, **Code Refactoring**,
**Logic and Edge Cases**.

**1a. Architecture.** Map it accurately rather than generically. What is
actually here:

```
src/data/leagues/   18 league data files (RawClub[]), men's and women's
src/data/           additions, captains, prospects, verified, kit trim
src/game/           76 pure engine modules: matchEngine, season, rollover,
                    schedule, transfers, money, media, saves, monetisation
src/ui/screens/     41 React screens
src/ui/audio.ts     synthesised WebAudio match sound, no audio assets
src/store.ts        zustand: navigation, the Continue loop, live match playback
src/locales/        6 languages: en, fr, es, it, ja, af
scripts/            261 harnesses plus scripts/lib and scripts/tools
```

React 18 plus zustand plus Vite, TypeScript, no test framework and no server.
**There is no canvas game loop**: the match is live text with a CSS-animated
pitch view, and `src/ui/theme.css` carries 163 animation and transform rules.
Map the execution flow that actually matters: the Continue loop in `store.ts`,
the week advance in `season.ts`, the match stream in `matchEngine.ts`, live
playback and its timers in `MatchDay.tsx`, and the save path in `save.ts`.

**1b. Code quality and performance.** Translate the generic checklist into what
this app can actually suffer:

- **Save write amplification.** 1.6.2 fixed twenty-six separate actions each
  rewriting an entire career to move a bookmark, which a tester felt as a one
  to two second tap delay (commit `d69f717`). Verify the fix holds: count
  writes per interaction, measure tap to paint on a fresh career and on a late
  career save, and confirm the other half of the claim, that nothing is saved
  less, only less often. Kill the app mid-session and show what is lost.
- **Timers and listeners.** The match playback timers in `MatchDay.tsx`, the
  `AudioContext` in `src/ui/audio.ts` (created once, resumed on demand), and
  any `setInterval` or subscription that outlives the screen that created it.
  Leaving a match mid-stream and returning is the case to drive.
- **Stale closures over zustand state**, and any selector that re-renders a
  dense screen on every tick. The squad tables and the match screen are where
  this is felt.
- **Async ordering, which is this app's version of a race.** The save queue
  (`scripts/savequeue.mjs`), autosave against an explicit save, export while a
  write is in flight, and a purchase resolving while the save is being written.
- **Asset weight.** There are no audio files; sound is synthesised. Check the
  bundle, the fonts (six `@fontsource` families are declared), and the images.

**1c. Bugs and edge cases.** Missing null checks, broken logic, boundary `<=`
against `<`, and non-finite values. Feed exported functions NaN, Infinity,
negatives and empty arrays. The existing fuzzers are `fuzz2`, `fuzz25d`,
`marketfuzz`, `sheetfuzz`, `savefuzz`, `chaosprobe`, `breakit`. The bar is not
"it refuses": a refusal is fine and a shrug is fine, but a throw, a NaN in a
price or a score, or a world that stops adding up is not.

**1d. Game design and logic integrity.** Balance, data structures, event
management, progression, and save integrity:

- **Balance measured, not felt.** Win rate of a manager who only presses
  Continue against one who uses every system well. If those are close, the
  systems are decoration. Hunt dominant strategies. Probes: `bandcheck` is the
  one that says whether a change to the engine was safe, then `disttest`,
  `dialweight`, `splitprobe`, `stackprobe`, `blowprobe`.
- **Progression over twenty seasons.** Rollover, ageing, retirements, regens,
  awards, records, prize money, promotion and relegation, Champions Cup
  requalification. Look for unbounded growth in any ledger, wage inflation, and
  whether the world still makes sense in season twenty.
- **Save and load integrity.** `savefuzz`'s bar is that every damaged save is
  healed or refused and none throws. Then `migratetest`, `cloneprobe`,
  `replayprobe`, `resumeprobe`, `backupprobe`, `backupreach`, `deepsave`.
  Specifically test the 1.6.2 week mapping migration (week 45 converted to week
  0, commit `18f0144`): a career written before it must migrate, play, and
  settle on the right week.
- **The till.** Four rules: fails open, grants only on `owned`, handles all five
  purchase endings, keeps the receipt out of the save. `moneyprobe`,
  `storeprobe`, `billprobe`, `tillprobe`, `rewardedprobe`, `adsprobe`. Test
  with no bridge, with a bridge, with a bridge that lies, and on a fresh
  install with a previous purchase.

**1e. The 1.6.2 claims.** The release copy promises players four things. A
release note that is false is a Critical Fix. Verify each: Back goes back
rather than closing the app (`d67a483`), the app answers a tap (`d69f717`),
purchases cannot be lost, and old careers land on the right week (`18f0144`).
Also that the possession strip animates on the compositor and not the main
thread (`02de1c6`).

**1f. What nothing covers.** Name the surfaces no harness touches. One is known
already: **no probe in `scripts/` mentions audio**, so `src/ui/audio.ts` and
haptics are untested. Find the others.

*Exit for Phase 1: a baseline run of `./scripts/suite.sh all` recorded before
you changed anything, every harness listed PASS, FAIL or SKIPPED with a reason
for each non-PASS, a named list of anything in `scripts/` the suite never runs,
and findings in the four categories, each reproduced or measured.*

### 3. Phase 2: confirm the contents and the data

**2a. Players, clubs, grounds.** Two separate questions, and the second is the
one that carries risk.

*Integrity:* roughly 1,600 players in the 2026-27 window across 18 league
files, relocations landing, additions landing, captains wearing the armband,
namesakes split on shirt and age, no generated player wearing a real one's
name, plausible ratings, no duplicate or orphan ids, every club with a legal
squad in every position. Probes: `dataaudit`, `namedup`, `saintscheck`,
`worldcheck`, `squaddiff`, `squadname`, `verified.ts`.

*Rights and sensitivity:* clubs, competitions, grounds and sponsors are
deliberately fictional and location-based; real ground capacities and colours
are used. Real player names ship unlicensed by the owner's explicit decision,
used to identify people in a sporting database, with a removal address in the
README. Your job is to confirm nothing has drifted back over the line: run
`ipprobe` on a fresh build, check `docs/sensitivity-audit.md` still describes
what ships, and flag anything that reads as an endorsement or an official mark.

**2b. The animation.** Judge it against the model it was built to, not against
taste. `docs/match-drama.md` is the specification and `dramaprobe` reads the
pixels the renderer produced: every ball position is exactly `50 + momo * 30`
nudged by whose event it was, to a hundredth of a percent; a one-score finish
is paced 1.3x slower than a rout on the wall clock; the tension band appears
only when the game is late and close. Then judge what the probe cannot: frame
pacing on a mid-range phone, whether the flash on a key event reads at a
glance, whether anything janks when the possession strip moves, and whether
`prefers-reduced-motion` genuinely collapses the motion rather than merely
shortening it. `src/ui/theme.css` has two `prefers-reduced-motion` blocks;
verify they cover all 163 animation rules.

**2c. The six languages.** Parity first, naturalness second, and the second is
what actually matters here.

*Parity, already probed:* `i18nprobe` (every key the code asks for exists in
English, every English key exists in every translation, placeholders match on
both sides), `langprobe` (the picker on the title screen, repaint without
navigation, the choice surviving a reload, `<html lang>` following, the bottom
nav fitting 412px in the longest language), `keyscreen` (28 screens and every
tab, roughly 4,900 rendered strings, failing on anything that is or looks like
a dictionary key), `langparity`, `englishprobe`, `frenchprobe`.

*Naturalness, not probed at all:* read the rendered strings in context, screen
by screen, in **en, fr, es, it, ja and af**, and judge whether a native speaker
would write them. English and French are the two the game was authored in and
are the safest; **es, it, ja and af are the ones most likely to be translated
rather than written**, and Japanese carries the extra load of register,
counters and line breaking in a narrow column. Look for: literal translations
of idiom, a register that slips between formal and familiar within one screen,
sports vocabulary that is not what the sport is actually called in that
language, placeholders that produce ungrammatical agreement once a real name or
number is substituted, pluralisation that only works in English, dates and
money in the wrong local form, and truncation at 412px. `docs/i18n.md` states
the rule for what follows the reader and what keeps its own language; check the
code obeys it. Report per language, and say plainly which ones you believe need
a native speaker rather than another pass from you.

*Exit for Phase 2: data integrity confirmed with the probe output quoted, the
rights position confirmed against a fresh build, the animation judged against
`docs/match-drama.md` and on a real device profile, and a per-language verdict
naming specific strings.*

### 4. Phase 3: the master fix prompt

Only after Phase 1 and Phase 2 have been presented and read.

Produce a single formatted code block containing a prompt for a fix session.
It must:

- Open with the repository, the exact ref and commit the audit was performed
  at, and the setup commands, so the fix session starts on the same code.
- Carry a high-level map of the architecture and the language setup, so the fix
  session has context without re-reading all 59,110 lines.
- Restate the nine rules in section 1 verbatim. A fix session that does not
  know about `fingerprint`, `textlint`, `netprobe`, `ipprobe` and version.json
  will produce work that CI rejects.
- Itemise every issue by severity:
  - **P0 Critical and game-breaking** - crash, data loss, stuck game, money
    taken without a grant, a real-world mark in the bundle, a network call, a
    false claim in the release notes.
  - **P1 High priority** - a system that does not do what it claims, a balance
    hole, a broken screen at 412x915 in night mode, a language a native speaker
    would reject.
  - **P2 Optimisation and cleanup** - polish, wording, small layout, dead code.
- For each issue give: file path, exported symbol or component, a quoted
  snippet of the current code, what is wrong, how it was reproduced or
  measured, the exact technical approach to fix it, and what it must not
  disturb.
- Require, for every P0 and P1, a probe placed in `scripts/` and demonstrated
  to fail on the pre-fix commit before the fix is believed, then folded into
  `scripts/suite.sh`.
- Name the gate each fix must pass before it is pushed: `bandcheck` for
  anything touching the engine, `savefuzz` and `migratetest` for anything
  touching saves, `moneyprobe` and `storeprobe` for the till, `ipprobe` and
  `netprobe` for anything touching the bundle, `keyscreen` and `i18nprobe` for
  anything touching strings, `tapsize`, `nightcontrast` and `portraitqa` for
  anything touching a screen.
- Ask for unified diffs or complete refactored blocks, small commits, a push to
  a named branch, and a green Gate on every push.
- End with the order of work: P0 first, then whatever a stranger sees in the
  first ten minutes, then P1, then P2.

Do not write the Phase 3 block until Phase 1 and Phase 2 are done. When you
present Phase 1 and Phase 2, lead with the worst thing you found rather than
the most impressive thing you did.
