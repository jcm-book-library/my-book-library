# Starter prompt for sister apps

Paste the block below into a new Claude Code session. Fill in the `[brackets]`, and delete whatever doesn't fit the project.

```
I'm building a personal tracker web app, a sister to my book tracker
"Jackets & Manuscripts". Match its look, structure and data-safety rules,
then adapt them to this project.

PROJECT: [TV & film tracker | daily diary]
DATA: Google Sheet [name / ID], tab(s) [names]. The sheet is the source of
truth ("the brains"). The app is a friendlier front end that reads and writes it.
WORKING NAME: [name]. I'll bring a brand kit later. Until then, use a simple text wordmark.

REFERENCE IMPLEMENTATION
Read jcm-book-library/my-book-library, branch claude/keen-sagan-yf9rqf:
- v3/reading-log.html is the working app. Copy its patterns directly.
- v3/README.md covers the data model and sheet rules.
- v3/brand/BRAND.md covers how a brand kit gets applied.
Don't change anything in that repo. Build this project in its own repo or folder.

HOSTING
- One self-contained HTML file, published as a private claude.ai artifact.
- It reaches Google Sheets through the artifact "mcp" capability
  (server "Google Sheets"; tools get_values, append_values, update_values),
  called via window.claude.use('mcp'). Results come back in payload.values.
- The page can't fetch other websites (CSP). Scripts load from cdnjs only
  (Chart.js 4.4.1). Fonts come from Google Fonts.
- Keep a copy of every version in the repo on a feature branch.

LOOK ("Proton Seasons")
- Dark only. Base colours: bg #16141f, surface #1e1b2b, raise #2a2640,
  line #353050, fg #f1effa, muted #a49fbf, danger #ff7a7a.
- Each month has its own accent colour, Jan to Dec:
  #e8935a #e07a7a #d9738f #c573b4 #a674e0 #7f6cf5 #6a7ff0 #5591e0 #3fa4b8
  #43ad8f #7bae6a #d6a345
- Drift: over the month, the accent moves up to 60% of the way toward the
  next month's colour. Tint: bg and surface take 5% of the accent (raise 6%, line 8%).
- Lime #c4f04a appears in only one or two places (rolling average, today's progress).
- Fonts: Atkinson Hyperlegible 700 for headings and big numbers; Figtree 400–600 for body.
- Layout:
  - Header: date line in the accent colour, wordmark, sync status with a Refresh button.
  - A pill tab bar.
  - Stat tiles: small uppercase label, big number, muted note underneath.
  - Rounded cards with a 1px line border.
  - Phone first: a 16px side gutter and no sideways scrolling.
    Laptop: two columns.
- Charts: Chart.js, month-coloured bars, lime line for the rolling average.
  Clicking a bar or rating drills into the matching items.

SHEET SAFETY (non-negotiable; my old app broke my sheet)
- Every row has a stable id column. Before any write, find the row by id,
  then write only the cells that changed. Never rewrite the whole sheet,
  and never delete and re-add rows.
- Numbers and dates are written as real values (yyyy-mm-dd). Text is
  prefixed with ' so Sheets doesn't reinterpret it.
- Never write to formula columns. Ask me which columns are formulas.
- Before any bulk clean-up, duplicate the tab as a dated backup, trial the
  change on a copy, and show me the plan first.
- Settings live in an "App Settings" tab (key | value), not in the code.

WAY OF WORKING
- First read the sheet's headers and a sample of rows. Then propose
  the data model, the tabs and a first version, and wait for my OK.
- Test headless with Playwright (Chromium at /opt/pw-browsers/chromium),
  with a stubbed window.claude, at both laptop and phone width.
- Give me options with a recommendation, and lead with bullet points.

PROJECT-SPECIFIC IDEAS (adapt or discard)
[TV & film: watchlist, currently watching with season/episode progress,
 episodes or hours per week, finished-this-year tiles, ratings by genre
 or network, "what to watch next" from my own data.]
[Diary: quick daily entry, streaks, mood/energy trends, monthly review.
 PRIVACY: this data is sensitive. Only read the columns the feature needs,
 keep the artifact private, and never copy entries into other sheets,
 repos or chats.]
```
