# Tests

Headless Playwright checks that compare the working `app.html` with the committed one (`git HEAD`).
Synthetic data only; the sheet is a stateful fake (`lib.js`), so nothing touches Google Sheets.

    bash tests/check.sh       # about 2 minutes; prints PASS or FAIL

- `visual.js`: 42 screenshots (390px and 1280px), compared pixel by pixel (<=100 px and <=12 channel diff counts as noise).
- `flows.js`: 18 write flows (add/edit book, log pages, wishlist, series, lists, ratings...). Each records every non-read call; the JSON must be byte-identical.
- Needs Playwright (global install is found automatically), python3 with numpy and Pillow. Outputs go to `tests/out/` (git-ignored).
