# Tests

Headless Playwright checks that compare the working `app.html` with the committed one (`git HEAD`).
Synthetic data only; the sheet is a stateful fake (`lib.js`), so nothing touches Google Sheets.

    bash tests/check.sh       # about 2 minutes; prints PASS or FAIL

- `visual.js`: about 50 screenshots (390px and 1280px), compared pixel by pixel (<=100 px and <=12 channel diff counts as noise).
- `flows.js`: write flows (add/edit book, log pages, wishlist, series, lists, ratings...). Each records every non-read call; the JSON must be byte-identical.
- Needs Playwright (global install is found automatically), python3 with numpy and Pillow. Outputs go to `tests/out/` (git-ignored).
- `copyback.js`: the data tools in Data & sign-in (Copy Sheet -> Supabase, Check, Copy Supabase -> Sheet). A fake Sheets API (two spreadsheets, every write recorded) and a fake Supabase; `node tests/copyback.js tests/out/cb`. The fakes are shared with `supabase.js` through `fakes.js`.
- `supabase.js`: Supabase mode end to end against the fake Supabase (`node tests/supabase.js tests/out/sb`).
- `bash tests/run-all.sh` runs `check.sh`, `supabase.js`, `copyback.js` and `sql/family.sh` (the family privacy rules on a throwaway local Postgres 16) and prints one PASS/FAIL summary (about 3 minutes).
- `insights-seed.js`: synthetic books and log entries injected by `visual.js` (and handy for perf checks) so every Insights chart renders; `tests/data.js` is unchanged.
