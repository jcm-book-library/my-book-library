-- shared.activity: every app's log in one agreed layout, for The Brain to read.
-- Books is the first feed (amount = pages). Other apps join with "union all" when they move.
-- Run in Supabase: SQL Editor > New query > paste all of this > Run. Safe to run again.
-- Then add "shared" to Exposed schemas (Integrations > Data API > Settings).
--
-- security_invoker: the view runs as the signed-in user, so each table's "own rows" rule
-- still applies. Signed-out visitors get nothing.

create schema if not exists shared;

create or replace view shared.activity with (security_invoker = true) as
select l.date                                   as date,
       'books'::text                            as app,
       l.book_id::text                          as item_id,
       coalesce(nullif(l.title, ''), b.title)   as title,
       l.pages                                  as amount,
       'pages'::text                            as unit,
       nullif(l.logged_at, '')::timestamp       as logged_at,
       l.source                                 as source,
       null::text                               as note
from books.reading_log l
left join books.books b on b.user_id = l.user_id and b.id = l.book_id
where l.pages > 0 and coalesce(l.source, '') <> 'deleted';

revoke all on schema shared from anon, public;
revoke all on all tables in schema shared from anon, public;
grant usage on schema shared to authenticated;
grant select on shared.activity to authenticated;

notify pgrst, 'reload schema';

-- Check: should show your most recent reading.
select * from shared.activity order by date desc, logged_at desc nulls last limit 5;
