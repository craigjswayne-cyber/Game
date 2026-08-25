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

**The match, as it looks** — `dramaprobe` drives a real match and reads the
pixels the renderer produced: every ball position is exactly the territory model
(`50 + momo * 30`, nudged by whose event it was) to a hundredth of a percent,
and is nothing like the clock sawtooth it replaced in v1.1.1; a one-score finish
is paced 1.3x slower than a rout on the wall clock; the tension band appears
only when the game is late **and** close. The last three assertions run on a
replay — at full time the cursor is wound back and the tail re-revealed with
rewritten scores, so one real match can be both a nail-biter and a rout without
the engine being touched. See `docs/match-drama.md`.

**Words on screens** — `keyscreen` opens the game and walks 28 screens and every
tab in both languages, reading roughly 4,900 rendered strings and failing on any
that is, or looks like, a dictionary key. It reads no code, on purpose: the bug
it was written for (`tactics.sliderDefLineLo` on the Tactics screen, found live
by the owner) was invisible to both `i18nprobe` and `keyprobe` because the key
existed, the table was right, and the unwrapped read was a plain property rather
than a call.

**Language** — `i18nprobe` (every key the code asks for exists in English, every
English key exists in every translation, and the placeholders match on both
sides) and `langprobe` (the picker is on the title screen under the text size,
switching repaints without navigation, the choice survives a reload, `<html
lang>` follows, and the bottom nav and submenus still fit 412px in the longer
language). See `docs/i18n.md`.

**IP** — `ipprobe` greps the shipped bundle for 121 real club, competition,
sponsor, venue and governing-body marks. It reads the rename table out of
`save.ts` rather than keeping its own copy. Case-insensitive on purpose (SIX
NATIONS shipped once, in caps) and anchored at a word boundary, because without
the anchor `world.infRankLine` reads as "franklin" and fails the deploy over a
translation key.

**Money and privacy** — `netprobe` sweeps every shipped file for fetch, XHR,
beacons, sockets, third-party SDK names, remote fonts and absolute URLs, which
is the whole of the evidence for the "no data collected" answer on both store
questionnaires. `moneyprobe` holds the four rules the till obeys: fails open,
grants only on `owned`, handles all five purchase endings, keeps the receipt out
of the save. `storeprobe` runs the built game in a browser — no purchase door
and no ad frame without a bridge, a working one with a bridge injected the way a
wrapper injects it, a restore at boot on a fresh install, and no ad for anybody
who has paid. See `docs/monetisation.md`.

**The way out** — `backupreach` checks that a career can leave the phone it
lives on: the share sheet is offered where the browser can take a file, what it
is handed is a real save (named, typed, parsing, 6,583 players, the manager's
own name), Export still works where sharing is not possible, and backing out of
the sheet is not reported as a failure. This is the only insurance a player has
against a lost device, so it is worth more than it looks.

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
- **`storeart.mjs` is not a probe** and has no verdict: it writes the store
  screenshots, the feature graphic and the App Store icon into `storeart/`. Run
  it before a submission and look at what it produced — it walks a real career,
  so a screen that is broken in a new build is broken in the picture.
