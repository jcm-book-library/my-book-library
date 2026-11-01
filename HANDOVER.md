# The Library: handover

Read this after `CLAUDE.md` and the house rules. It records how the app and its sheet fit together as of 2026-10-31 (app Version 34: the claude.ai artifact version; the app itself shows no version number), so a fresh session can carry on without the old conversation.

## What it is
- A personal reading tracker. One file, `app.html`, is both the private claude.ai artifact and (built by `python3 tools/build-pages.py` into `index.html`) the GitHub Pages site.
- The app is called **The Library** (since October 2026; the owner confirmed it as the name on 1 Nov). "Jackets & Manuscripts" is retired. It survives only in the old branch notes (`v3/brand`, `v3/STARTER-PROMPT.md` on `claude/keen-sagan-yf9rqf`) and the house rules' "Look" line in `control-room`. The repo name stays `my-book-library`.
- The data lives in the **Entertainment Tracker** Google Sheet. The app reads and writes it through the `Google Sheets` connector (claude.ai) or a small REST adapter with the owner's Google sign-in (Pages).
- Look: Proton Seasons month colours, dark, Roboto everywhere with tabular figures on every element.

## Working rules the owner has set
- **Direct pushes to `main` are fine for this repo** (the pull-request rule in the house rules is for other repos). Routine for each change: edit `app.html`, `python3 tools/build-pages.py`, run the screenshot tests, commit and push `main`, then copy it to `v3/reading-log.html` on branch `claude/keen-sagan-yf9rqf`, commit and push.
- **The owner uses only the live GitHub Pages site**, not the claude.ai artifact. Don't spend effort on the artifact; claude.ai-only limits (no outside images, `confirm()`) matter less, though the connector code still works there.
- **Never read anything from the `Brain tester` sheet beyond its Date and Pages columns.** It holds mood, meds and fitness data. The diary is sensitive.
- Never touch other apps' tabs (those starting with an emoji, plus their Log, Settings and backup tabs).
- Back up a tab (duplicate it, name it with the date) before any column or bulk change. Ask the owner before deleting a backup; they like to keep it a few days.
- Show the plan before the first sheet write of a session. Check every bulk write by reading it back and comparing with a script. Never hand-type long arrays.

## Sheet safety conventions (the app follows these, except where noted)
- Find the row by its `id` immediately before every write and write only the changed cells. Never rewrite whole tabs, never sort from code, never delete and re-add rows (removing an item clears its cells; the empty row stays). The app clears rows in Wishlist, Reading Lists and Series Tracker; it never clears Books rows. Deleting a Reading Log entry is a soft delete: `pages` set to 0 and `source` to `deleted`.
- New rows go **below the last used row** with an explicit range, not `append_values` (append fills gaps left by cleared rows and can overrun them). Wishlist, Reading Lists and Series Tracker do this. Books, Reading Log, Ratings, Wishlist archive, App Settings, Contents and the Quotes sheet still use `append_values`, which is safe only because the app never clears rows in those tabs. If a tab gains a "remove" that clears rows, move its adds to below-last-row first.
- Formula columns (`remain`, `%` in Books) are never written by edits. The app writes them once, on a newly added Books row (add a book, or a Wishlist "Got it" move). The formulas are `=IF(N(pages)>0,pages-currentPage,"")` and `=IF(N(pages)>0,currentPage/pages*100,"")`.
- The app reads columns **by header name**, so column order can change freely. Text is written with a leading `'`, numbers as numbers, dates as `yyyy-mm-dd`. Plain (unquoted) values: Wishlist `gift` (TRUE/FALSE), `release` and `checkedOn`; Series Tracker `released`; Reading Lists `order`; Reading Log `pages`, `pageReached`, `minutes` and `loggedAt`; the Contents timestamp.
- Read ranges have caps: Books `A:AZ` to row 5000, Wishlist `A:Z` to 3000, Series Tracker `A:I` to 500 (**a 10th Series Tracker column would not be read**), Reading Lists `A:G` to 2000, Reading Log `A:H` to 20000.
- Dropdown changes keep the chip style (`customUiMode: CHIP` and the `dropdownStyle` colours spelled out), or both are lost.
- Sheets API quirks met so far: `update_values` is USER_ENTERED (formulas and dates are parsed) and refuses a write bigger than its range; `repeatCell` and `copyPaste` skip rows hidden by a basic filter; large `get_values` results are saved to a file and need parsing with Python; write a formula and `PASTE_VALUES` it rather than transcribing.

## Tabs and columns
**Books** (one row per copy or read; `id` is the last column; formulas in `remain` and `%`; new ids are the highest id **+4**, a convention since the first version)
`title, author, status, rating, favourite, cover, currentPage, pages, remain, %, startDate, finishDate, series, seriesNum, type, format, publisher, genre, theme1, theme2, theme3, setting, year, awards, tier, upNextOrder, why, triaged, added, copies, isbn, loaned, loanee, synopsis, notes, id`
- `status`: Reading, TBR, Re-read, Finished (was "Read"), Paused, DNF. Every read keeps its own row and rating; later reads of the same title and first author are grouped for badges and the Re-reads panel.
- `favourite`: `Yes` or blank. `cover`: `ol:<Open Library cover id>`, `none`, or blank (a reference, never a picture). `publisher` is mainly for comics. `copies` is `Kobo | PDF | Physical` (replaces the old `owned`). `seriesNum` accepts halves (1.5).
- `tier`: Up next / Soon / Someday, with `upNextOrder` 1..n for Up next. Starting a book (status to Reading) clears both and renumbers Up next; the app also tidies Reading books that still carry a tier.
- Removed in October: `spotlight`, `owned`, `ambition`, `fatalFlaw`.

