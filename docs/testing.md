# Testing

`scripts/` holds about 420 TypeScript and `.mjs` files. As of 1.9.1 every one
of them is either in a `scripts/suite.sh` list, named as a tool, or a library,
and `scripts/orphancheck.mjs` fails the Gate when a new one is none of those.
The counts:

| group | how many | where it is listed | how it runs |
|---|---|---|---|
| engine probes | 275 | every top-level `scripts/*.ts` (the glob) | `npx vite-node`, 15 min timeout (30 for `LONG`) |
| browser harnesses | 102 | `BROWSER` in `suite.sh` | `node`, against a build and `vite preview` |
| soaks and audits | 13 | `SLOW` in `suite.sh` | 90 min timeout each, weekly |
| reporters | 20 | `REPORTERS` in `suite.sh` | never: no verdict, run by hand |
| unit tests | 9 files | `tests/*.test.ts` | `npm test` (vitest) |
| tools and libraries | 18 | `TOOLS` and `LIBRARIES` in `orphancheck.mjs` | by hand, or imported |

This page says how to run them, what CI runs where, and which probes cover
which part of the game.

## Running them

```bash
./scripts/suite.sh fast     # linters, unit tests, engine probes      (~2 h as 4 parallel shards on 4 cores)
./scripts/suite.sh browser  # linters, build, the 102 browser harnesses (~2 h)
./scripts/suite.sh smoke    # linters, build, e2e storeprobe backupreach keyscreen (~6 min)
./scripts/suite.sh pr       # linters, build, the 25 PRBROWSER harnesses (the second PR job)
./scripts/suite.sh soak     # linters, build, the SLOW list            (hours)
./scripts/suite.sh area save  # one part of the game: save money match rollover fuzz ui i18n a11y ip
./scripts/suite.sh          # fast + browser
./scripts/suite.sh all      # fast + browser + SLOW
```

Every line is PASS or FAIL with the harness's own last line, and the exit
code is the number of failures. A harness fails if it exits non-zero **or**
if it prints a line that starts with `FAIL`, or a verdict in capitals ending in
`FAILED`, whatever its exit code (1.9.1: two probes printed `PROBE FAILED` and
exited 0 for months). The last line is a JSON summary for machines:
`SUITE-SUMMARY {"result":"PASS",...}`.

Sharding, the same in CI and locally:

```bash
SHARDS=8 SHARD=3 ./scripts/suite.sh fast        # every 8th engine probe, from the 3rd
BSHARDS=3 BSHARD=1 ./scripts/suite.sh browser   # every 3rd browser harness
SSHARDS=7 SSHARD=2 ./scripts/suite.sh soak      # every 7th soak
PROBE_QUICK=1 ./scripts/suite.sh fast           # the smaller samples CI uses
```

One harness on its own:

```bash
npx vite-node scripts/bandcheck.ts     # engine probes are TypeScript
node scripts/tapsize.mjs               # browser harnesses are .mjs (after npm run build)
npx vitest run tests/migrate.test.ts   # one unit test file
```

The browser harnesses need a build (`npm run build`) and Chromium. Each
serves the build with `vite preview` on a free port (`startPreview` in
`scripts/lib/preview.mjs` binds to port 0 and returns the URL), so two
harnesses, two worktrees or two terminals run side by side without taking
each other's port. `PREVIEW_PORT=4173` pins one, to keep a server at a known
address. The guard that the server answering serves this checkout's bundle
stays: a harness never grades another build. They find
it at `/opt/pw-browsers/chromium` by default and honour `PW_CHROMIUM` when it
is somewhere else, which is how they run on a CI runner:

```bash
export PW_CHROMIUM=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
```

## Unit tests (vitest)

`npm test` runs `vitest run` with one project, `unit` (`vitest.config.ts`),
over `tests/**/*.test.ts`: fast, deterministic, no browser, about a minute.

