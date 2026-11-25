-- FindIt AI - 008: private photo bucket (signed URLs)
-- Photos were served from a PUBLIC bucket, so anyone holding a URL could open it forever, even after a report was
-- hidden, closed or deleted. The bucket is now private: the app asks Storage for short-lived signed URLs, and Storage
-- only signs a path when the caller is allowed to SELECT that object. Safe to apply after 001-007.

update storage.buckets set public = false where id = 'item-images';

-- Faster lookup from a storage object name to its item_images row (used by the policy below).
create index if not exists item_images_storage_path_idx on public.item_images (storage_path);

-- A caller may read (and therefore sign) an object when
--   1. it is in the caller's own folder (needed right after upload, before the item_images row exists), or
--   2. the caller can see its item_images row. That subquery runs under the caller's own RLS, so it matches exactly
--      "photos of public reports" for visitors and "photos of my reports / any report for admins" for signed-in users.
-- Hidden, closed or deleted reports therefore stop serving photos to everyone except the owner and admins, and the
-- bucket still cannot be listed in bulk: an object that no visible report references is invisible.
drop policy if exists item_images_storage_read on storage.objects;
drop policy if exists item_images_storage_read_own on storage.objects;
create policy item_images_storage_read on storage.objects for select to anon, authenticated using (
  bucket_id = 'item-images' and (
    (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
    or exists (select 1 from public.item_images ii where ii.storage_path = objects.name)
  )
);
