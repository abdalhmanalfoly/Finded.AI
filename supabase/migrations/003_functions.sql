-- FindIt AI - 003: contact requests, notifications, moderation functions
create or replace function public.create_contact_request(p_item_id uuid, p_message text, p_match_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); it public.items; rid uuid; msg text := trim(coalesce(p_message, ''));
begin
  if uid is null then raise exception 'Please log in first.'; end if;
  if public.is_suspended() then raise exception 'Your account is suspended.'; end if;
  select * into it from public.items where id = p_item_id and status in ('active', 'matched') and not is_hidden;
  if not found then raise exception 'This item is not available.'; end if;
  if it.user_id = uid then raise exception 'You cannot contact yourself.'; end if;
  if char_length(msg) < 10 or char_length(msg) > 500 then raise exception 'Write a message between 10 and 500 characters.'; end if;
  if exists (select 1 from public.contact_requests where requester_id = uid and item_id = p_item_id and status = 'pending') then
    raise exception 'You already have a pending request for this item.';
  end if;
  if (select count(*) from public.contact_requests where requester_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily contact request limit reached.';
  end if;
  if p_match_id is not null and not exists (
    select 1 from public.matches m join public.items i on i.id in (m.lost_item_id, m.found_item_id)
    where m.id = p_match_id and i.user_id = uid and p_item_id in (m.lost_item_id, m.found_item_id)) then
    raise exception 'Invalid match.';
  end if;
  insert into public.contact_requests (match_id, item_id, requester_id, recipient_id, message)
  values (p_match_id, p_item_id, uid, it.user_id, msg) returning id into rid;
  insert into public.notifications (user_id, type, title, body, related_request_id)
  values (it.user_id, 'contact_request', 'New contact request', 'Someone sent a request about "' || it.name || '".', rid);
  return rid;
end $$;

create or replace function public.respond_contact_request(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.contact_requests;
begin
  if uid is null then raise exception 'Please log in first.'; end if;
  select * into r from public.contact_requests where id = p_request_id and recipient_id = uid and status = 'pending';
  if not found then raise exception 'Request not found.'; end if;
  update public.contact_requests set status = case when p_accept then 'accepted' else 'rejected' end where id = r.id;
  if p_accept and r.match_id is not null then
    update public.matches set status = 'contacted' where id = r.match_id and status = 'suggested';
  end if;
  insert into public.notifications (user_id, type, title, body, related_request_id)
  values (r.requester_id, 'contact_response',
          case when p_accept then 'Contact request accepted' else 'Contact request declined' end,
          case when p_accept then 'You can now exchange messages.' else 'The owner declined your request.' end, r.id);
end $$;

create or replace function public.cancel_contact_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.contact_requests set status = 'cancelled'
  where id = p_request_id and requester_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Request not found.'; end if;
end $$;

create or replace function public.dismiss_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from public.matches m join public.items i on i.id in (m.lost_item_id, m.found_item_id)
                 where m.id = p_match_id and i.user_id = uid) then
    raise exception 'Match not found.';
  end if;
  update public.matches set dismissed_by = array_append(dismissed_by, uid)
  where id = p_match_id and not (uid = any(dismissed_by));
end $$;

create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.contact_requests;
begin
  select * into r from public.contact_requests where id = new.request_id;
  insert into public.notifications (user_id, type, title, body, related_request_id)
  values (case when new.sender_id = r.requester_id then r.recipient_id else r.requester_id end,
          'message', 'New message', 'You have a new message in a contact thread.', r.id);
  return new;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_new_message();

-- ---------- admin functions (all actions are logged) ----------
create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'reports', (select count(*) from public.items),
    'matches', (select count(*) from public.matches),
    'open_flags', (select count(*) from public.flags where status in ('open', 'in_review')),
    'resolved_reports', (select count(*) from public.items where status = 'resolved'));
end $$;

create or replace function public.admin_set_item_hidden(p_item_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.items set is_hidden = p_hidden where id = p_item_id;
  insert into public.admin_actions (admin_id, action, target_type, target_id)
  values (auth.uid(), case when p_hidden then 'hide_item' else 'unhide_item' end, 'item', p_item_id);
end $$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot suspend yourself.'; end if;
  update public.profiles set is_suspended = p_suspended where id = p_user_id;
  insert into public.admin_actions (admin_id, action, target_type, target_id)
  values (auth.uid(), case when p_suspended then 'suspend_user' else 'restore_user' end, 'user', p_user_id);
end $$;

create or replace function public.admin_resolve_flag(p_flag_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_status not in ('in_review', 'resolved', 'dismissed') then raise exception 'Invalid status.'; end if;
  update public.flags set status = p_status, resolved_by = auth.uid(), resolution_note = left(p_note, 1000) where id = p_flag_id;
  if not found then raise exception 'Flag not found.'; end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (auth.uid(), 'flag_' || p_status, 'flag', p_flag_id, left(p_note, 1000));
end $$;

-- ---------- execute permissions ----------
grant execute on function public.create_contact_request(uuid, text, uuid), public.respond_contact_request(uuid, boolean),
  public.cancel_contact_request(uuid), public.dismiss_match(uuid), public.admin_stats(),
  public.admin_set_item_hidden(uuid, boolean), public.admin_set_user_suspended(uuid, boolean),
  public.admin_resolve_flag(uuid, text, text) to authenticated;