| file | what it holds | was |
|---|---|---|
| `tests/fingerprint.test.ts` | the six fixed-seed scores | reads `EXPECTED` from `scripts/fingerprint.ts`, which is still a probe |
| `tests/migrate.test.ts` | old saves migrate, heal and keep | `scripts/migratetest.ts` (ported, removed) |
| `tests/refund.test.ts` | the till and the store agree on refunds | `scripts/refundprobe.ts` (ported, removed) |
| `tests/determinism.test.ts` | eight weeks with a save and load each week match eight without | short form of `scripts/reloaddetprobe.ts` |
| `tests/savequeue.test.ts` | a burst of marks is one write, never two in flight, never a half-played match; a failed write raises the banner | the engine half of `scripts/savequeue.mjs` |
| `tests/settleweek.test.ts` | a week that throws half way is not saved, the career goes back to disk, the same week twice holds the writer | core of `scripts/settleguardprobe.ts` |
| `tests/spend.test.ts` | a credit is spent on its effect once, given back on every failure, and the career is on disk at the answer | core of `scripts/spendprobe.ts` |
| `tests/pledge.test.ts` | `pledgeDue` never falls due before a promise is made; `carryPledges` carries only last season's late one | the arithmetic of `scripts/pledgeprobe.ts` |
| `tests/listsaves.test.ts` | the Load screen reads labels, labels old slots, reads no career, deletes labels with saves | `scripts/listsavesprobe.ts` |
| `tests/savehostile.test.ts` | the import gate: ids named after Object.prototype refused, a damaged players map pruned, body fields, positions and records healed, a pre-MRC save migrates the same twice, five round trips equal one | new (1.9.4 audit) |
| `tests/saveswitch.test.ts` | opening another career writes the outgoing one's last marks to its own slot, never mid-match | new (1.9.4 audit) |
| `tests/condband.test.ts` | a condition's colour band is read off the figure printed beside it (84.6 shows 85% and is green) | new (1.9.4 audit) |

New fast, deterministic checks belong here rather than in a new probe. Watch
mode while working: `npx vitest`. vitest 4.1 runs on the repo's Vite 8, the
same Vite the build and `vite-node` 6 use. (vitest 5 needs Node 22.12; CI is on
Node 20.)

## What runs automatically

`.github/workflows/ci.yml`, **Gate**:

| job | when | what |
|---|---|---|
| Engine probes (8 shards) | every push, every PR, nightly | typecheck, textlint, tokenlint, cssaudit, accessibility lint (`npm run lint`), **orphan check**, `npm test` (shard 1), build, **ipprobe**, `suite.sh fast` with `PROBE_QUICK=1`. 25 to 40 min a shard, 55 min ceiling |
| Browser smoke | pull requests, and pushes to any branch but `main` | build, Chromium, `suite.sh smoke`. About 6 min plus the Chromium install, 30 min ceiling |
| Browser, PR set (3 shards) | the same | build, Chromium, `suite.sh pr`: the 25 `PRBROWSER` harnesses (accessibility, save and load, purchases, the match screen, phone layout), eight or nine a shard, 40 min ceiling |
| Browser harnesses (3 shards) | `main`, 03:00 UTC nightly, manual | build, Chromium, `suite.sh browser`. About 40 min a shard, 75 min ceiling; screenshots kept on failure |

`.github/workflows/soak.yml`, **Soak**: Sundays at 04:00 UTC and on demand,
`suite.sh soak` in seven shards (at most two of the 90-minute soaks each, so
three hours at worst inside the 300 min ceiling). A workflow of its own
because the Gate cancels itself on a new push to the same ref, which would
throw away a soak hours in. On its own schedule it is advisory.

`.github/workflows/release-check.yml`, **Release check**: by hand only
(Actions, Run workflow, give it a tag, branch or SHA). The seven soak shards
and the whole browser list in four shards, on that ref. **A release is cut
only after the release check is green on the release commit**, with the Gate
green on the same commit; `docs/release-readiness.md` (addendum of
2026-10-17) records the rule.

`.github/workflows/pages.yml`, **Deploy to GitHub Pages**: runs when a Gate run
for a push to `main` **completes successfully** (`workflow_run`), checks out
that run's exact `head_sha`, and then still runs its own typecheck,
`landingprobe` and `ipprobe` before publishing. A red Gate deploys nothing;
before 1.9.1 the deploy ran beside the Gate and could publish a commit the Gate
then failed.

## The orphan check

`node scripts/orphancheck.mjs` (seconds; in the Gate and in every
`suite.sh` mode) fails when:

- a `scripts/**/*.ts` or `.mjs` is in no suite list (top-level `.ts` files are
  covered by the engine glob) and not in `TOOLS` or `LIBRARIES` in the script;
- a name in a `suite.sh` list has no file behind it;
- a `TOOLS` or `LIBRARIES` entry no longer exists.

A new harness with a verdict goes in a `suite.sh` list in the commit that adds
it. A tool with no verdict (screenshots, art, a build step, a comparison for a
person to read) goes in `TOOLS` with a word on why. `uiqa`, `onefile`,
`storeart` and `ipadshots` are tools; `paletteqa`, `iconshots` and `tidyshots`
have verdicts and are browser harnesses.

