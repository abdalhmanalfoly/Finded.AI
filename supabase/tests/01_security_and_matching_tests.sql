-- Run after 00_mock_supabase.sql and all migrations, on a LOCAL test database only.
-- psql -v ON_ERROR_STOP=0 -d findit -f 01_security_and_matching_tests.sql
\set ua 'a0000000-0000-0000-0000-000000000001'
\set ub 'a0000000-0000-0000-0000-000000000002'
\set uc 'a0000000-0000-0000-0000-000000000003'
\set uadm 'a0000000-0000-0000-0000-000000000004'
\set um1 'a0000000-0000-0000-0000-000000000005'
\set um2 'a0000000-0000-0000-0000-000000000006'
\set ud 'a0000000-0000-0000-0000-000000000007'

drop schema if exists test cascade;
create schema test;
create table test.results (n serial, name text, ok boolean);
create function test.record(p_name text, p_ok boolean) returns void language sql security definer as
  $$ insert into test.results (name, ok) values (p_name, coalesce(p_ok, false)) $$;
create function test.ok(p_name text, p_ok boolean) returns void language sql as $$ select test.record(p_name, p_ok) $$;
create function test.expect_error(p_name text, q text) returns void language plpgsql as $$
begin execute q; perform test.record(p_name, false);
exception when others then perform test.record(p_name, true); end $$;
create function test.mk(p_type text, p_name text, p_cat text, p_desc text, p_loc text, p_city text, p_date date, p_color text, p_brand text)
returns uuid language plpgsql as $$
declare i uuid; begin
  insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color, brand)
  values (auth.uid(), p_type, p_name, p_cat, p_desc, p_loc, p_city, p_date, p_color, p_brand) returning id into i;
  return i; end $$;
grant usage on schema test to public;
grant execute on all functions in schema test to public;

-- ---------- setup (trusted context) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  (:'ua', 'a@example.com', '{"display_name":"Alice"}'), (:'ub', 'b@example.com', '{"display_name":"Bob"}'),
  (:'uc', 'c@example.com', '{}'), (:'uadm', 'admin@example.com', '{"display_name":"Admin"}'),
  (:'um1', 'm1@example.com', '{"display_name":"Matcher One"}'), (:'um2', 'm2@example.com', '{"display_name":"Matcher Two"}'),
  (:'ud', 'd@example.com', '{"display_name":"Dana"}');
update public.profiles set role = 'admin' where id = :'uadm';
select test.ok('SETUP profile auto-created for each new user', (select count(*) from public.profiles) = 7);

-- ---------- users create reports ----------
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.mk('lost', 'Blue umbrella', 'Other', 'Large blue umbrella with wooden handle', 'Zamalek bus stop', 'Cairo', current_date - 3, 'Blue', null) as a1 \gset
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
select test.mk('found', 'Gold bracelet', 'Jewelry', 'Thin gold bracelet found near the fountain', 'Alsaha park', 'Alexandria', current_date - 2, 'Gold', null) as b1 \gset
reset role;

-- ---------- visibility ----------
set role anon; reset request.jwt.claim.sub;
select test.expect_error('RLS anon cannot read items table', 'select * from public.items');
select test.ok('RLS anon sees public view rows', (select count(*) from public.public_items) = 2);
select test.ok('PRIVACY public view exposes no user_id/additional_details/lat/long',
  (select count(*) from information_schema.columns where table_name = 'public_items' and column_name in ('user_id', 'additional_details', 'latitude', 'longitude', 'is_hidden')) = 0);
