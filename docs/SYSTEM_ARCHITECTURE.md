> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# System Architecture

- **UI:** React 18, React Router 6, Tailwind CSS, Vite.
- **Service boundary:** `src/services/itemsService.js` selects Supabase or sample implementation based on environment configuration.
- **Backend:** Supabase Auth, PostgreSQL, RLS, SQL functions/triggers, and Storage.
- **Matching:** PostgreSQL weighted similarity implementation in migration 004 (trigram and word overlap), not a vision model.
- **Deployment:** Vercel SPA rewrite and security headers are configured in source; no live deployment is asserted.

The service boundary and existing design should be preserved. See `SUPABASE_SETUP.md` and `SECURITY_AUDIT.md`.
