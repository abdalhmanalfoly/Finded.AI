-- FindIt AI - 010: restore the least-privilege INSERT grant on public.items.
-- Safe to apply after 001-009. Idempotent. Do NOT re-run old migrations on a live project.
--
-- Production diagnosis (confirmed 2026-11-25):
--   operation items.insert, code 42501, message "permission denied for table items",
--   hint "Grant the required privileges to the current role with: GRANT INSERT ON public.items TO authenticated;"
--   auth.getSession ok, auth.getUser ok, hasUser true.
--
-- This is a GRANT failure, not an RLS failure. A policy rejection would say
-- "new row violates row-level security policy"; a missing GRANT is rejected before any row is
-- evaluated. This project applies migrations manually in the SQL Editor (see README and
-- docs/SUPABASE_SETUP.md), so a deployed project can have 001 plus a partial or older 002 in
-- which the column-level INSERT grant was never executed. Grants and RLS are two separate locks.
--
-- We deliberately do NOT follow the hint literally. A table-level `GRANT INSERT ON public.items`
-- would also allow authenticated users to write id, status, is_hidden, created_at, updated_at
-- and view-derived photo paths such as cover_path. Only the 14 columns the application actually sends are granted, matching
-- 002_security.sql plus the two coordinate columns from 007_image_ai_arabic_maps_realtime.sql.

-- 1. The privilege layer: exactly the columns used by createItem()/toRow().
-- A broad table-level grant may already have been executed in some projects; remove it so
-- system-managed columns cannot be supplied by a client. Column grants below remain in force.
revoke insert on public.items from authenticated;
grant insert (
  user_id, type, name, category, description, location_text, city,
  event_date, event_time, color, brand, additional_details,
  latitude, longitude
) on public.items to authenticated;

-- createItem() uses INSERT ... RETURNING id, which also requires SELECT on that column.
-- 002 already grants it table-wide; re-assert so the INSERT can return the new id.
grant select on public.items to authenticated;

-- Defensive: anon and PUBLIC must never be able to write reports.
revoke insert on public.items from anon, public;

-- 2. The RLS layer is independent and is restored, not weakened: RLS on, ownership + suspension
--    enforced by the WITH CHECK. Re-asserting makes the policy correct even if 002 was partial.
alter table public.items enable row level security;
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert to authenticated
  with check (user_id = auth.uid() and not public.is_suspended());

-- 3. The same submit flow writes photo metadata. Restore its exact column grant and the
--    ownership/suspension policy too, otherwise the next step fails with the same 42501.
revoke insert on public.item_images from authenticated;
grant insert (item_id, storage_path, position) on public.item_images to authenticated;
revoke insert on public.item_images from anon, public;
alter table public.item_images enable row level security;
drop policy if exists item_images_insert on public.item_images;
create policy item_images_insert on public.item_images for insert to authenticated with check (
  exists (select 1 from public.items i where i.id = item_id and i.user_id = auth.uid())
  and not public.is_suspended());
