# Release status — Finded.AI

This is the authoritative snapshot for the published repository. Some earlier planning documents in `docs/` are historical and may describe features that were not yet implemented when they were written.

## Verified backend

- Project: **Ai fin**
- Reference: `gtbvqmuuyidmdhgmwsjv`
- The browser uses only `VITE_SUPABASE_URL` and a public anon/publishable key. No service-role key is present in source or committed env files.

## Verification performed for this release

- `npm ci` in `frontend/` — succeeded on Node 20.16.0 with engine warnings from Supabase packages that prefer Node 22; CI uses Node 22.
- `npm test` in `frontend/` — **87/87 tests passed**.
- `npm run build` in `frontend/` — **passed**; Vite reported only a chunk-size advisory for the main bundle.
- Production preview served over `http://127.0.0.1:4173/` — **HTTP 200**.
- Edge Function helper test (`supabase/functions/embed-image/embedding.test.mjs`) — not part of the frontend test command; no Deno runtime was required for the published source checks.

## Not executed in this environment

- PostgreSQL SQL suites under `supabase/tests/` — no local PostgreSQL instance was available. CI runs them on PostgreSQL 16.
- Playwright browser E2E specs — browser binaries were not installed locally. The Playwright dependency is pinned and the preview-mode E2E environment is isolated via `frontend/.env.e2e`.
- Production deployment switch — not performed; owner approval is required.

## Known limitations

- Data/auth/storage from the previous Supabase project could not be recovered through this account. No data migration is claimed.
- `embed-image` Edge Function is source-complete but not confirmed deployed in Ai fin; image-similarity enrichment is best-effort until it is deployed and configured.
- `npm audit` reports 4 dependency advisories (3 moderate, 1 high) whose fixes require breaking upgrades (`vite@6`, `react-router-dom@7`). They were not applied in this release.
- OSM public tile server is suitable for light use only; switch providers before high traffic.
- Arabic legal text should receive native-speaker/legal review before public launch.

## Security posture

- RLS is enabled on base tables; public reads use the narrow `public_items` view.
- The `item-images` bucket is private and photos are served through short-lived signed URLs.
- Auth requests are single-flight with no automatic retry/backoff loop.
- Signup testing is gated by an explicit instruction and capped at one request.
- No Supabase Auth rate limits were weakened.
- `.env.local`, build output, dependencies, logs, and temporary files are git-ignored; only empty/template env files are committed.
