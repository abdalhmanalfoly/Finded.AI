-- The nemotron-match Edge Function reads report rows with the service role.
-- Earlier hardening revoked table privileges from service_role; restore the
-- minimum SELECT access needed for server-side retrieval. anon and
-- authenticated privileges and RLS policies are unchanged.
grant select on public.items to service_role;
grant select on public.item_images to service_role;
grant select on public.item_embeddings to service_role;
