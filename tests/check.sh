#!/usr/bin/env bash
# Compare the working app.html against the committed one (git HEAD) by screenshots and recorded sheet writes.
# Usage: bash tests/check.sh        Outputs go to tests/out/
set -u
cd "$(dirname "$0")/.."
OUT=tests/out
rm -rf "$OUT"; mkdir -p "$OUT/base" "$OUT/new"
BASE_DIR=$(mktemp -d)
git show HEAD:app.html > "$BASE_DIR/app.html" || { echo "FAIL: cannot read HEAD:app.html"; exit 2; }
fail=0

run() { # label appfile outdir
  echo "-- $1: screenshots"; node tests/visual.js "$2" "$3/screens" || fail=1
  echo "-- $1: flows"; node tests/flows.js "$2" "$3/flows" || fail=1
}
run baseline "$BASE_DIR/app.html" "$OUT/base"
run working app.html "$OUT/new"
rm -rf "$BASE_DIR"

echo; echo "== Screens"
python3 tests/cmp.py "$OUT/base/screens" "$OUT/new/screens" || fail=1

echo "== Flows"
nflow=0; nbad=0
for f in "$OUT"/base/flows/*.json; do
  n=$(basename "$f"); nflow=$((nflow+1))
  if ! cmp -s "$f" "$OUT/new/flows/$n"; then echo "  DIFF $n"; nbad=$((nbad+1)); fi
done
echo "flow files: $nflow compared, $nbad different"
[ "$nbad" -gt 0 ] && fail=1
# flows must have actually run (no failures, and some writes recorded)
if grep -l '"failure": "[^"]' "$OUT"/new/flows/*.errors.json "$OUT"/base/flows/*.errors.json 2>/dev/null; then echo "  some flows failed to run"; fail=1; fi
nw=$(cat "$OUT"/new/flows/*.json | grep -c '"tool"')
echo "recorded writes in working copy: $nw"; [ "$nw" -lt 50 ] && fail=1

echo
if [ "$fail" -eq 0 ]; then echo "PASS: screens identical (or noise) and all flows byte-identical"; else echo "FAIL: see differences above (tests/out/)"; fi
exit $fail