## Which probes cover what

Where to start for each part of the game. Browser harnesses are marked (b),
soaks (s), unit tests (u). The lists are the `AREA_<name>` lists in
`scripts/suite.sh`, and `./scripts/suite.sh area <name>` runs one (soaks
only with `AREA_SOAKS=1`). `orphancheck` fails when a row here and its list
disagree, when a name has no file, or when a name is a reporter: `summertest`,
`disttest` and `dataaudit` print numbers and have no verdict, so they cover
nothing and are not listed.

| area | probes |
|---|---|
| **Save and load** (`save`) | `savefuzz` (every damaged save healed or refused), `migrate.test` (u), `savequeue.test` (u: a burst of marks is one write, never two in flight, never mid-match, a failed write raises the banner), `settleweek.test` (u: a week that throws half way is never saved and the career goes back to disk), `listsaves.test` (u), `savedetprobe` and `reloaddetprobe` (a save and load every week changes nothing), `determinism.test` (u), `cloneprobe`, `replayprobe`, `resumeprobe`, `backupprobe`, `importprobe`, `listsavesprobe` (the Load screen reads labels, not careers), `settleguardprobe`, `personaprobe` (the store driven for two seasons, with and without a reload every week), `deepsave` (s), `savequeue` (b), `reloadprobe` (b), `resilience` (b), `backupreach` (b) |
| **Purchases and money** (`money`) | `moneyprobe` (the till's four rules), `refund.test` (u), `spend.test` (u: one credit, one effect, on disk), `tillprobe`, `creditprobe`, `spendprobe`, `billprobe`, `rewardedprobe`, `netprobe` (nothing phones home), `storeprobe` (b), `purchasestate` (b: what was bought stays bought through reload, language, import, new career and reinstall), `proprompt` (b), `exportui` (b) |
| **Match simulation** (`match`) | `fingerprint` and `fingerprint.test` (u), `bandcheck` (the calibration gate), `engine10k` (ten thousand matches against the rules), `simtest`, `splitprobe`, `blowprobe`, `scrumlaw`, `packprobe`, `forfeitprobe`, `perfprobe` (speed, relative to the machine), `dialweight` (s), `stackprobe` (s), `dramaprobe` (b: the match as it looks) |
| **Season rollover** (`rollover`) | `rolloverprobe` (tables reset, a new fixture list, champions in the roll of honour, contracts and players a year on), `calinvariant`, `invariants`, `closeprobe`, `seasonplanprobe`, `pledgeprobe` and `pledge.test` (u) (no promise falls due before it is made), `runtimematrix` (s: fifteen seasons, three seeds, both worlds), `releasesim` (s), `soakhealth` (s) |
| **Exploits and fuzzing** (`fuzz`) | `actionfuzz` (every user action in any order), `marketfuzz`, `sheetfuzz`, `fuzz2`, `fuzz25d`, `breakit`, `breaker` (b), `chaosui` (b) |
| **UI** (`ui`) | `e2e` (b: the whole flow), `portraitqa` (b), `devicematrix` (b), `overlapaudit` (b), `scrollaudit` (b), `stickyaudit` (b), `uiqaprobe` (b), `paletteqa` (b), `iconshots` (b), `tidyshots` (b), `cssaudit`, `tokenlint` |
| **Words and languages** (`i18n`) | `textlint`, `i18nprobe`, `keyprobe`, `frenchprobe`, `englishprobe`, `langparity`, `frliveprobe`, `langprobe` (b), `keyscreen` (b: 28 screens in both languages, no raw keys) |
| **Accessibility** (`a11y`) | `a11yprobe` (b), `smalltype` (b), `tapsize` (b) and `geosweep` (b) (44 px targets), `textscale` (b), `nightcontrast` (b) and `contrastprobe` (b) (contrast in both themes), `colouraudit` (b), `colourblind`, `motionprobe` (b: reduced motion), `tapcontrols` (b). Not in the area run: `npm run lint` (eslint jsx-a11y over `src/ui`), which every mode's linters run |
| **IP** (`ip`) | `ipprobe` (b: the build carries no real club, competition, sponsor or venue mark), `namedup` |

## The fingerprint

`scripts/fingerprint.ts` holds six fixed-seed scores exactly. It fails on ANY
change to the sim stream, including deliberate ones, and the ritual when it
fails is: work out whether the change was mechanical, run `bandcheck` first,
and if the bands hold, rebaseline **in the same commit** with a comment saying
what moved and why. The file is a history of those decisions and is worth
reading before changing anything in `matchEngine`. `tests/fingerprint.test.ts`
reads the same baseline, so there is one place to change it.

## perfprobe is relative

`perfprobe` used to hold a fresh week to a fixed 215 ms, which failed about one
run in three on a slower container with nothing changed. Since 1.9.1 it times a
calibration workload (plain JavaScript, no game code) interleaved with the
work, and each budget is a ratio to it: the reference ratio measured on the dev
container, times 1.5. A slow machine slows both sides; a genuine 2x regression
in the engine fails. `PERF_SLOWDOWN=2 npx vite-node scripts/perfprobe.ts` shows
it failing. A deliberate cost is rebaselined in the file with a line saying what
moved.

## Writing a probe that is worth having

Seven lessons, each of them paid for:

1. **The verdict is the exit code.** Use `ok`, `check` and `done` from
   `scripts/lib/probe` (`./lib/probe` in an engine probe, `./lib/probe.mjs`
   in a browser harness, with `done(name, passed, { exit: true })` so a
   browser or a preview server cannot hold the process open). 202
   probes moved onto it in 1.9.2 (`scripts/tools/probemod.mjs`, which lists
   the ones it left alone and why). Printing FAILED is for the reader; `suite.sh` now
   catches a FAIL line too, but a probe should not rely on that.
2. **A probe that measures nothing must fail.** `nightcontrast` wrapped its
   measurement in a bare `catch`, so a syntax error made every screen return
   early and it reported PASSED on 0 runs of text. It now fails below 400.
3. **A probe that cannot fail is a walkthrough.** `e2e` drove the entire game
   and had no assertions, exiting 0 from a `finally`. Green through every
   regression in the August 2026 round. `scripts/qa/rollover.ts` was the same
   until 1.9.1.
4. **Wait for a condition, not the clock.** A fixed `waitForTimeout(600)` is
   wasted time on a quiet box and too short on a loaded runner.
   `until(page, fn, arg, timeout)` in `lib/preview.mjs` returns as soon as the
   page says what the next assertion reads, and gives up quietly so the
   assertion still decides. `startPreview` polls the server instead of
   sleeping three seconds.
5. **Don't bound a loop with a number.** `annualprobe` had its iteration budget
   raised twice and ran out silently both times, reporting a fault in a healthy
   page. Bound it by progress: keep going while the clock moves, stop when it
   stalls.
6. **Give a statistical assertion enough sample.** `difficultyprobe` measured
   its headline gap over three seeds; it swung between 4.0 and 17.3 across four
   consecutive commits and reported variance as a regression. Nine seeds settled
   it at 12.6.
7. **Assert the property, not a perfect record.** The same probe demanded an
   engaged manager survive all six seeds. A hard zero broke the first time the
   world's composition moved. The property was comparative all along: sacked
   less often than the sleepwalker, and rare.

## Known gaps

- **Not all of the browser half is on every PR.** The smoke job runs four
  harnesses and the PR set 25 more; the other 73 run on `main`, nightly and
  in the release check. Run `./scripts/suite.sh browser` yourself before
  anything that touches the UI broadly.
- **752 fixed `waitForTimeout` sleeps remain** in the browser harnesses
  (counted 17 Oct 2026, `grep -o waitForTimeout scripts/*.mjs`).
  The smoke set and the shared preview helper were converted in 1.9.1; convert
  the rest as each harness is next touched, with `until()`.
- **`storeart.mjs` is not a probe** and has no verdict: it writes the store
  screenshots, the feature graphic and the App Store icon into `storeart/`. Run
  it before a submission and look at what it produced: it walks a real career,
  so a screen that is broken in a new build is broken in the picture.
- **Purchases are only half testable here (1.8.18).** `refund.test`,
  `proprompt` and `exportui` drive the JavaScript side of billing and export
  against faked shells. The native halves (`PhaseBilling.java`,
  `PhaseBilling.swift`, the Share and Filesystem plugins) only run on a phone:
  the device record in `docs/launch/LAUNCH-PROGRAMME.md` (section 10) is the
  test for them, and it is run before every release that touches `packaging/`.
- **Save time on a real phone is not measured by any probe (1.8.18).** The
  whole career is one IndexedDB record, cloned on the main thread at every
  save. `soakhealth` fails if the twenty-season save passes 16 MB (it was about
  11 MB when the ceiling was set), and a dev build logs `[save] ... held the
  main thread N ms` on every write. A structured clone of a new-game save took
  about 75 ms on the CI-class container on 12 Oct 2026; the budget-Android
  figure late in a long career is still to be recorded here.
