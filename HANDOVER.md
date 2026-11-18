# Our Library: handover

Read this after `CLAUDE.md` and the house rules. Updated 17 Nov 2026, at the end of the session that took the app from the 31 Oct audit to a family-ready trial build. A fresh session should be able to carry on from here without the old conversation.

## Where we are
- **Live:** https://ourlibrary.au/ (GitHub Pages, `CNAME` file; DNS at VentraIP: four GitHub A records and a `www` CNAME to `jcm-book-library.github.io`; the old `jcm-book-library.github.io/my-book-library/` address forwards). `main` holds everything up to PR #19.
- **Data:** Supabase project `jcm-apps`, schema `books` (the owner's library) plus schema `family` (sharing). The Google Sheet "Entertainment Tracker" is now a backup the owner refreshes weekly with Copy Supabase → Sheet.
- **Family trial:** everything for the owner's sister to join is built and merged: email-code sign-in, the family-member version of the app, the welcome panel, the Family tab, reviews, Recommend to, Hide from family. She has **not been invited yet** (trial around 27 Nov 2026, during a trip together).
- **Not built yet:** the StoryGraph/Goodreads import (waiting for the sister's real CSV), family chat, family challenges, themes round 2.

## What changed this session (31 Oct to 17 Nov 2026, PRs #4–#19)
- **Plans written:** `plans/FAMILY.md` (family roadmap) and `plans/THEMES.md` (theme ideas).
- **Look:**
  - Reading now cards: "Slate raised" design with a progress ring, Pages to go / Ave a day / Days to go / Approx finish, weekday chips, 14-day bars, "N days since started", and On page / Log / Dog-ear centred on the ring.
  - Leather-bound shelves with an e-reader and a tablet on the Reading now shelf.
  - Library list boxes open with 10 books each.
- **Insights:** rebuilt as five chapters. Every chart opens with its question and a computed takeaway, and a "?" button holds "why this chart". There are pages-per-month and ratings-per-month charts, Dog-ear quotes are at the top, and the old bar charts are gone. Built with the data-viz method (validated palette, no dual axes).
- **Now tab:**
  - Tiles: 7-day avg, books on the go, books finished this month and this year.
  - Read next and Favourites rotate daily, and On this day is in a 2×2 row.
  - Pages per day has 7 / 30 / 90 days, This year and Last 12 months.
- **Ave a day** is each book's own pace: pages read ÷ days since starting, days off included, with long reads counting only the last 14 days, from page numbers. "2026 so far" counts finished books plus the current page of each book being read.
- **Library:**
  - Authors: Top 10 read, Top 10 on TBR, all authors (50 then Show all).
  - A back-to-top button on every tab, and the scroll position is remembered per view, after data refreshes and across iPhone app restarts.
- **Next Up** (renamed from Next):
  - Your TBR has a weekly rotating Top 5 (Quick wins, Non-fiction, Longest, Waiting longest), and Award watch is in Plan.
  - **Wishlist redesign:**
    - Sticky add bar, Inbox / Download / Buy / Borrow tabs, and Available / Coming soon / Not available sections.
    - Got it → Up next / Soon / Someday plus copies.
    - Book / Graphic novel / Comic stickers and an optional filter, a Copy button for "Title — Author", and edits stay on the current tab.
- **Remove books:** a ✕ on TBR / Paused / DNF sets status `Removed`, with a 10 s Undo. Toolbox → Removed books offers Restore or Delete for good.
- **Themes round 1:** Default, Day, Night and Easy on the eyes, plus a dyslexia-friendly font toggle. Toolbox → Look, saved per account.
- **Renamed** to Our Library, with new shelf-of-spines icons.
- **Family:** `supabase/04-family.sql`, sign-in by emailed code, member mode, welcome panel, avatar menu, Family tab.
- **Tests:** `tests/run-all.sh` now runs four suites (see Gotchas).

## Decisions (owner's, keep to them)
- **Process:** branch and PR into `main` for every change; the owner merges. Run `bash tests/run-all.sh` before every push.
- **The owner uses only the live site,** not the claude.ai artifact, which is read-only now.
- **Page logging stays manual** (no Kobo sync). No spending stats. Loans get a "Lent out" popup, not reminders.
- **Family:** about 5 people (up to 7), adults.
  - **Invite-only** email-code sign-in; Google sign-in later, with notifications.
  - **Shared:** shelves, ratings, reviews, current reads, and **this month only** of pages and streak. No history and no ranking (cards sorted A–Z). Notes are never shared. Hide from family is per book.
  - **Members** get a simpler Toolbox (Look and Sign out) for the first three months.
- **Wishlist:** "Got it" fills copies (Download: Kobo or PDF; Buy: Physical; Borrow: a library note). Gift kept, Waiting dropped, fields cut down (add back only what's missed). Series tracking lives in Library → Series, not the Wishlist.
- **Remove = option A** (recoverable status `Removed`); Delete for good only from Toolbox, after a confirm.
- **Themes:**
  - Round 1 is Default / Day / Night / Easy.
  - Round 2 (Library, E-book with a DOS variant, Classical, Morning) is a surprise for later.
  - Layout never changes between themes.
- **Charts:** every chart must answer a question; not everything a bar chart; the "Why this chart" note sits behind "?".
- **Spine titles never show "…":** shrink, then two lines, then cut after a whole word. The same rule applies to card titles.
- **Domain:** `ourlibrary.au` (plain .au, Citizen/Resident). The free `.online` add-on was declined.

## Next steps
1. **Sister's trial (~27 Nov):**
   1. The owner invites her: Supabase → Authentication → Users → Invite user.
   2. She signs in once with the emailed code.
   3. The owner runs `select family.add_member('<her email>', '<her name>');`.
2. **StoryGraph import:** build it as soon as her CSV arrives. Check her real file first; tests use a made-up file with the same columns. Match by column name: Title, Authors, ISBN/UID, Format, Read Status, Star Rating, Last Date Read, Read Count, Tags… Goodreads columns too.
   - **Mapping:** read → Finished, currently-reading → Reading, to-read → TBR, did-not-finish → DNF, paused → Paused. Shelves/tags become reading lists.
   - **Behaviour:** preview before saving, spot duplicates of books already in the account, and offer "Undo import" for a day (a deliberate one-off bulk insert into the member's own rows). The welcome panel's import card is waiting for it.
3. **After the trip:** fixes from her feedback, then family chat (one reading room plus challenge threads; `family.messages` and `family.challenges` already exist with RLS), then challenges, then invites for the rest of the family. Launch target about 20 Dec.
4. **Later:** themes round 2; barcode scanning (iPhone, needs a scanning library); Google Drive covers for books Open Library lacks; fill the ~220 blank page counts with Fill details.

## Gotchas
- **Tests:** `bash tests/run-all.sh` runs four suites:
  - `check.sh`: Sheet-mode screens plus recorded write flows, compared with git HEAD.
  - `supabase.js`: against a fake Supabase in `tests/fakes.js`, including family RLS-like rules.
  - `copyback.js`.
  - `sql/family.sh`: the real `04-family.sql` on a throwaway local Postgres 16.

  Screens are flaky in the sandbox. One to three screens just over 100 px at a channel diff of 1–3, with every flow byte-identical, is noise; say so in the PR. **Write flows must stay byte-identical** unless a change is intended and explained.
- **Data layer:** `sheetDb` and `sbDb` have the same methods and `DB()` picks one; screens never call a backend directly. New writes go in both backends (or are clearly Supabase-only, like everything family), and both get tests.
- **Ids are never reused:**
  - **Books:** highest id (including Removed) or the `bookIdFloor` App Setting, whichever is higher, + 4. The floor only goes up and is set by Delete for good.
  - **Wishlist:** highest of the Wishlist **and** the Wishlist archive ids, + 1. An archive row whose id already exists gets a `-2`, `-3` suffix. This fixed a real "duplicate key wishlist_archive_user_id_id_key" bug.
  - Any new id scheme must count deleted and archived ids.
- **Supabase delete:** look the row up first, require exactly one, then delete by `row_id`. Never delete by a filter that could match two rows.
- **Copy Supabase → Sheet:** lists by title any book in the Sheet that isn't in the app and asks before clearing it. The tab is backed up first.
- **Removed books** are split out on load into `state.removedBooks`, so every screen ignores them automatically; `family.books()` also excludes them.
- **Wishlist values:**
  - Stages written now are `Inbox / Download / Buy / Borrow`; availability (`checked`) is `Available / Coming soon / Not available`; `format` is `Book / Graphic novel / Comic`.
  - Old values are only **read** as new ones (`wishHow`, `wishAvail`, `wishKind`), never bulk-rewritten. A row gets the new word when the user next changes it.
  - The Sheet's dropdowns still list the old words, so copy-back writes new words into those cells. API writes aren't blocked, but the cells may show a validation flag; update the dropdowns (keep `customUiMode: CHIP`) if the owner minds.
- **Nothing deletes tracked series automatically.** The old Wishlist "prune" was removed because Library → Series shows empty tracked series on purpose.
- **Themes:**
  - Colours are tokens on `:root`, with `[data-theme]` on `<html>`. Default must look exactly as before.
  - Accent buttons pick dark or white text with `inkFor()`, whichever reads better on the month's colour.
  - The choice is saved per browser (`mbl_theme`, `mbl_dysfont`) and to settings `theme` / `dyslexiaFont` only when changed; loading writes nothing.
- **Scroll memory:** kept per view key, also in `localStorage` `mbl_scroll` for 30 minutes. `refresh()` saves before and restores after (and again after the Wishlist reloads).
- **Sign-in:**
  - In Supabase mode nobody sees data until signed in.
  - Auth is `POST /auth/v1/otp {create_user:false}` then `/auth/v1/verify {type:'email'}`; the session is stored by `sb.keep()` (`jcm-sb-session`, Web Lock refresh).
  - Sign-in storage is per address, so `ourlibrary.au` has its own session separate from the other jcm apps.
  - Never ask for or use the `service_role` key or the database password.
- **Supabase setup that must stay in place:**
  - Magic Link template shows `{{ .Token }}`.
  - Custom SMTP through Resend (sender `hello@ourlibrary.au`).
  - Sign-ups off.
  - Redirect URL `https://ourlibrary.au/**`.
  - Exposed schemas include `books`, `shared` and `family`.
  - Google OAuth origin `https://ourlibrary.au` (for the Sheet backup).
- **Owner-only lock on other apps:** the control-room session added `shared.owners`, `shared.is_owner()` and a restrictive "owner only" policy on every `brain` table (done 15 Nov; the owner's email is in Supabase only, not in any repo). When another app moves to Supabase, its schema must be added to that list (control room owns it). Never add `books`, `family` or `shared`.
- **SQL changes** go in a new numbered file in `supabase/` that the owner pastes into the SQL Editor (safe to re-run); Claude can't reach the project. `04-family.sql` has been run (15 Nov). If unsure whether that copy already had the change excluding Removed books from `family.books()`, run the current file again; it is safe to re-run.
- **Built-in snapshot:** the old personal snapshot (`SNAPSHOT`, 9 Oct data) is no longer loaded in Supabase mode, but it is **still in the public `app.html`**. Remove it before the wider family launch (see Open questions).
- **The claude.ai artifact is read-only** (`ARTIFACT_READ_ONLY`). `confirm()` doesn't work there, so the app uses its own `askOk` dialog.
- **Covers:** Open Library works on the live site but has limited coverage; the sandbox can't reach it (tests use a stand-in). The same goes for Google Fonts and Google Books in tests.
- **Never read the `Brain tester` sheet beyond its Date and Pages columns,** and never touch other apps' tabs.

## Open questions
- **Remove the `SNAPSHOT` blob and the hard-coded `SHEET_ID` from the public `app.html` before inviting the wider family?** Recommended yes; move the Sheet id into the owner's browser settings.
- **The old routine of copying `app.html` to `v3/reading-log.html` on `claude/keen-sagan-yf9rqf`** wasn't kept up after early November. Retire that branch copy, or resume it?
- **Should the Sheet's Wishlist dropdowns be updated to the new words?** (Owner choice; needs a backup tab first.)
- **The two lighter readers:** invite at launch or after Christmas?
- **Reviews:** stars plus text (built) — keep, or text only?
- **Books adds in Sheet mode still use `append_values`.** Delete for good leaves blank Books rows, so a Sheet-mode add could land in a gap. Low risk because the owner is on Supabase, but move Books adds to below-last-row if Sheet mode is ever used for adding again.

## Reference: Supabase and the data layer
- `supabase/`:
  - `01-schema.sql`: `books` tables, own-rows RLS, realtime
  - `02-check.sql`: row counts
  - `03-shared.sql`: the `shared.activity` view The Brain reads
  - `04-family.sql`: the family layer
  - `05-reading-list-status.sql`: `reading_lists.status` (run in the SQL Editor before using statuses in Supabase mode)
- Family layer: schema `family` with `members` (role owner/member, display_name, colour; added only via `family.add_member` in the SQL Editor), `reviews`, `recommendations`, `messages`, `challenges`, plus `books.books.hidden`.
  - Other people's data is read only through the security-definer functions `family.books()` (shared columns only; never notes/why/plan/copies/loans; never hidden or Removed books), `family.this_month()` (Melbourne time) and `family.streaks()` (the app's rule).
  - Members never read each other's `books` tables.
- `loadMe()` reads my `family.members` row. If there's no row or no schema, I'm treated as owner. `role = member` gets the simple Toolbox. `sbDb.profileSave` PATCHes only `display_name, colour`.
- Family tab writes:
  - `family.reviews`: POST, then a PATCH of `body, stars`
  - `family.recommendations`: POST; the recipient PATCHes only `status`
  - Hide from family: `writeBookFields(id, {hidden})`
  - Add to Wishlist from a recommendation uses `appendWishRows`

  The Realtime socket joins `realtime:family` for recommendations.
- Data tools (Toolbox → Data & sign-in, owner only): Copy Sheet → Supabase, Check, Copy Supabase → Sheet (weekly backup: preview, dated hidden backup tab, changed cells only, cleared not deleted, never the formula columns). These are the only bulk writes; keep `tests/copyback.js` passing.
- If the app shows no books but `02-check.sql` shows rows: stale sign-in. Sign out and back in.

## Reference: Sheet safety conventions
- Find the row by `id` right before every write and write only changed cells. Never rewrite whole tabs, never sort from code, never delete and re-add rows; removing an item clears its cells.
- **New rows:** below the last used row with an explicit range for Wishlist, Reading Lists and Series Tracker. Books, Reading Log, Ratings, Wishlist archive, App Settings, Contents and Quotes still use `append_values` (see Open questions).
- **Formula columns** `remain` and `%` in Books are written only once, on a new row:
  - `=IF(N(pages)>0,pages-currentPage,"")`
  - `=IF(N(pages)>0,currentPage/pages*100,"")`
- **Columns are read by header name.**
  - Text is written with a leading `'`, numbers as numbers, dates as `yyyy-mm-dd`.
  - Written unquoted: Wishlist `gift`, `release`, `checkedOn`; Series `released`; Reading Lists `order`; Reading Log `pages`, `pageReached`, `minutes`, `loggedAt`; the Contents timestamp.
- **Read caps:**
  - Books `A:AZ` to row 5000; Wishlist `A:Z` to 3000; Reading Lists `A:H` to 2000; Reading Log `A:H` to 20000.
  - Series Tracker `A:I` to 500, so a 10th column wouldn't be read.
- Dropdown changes keep the chip style (`customUiMode: CHIP` with `dropdownStyle`). Back up a tab before any column or bulk change, show the plan before the first Sheet write of a session, and check bulk writes by reading them back.
- **Sheets API quirks:**
  - `update_values` is USER_ENTERED and refuses writes bigger than the range.
  - `repeatCell` and `copyPaste` skip filter-hidden rows.
  - Large `get_values` results land in a file.

## Reference: tabs and columns
- **Books:** `title, author, status, rating, favourite, cover, currentPage, pages, remain, %, startDate, finishDate, series, seriesNum, type, format, publisher, genre, theme1, theme2, theme3, setting, year, awards, tier, upNextOrder, why, triaged, added, copies, isbn, loaned, loanee, synopsis, notes, id`
  - Supabase adds `hidden`.
  - `status`: Reading, TBR, Re-read, Finished, Paused, DNF, Removed.
  - `tier`: Up next / Soon / Someday, with `upNextOrder`.
  - `copies`: `Kobo | PDF | Physical`.
  - `cover`: `ol:<id>` or `none`.
  - Each read is its own row; re-reads are grouped by `readKey` (title + `authorKeyOf` first author).
- **Wishlist:** `id, added, title, author, series, number, type, format, publisher, stage, waiting, wantAs, checked, checkedOn, release, price, link, seenIn, interest, gift, notes, bookId`. See Gotchas for the stage, availability and kind values.
- **Wishlist archive:** `Title, Author, Status, Type, Format, ETA, Cost, Reading List, Notes, id, Series, Link, bookId`
- **Series Tracker:** `series, author, publisher, kind, status, released, soldAs, link, notes`
- **Reading Lists:** `list, order, title, author, notes, id, bookId, status`. Lists are standalone: no matching to Books. `bookId` is legacy (never read or written by the list screens). `status` is To read (or blank) / Reading / Read, per entry. A Sheet tab without a `status` header still reads (blank); writing a status needs the header, and Copy Supabase → Sheet refuses if Supabase has statuses and the header is missing.
- **Reading Log:** `date, pages, bookId, title, pageReached, loggedAt, source, minutes`. A deleted entry is soft-deleted: pages 0, source `deleted`.
- **App Settings:** `streakStartDate, streakMinPages, dailyGoalPages, yearBookGoal, bookIdFloor, theme, dyslexiaFont`
- **Ratings** is positional (10 columns). **Contents:** `bookId, stamp, story, start`. A separate Quotes sheet holds `QUOTES` (A:G).
