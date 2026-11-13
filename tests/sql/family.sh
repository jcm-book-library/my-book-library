#!/usr/bin/env bash
# Tests supabase/04-family.sql on a throwaway local Postgres with a stand-in for Supabase's
# auth (auth.users, auth.uid() from the JWT "sub" setting, anon/authenticated roles and the
# supabase_realtime publication). Loads 01, 03 and 04, then acts as three people:
# Owner (O), family Member (M) and Outsider (X), and checks what each can see and do.
# Run: bash tests/sql/family.sh   (needs PostgreSQL 16 binaries; prints PASS/FAIL lines)
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=/usr/lib/postgresql/16/bin
DIR=$(mktemp -d)
chown postgres "$DIR" 2>/dev/null || true
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
as_pg "$BIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
as_pg "$BIN/pg_ctl -D $DIR/data -o '-k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
trap 'as_pg "$BIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null"; rm -rf "$DIR"' EXIT
export PGOPTIONS='-c client_min_messages=warning'
PSQL="$BIN/psql -h $DIR -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X"

$PSQL <<'SQL'
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create publication supabase_realtime;
SQL
for f in supabase/01-schema.sql supabase/03-shared.sql supabase/04-family.sql; do
  $PSQL -f "$f" >/dev/null
done
# Run 04 a second time: it must be safe to re-run.
$PSQL -f supabase/04-family.sql >/dev/null

O=00000000-0000-0000-0000-00000000000a; M=00000000-0000-0000-0000-00000000000b; X=00000000-0000-0000-0000-00000000000c
$PSQL <<SQL
insert into auth.users values ('$O','owner@example.com'),('$M','member@example.com'),('$X','outsider@example.com');
select family.add_member('owner@example.com','Owner','owner');
select family.add_member('member@example.com','Member');
-- Owner's data: one shared book, one hidden book, notes; log for this month and older.
insert into books.books (user_id,id,title,author,status,notes,why,loanee,hidden,pages,current_page)
  values ('$O',1,'Shared Book','A','Reading','private note','private why','Sam',false,300,120),
         ('$O',5,'Hidden Book','B','Finished','hidden note',null,null,true,200,200),
         ('$O',9,'Removed Book','C','Removed','removed note',null,null,false,100,0);
insert into books.books (user_id,id,title,status,notes) values ('$X',1,'Outsider Book','Reading','x note');
insert into books.settings (user_id,key,value) values ('$O','streakMinPages','10');
with t as (select (now() at time zone 'Australia/Melbourne')::date d)
insert into books.reading_log (user_id,date,pages,book_id,source)
  select '$O'::uuid, d - g, 20, 1, 'app' from t, generate_series(0,4) g     -- 5 days in a row
  union all select '$O', d - 40, 99, 1, 'app' from t                    -- older than this month
  union all select '$O', d - 7, 5, 1, 'app' from t                      -- below min, breaks nothing it touches
  union all select '$X', d, 50, 1, 'app' from t;
insert into family.reviews (user_id,book_id,body,stars) values ('$O',1,'Loved it',5),('$O',5,'Secret review',4);
SQL

