-- FindIt AI - 007: image-embedding matching, Arabic-aware text matching, map coordinates,
-- realtime publication, storage listing hardening. Safe to apply after 001-006.

-- ======================= Arabic-aware normalization =======================
-- Removes diacritics/tatweel, unifies alef/yeh/teh-marbuta variants, maps Arabic-Indic digits to ASCII.
create or replace function public.normalize_text(t text) returns text
language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(
    translate(regexp_replace(lower(coalesce(t, '')), '[ً-ٰٟـ]', '', 'g'),
              'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩', 'اااايهوي0123456789'),
    '[^a-z0-9؀-ۿ]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create or replace function public.text_tokens(t text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct w), '{}')
  from regexp_split_to_table(public.normalize_text(t), ' ') as w
  where char_length(w) > 1 and w not in ('the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'with', 'for', 'to', 'is', 'it', 'my', 'near', 'by',
                                          'في', 'من', 'علي', 'عند', 'مع', 'الي', 'عن', 'قرب', 'جنب')
$$;

-- ======================= Map coordinates =======================
alter table public.items drop constraint if exists items_coords_valid;
alter table public.items add constraint items_coords_valid check (
  (latitude is null and longitude is null)
  or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180));

grant insert (latitude, longitude) on public.items to authenticated;
grant update (latitude, longitude) on public.items to authenticated;

-- Public view: coordinates are rounded to 3 decimals (about 110 m) so an exact spot is never published.
create or replace view public.public_items as
select i.id, i.type, i.name, i.category, i.description, i.location_text, i.city, i.event_date, i.event_time,
       i.color, i.brand, i.status, i.created_at,
       (select ii.storage_path from public.item_images ii where ii.item_id = i.id order by ii.position limit 1) as cover_path,
       round(i.latitude::numeric, 3)::double precision as approx_lat,
       round(i.longitude::numeric, 3)::double precision as approx_lng
from public.items i
where i.status in ('active', 'matched') and not i.is_hidden;
grant select on public.public_items to anon, authenticated;

create or replace function public.distance_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select case when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 6371 * 2 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))) end
$$;

