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
#   ./scripts/suite.sh fast     engine probes only, no browser  (~10 min)
#   ./scripts/suite.sh          fast + the browser harnesses    (~40 min)
#   ./scripts/suite.sh all      everything, soaks included      (hours)
#
# Every line is PASS or FAIL with the harness's own last line, and the exit code
# is the number of failures. Reporting tools that have no verdict are listed at
# the end as SKIPPED, by name, so nothing is quietly left out.
set -uo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-default}"
FAILS=0

# no pass/fail to give: these print numbers or write screenshots
REPORTERS="analysis gapreport icons shots qa-shots qa-shots2 newspeak boardprobe disttest loantest nattest summertest dataaudit squaddiff premmerge"
# minutes each, not seconds: only on request
SLOW="soakhealth soakui stresstest deepsave e2edeep"

run() {
  local name="$1"; shift
  local out code
  out=$("$@" 2>&1); code=$?
  local last
  last=$(printf '%s' "$out" | tail -1 | cut -c1-96)
  if [ $code -eq 0 ]; then
    printf 'PASS  %-16s %s\n' "$name" "$last"
  else
    printf 'FAIL  %-16s %s\n' "$name" "$last"
    FAILS=$((FAILS + 1))
  fi
}

echo "=== typecheck, prose and tokens ==="
run tsc npx tsc -b
run textlint npx vite-node scripts/textlint.ts
run cssaudit node scripts/cssaudit.mjs

echo
echo "=== engine ==="
for f in scripts/*.ts; do
  n=$(basename "$f" .ts)
  [ "$n" = worldcheck ] && continue                       # a library, not a probe
  case " $REPORTERS $SLOW " in *" $n "*) continue;; esac
  run "$n" timeout 900 npx vite-node "$f"
done

if [ "$MODE" != fast ]; then
  echo
  echo "=== build, then the browser ==="
  run build npm run build
  for n in e2e e2enight resilience reloadprobe subsprobe hubprobe tapsize drawui portraitqa densityaudit stickyaudit scrollaudit overlapaudit blockprobe pickaudit nightcontrast contrastprobe colouraudit breaker subreach; do
    [ -f "scripts/$n.mjs" ] || continue
    run "$n" timeout 1200 node "scripts/$n.mjs"
  done
fi

if [ "$MODE" = all ]; then
  echo
  echo "=== the long ones ==="
  for n in $SLOW; do
    [ -f "scripts/$n.ts" ] && run "$n" timeout 5400 npx vite-node "scripts/$n.ts"
    [ -f "scripts/$n.mjs" ] && run "$n" timeout 5400 node "scripts/$n.mjs"
  done
fi

echo
echo "SKIPPED (no verdict to give, run by hand when the numbers matter):"
echo "  $REPORTERS"
[ "$MODE" != all ] && echo "SKIPPED (long): $SLOW"
echo
if [ $FAILS -eq 0 ]; then echo "SUITE PASSED"; else echo "SUITE FAILED: $FAILS"; fi
exit $FAILS