pass=0; fail=0
check() { # name, user, sql, expected
  local got
  got=$($PSQL -t -A -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','$2',true); $3; commit;" 2>&1 | sed -n '2p' | tr -d '\r')
  if [ "$got" = "$4" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 -> got [$got] want [$4]"; fail=$((fail+1)); fi
}
fails() { # name, user, sql : the statement must be refused
  if $PSQL -c "begin; set local role authenticated; select set_config('request.jwt.claim.sub','$2',true); $3; commit;" >/dev/null 2>&1; then
    echo "FAIL $1 -> was allowed"; fail=$((fail+1)); else echo "PASS $1"; pass=$((pass+1)); fi
}

check "member sees owner's shared book only (not hidden)" $M "select string_agg(title, ',' order by id) from family.books() where user_id='$O'" "Shared Book"
check "a Removed book is not returned by family.books (member and owner)" $M "select count(*) from family.books() where title='Removed Book'" "0"
check "a Removed book is not returned to its owner by family.books either" $O "select count(*) from family.books() where title='Removed Book'" "0"
check "family.books has no notes/why/loanee columns" $M "select count(*) from information_schema.columns where table_schema='family' and table_name='books'" "0"
fails "member cannot read owner's notes via books table" $M "select 1/(count(*)) from books.books where user_id='$O'"
check "member reading books table directly sees nothing of owner" $M "select count(*) from books.books where user_id='$O'" "0"
check "outsider sees no family books" $X "select count(*) from family.books()" "0"
check "this_month: member sees owner's days this month only (no 40-day-old entry)" $M "select count(*) from family.this_month() where user_id='$O' and pages=99" "0"
check "this_month: owner has 5 days at 20 pages this month or fewer" $M "select (count(*) between 1 and 6)::text from family.this_month() where user_id='$O'" "true"
check "this_month: outsider's log not visible to member" $M "select count(*) from family.this_month() where user_id='$X'" "0"
check "streak: owner's 5-day run (min 10 pages)" $M "select streak||':'||today_done from family.streaks() where user_id='$O'" "5:true"
check "streak: outsider gets nothing" $X "select count(*) from family.streaks()" "0"
check "reviews: member sees owner's review of a shared book" $M "select string_agg(body, ',') from family.reviews where user_id='$O'" "Loved it"
check "reviews: outsider sees none" $X "select count(*) from family.reviews" "0"
fails "reviews: member cannot write a review as the owner" $M "insert into family.reviews (user_id,book_id,body) values ('$O',2,'fake')"
check "recommend: member can recommend to owner" $M "insert into family.recommendations (to_user,title,note) values ('$O','Dune','Try it') returning title" "Dune"
fails "recommend: outsider cannot recommend to owner" $X "insert into family.recommendations (to_user,title) values ('$O','Spam')"
fails "recommend: member cannot recommend to an outsider" $M "insert into family.recommendations (to_user,title) values ('$X','Dune')"
check "recommend: owner sees it in their inbox" $O "select count(*) from family.recommendations where to_user='$O' and status='new'" "1"
check "recommend: owner can mark it added" $O "update family.recommendations set status='added' where to_user='$O' returning status" "added"
fails "recommend: recipient cannot change the title" $O "update family.recommendations set title='Changed' where to_user='$O'"
check "recommend: outsider sees none" $X "select count(*) from family.recommendations" "0"
check "chat: member can post to the family room" $M "insert into family.messages (family_id,body) select id,'Hello all' from family.families limit 1 returning body" "Hello all"
check "chat: owner reads it" $O "select string_agg(body, ',') from family.messages" "Hello all"
check "chat: outsider reads nothing" $X "select count(*) from family.messages" "0"
fails "chat: outsider cannot post into the family" $X "insert into family.messages (family_id,body) select 1,'hi'"
fails "chat: member cannot post as someone else" $M "insert into family.messages (family_id,user_id,body) values (1,'$O','fake')"
check "chat: owner cannot delete member's message" $O "with d as (delete from family.messages where user_id='$M' returning 1) select count(*) from d" "0"
check "challenge: owner can set one" $O "insert into family.challenges (family_id,title,starts,ends,target_pages) values (1,'December 500',current_date,current_date+30,500) returning title" "December 500"
fails "challenge: member cannot set one" $M "insert into family.challenges (family_id,title,starts,ends) values (1,'Mine',current_date,current_date)"
check "members: member can rename themself" $M "update family.members set display_name='Mum' where user_id='$M' returning display_name" "Mum"
fails "members: member cannot make themself owner" $M "update family.members set role='owner' where user_id='$M'"
check "members: member cannot rename the owner" $M "with u as (update family.members set display_name='X' where user_id='$O' returning 1) select count(*) from u" "0"
fails "members: app cannot add members" $M "select family.add_member('outsider@example.com','X')"
fails "signed-out visitors get nothing" "" "set local role anon; select count(*) from family.messages"
check "books own rows still work for owner" $O "select count(*) from books.books" "3"

echo "$pass PASS, $fail FAIL"
[ "$fail" = 0 ]
