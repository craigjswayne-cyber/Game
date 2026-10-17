#!/usr/bin/env bash
# ---- RUN EVERYTHING ----
#
# There are sixty-odd harnesses in here and for months the habit was to run about
# twenty of them. That is how subsprobe sat broken for two rounds (it pressed
# Continue once and waited for a Kick Off button that was several days away, after
# Continue went day by day) and how staffprobe sat failing on an assertion about
# six-week courses that had not existed for a while. Neither was in the per-round
# list, so "the suite is green" meant "the third of it I ran is green".
#
#   ./scripts/suite.sh fast     linters + engine probes, no browser
#   ./scripts/suite.sh browser  linters + build + the browser harnesses
#   ./scripts/suite.sh smoke    linters + build + four browser harnesses (the PR job)
#   ./scripts/suite.sh pr       linters + build + PRBROWSER, 25 more browser harnesses (the second PR job)
#   ./scripts/suite.sh soak     the SLOW list only, soaks and audits  (the weekly job)
#   ./scripts/suite.sh area A   the probes for one part of the game: A is one of
#                               save money match rollover fuzz ui i18n a11y ip
#   ./scripts/suite.sh          fast + browser
#   ./scripts/suite.sh all      everything, soaks included      (hours)
#
# Timings and what CI runs where are in docs/testing.md.
#
# Every line is PASS or FAIL with the harness's own last line, and the exit code
# is the number of failures. Reporting tools that have no verdict are listed at
# the end as SKIPPED, by name, so nothing is quietly left out.
set -uo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-default}"
FAILS=0
PASSES=0
FAILED_NAMES=""

# no pass/fail to give: these print numbers or write screenshots. perfrun is
# the release-to-release performance comparison (run in two worktrees).
REPORTERS="analysis leaguestrength gapreport icons shots qa-shots qa-shots2 newspeak boardprobe disttest loantest nattest summertest dataaudit squaddiff premmerge stancecheck womensvoice newsmix perfrun"
# minutes each, not seconds: only on request
# dialweight is here too (v1.2.2): a qualitative balance audit that sims
# ~290 paired seasons and alone took ten of the Gate's thirty minutes. Its
# own header calls it "release audit, Pass 2" - it runs in `all` and in the
# release deep test, not on every push.
# LONG: in the fast run, but given 30 minutes rather than 15. memoryloopprobe
# measures the rematch on 1,440 paired matches since 1.8.16, and frliveprobe
# plays every line in French; both finish in 12 alone and ran past 15 under a
# four-shard load. analystprobe joined them in 1.9.1: 13.7 minutes under a
# four-shard load on a four-core box, printing its verdict as the 15-minute
# timeout killed it.
LONG="memoryloopprobe frliveprobe analystprobe"
# runtimematrix (1.9.1, was scripts/qa2/matrix.ts): fifteen seasons on three
# seeds in each world with every invariant checked every season.
SLOW="soakhealth soakui stresstest deepsave e2edeep releasesim dialweight optionsprobe autopilotprobe aiecon stackprobe distressprobe runtimematrix"
# THE PR SMOKE (1.9.1): the browser half only ran on main and overnight, so a
# pull request that broke the wizard found out after it merged. These four
# cover the whole flow end to end, the till, the way a career leaves the
# phone, and every screen's words in both languages, in about six minutes
# (5m23s measured on a four-core box, 17 Oct 2026; docs/testing.md).
SMOKE="e2e storeprobe backupreach keyscreen"
# THE SECOND PR JOB (1.9.2): the whole browser list is 102 harnesses and about
# forty minutes a shard in three, too long to sit on every pull request. These
# 25 are the ones that guard what a player loses most by: reaching a control
# and reading it (accessibility), keeping a career (save and load), keeping
# what was bought (purchases), the match screen, and the layout on a phone.
# The rest still run on main, nightly and in the release check.
PRBROWSER="a11yprobe tapsize textscale nightcontrast contrastprobe motionprobe smalltype
  savequeue reloadprobe resilience healrefresh
  purchasestate proprompt exportui tillface adsprobe
  dramaprobe subsprobe injurygate hlliveprobe
  portraitqa devicematrix overlapaudit scrollaudit geosweep"

