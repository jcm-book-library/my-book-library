# Starter prompt for sister apps (TV, movies, gaming, music)

Start a new Claude Code session with both repos attached: `jcm-book-library/my-book-library` (reference only) and the new repo for that app.

Paste **Part 1**, then the **Part 2** block for that app, into the first message. Fill in anything in `[brackets]`.

## Part 1: paste this every time

```
I'm building a personal tracker web app, a sister to my book tracker
"Jackets & Manuscripts". It should look and work like the book app,
adapted to this medium. I want each tracker in its own chat and its own
page, so only work on this one.

REFERENCE (read first, don't change)
Repo jcm-book-library/my-book-library, branch claude/keen-sagan-yf9rqf:
- v3/reading-log.html is the finished book app. Copy its patterns,
  styles and helper code directly rather than reinventing them.
- v3/README.md covers its data model and sheet rules.
- v3/brand/BRAND.md covers how a brand kit gets applied.
Build this app in [new repo name], not in my-book-library.

DATA
Google Sheet "Entertainment Tracker", ID
1558jWeUc8gCzQuph6wOVyOocvTBhQf22UuCSXza8klc. The sheet is the source of
truth; the app is a friendlier front end that reads and writes it.
This spreadsheet also holds my books. NEVER read from or write to the Books,
Reading Log, App Settings, Ratings, Contents, Wishlist, Calibre Review or
"Books backup" tabs, or any tab except the ones named in Part 2 and new
tabs you create for this app (prefix their names with this app's emoji).

HOSTING (same as the book app)
- One self-contained HTML file, published as a private claude.ai artifact
  that reaches Sheets through the artifact "mcp" capability
  (server "Google Sheets": get_values, append_values, update_values).
- The same file on GitHub Pages under jcm-book-library.github.io, using the
  book app's Google sign-in adapter (GIS token client + Sheets REST).
  It's the same origin as the book app, so reuse its saved Client ID
  (localStorage "mbl_config"), but give everything else this app's own
  storage keys.
- Build step like the book app's tools/build-pages.py (app.html -> index.html
  with icons and manifest).
- Scripts only from cdnjs (Chart.js 4.4.1); fonts from Google Fonts;
  anything else inline (the world map in the book app is inline SVG).

LOOK
Same as the book app: dark "Proton Seasons" theme with month accent colours
and drift, Atkinson Hyperlegible + Figtree, stat tiles, rounded panels,
pill tab bar, phone first with no sideways scrolling, two columns on a
laptop. Text wordmark until I bring a brand kit.

SHEET SAFETY (non-negotiable; an old app of mine broke my sheet)
- These tabs have no id column yet. Before the app writes anything:
  duplicate the tab as a dated backup, then propose adding a stable id
  column, and show me the plan first.
- Find a row by id right before every write; write only the cells that
  changed. Never rewrite whole tabs, never delete and re-add rows.
- Dates as yyyy-mm-dd, numbers as numbers, text prefixed with ' so Sheets
  doesn't reinterpret it. Never write formula columns (ask me which they are).
- Keep the existing dropdowns and their chip formatting
  (setDataValidation needs customUiMode CHIP set explicitly).
- After any bulk change, read the tab back and compare with a script.
  Don't hand-type long arrays into tool calls.
- Settings live in a key | value settings tab for this app.

WAY OF WORKING
- First read the tab's two header rows and a sample of rows (headers can
  start on row 2). Then propose the data model, any new columns or tabs,
  and the first version, and wait for my OK.
- Build in stages and publish after each. Test headless with Playwright
  (Chromium at /opt/pw-browsers/chromium, stubbed window.claude) at laptop
  and phone width before every publish. Commit and push each stage.
- I like options with a recommendation, bullet points first, and pushback
  when I'm wrong.

FEATURES TO MIRROR FROM THE BOOK APP (adapt names to the medium)
- Log: what I'm on now, full-width rows with progress, a quick way to log
  today, backdating (Today / Yesterday / pick a date) and editing past entries.
- Library: searchable, sortable table with status chips, detail rows, an
  edit/add dialog that writes only changed cells.
- Plan: Up next (ordered, about 10, with a "why"), Soon, the backlog in
  sheet order with one-tap Up next / Soon, and a sort deck that shows the
  most promising unsorted items first and resurfaces Someday after a year.
- Dashboard: tiles, monthly totals, a calendar heatmap, ratings, genres,
  top people, and drill-down on every bar.
- Tools: lucky dip by mood, "Do I own this?", stalled nudges,
  goal planner, year in review, recommendations from my own ratings.
- Discover: on this day in past years, quote or highlight of the day.
```

## Part 2: add the block for that app

### 📺 TV

```
PROJECT: TV tracker. Tab "📺" (headers on row 2): Title, Rating (out of 10),
Status, How to Watch, Genre, Platform, Starring, Release Date, Year,
Total Seasons, Total Eps, Notes.
Ideas: season/episode progress for what I'm watching, episodes per week,
a watch log tab for history and streaks, "next episode" logging in one tap,
binge vs weekly stats, platform split, shows finishing soon.
```

### 🎥 Movies

```
PROJECT: Movie tracker. Tab "🎥" (headers on row 2): Title, Rating (out of
10), Status, Date, Starring, Director, Cinematography, Purchase, Genre,
Platform, Release, Year, Notes.
Ideas: watch diary by date, films per month, favourite directors and
cinematographers, decade and genre breakdowns, owned vs streamed,
rewatches, a watchlist plan with Up next.
```

### 🎮 Gaming

```
PROJECT: Game tracker. Tab "🎮" (headers on row 1): Title, Rating (out of
10), Status, Platform, Purchase, Genre, Director, Starring, Released,
Date Finished, Notes.
Ideas: hours played (a play-session timer like the book app's reading
timer), backlog plan, completion rate, platform split, stalled games,
time to beat vs my time.
```

### 🎸 Music

```
PROJECT: Album tracker. Tab "🎸" (headers on row 1): Title, Rating,
Artist, Status, Genre, Format, Release Date, Year, Notes.
Ideas: albums to listen to (plan with Up next), a listening log,
albums per month, favourite artists and decades, genre map, an
"album of the day" like the quote of the day.
```
