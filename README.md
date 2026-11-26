# Finded.AI

**Lost something? Let AI find it.**

Finded.AI is a lost-and-found web application. People report lost or found items, browse and filter reports, review explainable match suggestions, and contact each other through a request-and-approve chat flow. The frontend is a React single-page app; Supabase provides authentication, PostgreSQL, Row Level Security, Storage, Realtime, and database functions. There is no custom backend server.

## Current status

- The repository contains the React app, Supabase migrations/tests/functions, Edge Function source, deployment config, and documentation.
- The verified Supabase backend for this release is **Ai fin** (`gtbvqmuuyidmdhgmwsjv`).
- Authenticated end-to-end checks were performed against Ai fin: report creation with and without images, signed photo access, item updates/deletion, match generation, contact requests/chat with Realtime, admin RPCs, and ownership/RLS denials.
- A production deployment switch was **not** performed by this release.
- Data from the previous Supabase project could not be recovered through this account; this repository does not include a data migration for it.
- The optional image-embedding Edge Function (`embed-image`) is source-complete but must be deployed and configured with `EMBEDDING_URL` before image-similarity enrichment can be considered production-ready.

## Main features

- Email/password registration, login, logout, password reset, and editable user profiles.
- Lost/found reports with up to three images, edit, delete, resolve, close, and reopen flows.
- Public browsing/search with text, category, city, brand, and event-date filters; pagination; item detail pages.
- Private Storage bucket for report photos, served through short-lived signed URLs.
- Database matching engine with explainable reasons and scores; Realtime updates for matches, notifications, and chat.
- Contact requests with accept/decline and a simple text chat after approval.
- User dashboard with recent activity, notification center with unread counts, and matches page.
- Admin dashboard with reports, flags, users, statistics, audit log, hide/unhide, suspension, and stale-report cleanup.
- Privacy tools: export my data and delete my account.
- English and Arabic UI with RTL support.
- Preview mode with sample data when Supabase environment variables are absent.

## Technology stack

- **Frontend:** React 18, Vite 5, React Router 6, Tailwind CSS 3, JavaScript.
- **Backend:** Supabase Auth, PostgreSQL, PostgREST, Storage, Realtime, Edge Functions.
- **Testing:** Node test runner, static security tests, Playwright preview E2E specs, SQL test suites for local PostgreSQL.
- **Deployment:** Vercel-compatible static build (`frontend/vercel.json` supplies SPA rewrites and security headers).

## Architecture

```text
Browser (React SPA)
  ├── supabase-js using VITE_SUPABASE_URL + public anon key
  └── user JWT from Supabase Auth
        ├── Postgres: tables, RLS policies, column-level grants, functions, triggers, matching
        ├── Storage: private item-images bucket + signed URLs
        └── Realtime: notifications, matches, messages, contact requests

No service-role key is used by the browser.
All authorization decisions are enforced in the database.
```

Core service layer: `frontend/src/services/supabaseService.js`.
Auth/session/profile state: `frontend/src/context/AuthContext.jsx`.
Schema and security: `supabase/migrations/`.

## Project structure

```text
.
├── frontend/
│   ├── src/
│   │   ├── components/       Reusable UI, item cards, layout, route guards
│   │   ├── context/          Auth context with single-flight auth requests
│   │   ├── data/             Preview-mode sample data
│   │   ├── hooks/            Async and unread-count hooks
│   │   ├── i18n/             English/Arabic translations and RTL support
│   │   ├── layouts/          Public layout
│   │   ├── lib/              Supabase client, validation, signed URLs, map tiles, diagnostics
│   │   ├── pages/            Landing, auth, reports, matches, chat, admin, profile, legal pages
│   │   ├── services/         Sample data service and real Supabase service layer
│   │   ├── App.jsx           Routes
│   │   └── main.jsx          App entry
│   ├── tests/                Unit, render, security, upload, and live-smoke tests
│   ├── e2e/                  Playwright preview-mode tests
│   ├── .env.example          Public environment variable template
│   └── vercel.json           SPA rewrites and security headers
├── scripts/
│   ├── verify-live.mjs       Read-only Supabase smoke test (+ optional existing-user write test)
│   └── signup-guard.mjs      Explicit-instruction, one-request signup test gate
├── supabase/
│   ├── migrations/           001-010 SQL migrations
│   ├── tests/                SQL security/matching/hardening suites
│   ├── functions/            embed-image Edge Function source and tests
│   └── run_local_tests.sh    Local PostgreSQL test runner
├── docs/                     Detailed product, security, setup, and release documentation
└── IMPLEMENTATION_CHANGELOG.md
```

