-- Run AFTER 01_security_and_matching_tests.sql and 02_hardening_tests.sql, on the same
-- throwaway LOCAL database. Never run on a real Supabase project.
-- Verifies migration 010: the privilege layer and the RLS layer are BOTH required for a report
-- INSERT, and existing restrictions are unchanged.
\set ug 'c0000000-0000-0000-0000-000000000001'
\set uh 'c0000000-0000-0000-0000-000000000002'

reset role; reset request.jwt.claim.sub;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'ug', 'grant@example.com', '{"display_name":"Grant Tester"}'),
  (:'uh', 'suspend@example.com', '{"display_name":"Suspend Tester"}');

-- ---------- A. privilege layer (independent of RLS) ----------
select test.ok('G1 RLS is enabled on public.items',
  (select relrowsecurity from pg_class where oid = 'public.items'::regclass));
select test.ok('G2 authenticated has INSERT on every column the frontend sends', (
  select bool_and(has_column_privilege('authenticated', 'public.items', c, 'INSERT'))
  from unnest(array['user_id','type','name','category','description','location_text','city',
                    'event_date','event_time','color','brand','additional_details','latitude','longitude']) c
));
select test.ok('G3 anon has no INSERT privilege on public.items',
  not has_table_privilege('anon', 'public.items', 'INSERT')
  and not has_column_privilege('anon', 'public.items', 'user_id', 'INSERT'));
select test.ok('G4 PUBLIC has no INSERT privilege on public.items',
  not has_table_privilege('public', 'public.items', 'INSERT'));
select test.ok('G5 authenticated cannot INSERT privileged columns', (
  select bool_and(not has_column_privilege('authenticated', 'public.items', c, 'INSERT'))
  from unnest(array['id','status','is_hidden','created_at','updated_at']) c
));
select test.ok('G16 no broad table-level INSERT grant remains (system columns protected)',
  not has_table_privilege('authenticated', 'public.items', 'INSERT')
  and not has_table_privilege('authenticated', 'public.item_images', 'INSERT'));
select test.ok('G6 authenticated keeps existing SELECT/UPDATE/DELETE restrictions',
  has_table_privilege('authenticated', 'public.items', 'SELECT')
  and has_table_privilege('authenticated', 'public.items', 'DELETE')
  and has_column_privilege('authenticated', 'public.items', 'name', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.items', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.items', 'is_hidden', 'UPDATE'));

-- ---------- B. the real INSERT works for its owner ----------
set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
with ins as (
  insert into public.items (user_id, type, name, category, description, location_text, city,
                            event_date, event_time, color, brand, additional_details, latitude, longitude)
  values (auth.uid(), 'lost', 'Max cola', 'Other', 'Max cola with lemon went missing',
          'Misr, Cairo, EGY', 'assuit', current_date, 'Morning', 'Green', 'Samsung',
          'private detail', 30.0444, 31.2357)
  returning id
)
select test.ok('G7 authenticated can INSERT the full frontend payload incl. coordinates',
  (select count(*) from ins) = 1);
select test.ok('G8 owner sees the new report through the protected table',
  (select count(*) from public.items where user_id = auth.uid()) = 1);
select test.expect_error('G9 privileged columns cannot be set on INSERT',
  'insert into public.items (user_id,type,name,category,description,location_text,city,event_date,color,status) values ('
  || quote_literal(:'ug') || ',''lost'',''Fake status'',''Other'',''Long enough description'',''Somewhere'',''Cairo'',current_date,''Red'',''resolved'')');
select test.expect_error('G10 user cannot create a report for another user',
  'insert into public.items (user_id,type,name,category,description,location_text,city,event_date,color) values ('
  || quote_literal(:'uh') || ',''lost'',''Fake owner'',''Other'',''Long enough description'',''Somewhere'',''Cairo'',current_date,''Red'')');
select test.ok('G11 rejected INSERTs created no rows', (
  select count(*) from public.items where user_id = :'ug'
) = 1 and not exists (select 1 from public.items where name in ('Fake status', 'Fake owner')));
reset role; reset request.jwt.claim.sub;

-- ---------- C. anon cannot write ----------
set role anon; reset request.jwt.claim.sub;
select test.expect_error('G12 anon cannot INSERT a report',
  'insert into public.items (user_id,type,name,category,description,location_text,city,event_date,color) values ('
  || quote_literal(:'ug') || ',''lost'',''Anon item'',''Other'',''Long enough description'',''Somewhere'',''Cairo'',current_date,''Red'')');
reset role; reset request.jwt.claim.sub;

-- ---------- D. suspension is still enforced ----------
update public.profiles set is_suspended = true where id = :'uh';
set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000002';
select test.expect_error('G13 suspended user cannot INSERT a report',
  'insert into public.items (user_id,type,name,category,description,location_text,city,event_date,color) values ('
  || quote_literal(:'uh') || ',''lost'',''Suspended item'',''Other'',''Long enough description'',''Somewhere'',''Cairo'',current_date,''Red'')');
reset role; reset request.jwt.claim.sub;
update public.profiles set is_suspended = false where id = :'uh';

-- ---------- E. photo metadata uses the same two-layer check ----------
select id as g_item from public.items where user_id = :'ug' limit 1 \gset
select id as g_other_item from public.items where user_id <> :'ug' limit 1 \gset
set role authenticated; set request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
with ins as (
  insert into public.item_images (item_id, storage_path, position)
  values (:'g_item', 'c0000000-0000-0000-0000-000000000001/abc.jpg', 0) returning id
)
select test.ok('G14 owner can attach photo metadata', (select count(*) from ins) = 1);
select test.expect_error('G15 cannot attach metadata to another user report',
  'insert into public.item_images (item_id,storage_path,position) values ('
  || quote_literal(:'g_other_item') || ',''c0000000-0000-0000-0000-000000000001/stolen.jpg'',0)');
reset role; reset request.jwt.claim.sub;

\echo ===== 010 TESTS DONE =====
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from test.results;
select n, name from test.results where not ok order by n;
