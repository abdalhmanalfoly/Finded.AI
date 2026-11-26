-- Present AI match candidates in FindIt AI branding without changing how they
-- are ranked. The stored score remains a ranking score, not a probability.
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
           'FindIt AI-powered decision (ranking score, not a probability)',
           'Similarity: ' || round(sim::numeric, 3),
           'Model: findit.ai & Nemotron (NVIDIA)'
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
               'FindIt AI-powered decision (ranking score, not a probability)',
               'Similarity: ' || round(sim::numeric, 3),
               'Model: findit.ai & Nemotron (NVIDIA)'
             ),
             engine = 'ai', ai_similarity = sim, ai_embedding_id = emb_id, ai_model = model_name, ai_processed_at = now()
       where id = mid and status = 'suggested';
    end if;
  end loop;
  return n;
end $$;

-- Rebrand existing AI-owned explanations from their stored similarity.
-- score, engine, status, dismissed_by and ai_model are intentionally untouched.
update public.matches
   set reasons = jsonb_build_array(
         'FindIt AI-powered decision (ranking score, not a probability)',
         'Similarity: ' || round(ai_similarity::numeric, 3),
         'Model: findit.ai & Nemotron (NVIDIA)'
       )
 where engine = 'ai' and ai_similarity is not null;
