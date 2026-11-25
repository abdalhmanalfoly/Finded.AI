# Database Setup

## Migration order
Run SQL files in this order against the intended Supabase project:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_security.sql`
3. `supabase/migrations/003_functions.sql`
4. `supabase/migrations/004_matching.sql`
5. `supabase/migrations/005_harden_admin_suspension.sql`
6. `supabase/migrations/006_retention_audit_abuse_guards.sql`
7. `supabase/migrations/007_image_ai_arabic_maps_realtime.sql`
8. `supabase/migrations/008_private_images_signed_urls.sql`
9. `supabase/migrations/009_scale_privacy_hardening.sql`
10. `supabase/migrations/010_restore_items_insert_privilege.sql` (idempotent forward fix for projects where the INSERT grant on `public.items` is missing)

Use Supabase SQL Editor or the Supabase CLI linked to the correct project. Back up production data before applying schema changes. Do not execute `supabase/run_local_tests.sh` against a production database; it drops/recreates a local test database.

## Main entities
`profiles`, `items`, `item_images`, `matches`, `contact_requests`, `messages`, `notifications`, `flags`, `admin_actions`.

## Verification
After migrations, verify tables, RLS enabled flags, `public_items` view, `item-images` bucket/policies, and RPC functions. Run tests against a disposable local PostgreSQL/Supabase test environment. See `DATABASE_SCHEMA.md` and `SECURITY_AUDIT.md`.
