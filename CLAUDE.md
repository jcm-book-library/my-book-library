# Jackets & Manuscripts: notes for Claude

**Read the house rules first:** [HOUSE-RULES.md](https://github.com/jcm-book-library/control-room/blob/main/HOUSE-RULES.md) in `control-room` (plain text: https://raw.githubusercontent.com/jcm-book-library/control-room/main/HOUSE-RULES.md). They cover Google Sheet safety, branches and pull requests into `main`, using cheaper models to save usage credits, and the build template. The notes below are this repo's own; where they are more specific, they win. The project charter is `project.json`.

## This repo
- `app.html` is the app source; the same file is published as the claude.ai artifact.
- `python3 tools/build-pages.py` rebuilds `index.html` from `app.html` for GitHub Pages.
- Data lives in the Entertainment Tracker Google Sheet.
- `old.html` is kept for reference only: "Don't use its Save, because it rewrites the whole sheet."
- The data model and sheet-safety rules are in `v3/README.md` on branch `claude/keen-sagan-yf9rqf`.
