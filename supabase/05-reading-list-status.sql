-- Reading lists get their own status per entry (To read / Reading / Read), kept on the list entry only.
-- Blank (null) means To read. Nothing here touches the Books tables.
-- Run in Supabase: SQL Editor > New query > paste all of this > Run. Safe to run again.

alter table books.reading_lists add column if not exists status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reading_lists_status_check'
      and conrelid = 'books.reading_lists'::regclass
  ) then
    alter table books.reading_lists
      add constraint reading_lists_status_check
      check (status is null or status in ('To read', 'Reading', 'Read'));
  end if;
end $$;

notify pgrst, 'reload schema';
