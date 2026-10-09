# My Book Library v3 (backup of hosted pages)

Source for the v3 pages hosted on claude.ai. These are backups; the live site (`index.html` on `main`) is unchanged.

| File | What it is |
|---|---|
| `reading-log.html` | Live reading log: page logging, streak, daily/monthly charts, calendar. Proton Seasons theme. |
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
