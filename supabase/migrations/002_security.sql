-- FindIt AI - 002: Row Level Security, public view, grants, storage
create or replace function public.item_is_public(p_item_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.items where id = p_item_id and status in ('active', 'matched') and not is_hidden);
$$;

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.item_images enable row level security;
alter table public.matches enable row level security;
alter table public.contact_requests enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.flags enable row level security;
alter table public.admin_actions enable row level security;

-- profiles: own row, admin, or someone you have a contact request with
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin()
  or exists (select 1 from public.contact_requests r
             where (r.requester_id = auth.uid() and r.recipient_id = profiles.id)
                or (r.recipient_id = auth.uid() and r.requester_id = profiles.id))
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- items: owners and admins read the full row; everyone else uses the public_items view
create policy items_select on public.items for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy items_insert on public.items for insert to authenticated with check (user_id = auth.uid() and not public.is_suspended());
create policy items_update on public.items for update to authenticated
  using (user_id = auth.uid() and not public.is_suspended()) with check (user_id = auth.uid());
create policy items_delete on public.items for delete to authenticated using (user_id = auth.uid());

-- item_images
create policy item_images_select_public on public.item_images for select to anon, authenticated using (public.item_is_public(item_id));
create policy item_images_select_owner on public.item_images for select to authenticated using (
  exists (select 1 from public.items i where i.id = item_id and (i.user_id = auth.uid() or public.is_admin())));
create policy item_images_insert on public.item_images for insert to authenticated with check (
  exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid()) and not public.is_suspended());
create policy item_images_delete on public.item_images for delete to authenticated using (
  exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid()));

-- matches: only owners of either item. Created and changed by trusted functions only.
create policy matches_select on public.matches for select to authenticated using (
  exists (select 1 from public.items i where i.id in (lost_item_id, found_item_id) and i.user_id = auth.uid()));

-- contact requests and messages: participants only. Created through functions in 003.
create policy contact_requests_select on public.contact_requests for select to authenticated using (
  requester_id = auth.uid() or recipient_id = auth.uid());
create policy messages_select on public.messages for select to authenticated using (
  exists (select 1 from public.contact_requests r where r.id = request_id and (r.requester_id = auth.uid() or r.recipient_id = auth.uid())));
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and not public.is_suspended() and
  exists (select 1 from public.contact_requests r where r.id = request_id and r.status = 'accepted'
          and (r.requester_id = auth.uid() or r.recipient_id = auth.uid())));

-- notifications: own only
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- flags
create policy flags_select on public.flags for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy flags_insert on public.flags for insert to authenticated with check (
  reporter_id = auth.uid() and status = 'open' and not public.is_suspended());

-- admin audit log
create policy admin_actions_select on public.admin_actions for select to authenticated using (public.is_admin());

-- ---------- public view: safe columns only ----------
create or replace view public.public_items as
select i.id, i.type, i.name, i.category, i.description, i.location_text, i.city, i.event_date, i.event_time,
       i.color, i.brand, i.status, i.created_at,
       (select ii.storage_path from public.item_images ii where ii.item_id = i.id order by ii.position limit 1) as cover_path
from public.items i
where i.status in ('active', 'matched') and not i.is_hidden;

-- ---------- grants (explicit, least privilege) ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.public_items to anon, authenticated;
grant select on public.item_images to anon;
grant select on public.item_images, public.profiles, public.items, public.matches, public.contact_requests,
                public.messages, public.notifications, public.flags, public.admin_actions to authenticated;
grant update (display_name, avatar_url, city) on public.profiles to authenticated;
-- is_suspended is intentionally not directly writable; admins must use the audited RPC in migration 003.
grant insert (user_id, type, name, category, description, location_text, city, event_date, event_time, color, brand, additional_details)
  on public.items to authenticated;
grant update (name, category, description, location_text, city, event_date, event_time, color, brand, additional_details, status)
  on public.items to authenticated;
grant delete on public.items to authenticated;
grant insert (item_id, storage_path, position), delete on public.item_images to authenticated;
grant insert (request_id, sender_id, body) on public.messages to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
grant insert (reporter_id, item_id, reported_user_id, reason, details) on public.flags to authenticated;

grant execute on function public.is_admin(), public.is_suspended(), public.item_is_public(uuid) to anon, authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy item_images_storage_read on storage.objects for select to anon, authenticated using (bucket_id = 'item-images');
create policy item_images_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy item_images_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy item_images_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
