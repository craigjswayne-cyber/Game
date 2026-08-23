# Testing

There are ~112 harnesses in `scripts/`. This says how to run them, what each
tier is for, and what they do and do not cover — the last part matters, because
several of the gaps found in August 2026 were harnesses that looked like
coverage and were not.

## Running them

```bash
./scripts/suite.sh fast     # engine probes only, no browser   (~18 min)
./scripts/suite.sh          # fast + the browser harnesses     (~40 min)
./scripts/suite.sh all      # everything, soaks included       (hours)
```

Every line is PASS or FAIL with the harness's own last line, and the exit code
is the number of failures. Reporters with no verdict are listed at the end as
SKIPPED, by name, so nothing is quietly left out.

One harness on its own:

```bash
npx vite-node scripts/bandcheck.ts     # engine probes are TypeScript
node scripts/tapsize.mjs               # browser harnesses are .mjs
```

The browser harnesses need a build (`npm run build`) and Chromium. They find it
at `/opt/pw-browsers/chromium` by default and honour `PW_CHROMIUM` when it is
somewhere else, which is how they run on a CI runner:

```bash
export PW_CHROMIUM=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
```

## What runs automatically

`.github/workflows/ci.yml` — **Gate**:

| job | when | what |
|---|---|---|
| Engine probes | every push, every PR | typecheck, textlint, tokenlint, cssaudit, **ipprobe**, `suite.sh fast` |
| Browser harnesses | `main`, and 03:00 UTC nightly | a build, then the full `suite.sh`; screenshots kept as an artifact on failure |

`.github/workflows/pages.yml` — the deploy runs the typecheck, the engine suite
and ipprobe **before** publishing. `main` cannot ship a red build.

Before August 2026 nothing ran any of this: the only workflow built the game and
deployed it, and every green gate the project had ever passed was passed because
somebody remembered to type the command.

## The tiers, and what each is actually for

**Linters** (seconds) — `textlint` (house style: no em dashes, no mojibake, no
`.short}'s` possessive), `tokenlint` (colour only in `tokens.css`), `cssaudit`
(every token resolves, every `vh` has a `dvh` companion), `shelllint`.

**Calibration** — `bandcheck` is the one that decides whether a change to the
match engine was safe: four worlds, points/tries/home-advantage/draws/blowouts
all inside tolerance. `disttest`, `dialweight`, `splitprobe`, `stackprobe` and
`blowprobe` hold the dials, the roles and the extremes.

**The fingerprint** — `fingerprint.ts` holds six fixed-seed scores exactly. It
fails on ANY change to the sim stream, including deliberate ones, and the ritual
when it fails is: work out whether the change was mechanical, run `bandcheck`
first, and if the bands hold, rebaseline **in the same commit** with a comment
saying what moved and why. The file is a history of those decisions and is worth
reading before changing anything in `matchEngine`.

**Data** — `dataaudit` (relocations land, additions land, captains wear the
armband, namesakes are split on shirt and age), `namedup` (no generated player
wears a real one's name), `saintscheck`, `worldcheck`.

**Save integrity** — `savefuzz` (every damaged save healed or refused, none
throws), `migratetest`, `cloneprobe`, `replayprobe`, `resumeprobe`, `backupprobe`.

**Browser** — `tapsize` and `geosweep` (44px targets across 32 screens at three
widths), `portraitqa` and `devicematrix` (overflow, truncation, unreachable
content, six geometries), `nightcontrast` (contrast in **both** themes), `e2e`
(the whole flow end to end), `motionprobe`, `subreach`, `replyreach`.

**IP** — `ipprobe` greps the shipped bundle for 121 real club, competition,
sponsor, venue and governing-body marks. It reads the rename table out of
`save.ts` rather than keeping its own copy.

## Writing a probe that is worth having

Five lessons, each of them paid for:

1. **A probe that measures nothing must fail.** `nightcontrast` wrapped its
   measurement in a bare `catch`, so a syntax error made every screen return
   early and it reported PASSED on 0 runs of text. It now fails below 400.
2. **A probe that cannot fail is a walkthrough.** `e2e` drove the entire game
   and had no assertions, exiting 0 from a `finally`. Green through every
   regression in the August 2026 round.
3. **Don't bound a loop with a number.** `annualprobe` had its iteration budget
   raised twice and ran out silently both times, reporting a fault in a healthy
   page. Bound it by progress: keep going while the clock moves, stop when it
   stalls.
4. **Give a statistical assertion enough sample.** `difficultyprobe` measured
   its headline gap over three seeds; it swung between 4.0 and 17.3 across four
   consecutive commits and reported variance as a regression. Nine seeds settled
   it at 12.6.
5. **Assert the property, not a perfect record.** The same probe demanded an
   engaged manager survive all six seeds. A hard zero broke the first time the
   world's composition moved. The property was comparative all along: sacked
   less often than the sleepwalker, and rare.

## Known gaps

- **`suite.sh fast` does not run the browser harnesses.** That is the mode most
  rounds use, and it is how a rename broke 42 browser probes for a fortnight
  without anyone seeing it. CI runs the browser half on `main` and nightly;
  run the full suite yourself before anything that touches the UI.
- **The soaks are not in either CI job** (`soakhealth`, `soakui`, `stresstest`,
  `deepsave`, `e2edeep`, `releasesim`). They take hours. Run `suite.sh all`
  before a release that matters.
- **`staffprobe` occasionally reports FAIL with a passing last line** under
  parallel load — it prints its verdict and then does not exit, and the timeout
  wrapper records the kill. It passes standalone. Not yet fixed.