# ---- AREAS (1.9.2) ----
# Which probes cover which part of the game, in ONE place: `suite.sh area NAME`
# runs the list, and docs/testing.md's area table names exactly these (the
# orphan check fails when the two disagree, or when a name has no file).
# NAME.test is a vitest file under tests/; soaks (SLOW) in an area run only
# with AREA_SOAKS=1.
AREA_save="savefuzz migrate.test savequeue.test settleweek.test listsaves.test savedetprobe reloaddetprobe determinism.test cloneprobe replayprobe resumeprobe backupprobe importprobe listsavesprobe settleguardprobe personaprobe deepsave savequeue reloadprobe resilience backupreach"
AREA_money="moneyprobe refund.test spend.test tillprobe creditprobe spendprobe billprobe rewardedprobe netprobe storeprobe purchasestate proprompt exportui"
AREA_match="fingerprint fingerprint.test bandcheck engine10k simtest splitprobe blowprobe scrumlaw packprobe forfeitprobe perfprobe dialweight stackprobe dramaprobe"
AREA_rollover="rolloverprobe calinvariant invariants closeprobe seasonplanprobe pledgeprobe pledge.test runtimematrix releasesim soakhealth"
AREA_fuzz="actionfuzz marketfuzz sheetfuzz fuzz2 fuzz25d breakit breaker chaosui"
AREA_ui="e2e portraitqa devicematrix overlapaudit scrollaudit stickyaudit uiqaprobe paletteqa iconshots tidyshots cssaudit tokenlint"
AREA_i18n="textlint i18nprobe keyprobe frenchprobe englishprobe langparity frliveprobe langprobe keyscreen"
AREA_a11y="a11yprobe smalltype tapsize geosweep textscale nightcontrast contrastprobe colouraudit colourblind motionprobe tapcontrols"
AREA_ip="ipprobe namedup"
AREAS="save money match rollover fuzz ui i18n a11y ip"

run() {
  local name="$1"; shift
  local out code
  out=$("$@" 2>&1); code=$?
  local last
  last=$(printf '%s' "$out" | tail -1 | cut -c1-96)
  # A FAIL LINE IS A FAILURE, WHATEVER THE EXIT CODE (1.9.1). injuredquietprobe
  # and signedappsprobe printed "PROBE FAILED (n)" and exited 0, so this
  # function counted them PASS in every run. A line that starts with FAIL, or
  # a verdict in capitals ending in FAILED, now fails the harness on its own.
  if [ $code -eq 0 ] && printf '%s\n' "$out" | grep -qE '^FAIL\b|^[A-Z][A-Z0-9 ]* FAILED\b'; then
    code=1
    out="$out
FAIL  (exited 0 but printed a failure: the harness must set its exit code)"
  fi
  if [ $code -eq 0 ]; then
    printf 'PASS  %-16s %s\n' "$name" "$last"
    PASSES=$((PASSES + 1))
  else
    FAILED_NAMES="$FAILED_NAMES $name"
    printf 'FAIL  %-16s %s\n' "$name" "$last"
    # on a CI runner, each failure is also an annotation: the run page lists
    # them by name, which a log behind a download link does not
    if [ -n "${GITHUB_ACTIONS:-}" ]; then
      # the first line that says what went wrong, not node's version footer
      why=$(printf '%s' "$out" | grep -m1 -E '^(FAIL|PROBE THREW)|Error: |Timeout|exceeded' | cut -c1-200)
      [ -z "$why" ] && why=$(printf '%s' "$out" | grep -v '^\s*at ' | tail -6 | tr '\n' ' ' | cut -c1-300)
      echo "::error title=$name::${why:-$last}"
    fi
    # SAY WHAT FAILED, not just that something did. This threw the whole of $out
    # away and printed the summary line, so "FAIL subsprobe SUBS PROBE FAILED (2)"
    # meant re-running the probe by hand to find out which two - and a probe that
    # only fails under the suite does not always fail again on its own. The
    # harnesses all mark their own failures with a FAIL prefix, so those lines and
    # anything the probe threw come through here, indented, capped so one broken
    # harness cannot bury the rest of the report.
    #
    # AND THE THREE LINES UNDER EACH ONE, because several harnesses print the
    # diagnosis on the lines FOLLOWING the FAIL - annualprobe's step() reports
    # the screen it was looking at, its buttons and its text - and this grep
    # dropped every one of them. Main run 32901617528 said only 'walk through
    # the Annual door broke: page.click: Timeout 15000ms exceeded' while the
    # probe had already written down exactly what it was looking at. A harness
    # that diagnoses itself into a bin is a harness that does not diagnose.
    printf '%s' "$out" \
      | grep -E -A 3 --no-group-separator '^(FAIL|PROBE THREW|[A-Z][A-Z0-9 ]* FAILED: |.*(stopped early|stuck with))' \
      | head -20 | sed 's/^/        /'
    FAILS=$((FAILS + 1))
  fi
}

