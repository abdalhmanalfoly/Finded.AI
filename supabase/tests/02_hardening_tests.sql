-- Tests for migration 009. Run AFTER 01_security_and_matching_tests.sql on the same LOCAL test database
-- (it reuses the test.* helper functions created there). Never run on a real Supabase project.
\set u1 'b0000000-0000-0000-0000-000000000001'
\set u2 'b0000000-0000-0000-0000-000000000002'
\set u3 'b0000000-0000-0000-0000-000000000003'
\set u5 'b0000000-0000-0000-0000-000000000005'
\set uadm 'a0000000-0000-0000-0000-000000000004'

reset role; reset request.jwt.claim.sub;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'u1', 'h1@example.com', '{"display_name":"Hana One"}'), (:'u2', 'h2@example.com', '{"display_name":"Hana Two"}'),
  (:'u3', 'h3@example.com', '{"display_name":"Hana Three"}'), (:'u5', 'h5@example.com', '{"display_name":"Hana Five"}');
select test.ok('H0 setup: four new profiles', (select count(*) from public.profiles where id in (:'u1', :'u2', :'u3', :'u5')) = 4);

-- ---------- reports used below ----------
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.mk('lost', 'Red travel backpack', 'Bags', 'Red travel backpack with a black zipper and a small tear', 'Ramses station platform 3', 'Cairo', current_date - 1, 'Red', null) as h_lost \gset
set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
select test.mk('found', 'Red travel backpack', 'Clothing', 'Red travel backpack with a black zipper and a small tear', 'Ramses station platform 3', 'Cairo', current_date, 'Red', null) as h_found \gset
select test.mk('found', 'Brown leather wallet', 'Wallets', 'Brown leather wallet with two cards inside', 'Tahrir square metro', 'Cairo', current_date, 'Brown', null) as h_wallet \gset
reset role;

-- ---------- A. matching candidates ----------
select test.ok('H1 same name in a different category is still found as a candidate and matched',
  (select count(*) from public.matches where lost_item_id = :'h_lost' and found_item_id = :'h_found') = 1);
select test.ok('H2 unrelated wallet is not matched with the backpack',
  (select count(*) from public.matches where found_item_id = :'h_wallet' and lost_item_id = :'h_lost') = 0);

-- editing the found report into a different category AND name removes the stale suggestion
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
update public.items set name = 'Silver wedding ring', category = 'Jewelry', description = 'Plain silver ring found on a bench', color = 'Silver' where id = :'h_found';
reset role;
select test.ok('H3 partner that leaves the candidate set loses its suggested match',
  (select count(*) from public.matches where lost_item_id = :'h_lost' and found_item_id = :'h_found') = 0);

-- ---------- B. profile privacy ----------
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.ok('H4 user cannot read another profile row', (select count(*) from public.profiles where id = :'u2') = 0);
select test.ok('H5 contact_profiles hides strangers', (select count(*) from public.contact_profiles where id = :'u2') = 0);
select test.ok('H6 contact_profiles shows my own name', (select count(*) from public.contact_profiles where id = :'u1') = 1);
select test.ok('H7 contact_profiles exposes only id and display_name',
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'contact_profiles') = 2);
reset role;
set role anon; reset request.jwt.claim.sub;
select test.expect_error('H8 anon cannot read contact_profiles', 'select * from public.contact_profiles');
reset role;

-- ---------- D. flags remember the reported user (cannot be spoofed) ----------
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
insert into public.flags (reporter_id, item_id, reported_user_id, reason) values (:'u1', :'h_wallet', :'u3', 'Looks like spam');
reset role;
select test.ok('H9 flag stores the real owner as reported user, ignoring a spoofed value',
  (select reported_user_id = :'u2' from public.flags where item_id = :'h_wallet' and reporter_id = :'u1'));

-- ---------- C. export and delete ----------
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
select public.export_my_data() as h_export \gset
reset role;
select test.ok('H10 export contains my profile and my reports',
  (:'h_export'::jsonb -> 'profile' ->> 'id') = :'u2' and jsonb_array_length(:'h_export'::jsonb -> 'items') = 2);
select test.ok('H11 export contains no other user reports',
  not exists (select 1 from jsonb_array_elements(:'h_export'::jsonb -> 'items') e where e ->> 'user_id' <> :'u2'));