select test.expect_error('RLS anon cannot create contact request', 'select public.create_contact_request(' || quote_literal(:'a1') || ', ''hello this is a test'')');
select test.expect_error('RLS anon cannot read profiles', 'select * from public.profiles');
select test.expect_error('RLS anon cannot read notifications', 'select * from public.notifications');
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.ok('RLS user sees only own rows in items table', (select count(*) from public.items) = 1);
with u as (update public.items set name = 'Hacked name' where id = :'b1' returning 1) select test.ok('AUTHZ user cannot edit another user report', (select count(*) from u) = 0);
with d as (delete from public.items where id = :'b1' returning 1) select test.ok('AUTHZ user cannot delete another user report', (select count(*) from d) = 0);
select test.expect_error('AUTHZ user cannot reassign report owner', 'update public.items set user_id = ' || quote_literal(:'ub') || ' where id = ' || quote_literal(:'a1'));
select test.expect_error('AUTHZ user cannot unhide/hide own report', 'update public.items set is_hidden = true where id = ' || quote_literal(:'a1'));
select test.expect_error('AUTHZ user cannot become admin', 'update public.profiles set role = ''admin'' where id = ' || quote_literal(:'ua'));
select test.expect_error('AUTHZ user cannot unsuspend/suspend self', 'update public.profiles set is_suspended = true where id = ' || quote_literal(:'ua'));
select test.expect_error('AUTHZ user cannot create report as someone else',
  'insert into public.items (user_id,type,name,category,description,location_text,city,event_date,color) values (' || quote_literal(:'ub') ||
  ',''lost'',''Fake item'',''Other'',''Fake description here'',''Nowhere'',''Cairo'',current_date,''Red'')');
select test.expect_error('VALIDATION future date rejected',
  'insert into public.items (user_id,type,name,category,description,location_text,city,event_date,color) values (' || quote_literal(:'ua') ||
  ',''lost'',''Future item'',''Other'',''Some description here'',''Nowhere'',''Cairo'',current_date + 10,''Red'')');
select test.expect_error('VALIDATION short description rejected',
  'insert into public.items (user_id,type,name,category,description,location_text,city,event_date,color) values (' || quote_literal(:'ua') ||
  ',''lost'',''Short desc'',''Other'',''short'',''Nowhere'',''Cairo'',current_date,''Red'')');
select test.expect_error('VALIDATION invalid status rejected', 'update public.items set status = ''hacked'' where id = ' || quote_literal(:'a1'));
select test.expect_error('AUTHZ user cannot insert notifications', 'insert into public.notifications (user_id, type, title) values (' || quote_literal(:'ua') || ', ''system'', ''x'')');
select test.expect_error('AUTHZ user cannot insert matches', 'insert into public.matches (lost_item_id, found_item_id, score) values (' || quote_literal(:'a1') || ',' || quote_literal(:'b1') || ', 99)');
select test.expect_error('AUTHZ user cannot call matching engine', 'select public.run_matching(' || quote_literal(:'a1') || ')');
select test.expect_error('AUTHZ user cannot call admin_stats', 'select public.admin_stats()');
select test.expect_error('AUTHZ user cannot hide reports via admin function', 'select public.admin_set_item_hidden(' || quote_literal(:'b1') || ', true)');
select test.ok('AUTHZ admin log empty for user (RLS)', (select count(*) from public.admin_actions) = 0);
select test.ok('PRIVACY user cannot see unrelated profile', (select count(*) from public.profiles where id = :'uc') = 0);
reset role;

-- ---------- images ----------
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
insert into public.item_images (item_id, storage_path, position) values (:'a1', :'ua' || '/one.jpg', 0);
select test.ok('IMAGES owner can attach image', (select count(*) from public.item_images where item_id = :'a1') = 1);
select test.expect_error('IMAGES cannot attach to another user item', 'insert into public.item_images (item_id, storage_path) values (' || quote_literal(:'b1') || ', ''x/y.jpg'')');
insert into public.item_images (item_id, storage_path, position) values (:'a1', :'ua' || '/two.jpg', 1), (:'a1', :'ua' || '/three.jpg', 2);
select test.expect_error('IMAGES max 3 per report', 'insert into public.item_images (item_id, storage_path, position) values (' || quote_literal(:'a1') || ', ''x/four.jpg'', 3)');
-- storage policies
insert into storage.objects (bucket_id, name) values ('item-images', :'ua' || '/one.jpg');
select test.ok('STORAGE user can upload into own folder', true);
select test.expect_error('STORAGE user cannot upload into another folder', 'insert into storage.objects (bucket_id, name) values (''item-images'', ' || quote_literal(:'ub' || '/evil.jpg') || ')');
select test.expect_error('STORAGE user cannot upload to other bucket', 'insert into storage.objects (bucket_id, name) values (''other'', ' || quote_literal(:'ua' || '/x.jpg') || ')');
reset role;
set role anon; reset request.jwt.claim.sub;
select test.expect_error('STORAGE anon cannot upload', 'insert into storage.objects (bucket_id, name) values (''item-images'', ''x/anon.jpg'')');
select test.ok('IMAGES anon can see images of public items', (select count(*) from public.item_images where item_id = :'a1') = 3);
reset role;
select test.ok('STORAGE bucket limits configured (5 MB, jpeg/png/webp)',
  (select file_size_limit = 5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] and not allowed_mime_types && array['image/svg+xml','text/html'] from storage.buckets where id = 'item-images'));

