# The Library: handover

Read this after `CLAUDE.md` and the house rules. It records how the app and its sheet fit together as of 2026-10-31 (app Version 34), so a fresh session can carry on without the old conversation.

## What it is
- A personal reading tracker. One file, `app.html`, is both the private claude.ai artifact and (built by `python3 tools/build-pages.py` into `index.html`) the GitHub Pages site.
- The app is called **The Library** for now. The final name comes with the domain, when it is shared with family; the repo, brand notes (`v3/brand`) and `v3/STARTER-PROMPT.md` still say "Jackets & Manuscripts" on purpose.
- The data lives in the **Entertainment Tracker** Google Sheet. The app reads and writes it through the `Google Sheets` connector (claude.ai) or a small REST adapter with the owner's Google sign-in (Pages).
- Look: Proton Seasons month colours, dark, Roboto everywhere with tabular figures on every element.

## Working rules the owner has set
- **Direct pushes to `main` are fine for this repo** (the pull-request rule in the house rules is for other repos). Routine for each change: publish the artifact from the source file, copy it to `app.html`, `python3 tools/build-pages.py`, commit and push `main`, then copy it to `v3/reading-log.html` on branch `claude/keen-sagan-yf9rqf`, commit and push.
- **Never read anything from the `Brain tester` sheet beyond its Date and Pages columns.** It holds mood, meds and fitness data. The diary is sensitive.
- Never touch other apps' tabs (those starting with an emoji, plus their Log, Settings and backup tabs).
- Back up a tab (duplicate it, name it with the date) before any column or bulk change. Ask the owner before deleting a backup; they like to keep it a few days.
- Show the plan before the first sheet write of a session. Check every bulk write by reading it back and comparing with a script. Never hand-type long arrays.

## Sheet safety conventions (the app already follows these)
- Find the row by its `id` immediately before every write and write only the changed cells. Never rewrite whole tabs, never sort from code, never delete and re-add rows (removing an item clears its cells; the empty row stays).
- New rows go **below the last used row** with an explicit range, not `append_values` (append fills gaps left by cleared rows and can overrun them).
- Never write formula columns (`remain`, `%` in Books). Their formulas are `=IF(N(pages)>0,pages-currentPage,"")` and `=IF(N(pages)>0,currentPage/pages*100,"")`.
- The app reads columns **by header name**, so column order can change freely. Text is written with a leading `'`, numbers as numbers, dates as `yyyy-mm-dd`.
- Dropdown changes keep the chip style (`customUiMode: CHIP` and the `dropdownStyle` colours spelled out), or both are lost.
- Sheets API quirks met so far: `update_values` is USER_ENTERED (formulas and dates are parsed) and refuses a write bigger than its range; `repeatCell` and `copyPaste` skip rows hidden by a basic filter; large `get_values` results are saved to a file and need parsing with Python; write a formula and `PASTE_VALUES` it rather than transcribing.

## Tabs and columns
**Books** (one row per copy or read; `id` is the last column; formulas in `remain` and `%`)
`title, author, status, rating, favourite, cover, currentPage, pages, remain, %, startDate, finishDate, series, seriesNum, type, format, publisher, genre, theme1, theme2, theme3, setting, year, awards, tier, upNextOrder, why, triaged, added, copies, isbn, loaned, loanee, synopsis, notes, id`
- `status`: Reading, TBR, Re-read, Finished (was "Read"), Paused, DNF. Every read keeps its own row and rating; later reads of the same title and first author are grouped for badges and the Re-reads panel.
- `favourite`: `Yes` or blank. `cover`: `ol:<Open Library cover id>`, `none`, or blank (a reference, never a picture). `publisher` is mainly for comics. `copies` is `Kobo | PDF | Physical` (replaces the old `owned`). `seriesNum` accepts halves (1.5).
- `tier`: Up next / Soon / Someday, with `upNextOrder` 1..n for Up next. Starting a book (status to Reading) clears both and renumbers Up next; the app also tidies Reading books that still carry a tier.
- Removed in October: `spotlight`, `owned`, `ambition`, `fatalFlaw`.

**Wishlist** (`id` WL0001…, cleared rows are left empty)
`id, added, title, author, series, number, type, format, publisher, stage, waiting, wantAs, checked, checkedOn, release, price, link, seenIn, interest, gift, notes, bookId`
- Stages: Inbox, To download, To buy, To borrow, Waiting, Got it. "Got it" books are moved by the app into Books as TBR, logged in `Wishlist archive`, and their row is cleared.
- `format`: Book, Comic, Graphic novel, Manga, Issues, Deluxe, Omnibus, Compendium, Box Set, Limited Edition (shown as "Comic book" for Comic). Blank means not set yet.
- `wantAs`: Kobo or PDF in the Get them list (Physical, Either and Library still exist in the dialog and are kept). `checked`: Available / Unavailable / blank (New); `checkedOn` is the date it was set.

**Series Tracker**: `series, author, publisher, kind, status, released, soldAs, link, notes`. The Series view also lists every series with two or more books in Books and Wishlist; a tracked series with no books left is removed.
**Reading Lists**: `list, order, title, author, notes, id, bookId` (ids RL0001…). Items match Books by title and author, or by `bookId` when linked in the edit dialog.
**Other tabs the app uses:** `Reading Log` (date, pages, bookId, title, pageReached, loggedAt, source, minutes), `App Settings` (streak start, goals), `Ratings`, `Contents` (anthology stories), `Wishlist archive` (history only), and a separate Quotes sheet.

## Behaviour worth knowing
- Library: Reading, Finished (newest first), Re-read, TBR, Paused, DNF as expandable boxes. Rows open a floating card on the left (status, favourite, edit, cover).
- Log: Reading now (big page number), then Read next / Last five finished / Favourites, then Pages per day (Year by default). "2026 so far" is the pages of books finished this year; the daily log (inflated by Kobo page counts) still drives streaks and the daily chart.
- `confirm()` does nothing inside claude.ai, so the page uses its own confirmation dialog (`askOk`).
- **Covers only work on the GitHub Pages site.** claude.ai blocks outside images and lookups. The Open Library search and cover code was written to the documented API and tested against a stand-in; it has not yet been run against the real service (the build environment's network blocks `openlibrary.org`). The first real search is the real test.
- Tests were headless Playwright scripts with a stubbed `window.claude` at 390px and 1280px, run before every publish. They used copies of the real sheet data, so they are not in this public repo.

## Open ideas
- Fill the ~220 blank page counts (Open Library, or Calibre page counts); `added` dates from a Calibre timestamp export.
- Family sharing and the real name and domain (see `v3/FAMILY-PLAN.md` on the branch): invite-only sign-in, a daily backup sheet keeping 7 days.
- The Music Collection app was sent the bookmark/favourites style; a matching version for books there is its own session's call.