# ---- AREA MODE ----
# one part of the game, without the linters or anything else: a quick answer
# to "did I break saving", not a gate
AREA_RAN=""
if [ "$MODE" = area ]; then
  AREA="${2:-}"
  list=""
  case " $AREAS " in *" $AREA "*) eval "list=\"\$AREA_$AREA\"";; esac
  if [ -z "$AREA" ] || [ -z "$list" ]; then
    echo "usage: ./scripts/suite.sh area NAME, where NAME is one of: $AREAS"
    exit 2
  fi
  echo "=== area: $AREA ==="
  # a browser harness (.mjs) drives the build: make it once
  built=0
  for n in $list; do
    case " $SLOW " in *" $n "*)
      if [ -z "${AREA_SOAKS:-}" ]; then echo "SKIP  $n (a soak: AREA_SOAKS=1 to run it)"; continue; fi;;
    esac
    case "$n" in
      *.test) run "$n" npx vitest run "tests/$n.ts" ;;
      *)
        if [ -f "scripts/$n.ts" ]; then
          case " $SLOW " in *" $n "*) t=5400;; *) case " $LONG " in *" $n "*) t=1800;; *) t=900;; esac;; esac
          run "$n" timeout $t npx vite-node "scripts/$n.ts"
        elif [ -f "scripts/$n.mjs" ]; then
          if [ $built = 0 ] && [ "$n" != cssaudit ]; then run build npm run build; built=1; fi
          case " $SLOW " in *" $n "*) t=5400;; *) t=1200;; esac
          run "$n" timeout $t node "scripts/$n.mjs"
        else
          run "$n" sh -c "echo 'FAIL  area $AREA lists $n, and there is no scripts/$n.ts or .mjs'; exit 1"
        fi ;;
    esac
  done
  AREA_RAN=1
fi

[ -z "$AREA_RAN" ] && echo "=== typecheck, prose and tokens ==="
[ -z "$AREA_RAN" ] && run tsc npx tsc -b
[ -z "$AREA_RAN" ] && run textlint npx vite-node scripts/textlint.ts
# tokenlint was in CI's engine job and in no mode here (1.9.1), so a colour
# outside tokens.css passed ./scripts/suite.sh and failed the Gate
[ -z "$AREA_RAN" ] && run tokenlint npx vite-node scripts/tokenlint.ts
[ -z "$AREA_RAN" ] && run cssaudit node scripts/cssaudit.mjs
[ -z "$AREA_RAN" ] && run lint npx eslint src/ui
# every harness is in a list (1.9.1): a new file in no list fails here
[ -z "$AREA_RAN" ] && run orphancheck node scripts/orphancheck.mjs

