-- FindIt AI - 004: explainable matching engine (runs inside the database)
-- Scores are SIMILARITY ESTIMATES, not proof that two items are the same.
-- Weights: name 25, category 15, description 15, color 10, brand 10 (only when both have one), location 15, date 10.

create or replace function public.match_threshold() returns int language sql immutable as $$ select 50 $$;

create or replace function public.normalize_text(t text) returns text
language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9؀-ۿ]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create or replace function public.text_tokens(t text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct w), '{}')
  from regexp_split_to_table(public.normalize_text(t), ' ') as w
  where char_length(w) > 1 and w not in ('the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'with', 'for', 'to', 'is', 'it', 'my', 'near', 'by')
$$;

create or replace function public.jaccard(a text[], b text[]) returns numeric
language sql immutable as $$
  select case when cardinality(a) = 0 or cardinality(b) = 0 then 0
    else (select count(*) from unnest(a) x where x = any(b))::numeric
         / (select count(distinct y) from unnest(a || b) y) end
$$;

create or replace function public.text_sim(a text, b text) returns numeric
language sql immutable set search_path = public, extensions as $$
  select case when public.normalize_text(a) = '' or public.normalize_text(b) = '' then 0
    else greatest(similarity(public.normalize_text(a), public.normalize_text(b))::numeric,
                  public.jaccard(public.text_tokens(a), public.text_tokens(b))) end
$$;

-- Returns {"score": 0-100, "reasons": [...]} for one lost item and one found item.
create or replace function public.compute_match(l public.items, f public.items) returns jsonb
language plpgsql immutable set search_path = public, extensions as $$
declare
  name_sim numeric := public.text_sim(l.name, f.name);
  desc_sim numeric := public.text_sim(l.description, f.description);
  loc_sim numeric := public.text_sim(l.location_text, f.location_text);
  earned numeric := 0; possible numeric := 0; factor numeric := 1; reasons jsonb := '[]'::jsonb; days int;
begin
  if lower(l.category) <> lower(f.category) and name_sim < 0.5 then
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
  earned := earned + 8 * loc_sim;
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

  return jsonb_build_object('score', round(100 * factor * earned / possible), 'reasons', reasons);
end $$;

create or replace function public.run_matching(p_item_id uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare it public.items; c public.items; l public.items; f public.items;
  res jsonb; sc int; mid uuid; n int := 0;
begin
  select * into it from public.items where id = p_item_id;
  if not found then return 0; end if;

  if it.status not in ('active', 'matched') or it.is_hidden then
    delete from public.matches where status = 'suggested' and (lost_item_id = it.id or found_item_id = it.id);
    return 0;
  end if;

  for c in select * from public.items o
           where o.type <> it.type and o.status in ('active', 'matched') and not o.is_hidden and o.user_id <> it.user_id
  loop
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
      else
        update public.matches set score = sc, reasons = res -> 'reasons' where id = mid and (score <> sc or reasons <> res -> 'reasons');
      end if;
    elsif mid is not null then
      delete from public.matches where id = mid and status = 'suggested';
    end if;
  end loop;
  return n;
end $$;

create or replace function public.items_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.run_matching(new.id);
  return null;
end $$;

create trigger items_match_insert after insert on public.items for each row execute function public.items_after_change();
create trigger items_match_update after update on public.items for each row
  when (old.name is distinct from new.name or old.category is distinct from new.category
     or old.description is distinct from new.description or old.location_text is distinct from new.location_text
     or old.city is distinct from new.city or old.event_date is distinct from new.event_date
     or old.color is distinct from new.color or old.brand is distinct from new.brand
     or old.status is distinct from new.status or old.is_hidden is distinct from new.is_hidden)
  execute function public.items_after_change();

-- run_matching / compute_match are internal: not callable by app users
revoke all on function public.run_matching(uuid), public.compute_match(public.items, public.items) from public, anon, authenticated;
