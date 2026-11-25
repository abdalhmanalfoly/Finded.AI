# Supabase Setup

1. Create a project at https://supabase.com/dashboard.
2. Choose a region near the intended users and create a strong database password. Keep it private.
3. In Project Settings → API, copy the Project URL and the publishable/anon public key.
4. Copy `frontend/.env.example` to `frontend/.env.local` and set:
   - `VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY`
5. Never put the database password or `service_role` key in a `VITE_` variable or frontend file.
6. Open SQL Editor and apply migrations in numerical order:
   `001_schema.sql`, `002_security.sql`, `003_functions.sql`, `004_matching.sql`, `005_harden_admin_suspension.sql`, `006_retention_audit_abuse_guards.sql`, `007_image_ai_arabic_maps_realtime.sql`, `008_private_images_signed_urls.sql`, `009_scale_privacy_hardening.sql`, `010_restore_items_insert_privilege.sql`.
   For an already migrated project, apply only migrations not yet applied; do not rerun old migrations blindly.
7. Configure Authentication → URL Configuration with local URL `http://localhost:5173` and your eventual production URL/redirect paths.
8. Configure email/SMTP and verify signup, confirmation, and password recovery.
9. Confirm the `item-images` bucket exists and confirm it is **private** (migration 008 sets this) and that `item_images_storage_read` is the only SELECT policy on it. Photos are served through signed URLs.
10. Start the app with `cd frontend && npm install && npm run dev`.

The app remains in Preview Mode until both public environment variables are present. `frontend/.env.local` may contain only the public project URL and publishable key; it is git-ignored. Never commit it with any other secret, and never put a database password or `service_role` key in the frontend.

## Optional after migration 009
- **Nightly closing of stale reports:** enable the `pg_cron` extension (Database → Extensions) and re-run the last block of `009_scale_privacy_hardening.sql`; it schedules `close_stale_items(90)` at 03:00 daily. Without pg_cron the admin button "Close reports idle for 90+ days" still works.
- **Edge Function CORS:** `supabase secrets set ALLOWED_ORIGIN=https://your-site.example` so only your site can call `embed-image`.
- **Verify the live project:** `SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-live.mjs`.
