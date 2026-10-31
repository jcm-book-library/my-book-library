# The Library

My reading log, library and dashboard. The Google Sheet "Entertainment Tracker" holds the data, and this app reads and writes it.

The app was first called "Jackets & Manuscripts"; that name is retired. The repo is still `my-book-library`.

- **Live site:** https://jcm-book-library.github.io/my-book-library/
- **Old app:** `old.html`. It's kept for reference only. Don't use its Save, because it rewrites the whole sheet.

## Files
| File | What it is |
|---|---|
| `app.html` | The app source. Edit this. The same file is published as the claude.ai artifact. |
| `index.html` | Built from `app.html` for GitHub Pages. Rebuild it with `python3 tools/build-pages.py`. |
| `manifest.webmanifest`, `icons/` | Home-screen install and icons. |
| `old.html` | The previous app. |
| `HANDOVER.md` | Current sheet layout, working rules, conventions, known gaps and open ideas. Start here. |
| `tools/build-pages.py` | Builds `index.html` from `app.html`. |
| `project.json` | The charter read by the Control Room dashboard. |

## How it connects
- **Inside claude.ai:** it uses the Google Sheets connector.
- **On GitHub Pages:** it uses Google sign-in, from the OAuth Client ID saved in the browser (`mbl_config`, shared with the old app). The Client ID's Google Cloud project must list `https://jcm-book-library.github.io` under Authorized JavaScript origins. Sign-in lasts about an hour. After that, press **Connect** again.

The data model and sheet-safety rules are in `HANDOVER.md`. `v3/README.md` on branch `claude/keen-sagan-yf9rqf` is the older note.
