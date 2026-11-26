-- Service-role-only helper used by the nemotron-match Edge Function.
-- ALLOWED_ORIGIN may be set as a Supabase project secret or, as here, in Vault.
-- Deno.env is still preferred when a project secret is configured directly.
create or replace function public.get_allowed_origin() returns text
language sql stable security definer set search_path = '' as $$
  select d.decrypted_secret
  from vault.decrypted_secrets d
  where d.name = 'ALLOWED_ORIGIN'
  limit 1;
$$;
revoke all on function public.get_allowed_origin() from public, anon, authenticated;
grant execute on function public.get_allowed_origin() to service_role;
