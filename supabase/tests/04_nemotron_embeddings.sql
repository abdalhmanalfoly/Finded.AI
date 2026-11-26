-- Run AFTER 01-03 on the same throwaway LOCAL database. Never run on a real Supabase project.
-- Minimal end-to-end check: one lost report and one found report, no live API call.
\set ul 'd0000000-0000-0000-0000-000000000001'
\set uf 'd0000000-0000-0000-0000-000000000002'

reset role; reset request.jwt.claim.sub;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'ul', 'nemotron-lost@example.com', '{"display_name":"Nemotron Lost"}'),
  (:'uf', 'nemotron-found@example.com', '{"display_name":"Nemotron Found"}');

-- Two opposite-type reports created by their owners (triggers enqueue AI jobs).
set role authenticated; set request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (auth.uid(), 'lost', 'Red backpack', 'Bags', 'Red backpack with black straps', 'Cairo', 'Cairo', current_date, 'Red')
returning id as lost_id \gset
set request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
insert into public.items (user_id, type, name, category, description, location_text, city, event_date, color)
values (auth.uid(), 'found', 'Red backpack', 'Bags', 'Red backpack with black straps', 'Cairo', 'Cairo', current_date, 'Red')
returning id as found_id \gset
reset role; reset request.jwt.claim.sub;

-- Service-role-only storage of verified 4096-dimension passage vectors.
select test.ok('N1 AI jobs were enqueued for both reports',
  (select count(*) from public.ai_processing_jobs where item_id in (:'lost_id', :'found_id')) = 2);

select public.store_item_embedding(
  :'lost_id', null, 'text', 'passage',
  array(select (0.5 + (g % 10)::float8 / 100)::real from generate_series(1, 4096) g),
  'nvidia/nemotron-3.5-embed-8b:free', 'nvidia/nemotron-3.5-embed-8b-20261021', 4096, 'hash-lost');
select public.store_item_embedding(
  :'found_id', null, 'text', 'passage',
  array(select (0.5 + (g % 10)::float8 / 100 + (g % 7)::float8 / 1000)::real from generate_series(1, 4096) g),
  'nvidia/nemotron-3.5-embed-8b:free', 'nvidia/nemotron-3.5-embed-8b-20261021', 4096, 'hash-found');

select test.ok('N2 document embeddings are stored with the verified model and mode', (
  select bool_and(e.model_name = 'nvidia/nemotron-3.5-embed-8b:free' and e.input_mode = 'passage' and e.dimensions = 4096)
  from public.item_embeddings e where e.item_id in (:'lost_id', :'found_id')
));
select test.expect_error('N3 authenticated callers cannot read document vectors',
  'set role authenticated; select embedding from public.item_embeddings limit 1');
reset role;

-- Text query -> opposite-type passage documents.
select test.ok('N4 lost-to-found retrieval returns only the found report', (
  select count(*) = 1 and bool_and(candidate_id = :'found_id')
  from public.match_items_by_embedding(
    :'lost_id', array(select (0.5 + (g % 10)::float8 / 100)::real from generate_series(1, 4096) g), 10)
));
select test.ok('N5 found-to-lost retrieval works in the other direction', (
  select count(*) = 1 and bool_and(candidate_id = :'lost_id')
  from public.match_items_by_embedding(
    :'found_id', array(select (0.5 + (g % 10)::float8 / 100)::real from generate_series(1, 4096) g), 10)
));

select id as lost_emb from public.item_embeddings where item_id = :'lost_id' \gset
select public.persist_ai_matches(
  :'lost_id',
  jsonb_build_array(jsonb_build_object(
    'candidateId', :'found_id', 'similarity', 0.93,
    'embeddingId', :'lost_emb', 'documentType', 'text'
  ))
);
select test.ok('N6 AI match is persisted with the correct lost/found direction', (
  select count(*) = 1 and bool_and(engine = 'ai' and lost_item_id = :'lost_id' and found_item_id = :'found_id'
                                    and score = 93 and abs(ai_similarity - 0.93) < 0.001)
  from public.matches where lost_item_id = :'lost_id' and found_item_id = :'found_id'
));

-- Dismissal is owned by the user; an AI rerun must not reset it or flip status.
set role authenticated; set request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
select public.dismiss_match((select id from public.matches where lost_item_id = :'lost_id' and found_item_id = :'found_id'));
reset role;
select public.persist_ai_matches(
  :'lost_id',
  jsonb_build_array(jsonb_build_object('candidateId', :'found_id', 'similarity', 0.81, 'embeddingId', :'lost_emb'))
);
select test.ok('N7 AI rerun preserves dismissal and match status', (
  select dismissed_by @> array['d0000000-0000-0000-0000-000000000001'::uuid] and status = 'suggested'
  from public.matches where lost_item_id = :'lost_id' and found_item_id = :'found_id'
));
select test.expect_error('N8 authenticated callers cannot invoke retrieval directly',
  'set role authenticated; select * from public.match_items_by_embedding(''' || :'lost_id' || ''', array(select 0.5::real from generate_series(1,4096)), 10)');
reset role;

\echo ===== 011 TESTS DONE =====
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from test.results;
select n, name from test.results where not ok order by n;
