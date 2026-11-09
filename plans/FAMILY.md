# Plan: The Library for the family

Status: **planned, not started.** Written 9 Nov 2026. Target: launch about 20 Dec 2026, ahead of Christmas.
Replaces the October notes in `v3/FAMILY-PLAN.md` (branch `claude/keen-sagan-yf9rqf`) where they differ.

## Decided
- **Name and domain:** "Our Library", on `ourlibrary.au`. Plain `.au` only needs an Australian citizen or resident; `.com.au` needs an ABN, so not that. Bought through VentraIP on 9 Nov 2026 (decline the free `ourlibrary.online` add-on).
- **People:** 5 at launch, possibly 7 (the other two read less). Adults.
- **Sign-in:** invite-only with a 6-digit email code. Sign-ups stay off; the owner invites from the Supabase dashboard. Google sign-in comes later, together with notifications, if everyone uses it regularly.
- **Backend:** the existing Supabase project `jcm-apps`, schema `books`. Every table already has `user_id` and an "own rows" rule, so each new person starts with an empty library.
- **Shared with family:** shelves, ratings, reviews, current reads, and a small box per person with **this month only**: pages per day, the month's total and the streak. No previous months, no year-to-date, no ranking. Person cards are sorted A–Z, never by pages. Notes are never shared. Any book can be hidden with a "Hide from family" switch.
- **Family-member version:** same app with a simpler Toolbox. Members can only change the Look (background and spine colours). No data tools, Fill details or goal setup for the first three months; the owner makes changes for them, then personal settings come in slowly.
- **Chat:** one family "reading room" thread, optionally one thread per family challenge. Live while the app is open, with an unread badge. No phone notifications in this version.

## Owner to-do
1. Buy `ourlibrary.au` at VentraIP (auto-renew on, no add-ons).
2. Create a Resend account (free tier) for the sign-in emails. Supabase's built-in email only sends to members of the Supabase team, so family can't get codes without it.
3. Paste the DNS records Claude provides into VentraIP's DNS page: four GitHub "A" records plus `www` for the site, and Resend's three records for email.
4. GitHub: repo → Settings → Pages → Custom domain `ourlibrary.au`, tick **Enforce HTTPS**.
5. Supabase:
   - Add `https://ourlibrary.au/**` to the redirect URLs.
   - Set Resend as the custom email sender.
   - Change the sign-in email to show the 6-digit code.
6. Get one real Goodreads or StoryGraph export from a family member by week 2.
7. Pick the trial person for week 4.

## Safety before anyone joins
- **Separate web address:** the family app lives on `ourlibrary.au`, so its sign-in is stored apart from the owner's other apps on `jcm-book-library.github.io`. The owner signs in there once.
- **Lock the other apps to the owner:** family accounts sit in the same Supabase sign-in system as The Brain. Their data is already invisible to family through "own rows", but each other app's rules should also accept only the owner's account. Do this as a small reviewed change per app before invites go out.
- A second Supabase project was considered and rejected: it would break The Brain reading `shared.activity`.
- Before launch, check the public repo for personal data (sheet ids, any built-in snapshot) and remove it.

## What gets built
- **Schema (`supabase/04-family.sql`, pasted by the owner):**
  - `profiles` (name, colour, role owner/member)
  - family membership
  - `hidden` flag on books
  - `reviews`
  - `recommendations` (from, to, title, author, note)
  - `messages` (thread, author, text)
  - views that show family only the shared fields and only this month's daily totals and streak
  - All of it covered by Row Level Security that checks family membership. Tested on a local Postgres first, including that a member can't read another member's notes, log history or hidden books.
- **Sign-in:** an email code screen on the new domain, using the existing shared sign-in block.
- **First run:** name and colour, then import:
  - Goodreads or StoryGraph CSV with a preview before saving. read / currently-reading / to-read map to Finished / Reading / TBR. Ratings, dates, page counts and ISBNs come across, and other shelves become reading lists.
  - Each import is tagged so **Undo import** can remove it during the first day. This is a deliberate one-off bulk insert into the member's own rows.
  - Paste a list and quick add also work. Fill details tops up gaps.
- **Tabs:** Now · Library · Next · **Family** · Insights.
- **Family tab:**
  - equal person cards: current reads, a small calendar of this month's pages, month total, streak
  - tap a person for their shelves, ratings and reviews
  - write reviews on your own reads
  - Recommend to → lands in that person's Wishlist Inbox as "Recommended by <name>" with the note
  - the reading room chat
  - optional challenge threads
- **Member mode:** the Toolbox shows only Look; data tools hidden.
- **Tests:** extend `tests/run-all.sh` with fake family accounts: sign-in, import (both CSV formats), privacy (what a member can and cannot read), recommendations and chat.

## Timeline
| Week | Built | Owner |
|---|---|---|
| 1 (10–16 Nov) | Family schema and privacy rules; other apps locked to the owner | Domain, Resend, DNS records |
| 2 (17–23 Nov) | Email-code sign-in on `ourlibrary.au`, profiles, member mode, CSV import with preview and undo | Real export from one family member |
| 3 (24–30 Nov) | Family tab: person cards, shared shelves, reviews | Write a few reviews to test |
| 4 (1–7 Dec) | Recommendations, chat, challenges. Trial with one person | Pick the trial person |
| 5 (8–14 Dec) | Fixes from the trial, then invite the rest | Send invites |
| 6 (15–21 Dec) | Freeze, buffer, launch about 20 Dec | — |

If time runs short, cut in this order: challenge threads, then live chat (fall back to messages that appear on refresh). Person cards, import, reviews and recommendations stay.

## Later (after Christmas)
- Google sign-in and notifications outside the app.
- Personal settings for members, introduced slowly after the first three months.
- Reactions and comments on reviews.
- Borrowing from each other's physical shelves, tying into Lent out.
- "Both read" comparisons.

## Open questions (none block week 1)
- Invite the two lighter readers at launch or after Christmas?
- Reviews: stars plus text, or text only?
