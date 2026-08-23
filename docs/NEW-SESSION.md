# Start here: everything a new session needs

Read this first, then `docs/audit-handoff.md` for the deep technical history.

## The project

**PHASE: Rugby Manager** - a rugby union management PWA. React + TypeScript +
Vite + zustand. Repo `craigjswayne-cyber/game`, working dir `/home/user/Game`.
Deployed to GitHub Pages at https://craigjswayne-cyber.github.io/Game/.

Played on a Samsung Android phone, **portrait**, **night mode**. That is the
target: not a desktop, not landscape.

## Where things stand right now

| | |
|---|---|
| Branch (all work) | `claude/rugby-manager-mobile-app-rk7yz1-m54m3g` at `2b07a45`, **v1.0.2** |
| `main` (what deploys) | `d9d0aae`, **v1.0.1**, tagged locally `v1.0.1` |
| Live game | still v1.0.1 - v1.0.2 has NOT been deployed and must not be until signed off |

**Deploying = fast-forwarding `main`.** There is standing permission to do that
for finished work, but v1.0.2 is explicitly held back.

## The rules (these are hard)

1. **Develop only on** `claude/rugby-manager-mobile-app-rk7yz1-m54m3g`. Never
   push another branch without asking.
2. **No em dashes in game text.** `scripts/textlint.ts` enforces it. Chat is
   exempt.
3. **No hex colours outside `src/ui/tokens.css`.** `scripts/tokenlint.ts`
   enforces it; `src/data` is exempt (club colours are data).
4. **Every fix ships with a probe demonstrated to FAIL on the old code**, via a
   git worktree at the pre-change commit with
   `ln -sfn /home/user/Game/node_modules`. Browser probes also need
   `npm run build` in the worktree, and check `pgrep -af "vite preview"` first -
   a leaked preview once served the wrong dist and produced a false green.
5. **Every balance dial mean-neutral BY MEASUREMENT**, paired seeds. New
   systems use deterministic `mulberry32` on seed/id hashes, never the shared
   match rng. If `scripts/fingerprint.ts` moves, that is a deliberate
   rebaseline and needs four-seed balance evidence in the same commit.
6. **Commits end exactly with** (use `git commit -F <file>`):
   ```
   Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01D5JwUfscxMRoNWmuWZ4J1o
   ```
   No model name in commits, PRs or code comments.
7. **Never invent player data.** Wikipedia and premiershiprugby.com are
   egress-blocked; the user's screenshots are the only trusted squad source.
   (Web *search* works; page *fetch* does not.)

## Commands

```bash
bash scripts/suite.sh fast     # ~109 probes, engine + lint          (~25 min)
bash scripts/suite.sh          # adds the browser probes
bash scripts/suite.sh all      # adds five long soaks                (hours)
npm run build && npx vite-node scripts/iplint.ts    # the IP tripwire
npx vite-node scripts/fingerprint.ts                # sim determinism
```

Positional arg - **without `all` it silently skips the long probes.**

Never edit `src/` or `scripts/` while a suite runs. Foreground `sleep` is
blocked: use `timeout N tail -f /dev/null`, or `setsid nohup ... & disown` plus
a Monitor.

Deploy verification must MATCH THE SHA - the `actions_list` MCP result always
overflows, so read the saved file:
`jq -r '.workflow_runs[0] | [.id, .head_sha[0:7], .status, .conclusion] | @tsv'`

Remote **refuses tag pushes** (403 on `refs/tags/`). Tags are local only.

## What v1.0.2 is: the IP rename for a commercial release

The owner is preparing to sell the game. Decisions already taken:

- **Club names = the city.** Bath, Bristol, Leicester, Northampton. No
  nicknames. 13 clubs share a city so they take their ground's locality.
- **Competitions = generic-descriptive.** English Premier Division, French
  Elite 14, Celtic & Africa Super League, European Club Cup, The Continental
  Shield, European Nations Championship, Southern Nations Championship, The
  World Championship, The Islands Cup, The Pacific Championship, Japan Elite
  League, English Second Division, English National Division, French Division 2.
- **Grounds = location-based**, in the naming shape of each rugby culture
  (Bath Lane, Stade Toulouse, Christchurch Oval, Chofu Field).
- **Player names UNCHANGED** - ~1,600 real names ship, by the owner's decision.
- **Harlequins and Saracens keep their real names** - the owner's call, made
  after being told they are the two remaining club trademarks.

Full table: `docs/ip-rename-plan.md`. Tooling:

- `scripts/rename-map.ts` - the real-to-fictional table. **Lives in `scripts/`
  deliberately**: Vite bundles only `src/`, so the real marks never ship while
  staying available to tooling.
- `scripts/rename-apply.mjs` - rewrites the data. Verifies against the table
  and exits non-zero rather than reporting a number.
- `scripts/rename-prose.mjs` - rewrites marks written into game prose.
- `scripts/iplint.ts` - **scans `dist/`, not `src/`** (comments are stripped at
  build). Fails if any of 230 guarded marks ship. In the suite.

### The risk the owner has accepted, having been told once

Renaming leagues and grounds reduces trademark exposure. **The ~1,600 real
player names plus Harlequins/Saracens remain the larger exposure** for a paid
release - name and likeness rights are what Football Manager licenses. The
owner knows and has decided. Do not re-litigate it; the architecture makes
switching players a one-flag change if they ever want it.

## Open right now

1. **`scripts/deepsave.json`** is a generated 12-season fixture still holding
   pre-rename club names. Regenerate it (`npx vite-node scripts/deepsave.ts`);
   it feeds the slow probes.
2. **Full `bash scripts/suite.sh all`** has not been run since the rename.
3. Then, when the owner signs off: deploy by fast-forwarding `main`.

## Traps this codebase has already taught us

- **A probe that measures a CALENDAR breaks on any balance change.** Four did:
  they assumed a sleepwalking manager keeps his job. He does not any more.
  Hold the board off with `boardConfidence` when employment is not the thing
  under test.
- **A new mechanic producing a legal-but-novel value trips old sanity checks.**
  Administration's -10 points tripped three. Teach the invariant, never weaken
  it.
- **Anything added to player event credit reaches FORM**, which drives the
  auto-picker, which changes selection and results. Keep collective verdicts
  out of `own` in matchEngine.
- **Measure the distribution before picking a threshold on it.** A rebuild
  trigger at mean squad age 28.6 fired for one club in a hundred; the real
  median is 26.2.
- **`.test()` on a `/g` regex advances `lastIndex`** and will eat the match your
  `.replace()` was about to make.
- **Club/competition names are STORED IN THE SAVE**, not read from data at
  render time. Any rename needs a migration in `save.ts` or existing careers
  keep the old names.
- Two audit findings of mine did not survive measurement (regen "inflation",
  the real-cover "gaps"). Both were reading a changing population as a defect.
  They are written up in `docs/audit-handoff.md` so nobody re-fixes them.

## Style

The user prefers dense, well-commented code that explains WHY, and commit
messages that read as prose. Prefer Bash (`grep`, `sed`, python heredocs) over
the Read/Edit/Write tools. Be direct; flag real problems once, then get on with
the work they asked for.