-- ---------- contact requests and messages ----------
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.expect_error('CONTACT cannot contact yourself', 'select public.create_contact_request(' || quote_literal(:'a1') || ', ''hello this is a test'')');
select test.expect_error('CONTACT short message rejected', 'select public.create_contact_request(' || quote_literal(:'b1') || ', ''hi'')');
select public.create_contact_request(:'b1', 'I think this bracelet is mine, it has a tiny scratch') as r1 \gset
select test.expect_error('CONTACT duplicate pending request rejected', 'select public.create_contact_request(' || quote_literal(:'b1') || ', ''another request message'')');
select test.expect_error('MESSAGES cannot send before acceptance', 'insert into public.messages (request_id, sender_id, body) values (' || quote_literal(:'r1') || ',' || quote_literal(:'ua') || ', ''hello'')');
select test.expect_error('CONTACT requester cannot accept own request', 'select public.respond_contact_request(' || quote_literal(:'r1') || ', true)');
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
select test.ok('CONTACT third user cannot see request', (select count(*) from public.contact_requests) = 0);
select test.expect_error('CONTACT third user cannot accept request', 'select public.respond_contact_request(' || quote_literal(:'r1') || ', true)');
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
select test.ok('NOTIFY recipient got contact request notification', (select count(*) from public.notifications where type = 'contact_request') = 1);
select test.ok('PRIVACY recipient can see requester name after request', (select count(*) from public.contact_profiles where id = :'ua') = 1);
select test.ok('PRIVACY recipient cannot read the requester full profile row', (select count(*) from public.profiles where id = :'ua') = 0);
select test.expect_error('NOTIFY cannot edit notification text', 'update public.notifications set title = ''x''');
update public.notifications set is_read = true where type = 'contact_request';
select test.ok('NOTIFY mark as read works', (select count(*) from public.notifications where is_read) = 1);
select public.respond_contact_request(:'r1', true);
insert into public.messages (request_id, sender_id, body) values (:'r1', :'ub', 'Hi! Describe the scratch please.');
select test.expect_error('MESSAGES cannot impersonate sender', 'insert into public.messages (request_id, sender_id, body) values (' || quote_literal(:'r1') || ',' || quote_literal(:'ua') || ', ''fake'')');
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.ok('CONTACT requester notified of acceptance', (select count(*) from public.notifications where type = 'contact_response') = 1);
select test.ok('MESSAGES participant can read thread', (select count(*) from public.messages where request_id = :'r1') = 1);
insert into public.messages (request_id, sender_id, body) values (:'r1', :'ua', 'It has a tiny scratch near the clasp.');
reset role;
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
select test.ok('MESSAGES outsider cannot read thread', (select count(*) from public.messages) = 0);
select test.expect_error('MESSAGES outsider cannot post', 'insert into public.messages (request_id, sender_id, body) values (' || quote_literal(:'r1') || ',' || quote_literal(:'uc') || ', ''hi'')');
reset role;