**Wishlist** (`id` WL0001…, cleared rows are left empty)
`id, added, title, author, series, number, type, format, publisher, stage, waiting, wantAs, checked, checkedOn, release, price, link, seenIn, interest, gift, notes, bookId`
- Formats are stored as written in the dialog ("Graphic novel", type "Non-fiction"). Books uses its own spellings ("Graphic Novel", "Non-Fiction", format "Comic"), and the "Got it" move converts them.
- Stages: Inbox, To download, To buy, To borrow, Waiting, Got it. "Got it" books are moved by the app into Books as TBR, logged in `Wishlist archive`, and their row is cleared.
- `format`: Book, Comic, Graphic novel, Manga, Issues, Deluxe, Omnibus, Compendium, Box Set, Limited Edition (shown as "Comic book" for Comic). Blank means not set yet.
- `wantAs`: Kobo or PDF in the Get them list (Physical, Either and Library still exist in the dialog and are kept). On "Got it", Kobo / PDF / Physical become Books `copies`; Library goes into `notes`; Either leaves `copies` blank. `checked`: Available / Unavailable / blank (New); `checkedOn` is the date it was set.

**Series Tracker**: `series, author, publisher, kind, status, released, soldAs, link, notes` (`soldAs` uses the Wishlist format list). The Series view also lists every series with two or more books in Books and Wishlist; a tracked series with no books left is removed.
**Reading Lists**: `list, order, title, author, notes, id, bookId` (ids RL0001…). Items match Books by title and author, or by `bookId` when linked in the edit dialog.
**Other tabs the app uses:**
- `Reading Log`: `date, pages, bookId, title, pageReached, loggedAt, source, minutes` (`source` is `app` or `deleted`).
- `App Settings`: key/value rows `streakStartDate`, `streakMinPages`, `dailyGoalPages`, `yearBookGoal`.
- `Ratings` (written by position, 10 columns): date, bookId, title, category, gut, criteria, standout, flaw, suggested, final.
- `Contents` (anthology stories): `bookId, stamp, story, start`; the newest stamp per book wins.
- `Wishlist archive` (history only, matched by header): `Title, Author, Status` (Bought / Downloaded), `Type, Format, ETA, Cost, Reading List, Notes, id, Series, Link, bookId`.
- A separate Quotes sheet, tab `QUOTES` (A:G): text, from, who, by, bookId, page, added.

## Behaviour worth knowing
- Library: Reading, Finished (newest first), Re-read, TBR, Paused, DNF as expandable boxes. Rows open a floating card on the left (status, favourite, edit, cover).
- Log: Reading now (big page number), then Read next / Last five finished / Favourites, then Pages per day (Year by default). "2026 so far" is the pages of books finished this year; the daily log (inflated by Kobo page counts) still drives streaks and the daily chart.
- `confirm()` does nothing inside claude.ai, so the page uses its own confirmation dialog (`askOk`).
- **Covers only work on the GitHub Pages site** (claude.ai blocks outside images). Open Library search and covers were confirmed working on the live site on 1 Nov, but its range of covers is limited. The build environment's network blocks `openlibrary.org`, so tests use a stand-in.
- Tests were headless Playwright scripts with a stubbed `window.claude` at 390px and 1280px, run before every publish. They used copies of the real sheet data, so they are not in this public repo.

## Known gaps (from the 31 Oct audit)
- The three find-row-by-id helpers (Books, Wishlist, Reading Lists) and the per-field write loops are near-duplicates. They could be merged into one helper, but they guard every write, so do it with full write-path tests.
- The Library filter chain is written twice (the Library list and the plan's "rest" pool). It could share one function; keep the tier difference.

## Agreed plan (1 Nov 2026)
Order: 1 Foundations (screenshot and write-flow tests in `tests/`, one find-row / write-cells / add-row helper) → 2 Simplify (new layout from the approved mock, shelf logo and background, quick add with paste, Lent out button) → 3 Fill details queue (Google Books + Open Library; barcode scanning later, iPhone so it needs a scanning library) → 4 Authors and Series pages → 5 Shelves with a Shelves / List toggle → 6 Charts redesign (owner brings data-storytelling ideas).
- **Logo:** shelf of spines, with a shelf of spines along the bottom of the screen as the background (a Plain option too).
- **Layout:** tabs Now · Library · Next · Insights, a Toolbox menu, header buttons "+ Add book" and "Lent out". The owner wants symmetry and condensed rows.
- **Colour:** the theme keeps the slow monthly drift; spines (logo, background, shelves) rotate faster or use a contrast colour. The mock offers Month / Daily mix / Contrast.
- **Kept manual on purpose:** logging pages read. Don't automate it (no Kobo sync).
- **Not wanted for now:** spending stats, loan reminders (a Lent out popup instead), imports (done), family sharing (a future version; then consider Wishlist items as Books rows).
- **Later:** once Open Library has filled what it can, add the remaining covers from Google Drive, as other projects do.

## Open ideas
- Fill the ~220 blank page counts (Open Library, or Calibre page counts); `added` dates from a Calibre timestamp export.
- Family sharing and the real name and domain (see `v3/FAMILY-PLAN.md` on the branch): invite-only sign-in, a daily backup sheet keeping 7 days.
- The Music Collection app was sent the bookmark/favourites style; a matching version for books there is its own session's call.