## Installation

Requirements:

- Node.js 20+ (22 recommended; CI uses 22)
- npm
- Optional: local PostgreSQL 16 for SQL tests
- Optional: Supabase project for real data

```bash
git clone https://github.com/abdalhmanalfoly/Finded.AI.git
cd Finded.AI/frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. Without environment variables the app runs in preview mode with sample data.

## Environment variables

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the **public** values from Supabase Project Settings → API:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key, protected by RLS |

Example names only:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never place a `service_role` key, database password, JWT secret, or private API key in `frontend/`, `.env.local`, or Git. `.env` files are ignored except `.env.example`.

Optional variables used by the smoke script from the shell, not committed:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | URL passed to `node ../scripts/verify-live.mjs` |
| `SUPABASE_ANON_KEY` | Public anon key for the smoke script |
| `TEST_EMAIL` / `TEST_PASSWORD` | Optional existing dedicated test account for the write/cleanup check |

See `docs/ENVIRONMENT_VARIABLES.md` and `docs/AUTH_TEST_POLICY.md`.

## Supabase configuration

1. Create or select the Supabase project. This release was validated against **Ai fin** (`gtbvqmuuyidmdhgmwsjv`).
2. Run migrations in order (see below).
3. Keep RLS enabled on all base tables.
4. Keep the `item-images` bucket private. Public reads must go through the `public_items` view and signed URLs.
5. Grant authenticated users only the column-level INSERT privileges defined in migration 010. Do not restore broad table-level INSERT grants.
6. Configure Auth email templates and confirmation settings according to your environment.
7. Create the first admin using the SQL in `docs/DEPLOYMENT_GUIDE.md`.
8. Deploy the `embed-image` Edge Function only if you want optional image-embedding enrichment; set `EMBEDDING_URL` and `ALLOWED_ORIGIN` as documented in `docs/PHOTO_MATCHING_AND_REALTIME.md`.
9. Deploy `nemotron-match` with `verify_jwt: true`. Store `OPENROUTER_API_KEY` only as a Supabase project secret or Vault secret (never a `VITE_` variable), and set `ALLOWED_ORIGIN` to your deployed site URL. See `docs/NEMOTRON_INTEGRATION.md`.
10. Enable Realtime for the tables listed in migration 007.

No Auth rate limits or security protections were changed for this release.

## Database migrations

Apply SQL files in `supabase/migrations/` in numeric order using the Supabase SQL Editor or the Supabase CLI:

```text
001_schema.sql
002_security.sql
003_functions.sql
004_matching.sql
005_harden_admin_suspension.sql
006_retention_audit_abuse_guards.sql
007_image_ai_arabic_maps_realtime.sql
008_private_images_signed_urls.sql
009_scale_privacy_hardening.sql
010_restore_items_insert_privilege.sql
011_nemotron_item_embeddings.sql
012_nemotron_allowed_origin.sql
013_nemotron_service_role_reads.sql
```

Migration 010 is required on already deployed projects to restore least-privilege INSERT on `items` and `item_images` after the earlier security hardening. Migration 011 adds pgvector document embeddings for `nvidia/nemotron-3.5-embed-8b:free` and the asymmetric retrieval RPCs. Migration 012 adds the service-role-only `get_allowed_origin()` RPC used by `nemotron-match`. Migration 013 restores minimum service-role `SELECT` access needed by that function after the hardening revocations; see `docs/NEMOTRON_INTEGRATION.md`. See `docs/DATABASE_SETUP.md` and `docs/DATABASE_SCHEMA.md`.

## Local development commands

From `frontend/`:

```bash
npm run dev        # Vite dev server
npm test           # Node unit/render/static-security tests
npm run build      # Production bundle in dist/
npm run preview    # Serve the built bundle
npm run test:e2e   # Playwright preview-mode E2E (install browser once first)
```

Playwright preview setup:

```bash
npm install --no-save @playwright/test
npx playwright install chromium
npm run test:e2e
```

## Testing

Frontend checks include validation, rendering in English and Arabic, route checks, upload pipeline regression tests, static security checks, and the live-smoke helper.

```bash
cd frontend && npm test
cd frontend && node --test tests/upload.test.js
```

Optional read-only live smoke test (does not call signup):

```bash
cd frontend
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_ANON_KEY=<public-anon-key> \
node ../scripts/verify-live.mjs
```

Adding `TEST_EMAIL` and `TEST_PASSWORD` enables a single create/delete report check using an existing account. Do not use signup automation; see `docs/AUTH_TEST_POLICY.md`.

SQL suites require a local PostgreSQL instance:

```bash
cd supabase
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres ./run_local_tests.sh
```

The SQL suites were not executed in this publication environment because no local PostgreSQL server was available. CI runs them on PostgreSQL 16 in the `database` job.

## Build

```bash
cd frontend
npm ci
npm run build
```

The build succeeds with a Vite chunk-size advisory for the main bundle. The advisory is not a failure; code-splitting is a future optimization.

## Deployment

1. Import the repository in Vercel with **Root Directory** set to `frontend`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project.
3. Confirm `frontend/vercel.json` is used for SPA rewrites and security headers.
4. Apply Supabase migrations to the target project before switching traffic.
5. Run `scripts/verify-live.mjs` against the deployed backend.
6. Verify login, report creation with/without an image, signed photo access, and Realtime chat in a browser.
7. Switch production traffic only after approval from the repository owner.

Full checklist: `docs/DEPLOYMENT_GUIDE.md` and `docs/PRODUCTION_CHECKLIST.md`.

## Security notes

- Every base table has RLS enabled; public reads use a deliberately narrow view.
- Authenticated users can only insert report rows owned by their `auth.uid()`; `status`, `id`, and `created_at` are not client-insertable.
- Storage uploads are constrained to the signed-in user's folder; objects are private and accessed through signed URLs.
- The frontend never reads a service-role key.
- Auth requests are single-flight; there is no automatic signup retry or backoff loop.
- Signup tests are disabled unless explicitly authorized, hard-capped at one request, and never run in parallel.
- No Supabase Auth rate limits were weakened.
- Do not commit `.env.local`, credentials, or private user data.

## Known gaps and honest limitations

- The legacy Supabase project's original data/auth/storage could not be recovered from this account; no silent data migration is claimed.
- The `embed-image` Edge Function is not considered deployed in Ai fin; image-similarity enrichment is best-effort until it is deployed and configured.
- No production deployment switch was performed.
- SQL suites and Playwright browser suites were not executed locally in this publication environment; frontend Node tests and the production build were executed.
- Some historical planning documents describe earlier project status; `docs/RELEASE_STATUS.md` is the authoritative release snapshot.

## Documentation index

Start with `docs/RELEASE_STATUS.md`. Additional documents cover architecture, schema, features, user flows, UI design, security, setup, installation, deployment, environment variables, testing, QA, audit, and roadmap. See `docs/` and `IMPLEMENTATION_CHANGELOG.md`.

## Repository

https://github.com/abdalhmanalfoly/Finded.AI