-- ---------- flags and admin ----------
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
insert into public.flags (reporter_id, item_id, reason, details) values (:'uc', :'b1', 'Suspicious listing', 'Looks fake');
select test.expect_error('FLAGS cannot file flag as someone else', 'insert into public.flags (reporter_id, item_id, reason) values (' || quote_literal(:'ua') || ',' || quote_literal(:'b1') || ', ''Spam'')');
select test.ok('FLAGS reporter sees own flag only', (select count(*) from public.flags) = 1);
select test.expect_error('FLAGS reporter cannot resolve flag', 'update public.flags set status = ''resolved''');
reset role;
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.ok('FLAGS other users cannot see flag', (select count(*) from public.flags) = 0);
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select test.ok('ADMIN can read all items', (select count(*) from public.items) = 2);
select test.ok('ADMIN can read all flags', (select count(*) from public.flags) = 1);
select test.ok('ADMIN stats work', (public.admin_stats() ->> 'users')::int = 7);
select public.admin_set_item_hidden(:'b1', true);
select test.ok('ADMIN hide removes item from public view', (select count(*) from public.public_items where id = :'b1') = 0);
select test.ok('ADMIN action is logged', (select count(*) from public.admin_actions where action = 'hide_item') = 1);
select public.admin_set_item_hidden(:'b1', false);
select public.admin_set_user_suspended(:'uc', true);
select test.expect_error('ADMIN cannot suspend self', 'select public.admin_set_user_suspended(' || quote_literal(:'uadm') || ', true)');
select public.admin_resolve_flag((select id from public.flags limit 1), 'resolved', 'Checked, listing is fine');
select test.ok('ADMIN resolved flag recorded', (select count(*) from public.flags where status = 'resolved' and resolved_by = :'uadm') = 1);
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
select test.expect_error('SUSPENDED user cannot create report', 'select test.mk(''lost'', ''Suspended item'', ''Other'', ''Some long enough description'', ''Somewhere'', ''Cairo'', current_date, ''Red'', null)');
select test.expect_error('SUSPENDED user cannot send contact request', 'select public.create_contact_request(' || quote_literal(:'b1') || ', ''hello this is a test'')');
reset role;

-- ---------- rate limit ----------
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000007';
do $$ declare i int; begin for i in 1..20 loop perform test.mk('lost', 'Bulk item number ' || i, 'Other', 'Bulk generated description ' || i, 'Bulk place ' || i, 'Cairo', current_date, 'Red', null); end loop; end $$;
select test.expect_error('LIMIT 21st report in a day is rejected', 'select test.mk(''lost'', ''Bulk item overflow'', ''Other'', ''Bulk generated description overflow'', ''Bulk place'', ''Cairo'', current_date, ''Red'', null)');
reset role;
delete from public.items where user_id = :'ud';

-- ---------- matching engine ----------
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select test.mk('lost', 'Black Samsung phone', 'Phones', 'Samsung Galaxy with a cracked clear case and blue lanyard', 'Maadi near the metro station', 'Cairo', current_date - 2, 'Black', 'Samsung') as s1l \gset
select test.mk('lost', 'Brown leather wallet', 'Wallets and bags', 'Small brown wallet with a gold clasp', 'Downtown Tahrir Square', 'Cairo', current_date - 2, 'Brown', null) as s2l \gset
select test.mk('lost', 'Black iPhone', 'Phones', 'Black iPhone 13 with a silicone case', 'Heliopolis Korba', 'Cairo', current_date - 2, 'Black', 'Apple') as s3l \gset
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000006';
select test.mk('found', 'Black Samsung phone', 'Phones', 'Found on a bench. Black phone with a blue strap and cracked case', 'Maadi Road 9 near metro', 'Cairo', current_date - 1, 'Black', 'Samsung') as s1f \gset
select test.mk('found', 'Car keys with red tag', 'Keys', 'Car key with a red fabric tag', 'Nasr City City Stars', 'Cairo', current_date - 1, 'Black', 'Toyota') as s2f \gset
select test.mk('found', 'Black Samsung phone', 'Phones', 'Black Samsung phone found at a cafe', 'Smouha cafe area', 'Alexandria', current_date - 1, 'Black', 'Samsung') as s3f \gset
reset role;