set role anon; reset request.jwt.claim.sub;
select test.expect_error('H12 anon cannot export', 'select public.export_my_data()');
select test.expect_error('H13 anon cannot delete an account', 'select public.delete_my_account()');
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select test.expect_error('H14 the only admin cannot delete the account', 'select public.delete_my_account()');
reset role;

set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000003';
select test.mk('lost', 'Blue school bag', 'Bags', 'Blue school bag with a cartoon keychain', 'Maadi grand mall', 'Cairo', current_date, 'Blue', null) as h_u3_item \gset
select public.delete_my_account();
reset role;
select test.ok('H15 deleted account is gone from auth.users', (select count(*) from auth.users where id = :'u3') = 0);
select test.ok('H16 deleted account profile and reports cascade away',
  (select count(*) from public.profiles where id = :'u3') = 0 and (select count(*) from public.items where user_id = :'u3') = 0);

-- ---------- E. embedding rate limit ----------
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000002';
insert into public.item_images (item_id, storage_path, position) values (:'h_wallet', 'b0000000-0000-0000-0000-000000000002/wallet1.jpg', 0);
select test.expect_error('H17 normal users cannot claim embedding attempts',
  'select public.claim_embedding_attempt((select id from public.item_images limit 1))');
reset role;
select id as h_img from public.item_images where item_id = :'h_wallet' limit 1 \gset
reset request.jwt.claim.sub;
set role service_role;
select test.ok('H18 first embedding attempt is allowed', public.claim_embedding_attempt(:'h_img'));
select test.ok('H19 an immediate retry is refused', not public.claim_embedding_attempt(:'h_img'));
reset role;
update public.embedding_attempts set last_attempt = now() - interval '11 minutes' where image_id = :'h_img';
set role service_role;
select test.ok('H20 retry after 10 minutes is allowed (2nd try)', public.claim_embedding_attempt(:'h_img'));
reset role;
update public.embedding_attempts set last_attempt = now() - interval '11 minutes' where image_id = :'h_img';
set role service_role;
select test.ok('H21 3rd try allowed', public.claim_embedding_attempt(:'h_img'));
reset role;
update public.embedding_attempts set last_attempt = now() - interval '11 minutes' where image_id = :'h_img';
set role service_role;
select test.ok('H22 a 4th try is refused for good', not public.claim_embedding_attempt(:'h_img'));
reset role;

-- ---------- F. suspended users cannot upload photos ----------
update public.profiles set is_suspended = true where id = :'u5';
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000005';
select test.expect_error('H23 suspended user cannot upload to storage',
  'insert into storage.objects (bucket_id, name, owner) values (''item-images'', ''b0000000-0000-0000-0000-000000000005/a.jpg'', ''b0000000-0000-0000-0000-000000000005'')');
reset role;
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
with ins as (insert into storage.objects (bucket_id, name, owner) values ('item-images', 'b0000000-0000-0000-0000-000000000001/a.jpg', 'b0000000-0000-0000-0000-000000000001') returning 1)
select test.ok('H24 active user can still upload to their own folder', (select count(*) from ins) = 1);
reset role; reset request.jwt.claim.sub;

-- ---------- G. upload paths and anon uploads ----------
set role authenticated; set request.jwt.claim.sub = 'b0000000-0000-0000-0000-000000000001';
select test.expect_error('H25 a signed-in user cannot upload into another user’s folder',
  'insert into storage.objects (bucket_id, name, owner) values (''item-images'', ''b0000000-0000-0000-0000-000000000002/stolen.jpg'', ''b0000000-0000-0000-0000-000000000001'')');
reset role;
set role anon; reset request.jwt.claim.sub;
select test.expect_error('H26 anon cannot upload photos',
  'insert into storage.objects (bucket_id, name, owner) values (''item-images'', ''b0000000-0000-0000-0000-000000000001/anon.jpg'', ''b0000000-0000-0000-0000-000000000001'')');
reset role; reset request.jwt.claim.sub;
select test.ok('H27 item-images bucket stays private', (select not public from storage.buckets where id = 'item-images'));

\echo ===== 009 TESTS DONE =====
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from test.results;
select n, name from test.results where not ok order by n;
