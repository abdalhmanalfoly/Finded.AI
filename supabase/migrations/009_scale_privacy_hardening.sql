-- FindIt AI - 009: matching scalability, profile privacy, account deletion/export, embedding rate limits,
-- flag target tracking, suspended-upload guard, optional pg_cron schedule.
-- Safe to apply after 001-008 (every statement is idempotent). Take a backup or try it on a test project first.

-- ======================= A. Matching: look only at plausible candidates =======================
-- Before: every insert/update compared the report with EVERY report of the opposite type.
-- Now a candidate is either (same category AND event date within 90 days) OR (similar name, any category,
-- found through a trigram index), newest first, at most 300. Matches whose partner is no longer a candidate
-- (for example after the category was edited) are removed again unless the owners already acted on them.
create index if not exists items_match_candidates_idx
  on public.items (type, (lower(category)), event_date)
  where status in ('active', 'matched') and not is_hidden;
create index if not exists items_name_trgm_idx
  on public.items using gin (name extensions.gin_trgm_ops);

create or replace function public.run_matching(p_item_id uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare it public.items; c public.items; l public.items; f public.items;
  res jsonb; sc int; mid uuid; n int := 0; cand uuid[] := '{}';
begin
  select * into it from public.items where id = p_item_id;
  if not found then return 0; end if;

  if it.status not in ('active', 'matched') or it.is_hidden then
    delete from public.matches where status = 'suggested' and (lost_item_id = it.id or found_item_id = it.id);
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
      else
        update public.matches set score = sc, reasons = res -> 'reasons' where id = mid and (score <> sc or reasons <> res -> 'reasons');
      end if;
    elsif mid is not null then
      delete from public.matches where id = mid and status = 'suggested';
    end if;
  end loop;

  -- Partners that dropped out of the candidate set no longer count as suggestions.
  delete from public.matches
  where status = 'suggested' and (lost_item_id = it.id or found_item_id = it.id)
    and not ((case when it.type = 'lost' then found_item_id else lost_item_id end) = any(cand));
  return n;
end $$;
revoke all on function public.run_matching(uuid) from public, anon, authenticated;

-- ======================= B. Profile privacy =======================
-- Contact counterparts only need a display name. They no longer read the whole profile row
-- (role, suspension flag, city, timestamps). Use public.contact_profiles for names.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create or replace view public.contact_profiles as
select p.id, p.display_name
from public.profiles p
where p.id = auth.uid()
   or exists (select 1 from public.contact_requests r
              where (r.requester_id = auth.uid() and r.recipient_id = p.id)
                 or (r.recipient_id = auth.uid() and r.requester_id = p.id));
revoke all on public.contact_profiles from public, anon;
grant select on public.contact_profiles to authenticated;

-- ======================= C. Account deletion and data export =======================
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please log in first.'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from public.items i where i.user_id = uid), '[]'::jsonb),
    'contact_requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.contact_requests r
                                  where r.requester_id = uid or r.recipient_id = uid), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.messages m
                          where m.request_id in (select id from public.contact_requests where requester_id = uid or recipient_id = uid)), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from public.notifications n where n.user_id = uid), '[]'::jsonb),
    'flags_filed', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.flags f where f.reporter_id = uid), '[]'::jsonb));
end $$;

-- Deletes the caller's account. Reports, photos rows, requests, messages and notifications go with it (cascade).
-- Photo FILES are removed by the app through the Storage API before this call (SQL cannot delete stored files).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please log in first.'; end if;
  if public.is_admin() and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'You are the only admin. Make another admin before deleting this account.';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.export_my_data(), public.delete_my_account() from public, anon;
grant execute on function public.export_my_data(), public.delete_my_account() to authenticated;

-- ======================= D. Flags remember who was reported =======================
create or replace function public.flags_fill_reported_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.item_id is not null then
    new.reported_user_id := (select user_id from public.items where id = new.item_id);
  end if;
  return new;
end $$;
drop trigger if exists flags_fill_reported_user on public.flags;
create trigger flags_fill_reported_user before insert on public.flags for each row execute function public.flags_fill_reported_user();

-- ======================= E. Photo-embedding rate limit (used by the embed-image Edge Function) =======================
create table if not exists public.embedding_attempts (
  image_id uuid primary key references public.item_images(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null,
  attempts int not null default 0,
  last_attempt timestamptz not null default now()
);
create index if not exists embedding_attempts_user_idx on public.embedding_attempts (user_id, last_attempt);
alter table public.embedding_attempts enable row level security;
revoke all on public.embedding_attempts from anon, authenticated;

-- Returns true when the caller may spend one embedding call on this photo:
-- at most 3 tries per photo (10 minutes apart) and 30 photos per owner per hour. Service role only.
create or replace function public.claim_embedding_attempt(p_image_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare it uuid; owner_id uuid;
begin
  if auth.uid() is not null then raise exception 'Not allowed.'; end if;
  select ii.item_id, i.user_id into it, owner_id
  from public.item_images ii join public.items i on i.id = ii.item_id where ii.id = p_image_id;
  if it is null then return false; end if;
  if (select count(*) from public.embedding_attempts where user_id = owner_id and last_attempt > now() - interval '1 hour') >= 30 then
    return false;
  end if;
  insert into public.embedding_attempts (image_id, item_id, user_id, attempts, last_attempt)
  values (p_image_id, it, owner_id, 1, now())
  on conflict (image_id) do update
    set attempts = public.embedding_attempts.attempts + 1, last_attempt = now()
    where public.embedding_attempts.attempts < 3 and public.embedding_attempts.last_attempt < now() - interval '10 minutes';
  return found;
end $$;
revoke all on function public.claim_embedding_attempt(uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_embedding_attempt(uuid) to service_role;
  end if;
end $$;

-- ======================= F. Suspended users cannot upload photos =======================
drop policy if exists item_images_storage_insert on storage.objects;
create policy item_images_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text and not public.is_suspended());

-- ======================= G. Optional: nightly stale-report closing =======================
-- Runs only when the pg_cron extension is enabled (Dashboard -> Database -> Extensions). Otherwise skipped.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('findit-close-stale'); exception when others then null; end;
    perform cron.schedule('findit-close-stale', '0 3 * * *', 'select public.close_stale_items(90)');
  end if;
exception when others then
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