-- ======================= Image embeddings =======================
-- Vectors are produced by the `embed-image` Edge Function (see supabase/functions) and stored unit-length,
-- so cosine similarity is a plain dot product. Plain real[] is used so no extension is required.
create table if not exists public.image_embeddings (
  image_id uuid primary key references public.item_images(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  embedding real[] not null check (cardinality(embedding) between 64 and 4096),
  model text not null default 'unknown',
  created_at timestamptz not null default now()
);
create index if not exists image_embeddings_item_idx on public.image_embeddings (item_id);
alter table public.image_embeddings enable row level security;
revoke all on public.image_embeddings from anon, authenticated;

create or replace function public.cosine_sim(a real[], b real[]) returns double precision
language sql immutable as $$
  select case when cardinality(a) <> cardinality(b) or cardinality(a) = 0 then null
    else (select sum(x * y) / nullif(sqrt(sum(x * x)) * sqrt(sum(y * y)), 0)
          from unnest(a, b) as t(x, y)) end
$$;

-- Highest cosine similarity between any photo of item a and any photo of item b; null when either has no vectors.
create or replace function public.image_similarity(a uuid, b uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select max(public.cosine_sim(x.embedding, y.embedding))
  from public.image_embeddings x join public.image_embeddings y on cardinality(x.embedding) = cardinality(y.embedding)
  where x.item_id = a and y.item_id = b
$$;
revoke all on function public.image_similarity(uuid, uuid) from public, anon, authenticated;

-- Only the service role (Edge Function) may store vectors. The caller is expected to have verified image ownership.
create or replace function public.store_image_embedding(p_image_id uuid, p_embedding real[], p_model text default 'unknown')
returns void language plpgsql security definer set search_path = public as $$
declare it uuid; norm double precision; unit real[];
begin
  if auth.uid() is not null then raise exception 'Not allowed.'; end if;
  select item_id into it from public.item_images where id = p_image_id;
  if it is null then raise exception 'Image not found.'; end if;
  select sqrt(sum(x * x)) into norm from unnest(p_embedding) as t(x);
  if norm is null or norm = 0 then raise exception 'Invalid embedding.'; end if;
  select array_agg((x / norm)::real order by ord) into unit from unnest(p_embedding) with ordinality as t(x, ord);
  insert into public.image_embeddings (image_id, item_id, embedding, model) values (p_image_id, it, unit, coalesce(p_model, 'unknown'))
  on conflict (image_id) do update set embedding = excluded.embedding, model = excluded.model, created_at = now();
  perform public.run_matching(it);
end $$;
revoke all on function public.store_image_embedding(uuid, real[], text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.store_image_embedding(uuid, real[], text) to service_role;
  end if;
end $$;

-- Which of my photos still lack a vector (lets the client retry embedding).
create or replace function public.my_unembedded_images(p_item_id uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select ii.id from public.item_images ii join public.items i on i.id = ii.item_id
  where ii.item_id = p_item_id and i.user_id = auth.uid()
    and not exists (select 1 from public.image_embeddings e where e.image_id = ii.id)
$$;
revoke all on function public.my_unembedded_images(uuid) from public, anon;
grant execute on function public.my_unembedded_images(uuid) to authenticated;

-- ======================= Matching with photos and map distance =======================
-- Same weights as 004 plus: photo similarity (+20, only when both items have photo vectors) and map distance (replaces
-- the text-area part when both items have coordinates and are close). Without vectors/coordinates behaviour is unchanged.
create or replace function public.compute_match(l public.items, f public.items) returns jsonb
language plpgsql stable set search_path = public, extensions as $$
declare
  name_sim numeric := public.text_sim(l.name, f.name);
  desc_sim numeric := public.text_sim(l.description, f.description);
  loc_sim numeric := public.text_sim(l.location_text, f.location_text);
  earned numeric := 0; possible numeric := 0; factor numeric := 1; reasons jsonb := '[]'::jsonb; days int;
  km double precision := public.distance_km(l.latitude, l.longitude, f.latitude, f.longitude);
  img double precision := public.image_similarity(l.id, f.id);
begin
  if lower(l.category) <> lower(f.category) and name_sim < 0.5 and coalesce(img, 0) < 0.85 then
    return jsonb_build_object('score', 0, 'reasons', jsonb_build_array('Different category and different item name'));
  end if;

  possible := possible + 25; earned := earned + 25 * name_sim;
  if name_sim >= 0.8 then reasons := reasons || to_jsonb('Very similar item name'::text);
  elsif name_sim >= 0.4 then reasons := reasons || to_jsonb('Similar item name'::text); end if;

  possible := possible + 15;
  if lower(l.category) = lower(f.category) then
    earned := earned + 15; reasons := reasons || to_jsonb('Same category: ' || l.category);
  end if;

  possible := possible + 15; earned := earned + 15 * desc_sim;
  if desc_sim >= 0.3 then reasons := reasons || to_jsonb('Similar description'::text); end if;

  possible := possible + 10;
  if lower(l.color) = lower(f.color) then
    earned := earned + 10; reasons := reasons || to_jsonb('Same color: ' || l.color);
  else reasons := reasons || to_jsonb('Different color'::text); end if;

  if coalesce(trim(l.brand), '') <> '' and coalesce(trim(f.brand), '') <> '' then
    possible := possible + 10;
    if public.normalize_text(l.brand) = public.normalize_text(f.brand)
       or public.text_tokens(l.brand) <@ public.text_tokens(f.brand) or public.text_tokens(f.brand) <@ public.text_tokens(l.brand) then
      earned := earned + 10; reasons := reasons || to_jsonb('Same brand: ' || l.brand);
    else
      factor := factor * 0.75; reasons := reasons || to_jsonb('Different brand (lowers the score)'::text);
    end if;
  end if;

  possible := possible + 15;
  if public.normalize_text(l.city) = public.normalize_text(f.city) then
    earned := earned + 7; reasons := reasons || to_jsonb('Same city: ' || l.city);
  end if;
  if km is not null then
    earned := earned + 8 * greatest(loc_sim, greatest(0, 1 - km / 5.0)::numeric);
    if km <= 1 then reasons := reasons || to_jsonb('Within 1 km on the map'::text);
    elsif km <= 5 then reasons := reasons || to_jsonb('Within 5 km on the map'::text); end if;
  else
    earned := earned + 8 * loc_sim;
  end if;
  if loc_sim >= 0.5 then reasons := reasons || to_jsonb('Same area'::text);
  elsif loc_sim >= 0.25 then reasons := reasons || to_jsonb('Similar area'::text); end if;

  possible := possible + 10; days := f.event_date - l.event_date;
  if days < -1 then
    factor := factor * 0.8; reasons := reasons || to_jsonb('Found before it was lost (lowers the score)'::text);
  else
    earned := earned + 10 * greatest(0, 1 - greatest(days, 0) / 30.0);
    if days <= 0 then reasons := reasons || to_jsonb('Same day'::text);
    elsif days <= 30 then reasons := reasons || to_jsonb('Found ' || days || ' day(s) after it was lost');
    else reasons := reasons || to_jsonb('Dates are more than 30 days apart'::text); end if;
  end if;

  if img is not null then
    possible := possible + 20;
    earned := earned + 20 * greatest(0, least(1, (img - 0.7) / 0.3))::numeric;
    if img >= 0.85 then reasons := reasons || to_jsonb('Photos look very similar'::text);
    elsif img >= 0.75 then reasons := reasons || to_jsonb('Photos look similar'::text); end if;
  end if;

  return jsonb_build_object('score', round(100 * factor * earned / possible), 'reasons', reasons);
end $$;
revoke all on function public.compute_match(public.items, public.items) from public, anon, authenticated;

-- Re-run matching when coordinates change too (004's trigger only watched text fields).
drop trigger if exists items_match_update on public.items;
create trigger items_match_update after update on public.items for each row
  when (old.name is distinct from new.name or old.category is distinct from new.category
     or old.description is distinct from new.description or old.location_text is distinct from new.location_text
     or old.city is distinct from new.city or old.event_date is distinct from new.event_date
     or old.color is distinct from new.color or old.brand is distinct from new.brand
     or old.latitude is distinct from new.latitude or old.longitude is distinct from new.longitude
     or old.status is distinct from new.status or old.is_hidden is distinct from new.is_hidden)
  execute function public.items_after_change();

-- ======================= Realtime =======================
-- Row Level Security still applies to realtime: users only receive rows they can select.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  end if;
end $$;

-- ======================= Storage hardening =======================
-- The bucket is public, so image URLs work without any SELECT policy. Remove the policy that let anyone LIST every
-- object in the bucket; owners may still list their own folder.
drop policy if exists item_images_storage_read on storage.objects;
create policy item_images_storage_read_own on storage.objects for select to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
