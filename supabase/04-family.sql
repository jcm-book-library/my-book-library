-- Our Library: the family layer. Run in Supabase after 01-schema.sql:
-- SQL Editor > New query > paste all of this > Run. Safe to run again.
-- Then add "family" to Exposed schemas (Integrations > Data API > Settings).
--
-- What family members can see of each other is decided here, not in the app:
--   * books: only the shared columns below, never notes, why, plan, copies or loans,
--     and never a book marked hidden;
--   * reading: this month's pages per day and the current streak, nothing older;
--   * reviews, recommendations to or from you, family chat and challenges.
-- Everything in the books schema stays "own rows": a member still cannot read
-- another member's books, log, settings, wishlist or quotes directly.
-- The functions run as their owner (security definer) so they can read across
-- members, and each one checks family membership itself. Members are added only
-- from the SQL Editor (family.add_member), never from the app.

create schema if not exists family;

-- Families and who is in them. role 'owner' can manage challenges.
create table if not exists family.families (
  id         bigint generated always as identity primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists family.members (
  family_id    bigint not null references family.families on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null check (char_length(display_name) between 1 and 40),
  colour       text check (colour is null or colour ~ '^#[0-9a-fA-F]{6}$'),
  joined_at    timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Any book can be kept out of the family view.
alter table books.books add column if not exists hidden boolean not null default false;

-- ---------- helpers (read across members; each checks membership) ----------

create or replace function family.my_families() returns setof bigint
language sql stable security definer set search_path = '' as $$
  select family_id from family.members where user_id = (select auth.uid())
$$;

create or replace function family.in_my_family(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from family.members a join family.members b on b.family_id = a.family_id
    where a.user_id = (select auth.uid()) and b.user_id = other)
$$;

create or replace function family.is_owner_of(fam bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from family.members
                 where family_id = fam and user_id = (select auth.uid()) and role = 'owner')
$$;

create or replace function family.book_hidden(owner_id uuid, book integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select hidden from books.books where user_id = owner_id and id = book limit 1), false)
$$;

-- ---------- what family can read ----------

-- Everyone's shareable books (yours included), hidden ones left out.
create or replace function family.books(member uuid default null)
returns table (user_id uuid, id integer, title text, author text, status text, rating numeric,
               favourite boolean, cover text, pages numeric, current_page numeric,
               start_date date, finish_date date, series text, series_num numeric,
               type text, format text, genre text, theme1 text, theme2 text, theme3 text,
               year integer, isbn text, synopsis text)
language sql stable security definer set search_path = '' as $$
  select b.user_id, b.id, b.title, b.author, b.status, b.rating, b.favourite, b.cover, b.pages,
         b.current_page, b.start_date, b.finish_date, b.series, b.series_num, b.type, b.format,
         b.genre, b.theme1, b.theme2, b.theme3, b.year, b.isbn, b.synopsis
  from books.books b
  where not b.hidden
    and family.in_my_family(b.user_id)
    and (member is null or b.user_id = member)
$$;

-- This month only (Melbourne time): pages per day for each family member.
create or replace function family.this_month()
returns table (user_id uuid, day date, pages numeric)
language sql stable security definer set search_path = '' as $$
  select l.user_id, l.date, sum(l.pages)
  from books.reading_log l
  where family.in_my_family(l.user_id)
    and l.pages > 0 and coalesce(l.source, '') <> 'deleted'
    and l.date >= date_trunc('month', (now() at time zone 'Australia/Melbourne'))::date
    and l.date <= (now() at time zone 'Australia/Melbourne')::date
  group by l.user_id, l.date
$$;

-- Current streak for each family member, the same rule as the app: consecutive days with at
-- least streakMinPages, counting back from today (or yesterday while today is unlogged); a run
-- that reaches the first logged day also counts the days back to streakStartDate.
create or replace function family.streaks()
returns table (user_id uuid, streak integer, today_done boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  m record; t date := (now() at time zone 'Australia/Melbourne')::date;
  minp numeric; startd date; firstd date; d date; n integer; done boolean;
begin
  for m in select distinct b.user_id from family.members a
           join family.members b on b.family_id = a.family_id
           where a.user_id = (select auth.uid()) loop
    select coalesce(nullif(s.value, '')::numeric, 1) into minp
      from books.settings s where s.user_id = m.user_id and s.key = 'streakMinPages';
    minp := coalesce(minp, 1);
    select case when s.value ~ '^\d{4}-\d{2}-\d{2}' then left(s.value, 10)::date end into startd
      from books.settings s where s.user_id = m.user_id and s.key = 'streakStartDate';
    select min(l.date) into firstd from books.reading_log l where l.user_id = m.user_id;
    firstd := coalesce(firstd, t);
    select coalesce(sum(l.pages), 0) >= minp into done from books.reading_log l
      where l.user_id = m.user_id and l.date = t and coalesce(l.source, '') <> 'deleted';
    d := case when done then t else t - 1 end; n := 0;
    while d >= firstd and (select coalesce(sum(l.pages), 0) from books.reading_log l
                           where l.user_id = m.user_id and l.date = d
                             and coalesce(l.source, '') <> 'deleted') >= minp loop
      n := n + 1; d := d - 1;
    end loop;
    if d < firstd and startd is not null and startd < firstd then n := n + (firstd - startd); end if;
    user_id := m.user_id; streak := n; today_done := done;
    return next;
  end loop;
end $$;

-- ---------- reviews ----------
create table if not exists family.reviews (
  row_id     bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  book_id    integer not null,
  body       text not null check (char_length(body) between 1 and 5000),
  stars      numeric check (stars is null or (stars >= 0.5 and stars <= 5)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

-- ---------- recommendations (land in the recipient's Wishlist Inbox) ----------
create table if not exists family.recommendations (
  row_id     bigint generated always as identity primary key,
  from_user  uuid not null default auth.uid() references auth.users on delete cascade,
  to_user    uuid not null references auth.users on delete cascade,
  title      text not null check (char_length(title) between 1 and 300),
  author     text,
  isbn       text,
  note       text check (note is null or char_length(note) <= 1000),
  status     text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_user <> to_user)
);

-- ---------- family chat ----------
create table if not exists family.messages (
  row_id     bigint generated always as identity primary key,
  family_id  bigint not null references family.families on delete cascade,
  thread     text not null default 'room' check (char_length(thread) between 1 and 60),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_family_idx on family.messages (family_id, thread, created_at);

-- ---------- family challenges (the owner sets them) ----------
create table if not exists family.challenges (
  row_id       bigint generated always as identity primary key,
  family_id    bigint not null references family.families on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  starts       date not null,
  ends         date not null,
  target_pages numeric,
  created_by   uuid not null default auth.uid() references auth.users on delete cascade,
  created_at   timestamptz not null default now(),
  check (ends >= starts)
);

-- updated_at stays current
create or replace function family.touch() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists touch on family.reviews;
create trigger touch before update on family.reviews for each row execute function family.touch();
drop trigger if exists touch on family.recommendations;
create trigger touch before update on family.recommendations for each row execute function family.touch();

-- ---------- Row Level Security ----------
alter table family.families        enable row level security;
alter table family.members         enable row level security;
alter table family.reviews         enable row level security;
alter table family.recommendations enable row level security;
alter table family.messages        enable row level security;
alter table family.challenges      enable row level security;

drop policy if exists "my families" on family.families;
create policy "my families" on family.families for select to authenticated
  using (id in (select family.my_families()));

drop policy if exists "my family's members" on family.members;
create policy "my family's members" on family.members for select to authenticated
  using (family_id in (select family.my_families()));
drop policy if exists "edit my own name and colour" on family.members;
create policy "edit my own name and colour" on family.members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own reviews" on family.reviews;
create policy "own reviews" on family.reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "family reviews" on family.reviews;
create policy "family reviews" on family.reviews for select to authenticated
  using (family.in_my_family(user_id) and not family.book_hidden(user_id, book_id));

drop policy if exists "sent or received" on family.recommendations;
create policy "sent or received" on family.recommendations for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
drop policy if exists "send to family" on family.recommendations;
create policy "send to family" on family.recommendations for insert to authenticated
  with check (from_user = (select auth.uid()) and family.in_my_family(to_user));
drop policy if exists "recipient sets status" on family.recommendations;
create policy "recipient sets status" on family.recommendations for update to authenticated
  using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));
drop policy if exists "sender can withdraw" on family.recommendations;
create policy "sender can withdraw" on family.recommendations for delete to authenticated
  using (from_user = (select auth.uid()));

drop policy if exists "read family chat" on family.messages;
create policy "read family chat" on family.messages for select to authenticated
  using (family_id in (select family.my_families()));
drop policy if exists "post to family chat" on family.messages;
create policy "post to family chat" on family.messages for insert to authenticated
  with check (user_id = (select auth.uid()) and family_id in (select family.my_families()));
drop policy if exists "delete own message" on family.messages;
create policy "delete own message" on family.messages for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "read family challenges" on family.challenges;
create policy "read family challenges" on family.challenges for select to authenticated
  using (family_id in (select family.my_families()));
drop policy if exists "owner manages challenges" on family.challenges;
create policy "owner manages challenges" on family.challenges for all to authenticated
  using (family.is_owner_of(family_id))
  with check (family.is_owner_of(family_id) and created_by = (select auth.uid()));

-- ---------- access: signed-in users only, and only the columns each table needs ----------
revoke all on schema family from anon, public;
revoke all on all tables in schema family from anon, public, authenticated;
revoke all on all functions in schema family from anon, public, authenticated;
grant usage on schema family to authenticated;
grant select on family.families, family.members to authenticated;
grant update (display_name, colour) on family.members to authenticated;
grant select, insert, update, delete on family.reviews to authenticated;
grant select, insert, delete on family.recommendations to authenticated;
grant update (status) on family.recommendations to authenticated;
grant select, insert, delete on family.messages to authenticated;
grant select, insert, update, delete on family.challenges to authenticated;
grant usage, select on all sequences in schema family to authenticated;
grant execute on function family.books(uuid), family.this_month(), family.streaks(),
                          family.my_families(), family.in_my_family(uuid),
                          family.is_owner_of(bigint), family.book_hidden(uuid, integer)
  to authenticated;

-- Live updates for chat and recommendations (RLS still applies).
do $$
declare t text;
begin
  foreach t in array array['messages', 'recommendations'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t) then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

-- ---------- adding people (SQL Editor only; the app cannot call this) ----------
-- 1. Invite them: Authentication > Users > Invite user (their email).
-- 2. Once they have signed in once, run:  select family.add_member('their@email', 'Their name');
--    The first person added to a new family becomes its owner:
--      select family.add_member('your@email', 'Josh', 'owner', 'Our Library');
create or replace function family.add_member(p_email text, p_name text, p_role text default 'member',
                                             p_family text default 'Our Library')
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; fam bigint;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then return 'No user with that email yet. Invite them first and wait until they have signed in.'; end if;
  select id into fam from family.families where name = p_family order by id limit 1;
  if fam is null then insert into family.families (name) values (p_family) returning id into fam; end if;
  insert into family.members (family_id, user_id, role, display_name)
  values (fam, uid, coalesce(p_role, 'member'), p_name)
  on conflict (family_id, user_id) do update set display_name = excluded.display_name, role = excluded.role;
  return p_name || ' is in ' || p_family || ' as ' || coalesce(p_role, 'member') || '.';
end $$;
revoke all on function family.add_member(text, text, text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
