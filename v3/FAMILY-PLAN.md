# Family library plan: decisions so far

Last updated 15 Oct 2026.

## Decided
- **Backend:** Supabase. A single project, Sydney region, on the free plan. Books, TV and diary each get their own tables in it.
- **Hosting:** GitHub Pages, with one umbrella domain and a subdomain for each project (books., tv., diary.).
- **Sign-in:**
  - Email with a 6-digit code, invite-only, with public sign-up turned off.
  - Google sign-in turned on for the owner only, as a testbed for work projects.
- **Email sending:** Resend or Brevo, sending from the domain, set up before the trial.
- **Users:** adults only, no more than about 10 in the next 6–12 months.
- **Backups:** a daily automatic copy of the database to a Google Sheet, keeping 7 days.
- **Google Sheet:** after the move it becomes backup only. All editing happens in the app.
- **The claude.ai artifact version** retires after the move. The GitHub Pages app becomes the only version.
- **App name:** taken from the domain chosen. "Jackets & Manuscripts" was chosen to match the owner's initials for the logo.
- **Personal data:** remove the built-in SNAPSHOT data from the app before family launch.

## Domain shortlist
- familybooktree
- ourlittlelibrary
- dogearedfamily. As a kid the owner dog-eared books, which drove their dad mad, so work the idea into the app even if this name isn't the one chosen. Ideas:
  - a folded page corner as the "current page" marker
  - "dog-ear" as the name for saving a favourite passage or quote
  - a page-fold animation when pages are logged

## Owner to-do
1. Pick the name and buy the domain. Check what the public domain lookup shows.
2. Create the Supabase account and project, and store the database password safely.
3. Later: create the email-sending account.

## Order of work
Calibre clean-up → database design and privacy rules → migrate the sheet and run it alongside the old setup → families, invites and imports (Goodreads/StoryGraph CSV) → trial with one family member in late November → Christmas launch.
