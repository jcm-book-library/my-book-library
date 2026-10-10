# My Book Library v3 (backup of hosted pages)

Source for the v3 pages hosted on claude.ai. These are backups; the live site (`index.html` on `main`) is unchanged.

| File | What it is |
|---|---|
| `reading-log.html` | The v3 app ("My Book Library"): Log tab (page logging, streak, charts, calendar, finish-a-book), Library tab (search, filter, sort, edit, add) and Dashboard tab (yearly stats, pace per book, ratings, genres, authors, awards, series, TBR). Proton Seasons theme. |
| `proton-seasons-preview.html` | Chosen design: Proton Night base with a soft colour per month (tint + drift on). |
| `colourways-preview.html` | The four original colour options, kept for reference. |

## Data (Google Sheet: Entertainment Tracker)

- `Books` — one row per book. `id` (col M) is a permanent label; never renumber or use a formula for it. Duplicate IDs are highlighted red.
- `Reading Log` — one row per log entry: `date | pages | bookId | title | pageReached | loggedAt | source`. Daily totals = sum per date. Rows from 1 Jan–8 Oct 2026 are imported daily totals (`source = import`).
- `App Settings` — `streakStartDate`, `streakMinPages`, `dailyGoalPages`.

## How the hosted pages write to the sheet

Through the claude.ai Google Sheets connector, as the viewer. Writes are narrow:
- Logging appends one row to `Reading Log`.
- It then updates that book's `currentPage` cell only, found by `id` just before writing, and only moves forward.

The pages that read live data only work when opened inside claude.ai; opened elsewhere they show a built-in snapshot.
- Editing a book in the Library writes only the cells that changed (text kept as text, numbers as numbers, dates as dates).
- Adding a book appends one row with the next ID (highest + 4) and adds the `remain` / `%` formulas to that row.
- Finishing a book from the Log sets `status = Read`, `finishDate = today`, `currentPage = pages`, and the rating if chosen.

## Sheet changes made on 2026-10-09

- Fixed 13 duplicate IDs (new IDs 8340–8388) and added a red highlight rule for duplicate IDs.
- Start/finish dates for Read books set from the StoryGraph export; 10 books not in StoryGraph given best-guess finish dates.
- `currentPage`, `pages`, `rating`, `year` converted from text to numbers; `startDate` / `finishDate` converted to real dates (shown as yyyy-mm-dd).
- Full copy of Books before the conversion kept in the `Books backup 2026-10-09` tab.

## Added 2026-10-10

- **Tools tab:** RATED scorer with separate criteria for Fiction, Non-fiction and Comics & GN, gut rating, standout +0.5 / fatal flaw −0.5, and 2–3 similar rated books to compare against. Saving writes the rating (and fatal flaw) to Books and a breakdown row to the `Ratings` tab. Recommendations score TBR books on theme, genre and author affinity from your ratings, series continuation, Spotlight and awards, with modes Best match / Next in series / Change of pace / Quick win / More like…; "Start reading" sets status and start date.
- **Contents:** anthologies and collections can store a table of contents (`Contents` tab: bookId, savedAt, story, startPage); the Log shows which story you're in and pages left in it.
- **Discover tab:** quote of the day (Quotes sheet), On this day, Coming soon (Wishlist), Award watch, links.
- **Sheet tidy-up:** themes normalised (capitalisation and duplicates merged, 2,290 → 2,124 distinct), award names consolidated, details filled for ~69 recently added books.
