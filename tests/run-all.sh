#!/usr/bin/env bash
# Runs every suite and prints one PASS/FAIL summary.
#   bash tests/run-all.sh      (about 3 minutes; exits non-zero if anything fails)
# check.sh clears tests/out/ first, so it has to run first.
set -u -o pipefail
cd "$(dirname "$0")/.."
fail=0; summary=""
run() { # label command...
  local label=$1; shift
  echo; echo "######## $label"
  local log; log=$(mktemp)
  "$@" 2>&1 | tee "$log"; local rc=$?
  local counts; counts=$(grep -E '^[0-9]+ PASS, [0-9]+ FAIL' "$log" | tail -1)
  [ -z "$counts" ] && counts=$(grep -E '^(PASS|FAIL):' "$log" | tail -1)
  if [ "$rc" -eq 0 ]; then summary="$summary
PASS  $label  ${counts}"; else summary="$summary
FAIL  $label  ${counts}"; fail=1; fi
  rm -f "$log"
}
run "check.sh (screens and write flows)" bash tests/check.sh
run "supabase.js" node tests/supabase.js tests/out/sb
run "copyback.js" node tests/copyback.js tests/out/cb
run "family SQL (local Postgres)" bash tests/sql/family.sh
echo; echo "======== Summary$summary"
if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "FAIL"; fi
exit "$fail"
