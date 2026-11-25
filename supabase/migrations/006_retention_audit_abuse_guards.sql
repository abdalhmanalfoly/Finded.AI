-- FindIt AI - 006: stale-report retention, admin audit-log reader, abuse guards.
-- Safe to apply after 001-005. Implements decision #10 in docs/OPEN_DECISIONS.md (suggest closing after 90 days).

-- ---------- admin: hiding a missing item must fail loudly ----------
create or replace function public.admin_set_item_hidden(p_item_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.items set is_hidden = p_hidden where id = p_item_id;
  if not found then raise exception 'Report not found.'; end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id)
  values (auth.uid(), case when p_hidden then 'hide_item' else 'unhide_item' end, 'item', p_item_id);
end $$;

-- ---------- admin: read the audit log (newest first) ----------
create or replace function public.admin_list_actions(p_limit int default 100)
returns table (id uuid, created_at timestamptz, admin_name text, action text, target_type text, target_id uuid, note text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query
    select a.id, a.created_at, coalesce(p.display_name, 'Deleted admin'), a.action, a.target_type, a.target_id, a.note
    from public.admin_actions a left join public.profiles p on p.id = a.admin_id
    order by a.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

-- ---------- retention: close reports with no activity for N days ----------
-- Callable by an admin, or from a trusted context (SQL editor, service role, pg_cron) where auth.uid() is null.
-- Closing a report removes its still-"suggested" matches through the normal matching trigger.
create or replace function public.close_stale_items(p_days int default 90)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_days is null or p_days < 30 then raise exception 'Retention period must be at least 30 days.'; end if;
  for r in
    update public.items set status = 'closed'
    where status = 'active' and updated_at < now() - make_interval(days => p_days)
    returning id, user_id, name
  loop
    insert into public.notifications (user_id, type, title, body)
    values (r.user_id, 'system', 'Report closed automatically',
            'Your report "' || r.name || '" had no activity for ' || p_days || ' days and was closed. Open the report and choose Reopen to make it active again.');
    n := n + 1;
  end loop;
  if auth.uid() is not null and n > 0 then
    insert into public.admin_actions (admin_id, action, target_type, note)
    values (auth.uid(), 'close_stale_items', 'item', n || ' report(s) older than ' || p_days || ' days');
  end if;
  return n;
end $$;

-- Owners may reopen a closed report themselves (status is already an updatable column); nothing else needed.
-- Optional scheduling when pg_cron is enabled in your Supabase project (Database -> Extensions):
--   select cron.schedule('findit-close-stale', '0 3 * * *', $$select public.close_stale_items(90)$$);

-- ---------- abuse guards ----------
-- One open flag per reporter and report; nobody can flag their own report.
create unique index if not exists flags_one_open_per_reporter_item
  on public.flags (reporter_id, item_id) where status in ('open', 'in_review');

create or replace function public.flags_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.item_id is not null and exists (select 1 from public.items where id = new.item_id and user_id = new.reporter_id) then
    raise exception 'You cannot report your own listing.';
  end if;
  if (select count(*) from public.flags where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily report limit reached.';
  end if;
  return new;
end $$;
drop trigger if exists flags_guard on public.flags;
create trigger flags_guard before insert on public.flags for each row execute function public.flags_guard();

-- Message flood limit: 60 messages per hour per sender.
create or replace function public.messages_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and
     (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'You are sending messages too quickly. Please wait a while.';
  end if;
  return new;
end $$;
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages for each row execute function public.messages_rate_limit();

-- ---------- execute permissions ----------
revoke all on function public.admin_list_actions(int), public.close_stale_items(int) from public, anon;
grant execute on function public.admin_list_actions(int), public.close_stale_items(int) to authenticated;
