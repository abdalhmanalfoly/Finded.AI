-- FindIt AI - 011: NVIDIA Nemotron 3.5 Embed 8B document embeddings + asymmetric pgvector retrieval.
-- Safe to apply after 001-010. Idempotent. Never run old migrations on a live project.
--
-- Verified live on 2026-11-26 through OpenRouter with nvidia/nemotron-3.5-embed-8b:free:
--   input_type "passage" (text and text+image) and "query" (text) both returned 4096 finite values.
-- Queries are NEVER stored as document embeddings. Only passage vectors are indexed here.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Match evidence: AI results take precedence; dismissed/user-acted rows keep their state.
-- ---------------------------------------------------------------------------
alter table public.matches add column if not exists engine text not null default 'rule';
alter table public.matches add column if not exists ai_similarity real;
alter table public.matches add column if not exists ai_embedding_id uuid;
alter table public.matches add column if not exists ai_model text;
alter table public.matches add column if not exists ai_processed_at timestamptz;
alter table public.matches drop constraint if exists matches_engine_check;
alter table public.matches add constraint matches_engine_check check (engine in ('rule', 'ai'));

-- ---------------------------------------------------------------------------
-- Document embeddings (one row per item/text or item/image document).
-- ---------------------------------------------------------------------------
create table if not exists public.item_embeddings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  image_id uuid references public.item_images(id) on delete cascade,
  embedding_type text not null check (embedding_type in ('text', 'image', 'multimodal')),
  input_mode text not null default 'passage' check (input_mode = 'passage'),
  embedding extensions.vector(4096) not null,
  model_name text not null,
  model_version text,
  dimensions int not null default 4096 check (dimensions = 4096),
  content_hash text not null,
  processing_status text not null default 'ready' check (processing_status in ('ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists item_embeddings_updated on public.item_embeddings;
create trigger item_embeddings_updated before update on public.item_embeddings
  for each row execute function public.set_updated_at();

-- NULL image_id means the text-only document. coalesce makes the key work on PG 11+ too.
create unique index if not exists item_embeddings_content_key
  on public.item_embeddings (
    item_id,
    coalesce(image_id, '00000000-0000-0000-0000-000000000000'::uuid),
    embedding_type, model_name, content_hash
  );
create index if not exists item_embeddings_item_idx on public.item_embeddings (item_id, embedding_type);
-- No ANN index: this model returns 4096 dimensions, but pgvector's HNSW/IVFFlat
-- index limit for vector is 2000 dimensions. Retrieval therefore uses an exact
-- cosine scan over ready documents, which is appropriate for the current data size.

alter table public.item_embeddings enable row level security;
revoke all on public.item_embeddings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Async queue: report changes enqueue work; the Edge Function claims it.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_processing_jobs (
  item_id uuid primary key references public.items(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists ai_processing_jobs_updated on public.ai_processing_jobs;
create trigger ai_processing_jobs_updated before update on public.ai_processing_jobs
  for each row execute function public.set_updated_at();
alter table public.ai_processing_jobs enable row level security;
revoke all on public.ai_processing_jobs from anon, authenticated;

create or replace function public.enqueue_ai_processing(p_item_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_processing_jobs (item_id, status, attempts)
  values (p_item_id, 'queued', 0)
  on conflict (item_id) do update
    set status = 'queued', attempts = 0, last_error = null, updated_at = now();
end $$;
revoke all on function public.enqueue_ai_processing(uuid) from public, anon, authenticated;

create or replace function public.items_ai_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_ai_processing(new.id);
  return null;
end $$;
drop trigger if exists items_ai_enqueue on public.items;
create trigger items_ai_enqueue after insert on public.items for each row execute function public.items_ai_enqueue();
drop trigger if exists items_ai_enqueue_update on public.items;
create trigger items_ai_enqueue_update after update on public.items for each row
  when (old.name is distinct from new.name or old.category is distinct from new.category
     or old.description is distinct from new.description or old.location_text is distinct from new.location_text
     or old.city is distinct from new.city or old.event_date is distinct from new.event_date
     or old.color is distinct from new.color or old.brand is distinct from new.brand
     or old.additional_details is distinct from new.additional_details
     or old.status is distinct from new.status or old.is_hidden is distinct from new.is_hidden)
  execute function public.items_ai_enqueue();

create or replace function public.item_images_ai_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_ai_processing(old.item_id);
  else
    perform public.enqueue_ai_processing(new.item_id);
  end if;
  return null;
end $$;
drop trigger if exists item_images_ai_enqueue on public.item_images;
create trigger item_images_ai_enqueue after insert or delete on public.item_images
  for each row execute function public.item_images_ai_enqueue();

-- ---------------------------------------------------------------------------
-- Service-role-only helpers used by the nemotron-match Edge Function.
-- ---------------------------------------------------------------------------
-- The provider key lives in Supabase Vault, never in a VITE_/frontend variable.
create or replace function public.get_openrouter_api_key() returns text
language sql stable security definer set search_path = '' as $$
  select d.decrypted_secret
  from vault.decrypted_secrets d
  where d.name = 'OPENROUTER_API_KEY'
  limit 1;
$$;
revoke all on function public.get_openrouter_api_key() from public, anon, authenticated;
grant execute on function public.get_openrouter_api_key() to service_role;

create or replace function public.ai_embedding_exists(
  p_item_id uuid, p_image_id uuid, p_embedding_type text, p_content_hash text
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.item_embeddings e
    where e.item_id = p_item_id
      and e.image_id is not distinct from p_image_id
      and e.embedding_type = p_embedding_type
      and e.model_name = 'nvidia/nemotron-3.5-embed-8b:free'
      and e.content_hash = p_content_hash
      and e.processing_status = 'ready'
  );
$$;
revoke all on function public.ai_embedding_exists(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.ai_embedding_exists(uuid, uuid, text, text) to service_role;

create or replace function public.store_item_embedding(
  p_item_id uuid, p_image_id uuid, p_embedding_type text, p_input_mode text,
  p_embedding real[], p_model_name text, p_model_version text, p_dimensions int, p_content_hash text
) returns void language plpgsql security definer set search_path = public, extensions as $$
declare vec extensions.vector(4096);
begin
  if auth.uid() is not null then raise exception 'Not allowed.'; end if;
  if not exists (select 1 from public.items where id = p_item_id) then raise exception 'Item not found.'; end if;
  if p_image_id is not null and not exists (
       select 1 from public.item_images where id = p_image_id and item_id = p_item_id) then
    raise exception 'Image not found.';
  end if;
  if p_embedding_type not in ('text', 'image', 'multimodal') then raise exception 'Invalid embedding type.'; end if;
  if p_input_mode <> 'passage' then raise exception 'Only passage embeddings may be stored.'; end if;
  if coalesce(array_length(p_embedding, 1), 0) <> 4096 or p_dimensions <> 4096 then
    raise exception 'Embedding must have 4096 dimensions.';
  end if;
  vec := (p_embedding::extensions.vector)::extensions.vector(4096);

  insert into public.item_embeddings
    (item_id, image_id, embedding_type, input_mode, embedding, model_name, model_version, dimensions, content_hash, processing_status)
  values
    (p_item_id, p_image_id, p_embedding_type, 'passage', vec, p_model_name, p_model_version, 4096, p_content_hash, 'ready')
  on conflict (item_id, coalesce(image_id, '00000000-0000-0000-0000-000000000000'::uuid), embedding_type, model_name, content_hash)
  do update set embedding = excluded.embedding, model_version = excluded.model_version,
                processing_status = 'ready', updated_at = now();
end $$;
revoke all on function public.store_item_embedding(uuid, uuid, text, text, real[], text, text, int, text) from public, anon, authenticated;
grant execute on function public.store_item_embedding(uuid, uuid, text, text, real[], text, text, int, text) to service_role;

create or replace function public.claim_ai_job(p_item_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is not null then raise exception 'Not allowed.'; end if;
  update public.ai_processing_jobs
     set status = 'processing', attempts = attempts + 1, updated_at = now()
   where item_id = p_item_id and attempts < 3 and status in ('queued', 'failed')
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.claim_ai_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_ai_job(uuid) to service_role;

create or replace function public.finish_ai_job(p_item_id uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then raise exception 'Not allowed.'; end if;
  if p_status not in ('done', 'failed') then raise exception 'Invalid status.'; end if;
  update public.ai_processing_jobs
     set status = p_status, last_error = p_error, updated_at = now()
   where item_id = p_item_id;
end $$;
revoke all on function public.finish_ai_job(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_ai_job(uuid, text, text) to service_role;

-- Retrieval threshold. This is a ranking cut-off, NOT a calibrated probability.
create or replace function public.ai_match_threshold() returns double precision
language sql immutable as $$ select 0.45::double precision $$;
revoke all on function public.ai_match_threshold() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Asymmetric retrieval: text query -> opposite-type passage documents.
-- ---------------------------------------------------------------------------
create or replace function public.match_items_by_embedding(
  p_item_id uuid, p_query real[], p_limit int default 10
) returns table (candidate_id uuid, similarity double precision, embedding_id uuid, image_id uuid, model_name text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare it public.items; q extensions.vector(4096);
begin
  if auth.uid() is not null then raise exception 'Not allowed.'; end if;
  if coalesce(array_length(p_query, 1), 0) <> 4096 then raise exception 'Query embedding must have 4096 dimensions.'; end if;
  select * into it from public.items where id = p_item_id;
  if not found or it.type not in ('lost', 'found') then return; end if;
  q := (p_query::extensions.vector)::extensions.vector(4096);

  return query
  with ranked as (
    select e.item_id,
           e.id as emb_id,
           e.image_id as img_id,
           e.model_name as model,
           e.embedding <=> q as distance
    from public.item_embeddings e
    join public.items o on o.id = e.item_id
    where e.processing_status = 'ready'
      and e.item_id <> p_item_id
      and o.type = case when it.type = 'lost' then 'found' else 'lost' end
      and o.status in ('active', 'matched')
      and not o.is_hidden
      and o.user_id <> it.user_id
  )
  select r.item_id,
         (1 - min(r.distance))::double precision,
         (array_agg(r.emb_id order by r.distance))[1],
         (array_agg(r.img_id order by r.distance))[1],
         (array_agg(r.model order by r.distance))[1]
  from ranked r
  group by r.item_id
  having (1 - min(r.distance)) >= public.ai_match_threshold()
  order by min(r.distance)
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
end $$;
revoke all on function public.match_items_by_embedding(uuid, real[], int) from public, anon, authenticated;
grant execute on function public.match_items_by_embedding(uuid, real[], int) to service_role;

create or replace function public.persist_ai_matches(p_item_id uuid, p_candidates jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare it public.items; c jsonb; cand_id uuid; sim double precision; model_name text;
  emb_id uuid; img_id uuid; l_id uuid; f_id uuid; sc int; mid uuid; n int := 0; cand uuid[] := '{}';
begin
  if auth.uid() is not null then raise exception 'Not allowed.'; end if;
  select * into it from public.items where id = p_item_id;
  if not found then return 0; end if;
  if coalesce(jsonb_array_length(p_candidates), 0) = 0 then return 0; end if;

  for c in select value from jsonb_array_elements(p_candidates)
  loop
    cand_id := nullif(c ->> 'candidateId', '')::uuid;
    sim := (c ->> 'similarity')::double precision;
    model_name := coalesce(c ->> 'modelName', 'nvidia/nemotron-3.5-embed-8b:free');
    emb_id := nullif(c ->> 'embeddingId', '')::uuid;
    img_id := nullif(c ->> 'imageId', '')::uuid;

    if not exists (
      select 1 from public.items o
      where o.id = cand_id and o.type <> it.type and o.status in ('active', 'matched')
        and not o.is_hidden and o.user_id <> it.user_id
    ) or sim is null or sim < public.ai_match_threshold() then
      continue;
    end if;

    cand := cand || cand_id;
    if it.type = 'lost' then l_id := it.id; f_id := cand_id; else l_id := cand_id; f_id := it.id; end if;
    sc := least(100, greatest(0, round(sim * 100)::int));

    select id into mid from public.matches where lost_item_id = l_id and found_item_id = f_id;
    if mid is null then
      insert into public.matches
        (lost_item_id, found_item_id, score, reasons, engine, ai_similarity, ai_embedding_id, ai_model, ai_processed_at)
      values
        (l_id, f_id, sc,
         jsonb_build_array(
           'Nemotron similarity ' || round(sim::numeric, 3) || ' (ranking score, not a calibrated probability)',
           'Document type: ' || coalesce(c ->> 'documentType', 'text'),
           'Model: ' || model_name
         ),
         'ai', sim, emb_id, model_name, now())
      returning id into mid;
      insert into public.notifications (user_id, type, title, body, related_match_id)
      values
        (it.user_id, 'match', 'AI match candidate', 'A Nemotron similarity candidate was found for "' || it.name || '".', mid),
        ((select user_id from public.items where id = cand_id), 'match', 'AI match candidate',
         'A Nemotron similarity candidate was found for "' || (select name from public.items where id = cand_id) || '".', mid);
      n := n + 1;
    else
      -- Never reset status or dismissed_by. Only suggested rows may be refreshed by a rerun.
      update public.matches
         set score = sc,
             reasons = jsonb_build_array(
               'Nemotron similarity ' || round(sim::numeric, 3) || ' (ranking score, not a calibrated probability)',
               'Document type: ' || coalesce(c ->> 'documentType', 'text'),
               'Model: ' || model_name
             ),
             engine = 'ai', ai_similarity = sim, ai_embedding_id = emb_id, ai_model = model_name, ai_processed_at = now()
       where id = mid and status = 'suggested';
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.persist_ai_matches(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.persist_ai_matches(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Keep the legacy rule-based fallback from overwriting AI-owned suggestions.
-- ---------------------------------------------------------------------------
create or replace function public.run_matching(p_item_id uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare it public.items; c public.items; l public.items; f public.items;
  res jsonb; sc int; mid uuid; n int := 0; cand uuid[] := '{}';
begin
  select * into it from public.items where id = p_item_id;
  if not found then return 0; end if;

  if it.status not in ('active', 'matched') or it.is_hidden then
    delete from public.matches
     where status = 'suggested' and (lost_item_id = it.id or found_item_id = it.id)
       and coalesce(engine, 'rule') <> 'ai';
    return 0;
  end if;

  for c in select * from (
              select o.* from public.items o
              where o.type <> it.type and o.status in ('active', 'matched') and not o.is_hidden and o.user_id <> it.user_id
                and ((lower(o.category) = lower(it.category) and o.event_date between it.event_date - 90 and it.event_date + 90)
                     or o.name operator(extensions.%) it.name)
              order by o.created_at desc
              limit 300) candidates
  loop
    cand := cand || c.id;
    if it.type = 'lost' then l := it; f := c; else l := c; f := it; end if;
    res := public.compute_match(l, f);
    sc := (res ->> 'score')::int;
    select id into mid from public.matches where lost_item_id = l.id and found_item_id = f.id;

    if sc >= public.match_threshold() then
      if mid is null then
        insert into public.matches (lost_item_id, found_item_id, score, reasons)
        values (l.id, f.id, sc, res -> 'reasons') returning id into mid;
        insert into public.notifications (user_id, type, title, body, related_match_id) values
          (l.user_id, 'match', 'Possible match found', 'Your report "' || l.name || '" may match another report (similarity estimate ' || sc || '%).', mid),
          (f.user_id, 'match', 'Possible match found', 'Your report "' || f.name || '" may match another report (similarity estimate ' || sc || '%).', mid);
        n := n + 1;
      elsif coalesce((select engine from public.matches where id = mid), 'rule') <> 'ai' then
        update public.matches set score = sc, reasons = res -> 'reasons'
         where id = mid and (score <> sc or reasons <> res -> 'reasons');
      end if;
    elsif mid is not null then
      delete from public.matches
       where id = mid and status = 'suggested' and coalesce(engine, 'rule') <> 'ai';
    end if;
  end loop;

  delete from public.matches
  where status = 'suggested' and (lost_item_id = it.id or found_item_id = it.id)
    and coalesce(engine, 'rule') <> 'ai'
    and not ((case when it.type = 'lost' then found_item_id else lost_item_id end) = any(cand));
  return n;
end $$;
revoke all on function public.run_matching(uuid) from public, anon, authenticated;
