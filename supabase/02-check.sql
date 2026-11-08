-- Check: SQL Editor > New query > paste > Run. Reads only.
-- One row per table: row count, whether RLS is on, and whether live sync covers it.
-- Expect 10 tables, rls_on true and live_sync true for every one.
select c.relname as "table",
       c.relrowsecurity as rls_on,
       exists (select 1 from pg_publication_tables p
               where p.pubname = 'supabase_realtime' and p.schemaname = 'books' and p.tablename = c.relname) as live_sync,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from books.%I', c.relname), false, true, '')))[1]::text::int as rows
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'books' and c.relkind = 'r'
order by 1;
