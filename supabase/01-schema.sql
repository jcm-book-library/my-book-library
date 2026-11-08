-- The Library on Supabase: tables, access, Row Level Security and live sync.
-- Run once in Supabase: SQL Editor > New query > paste all of this > Run.
-- Safe to run again: it only creates what is missing and resets the access rules.
--
-- Same pattern as The Brain: every row carries user_id (filled in from whoever is signed in),
-- RLS lets a signed-in user see and change only their own rows, and signed-out visitors
-- (the "anon" role) get nothing. Formula columns from the Sheet (Books remain and %) are
-- not stored: the app works them out.

create schema if not exists books;

-- Books tab: one row per copy or read. id is permanent (new id = highest + 4).
create table if not exists books.books (
  row_id        bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  id            integer not null,
  title         text,
  author        text,
  status        text,
  rating        numeric,
  favourite     boolean not null default false,
  cover         text,
  current_page  numeric,
  pages         numeric,
  start_date    date,
  finish_date   date,
  series        text,
  series_num    numeric,
  type          text,
  format        text,
  publisher     text,
  genre         text,
  theme1        text,
  theme2        text,
  theme3        text,
  setting       text,
  year          integer,
  awards        text,
  tier          text,
  up_next_order numeric,
  why           text,
  triaged       date,
  added         date,
  copies        text,
  isbn          text,
  loaned        text,
  loanee        text,
  synopsis      text,
  notes         text,
  updated_at    timestamptz not null default now(),
  unique (user_id, id)
);

-- Reading Log tab: one row per entry. No id in the Sheet; row_id is the key here.
-- A deleted entry is kept with pages 0 and source 'deleted', as in the Sheet.
create table if not exists books.reading_log (
  row_id       bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  date         date not null,
  pages        numeric not null default 0,
  book_id      integer,
  title        text,
  page_reached numeric,
  logged_at    text check (logged_at is null or logged_at = '' or logged_at ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$'),
  source       text,
  minutes      numeric,
  updated_at   timestamptz not null default now()
);

-- App Settings tab: key | value | note.
create table if not exists books.settings (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  key        text not null,
  value      text,
  note       text,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- Ratings tab: one breakdown row per rating.
create table if not exists books.ratings (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  date       date,
  book_id    integer,
  title      text,
  category   text,
  gut        numeric,
  criteria   text,
  standout   text,
  fatal_flaw text,
  suggested  numeric,
  final      numeric,
  updated_at timestamptz not null default now()
);

-- Contents tab: anthology stories. The newest saved_at per book wins.
-- saved_at stays text ('yyyy-mm-dd hh:mm:ss'), compared as text by the app.
create table if not exists books.contents (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  book_id    integer not null,
  saved_at   text,
  story      text,
  start_page numeric,
  updated_at timestamptz not null default now()
);

-- Wishlist tab (ids WL0001...). A removed item is deleted here; the copy back clears its Sheet row.
create table if not exists books.wishlist (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  added      date,
  title      text,
  author     text,
  series     text,
  number     text,
  type       text,
  format     text,
  publisher  text,
  stage      text,
  waiting    text,
  want_as    text,
  checked    text,
  checked_on date,
  release    text,
  price      text,
  link       text,
  seen_in    text,
  interest   text,
  gift       boolean not null default false,
  notes      text,
  book_id    integer,
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

-- Series Tracker tab: one row per tracked series, keyed by its name.
create table if not exists books.series_tracker (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  series     text not null,
  author     text,
  publisher  text,
  kind       text,
  status     text,
  released   numeric,
  sold_as    text,
  link       text,
  notes      text,
  updated_at timestamptz not null default now(),
  unique (user_id, series)
);

-- Reading Lists tab (ids RL0001...). "order" is a reserved word, so it is sort_order here.
create table if not exists books.reading_lists (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  list       text,
  sort_order numeric,
  title      text,
  author     text,
  notes      text,
  book_id    integer,
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

-- Wishlist archive tab: history of books moved out of the Wishlist.
create table if not exists books.wishlist_archive (
  row_id       bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  id           text not null,
  title        text,
  author       text,
  available    text,
  status       text,
  type         text,
  format       text,
  eta          text,
  cost         text,
  pages        numeric,
  source       text,
  reading_list text,
  notes        text,
  series       text,
  link         text,
  book_id      integer,
  updated_at   timestamptz not null default now(),
  unique (user_id, id)
);

-- QUOTES tab of the separate Quotes sheet. "from" and "by" are reserved words.
create table if not exists books.quotes (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  quote      text,
  from_title text,
  character  text,
  author     text,
  book_id    integer,
  page       numeric,
  added      date,
  updated_at timestamptz not null default now()
);

-- 8 Nov fixes for tables made by the first version: loaned holds 'Yes' or a lend date, so it is text.
do $$ begin
  if (select data_type from information_schema.columns
      where table_schema = 'books' and table_name = 'books' and column_name = 'loaned') = 'boolean' then
    alter table books.books alter column loaned drop default, alter column loaned drop not null;
    alter table books.books alter column loaned type text using case when loaned then 'Yes' end;
  end if;
  -- Wishlist number ("1-3") and price ("$19.99 on sale") are free text in the app, so text here too.
  if (select data_type from information_schema.columns
      where table_schema = 'books' and table_name = 'wishlist' and column_name = 'number') = 'numeric' then
    alter table books.wishlist alter column number type text using number::text,
                               alter column price  type text using price::text;
  end if;
end $$;

-- Keep updated_at current on every change.
create or replace function books.touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['books','reading_log','settings','ratings','contents','wishlist','series_tracker','reading_lists','wishlist_archive','quotes'] loop
    execute format('alter table books.%I enable row level security', t);
    execute format('create index if not exists %I on books.%I (user_id)', t || '_user_idx', t);
    execute format('drop trigger if exists touch on books.%I', t);
    execute format('create trigger touch before update on books.%I for each row execute function books.touch()', t);
    execute format('drop policy if exists "own rows" on books.%I', t);
    execute format('create policy "own rows" on books.%I for all to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    -- Live sync: changes reach your other devices straight away (RLS still applies).
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'books' and tablename = t) then
      execute format('alter publication supabase_realtime add table books.%I', t);
    end if;
  end loop;
end $$;

-- Access: signed-in users only (RLS above narrows that to their own rows).
revoke all on schema books from anon, public;
revoke all on all tables in schema books from anon, public;
grant usage on schema books to authenticated;
grant select, insert, update, delete on all tables in schema books to authenticated;
grant usage, select on all sequences in schema books to authenticated;
revoke execute on function books.touch() from public, anon, authenticated;

-- Tell the Data API to pick up the new tables.
notify pgrst, 'reload schema';