select test.ok('MATCH S1 black Samsung phone lost+found same area is matched', (select count(*) from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f') = 1);
select test.ok('MATCH S1 score is high (>= 80)', (select score >= 80 from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f'));
select test.ok('MATCH S1 has explanations', (select jsonb_array_length(reasons) >= 4 from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f'));
select test.ok('MATCH S1 both owners notified', (select count(*) from public.notifications where type = 'match' and related_match_id = (select id from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f')) = 2);
select test.ok('MATCH S2 wallet vs car keys: no match', (select count(*) from public.matches where lost_item_id = :'s2l') = 0);
select test.ok('MATCH S3 false match: black iPhone vs black Samsung (different brand) is not suggested, in same city or another',
  (select count(*) from public.matches where lost_item_id = :'s3l') = 0);
select test.ok('MATCH S3b Samsung found in Alexandria vs lost Samsung in Cairo is scored lower than same-area',
  (select count(*) = 0 or max(score) < (select score from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f')
   from public.matches where lost_item_id = :'s1l' and found_item_id = :'s3f'));

-- same owner is never matched with themselves
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select test.mk('found', 'Black Samsung phone', 'Phones', 'Samsung Galaxy with a cracked clear case and blue lanyard', 'Maadi near the metro station', 'Cairo', current_date - 1, 'Black', 'Samsung') as s4f \gset
reset role;
select test.ok('MATCH S4 same owner lost+found not matched together', (select count(*) from public.matches where found_item_id = :'s4f' and lost_item_id = :'s1l') = 0);

-- no duplicates on repeated runs
select public.run_matching(:'s1l'); select public.run_matching(:'s1f'); select public.run_matching(:'s1l');
select test.ok('MATCH S5 no duplicate match rows after repeated runs', (select count(*) from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f') = 1);

-- edits update results
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
update public.items set name = 'Green garden hose', category = 'Other', description = 'Twenty meter garden hose, green', color = 'Green', brand = null where id = :'s1l';
reset role;
select test.ok('MATCH S6 editing a report into something unrelated removes the stale match', (select count(*) from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f') = 0);
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
update public.items set name = 'Black Samsung phone', category = 'Phones', description = 'Samsung Galaxy with a cracked clear case and blue lanyard', color = 'Black', brand = 'Samsung' where id = :'s1l';
reset role;
select test.ok('MATCH S6b editing back restores the match (single row)', (select count(*) from public.matches where lost_item_id = :'s1l' and found_item_id = :'s1f') = 1);

-- resolved / closed / hidden are excluded
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000006';
update public.items set status = 'resolved' where id = :'s1f';
reset role;
select test.ok('MATCH S7 resolving a report removes its suggested matches', (select count(*) from public.matches where found_item_id = :'s1f') = 0);
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select test.mk('lost', 'Black Samsung phone', 'Phones', 'Samsung Galaxy with a cracked clear case and blue lanyard', 'Maadi near the metro station', 'Cairo', current_date - 2, 'Black', 'Samsung') as s7l \gset
reset role;
select test.ok('MATCH S7b new report does not match a resolved report', (select count(*) from public.matches where found_item_id = :'s1f') = 0);

-- date logic: found long before lost
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select test.mk('lost', 'Silver Dell laptop', 'Electronics', 'Silver Dell laptop in a gray sleeve', 'Smouha cafe', 'Alexandria', current_date - 1, 'Silver', 'Dell') as s8l \gset
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000006';
select test.mk('found', 'Silver Dell laptop', 'Electronics', 'Silver Dell laptop in a gray sleeve', 'Smouha cafe', 'Alexandria', current_date - 20, 'Silver', 'Dell') as s8f \gset
reset role;
select test.ok('MATCH S8 laptop found 19 days BEFORE it was lost scores lower and says so',
  (select score < 95 and reasons ? 'Found before it was lost (lowers the score)' from public.matches where lost_item_id = :'s8l' and found_item_id = :'s8f'));

-- hidden reports are excluded
reset request.jwt.claim.sub;
select public.run_matching(:'s8l');
update public.items set is_hidden = true where id = :'s8f';
select test.ok('MATCH S9 hiding a report removes its suggested matches', (select count(*) from public.matches where found_item_id = :'s8f') = 0);

-- per-user dismissal
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select public.dismiss_match(id) from public.matches where lost_item_id = :'s1l' and found_item_id = :'s4f';
reset role;
select test.ok('MATCH S10 dismissal records exactly the dismissing user', (
  select count(*) from public.matches
  where lost_item_id = :'s1l' and found_item_id = :'s4f'
    and dismissed_by = array['a0000000-0000-0000-0000-000000000005']::uuid[]
) = 1);

-- ---------- migration 006: retention, audit reader, abuse guards ----------
\set uo 'a0000000-0000-0000-0000-000000000007'
reset role; reset request.jwt.claim.sub;
-- stale report (inserted from a trusted context so updated_at can be back-dated)
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color, updated_at)
values (:'ua', 'lost', 'Old stale wallet', 'Wallet', 'Brown wallet lost long ago', 'Old station', 'Cairo', current_date - 200, 'Brown', now() - interval '100 days')
returning id as stale1 \gset
select test.ok('RETENTION trusted context closes only stale reports', public.close_stale_items(90) = 1);
select test.ok('RETENTION stale report is now closed', (select status from public.items where id = :'stale1') = 'closed');
select test.ok('RETENTION owner is notified', (select count(*) from public.notifications where user_id = :'ua' and type = 'system' and body like '%Old stale wallet%') = 1);
select test.ok('RETENTION second run closes nothing', public.close_stale_items(90) = 0);
select test.expect_error('RETENTION period below 30 days is rejected', 'select public.close_stale_items(7)');
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.expect_error('RETENTION normal user cannot run it', 'select public.close_stale_items(90)');
select test.expect_error('AUDIT normal user cannot read audit log', 'select * from public.admin_list_actions(10)');
reset role;

-- audit log reader and hide-missing-item
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select test.ok('AUDIT admin can read the log with admin name', (select count(*) from public.admin_list_actions(50) where admin_name = 'Admin') >= 1);
select test.expect_error('ADMIN hiding a missing report fails', 'select public.admin_set_item_hidden(gen_random_uuid(), true)');
reset role;

-- flag guards
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
select test.expect_error('FLAGS cannot flag own listing', 'insert into public.flags (reporter_id, item_id, reason) values (' || quote_literal(:'ub') || ',' || quote_literal(:'b1') || ', ''Spam'')');
reset role;
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
insert into public.flags (reporter_id, item_id, reason) values (:'ua', :'b1', 'Spam');
select test.expect_error('FLAGS duplicate open flag is rejected', 'insert into public.flags (reporter_id, item_id, reason) values (' || quote_literal(:'ua') || ',' || quote_literal(:'b1') || ', ''Spam again'')');
reset role;

-- message flood limit
insert into public.contact_requests (item_id, requester_id, recipient_id, message, status)
values (:'b1', :'ua', :'ub', 'Hello, I think this is mine', 'accepted') returning id as rl_req \gset
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select set_config('test.rl_req', :'rl_req', false) \gset
do $$ declare i int; begin for i in 1..(60 - (select count(*)::int from public.messages where sender_id = 'a0000000-0000-0000-0000-000000000001'::uuid)) loop insert into public.messages (request_id, sender_id, body) values (current_setting('test.rl_req')::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'msg ' || i); end loop; end $$;
select test.expect_error('LIMIT 61st message in an hour is rejected', 'insert into public.messages (request_id, sender_id, body) values (' || quote_literal(:'rl_req') || ', ' || quote_literal(:'ua') || ', ''one too many'')');
reset role;

-- ---------- migration 007: Arabic, maps, image embeddings, storage ----------
reset role; reset request.jwt.claim.sub;
select test.ok('ARABIC diacritics and ta-marbuta are normalized', public.normalize_text('مَحْفَظَة') = public.normalize_text('محفظه'));
select test.ok('ARABIC alef variants are unified', public.normalize_text('أحمد إبراهيم') = 'احمد ابراهيم');
select test.ok('ARABIC-Indic digits become ASCII', public.normalize_text('رقم ٣٤٥') = 'رقم 345');
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (:'um1', 'lost', 'محفظة جلدية سوداء', 'Wallet', 'محفظة جلدية سوداء فيها بطاقات', 'قرب محطة المترو', 'القاهرة', current_date - 2, 'Black') returning id as ar_l \gset
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (:'um2', 'found', 'محفظه جلديه سوداء', 'Wallet', 'محفظه جلديه سوداء فيها بطاقات', 'محطة المترو', 'القاهره', current_date - 1, 'Black') returning id as ar_f \gset
select test.ok('ARABIC reports written with different spelling are matched',
  (select score >= 50 from public.matches where lost_item_id = :'ar_l' and found_item_id = :'ar_f'));

-- coordinates
select test.expect_error('MAP latitude out of range is rejected', 'update public.items set latitude = 95, longitude = 10 where id = ' || quote_literal(:'ar_l'));
select test.expect_error('MAP latitude without longitude is rejected', 'update public.items set latitude = 30, longitude = null where id = ' || quote_literal(:'ar_l'));
update public.items set latitude = 30.04441, longitude = 31.23571 where id = :'ar_l';
select test.ok('MAP public view rounds coordinates to 3 decimals',
  (select approx_lat = 30.044 and approx_lng = 31.236 from public.public_items where id = :'ar_l'));
select test.ok('MAP distance Cairo-Alexandria is roughly 170-230 km', (select d between 170 and 230 from (select public.distance_km(30.0444, 31.2357, 31.2001, 29.9187) as d) x));
select test.ok('MAP distance to same point is zero', public.distance_km(30, 31, 30, 31) = 0);
select test.ok('MAP distance is null without coordinates', public.distance_km(null, 31, 30, 31) is null);

-- image embeddings
select test.ok('IMG cosine of identical vectors is 1', abs(public.cosine_sim(array_fill(1::real, array[64]), array_fill(1::real, array[64])) - 1) < 0.0001);
select test.ok('IMG cosine of orthogonal vectors is 0',
  abs(public.cosine_sim(array_cat(array[1::real], array_fill(0::real, array[63])), array_cat(array[0::real, 1::real], array_fill(0::real, array[62])))) < 0.0001);
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (:'um1', 'lost', 'Round sunglasses', 'Accessories', 'Dark round sunglasses with thin frame', 'Cafe on Tahrir square', 'Giza', current_date - 3, 'Black') returning id as im_l \gset
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (:'um2', 'found', 'Glasses', 'Accessories', 'Pair of glasses with metal frame left on a table', 'Garden restaurant', 'Giza', current_date - 2, 'Gray') returning id as im_f \gset
insert into public.item_images (item_id, storage_path, position) values (:'im_l', :'um1' || '/g1.jpg', 0) returning id as im_li \gset
insert into public.item_images (item_id, storage_path, position) values (:'im_f', :'um2' || '/g2.jpg', 0) returning id as im_fi \gset
select (public.compute_match(l, f) ->> 'score')::int as base_score from public.items l, public.items f where l.id = :'im_l' and f.id = :'im_f' \gset
select test.ok('IMG no vectors -> no photo reason', not (select (public.compute_match(l, f) -> 'reasons') ? 'Photos look very similar' from public.items l, public.items f where l.id = :'im_l' and f.id = :'im_f'));
select public.store_image_embedding(:'im_li', array_fill(1::real, array[64]), 'test');
select public.store_image_embedding(:'im_fi', array_fill(2::real, array[64]), 'test');
select test.ok('IMG stored vectors are unit length', (select abs(sqrt(sum(x * x)) - 1) < 0.001 from public.image_embeddings e, unnest(e.embedding) as t(x) where e.image_id = :'im_li'));
select test.ok('IMG identical photos raise the score', (select (public.compute_match(l, f) ->> 'score')::int > :base_score from public.items l, public.items f where l.id = :'im_l' and f.id = :'im_f'));
select test.ok('IMG very similar photos are explained', (select (public.compute_match(l, f) -> 'reasons') ? 'Photos look very similar' from public.items l, public.items f where l.id = :'im_l' and f.id = :'im_f'));
select test.ok('IMG storing a vector re-runs matching and creates the match',
  (select count(*) from public.matches where lost_item_id = :'im_l' and found_item_id = :'im_f') = 1);
select public.store_image_embedding(:'im_fi', array_cat(array[0::real, 1::real], array_fill(0::real, array[62])), 'test');
select test.ok('IMG unrelated photos add no bonus', (select (public.compute_match(l, f) ->> 'score')::int <= :base_score from public.items l, public.items f where l.id = :'im_l' and f.id = :'im_f'));

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select test.expect_error('IMG users cannot store vectors', 'select public.store_image_embedding(' || quote_literal(:'im_li') || ', array_fill(1::real, array[64]))');
select test.expect_error('IMG users cannot read vectors', 'select * from public.image_embeddings');
select test.expect_error('IMG users cannot call compute_match', 'select public.compute_match(l, f) from public.items l, public.items f limit 1');
select test.ok('IMG owner sees own photos that still lack a vector', (select count(*) from public.my_unembedded_images(:'im_l')) = 0);
reset role;
insert into public.item_images (item_id, storage_path, position) values (:'im_l', :'um1' || '/g3.jpg', 1);
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select test.ok('IMG owner sees the new photo as unembedded', (select count(*) from public.my_unembedded_images(:'im_l')) = 1);
set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000006';
select test.ok('IMG other users see nothing for that report', (select count(*) from public.my_unembedded_images(:'im_l')) = 0);
reset role;

-- storage listing (bucket is private since migration 008; see the signed-URL block below)
insert into storage.objects (bucket_id, name) values ('item-images', :'ua' || '/listing-check.jpg');
set role anon; reset request.jwt.claim.sub;
select test.ok('STORAGE anon cannot see an object no report references', (select count(*) from storage.objects where name like '%/listing-check.jpg') = 0);
reset role;
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
select test.ok('STORAGE users cannot see other users unreferenced files', (select count(*) from storage.objects where name like '%/listing-check.jpg') = 0);
reset role;
reset request.jwt.claim.sub;

-- ---------- migration 008: private bucket + signed URLs ----------
select test.ok('SIGNED bucket is private', (select not public from storage.buckets where id = 'item-images'));
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (:'ua', 'lost', 'Signed url pub', 'Other', 'Item whose photo should be signable by anyone', 'Zamalek', 'Cairo', current_date - 1, 'Red') returning id as su_pub \gset
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (:'ua', 'lost', 'Signed url hid', 'Other', 'Item that gets hidden by a moderator', 'Zamalek', 'Cairo', current_date - 1, 'Red') returning id as su_hid \gset
insert into public.item_images (item_id, storage_path, position) values (:'su_pub', :'ua' || '/su-pub.jpg', 0), (:'su_hid', :'ua' || '/su-hid.jpg', 0);
insert into storage.objects (bucket_id, name) values ('item-images', :'ua' || '/su-pub.jpg'), ('item-images', :'ua' || '/su-hid.jpg'), ('item-images', :'ua' || '/su-fresh.jpg');
update public.items set is_hidden = true where id = :'su_hid';

set role anon; reset request.jwt.claim.sub;
select test.ok('SIGNED anon can sign the photo of a public report', (select count(*) from storage.objects where name = :'ua' || '/su-pub.jpg') = 1);
select test.ok('SIGNED anon cannot sign the photo of a hidden report', (select count(*) from storage.objects where name = :'ua' || '/su-hid.jpg') = 0);
select test.ok('SIGNED anon cannot sign a freshly uploaded, unattached file', (select count(*) from storage.objects where name = :'ua' || '/su-fresh.jpg') = 0);
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
select test.ok('SIGNED another user can sign a public report photo', (select count(*) from storage.objects where name = :'ua' || '/su-pub.jpg') = 1);
select test.ok('SIGNED another user cannot sign a hidden report photo', (select count(*) from storage.objects where name = :'ua' || '/su-hid.jpg') = 0);
select test.ok('SIGNED another user cannot sign an unattached file', (select count(*) from storage.objects where name = :'ua' || '/su-fresh.jpg') = 0);
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
select test.ok('SIGNED owner can sign own hidden report photo', (select count(*) from storage.objects where name = :'ua' || '/su-hid.jpg') = 1);
select test.ok('SIGNED owner can sign own fresh upload before it is attached', (select count(*) from storage.objects where name = :'ua' || '/su-fresh.jpg') = 1);
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select test.ok('SIGNED admin can sign a hidden report photo (moderation)', (select count(*) from storage.objects where name = :'ua' || '/su-hid.jpg') = 1);
reset role;

update public.items set status = 'closed' where id = :'su_pub';
set role anon; reset request.jwt.claim.sub;
select test.ok('SIGNED closing a report stops anonymous photo access', (select count(*) from storage.objects where name = :'ua' || '/su-pub.jpg') = 0);
reset role;
reset request.jwt.claim.sub;

-- ---------- report ----------
\echo
\echo ===== RESULTS =====
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed, count(*) as total from test.results;
\echo ===== FAILURES =====
select n, name from test.results where not ok order by n;
\echo ===== MATCH SCORES (for tuning) =====
select l.name as lost, l.city as lost_city, f.name as found, f.city as found_city, m.score, m.reasons
from public.matches m join public.items l on l.id = m.lost_item_id join public.items f on f.id = m.found_item_id order by m.score desc;
\echo ===== RAW SCORES FOR NON-MATCHES =====
select l.name as lost, f.name as found, f.city as found_city, (public.compute_match(l, f) ->> 'score') as raw_score
from public.items l, public.items f where l.type = 'lost' and f.type = 'found' and l.user_id <> f.user_id
  and l.user_id in (:'um1', :'um2') and f.user_id in (:'um1', :'um2') order by 4 desc limit 12;