if [ -z "$AREA_RAN" ]; then echo; echo "=== engine ==="; fi
# SHARDS (v1.2.2): CI runs the engine probes as two parallel jobs, each taking
# every other file, so the wall clock halves without a single probe being
# skipped. Locally SHARDS is unset and one loop runs everything, as before.
# BROWSER MODE (1.8.4): the CI browser job ran `suite.sh` and so ran every
# engine probe again, unsharded, before its first harness: over two hours,
# cancelled at the 75-minute ceiling on every merge to main since 1.8.2, so
# the harnesses never actually ran in CI. The engine has its own sharded jobs;
# `browser` skips it here, and so do `smoke` and `soak`, which have jobs of
# their own.
i=0
case "$MODE" in browser|smoke|pr|soak|area) ENGINE=0;; *) ENGINE=1;; esac
[ $ENGINE = 1 ] || [ -n "$AREA_RAN" ] || echo "(skipped in $MODE mode)"
# the vitest unit project (tests/). Unsharded runs only: the CI engine job
# runs `npm test` as a step of its own on shard 1
[ $ENGINE = 1 ] && [ -z "${SHARDS:-}" ] && run unit npm test
[ $ENGINE = 0 ] || for f in scripts/*.ts; do
  n=$(basename "$f" .ts)
  [ "$n" = worldcheck ] && continue                       # a library, not a probe
  case " $REPORTERS $SLOW " in *" $n "*) continue;; esac
  if [ -n "${SHARDS:-}" ]; then
    i=$((i + 1))
    [ $((i % SHARDS)) -ne $(( ${SHARD:-1} % SHARDS )) ] && continue
  fi
  case " $LONG " in *" $n "*) run "$n" timeout 1800 npx vite-node "$f"; continue;; esac
  run "$n" timeout 900 npx vite-node "$f"
done

BROWSER="e2e e2enight backprobe savequeue resilience reloadprobe subsprobe dramaprobe jobsprobe hubprobe tapsize motionprobe drawui portraitqa densityaudit stickyaudit scrollaudit overlapaudit blockprobe pickaudit nightcontrast contrastprobe colouraudit breaker subreach injurygate instantverdictprobe tapcontrols dealcardui unemployedprobe stakesprobe devicematrix backlogprobe annualprobe geosweep strangerpath hireprobe bidprobe deskgate textscale langprobe skinui sackui engageui tillface keyscreen storeprobe proprompt feedbackui backupreach replyreach subline testsheet healrefresh sidescroll adsprobe womensui mgrgender joboffer matchad boardroomui pressureprobe introprobe tabletprobe ambientprobe overlayprobe tidyprobe ipprobe slotprobe feedprobe tryflash loanlistui floorad ruckui
  brandprobe chaosui coachriftui countryui devpickui exportui formerui ftprobe hlliveprobe injurysheet loannameui pressbaroprobe roomui screensave setpieceui sheetprobe spotadui teamtalkui temperui uiqaprobe telemetryui traitcard
  a11yprobe smalltype
  purchasestate paletteqa iconshots tidyshots"
# purchasestate (1.9.1, was scripts/qa/purchasestate.mjs), paletteqa, iconshots and tidyshots had a
# verdict and sat in no list; scripts/orphancheck.mjs now fails on that.
[ "$MODE" = smoke ] && BROWSER="$SMOKE"
[ "$MODE" = pr ] && BROWSER="$PRBROWSER"

if [ "$MODE" != fast ] && [ "$MODE" != soak ] && [ "$MODE" != area ]; then
  echo
  # ipprobe joins the browser list because it needs the BUILD, not a browser: it
# scans dist/ for real-world marks. It was in the CI workflow and in no local
# run at all, so ./scripts/suite.sh could say SUITE PASSED on a tree that the
# Gate then failed in forty-five seconds - which is exactly what happened when
# a women's club shipped Glasgow's real ground name. A local suite that does
# not run what CI runs is not a gate, it is a rehearsal.
echo "=== build, then the browser ==="
  run build npm run build
  b=0
  # TWENTY HARNESSES WITH A VERDICT WERE IN NO LIST (1.9.0): exportui (the
  # 1.8.18 export), screensave, hlliveprobe and seventeen more were written,
  # passed once, and never ran again, so three of them had gone stale against
  # 1.8.16's wording and pacing without anybody seeing it. They are the second
  # line below. A harness with a verdict belongs here; a screenshot tool does
  # not (shots, qa-shots, storeart, ipadshots and the like).
  for n in $BROWSER; do
    [ -f "scripts/$n.mjs" ] || continue
    # BSHARDS: the CI browser job runs as parallel shards, each taking every
    # BSHARDS-th harness; locally it is unset and every harness runs
    if [ -n "${BSHARDS:-}" ]; then
      b=$((b + 1))
      [ $((b % BSHARDS)) -ne $(( ${BSHARD:-1} % BSHARDS )) ] && continue
    fi
    run "$n" timeout 1200 node "scripts/$n.mjs"
  done
fi

if [ "$MODE" = all ] || [ "$MODE" = soak ]; then
  echo
  echo "=== the long ones ==="
  # the two browser soaks need the build; `all` made it above
  [ "$MODE" = soak ] && run build npm run build
  # SSHARDS: the weekly soak job runs as parallel shards, each taking every
  # SSHARDS-th soak; locally it is unset and every soak runs
  s=0
  for n in $SLOW; do
    if [ -n "${SSHARDS:-}" ]; then
      s=$((s + 1))
      [ $((s % SSHARDS)) -ne $(( ${SSHARD:-1} % SSHARDS )) ] && continue
    fi
    [ -f "scripts/$n.ts" ] && run "$n" timeout 5400 npx vite-node "scripts/$n.ts"
    [ -f "scripts/$n.mjs" ] && run "$n" timeout 5400 node "scripts/$n.mjs"
  done
fi

echo
echo "SKIPPED (no verdict to give, run by hand when the numbers matter):"
echo "  $REPORTERS"
[ "$MODE" != all ] && [ "$MODE" != soak ] && [ "$MODE" != area ] && echo "SKIPPED (long): $SLOW"
echo
if [ $FAILS -eq 0 ]; then echo "SUITE PASSED"; else echo "SUITE FAILED: $FAILS"; fi
# THE LAST LINE IS FOR MACHINES (QA-GATE, 1.6.5): one JSON object, parse this
# rather than the prose. A release is green only when result is PASS, which
# means every mandatory gate above exited 0; the reporters listed as SKIPPED
# have no verdict and are not gates.
names=""
for n in $FAILED_NAMES; do names="$names${names:+,}\"$n\""; done
printf 'SUITE-SUMMARY {"result":"%s","mode":"%s","passed":%d,"failed":%d,"failures":[%s]}\n' \
  "$([ $FAILS -eq 0 ] && echo PASS || echo FAIL)" "$MODE" "$PASSES" "$FAILS" "$names"
exit $FAILS
