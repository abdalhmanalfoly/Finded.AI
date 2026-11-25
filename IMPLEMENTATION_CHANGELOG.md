# FindIt AI — Implementation Changelog

This delivery is based on the supplied project archive. The original source archive was not overwritten.

## Frontend changes
- `frontend/src/services/supabaseService.js`: public item details now load from the safe public view first; authorized owner/admin data can override it. Image-query errors are surfaced. Real search includes brand and date bounds.
- `frontend/src/services/sampleService.js`: sample search applies the same date bounds.
- `frontend/src/pages/ItemsList.jsx`: added accessible from/to date filters.
- `frontend/src/context/AuthContext.jsx`: profile loading/error state, cleanup for async profile/session lookups, retryable profile refresh, and operational password-reset error handling.
- `frontend/src/components/layout/RouteGuards.jsx`: admin guard displays a recoverable profile verification error rather than an indefinite spinner.
- `frontend/tests/regression.test.js`: regression tests for delivered fixes.

## Database and test tooling
- `supabase/migrations/002_security.sql`: removed direct authenticated `is_suspended` update grant.
- `supabase/migrations/005_harden_admin_suspension.sql`: forward migration revokes that grant on already initialized projects.
- `supabase/run_local_tests.sh`: strict shell mode, PostgreSQL stop-on-error, captured output and failure detection.

## Documentation
Added/updated audit, implementation plan, missing-feature matrix, security audit, Supabase/database setup, architecture/schema, deployment, environment variables, production checklist, installation, testing, user guide, overview, and README handoff documentation.

## Deliberately not done
No credentials were invented. No live Supabase project was created or modified. No external image AI provider was integrated. No production deployment was attempted. No existing UI was rebuilt.

## Additional hardening in this delivery
- Mutating item/profile operations now request the affected row and explicitly report when RLS filters an update/delete to zero rows. This prevents suspended users or stale/deleted records from receiving a false success message.
- Item deletion now checks the image metadata query before deleting the item and reports Storage cleanup errors rather than silently ignoring them.
- Added a GitHub Actions workflow to run frontend tests and a Vite production build on pushes and pull requests.
- Updated the README handoff to reflect the current test count and include migration 005 in database setup.


## Gap-closing pass (November 2026)
- `supabase/migrations/006_retention_audit_abuse_guards.sql`: `close_stale_items(days)` (auto-close idle reports, owner notified), `admin_list_actions()` audit-log reader, hide-missing-report error, one open flag per reporter/report, no self-flagging, daily flag cap, 60 messages/hour limit.
- Admin UI: new **Audit log** tab and a "close reports idle for 90+ days" button. Owners get a **Reopen** button on closed/resolved reports.
- New `/privacy` and `/terms` pages linked from the footer (starter text, needs legal review).
- `frontend/.env.example` was missing, which made a security test fail; it is now present.
- `vercel.json`: Content-Security-Policy and HSTS headers. CI uses `npm ci`.
- SQL test suite: fixed a dead `\gset` that aborted the run halfway (only 79 tests ever executed) and a runner that always reported failure because it matched the word "FAILURES"; added 13 tests for migration 006 (now 92, all pass on PostgreSQL 16).
- Frontend tests: 27 -> 32, all pass. The production build was not run: the bundled `node_modules` are Windows-only and this environment has no package install access.

## Still not done (superseded by the second pass below)
Image AI matching, Arabic/RTL, maps, realtime chat, browser E2E, live Supabase verification, deployment.

## Second gap-closing pass (November 2026)
- Migration 007: Arabic-aware text normalization; image-embedding tables and functions with +20 score weight; map coordinates (validated, public view rounded to ~110 m) and distance in matching; Realtime publication; storage listing hardening.
- Edge Function `embed-image` + automatic call after upload (optional, needs EMBEDDING_URL).
- Full Arabic UI with RTL, language switch and persistence; server-generated texts translated by pattern.
- Optional map pin on reports with OpenStreetMap preview; CSP allows only that frame.
- Realtime notifications and chat.
- `scripts/verify-live.mjs` for a real Supabase project.
- Tests: 44 frontend (real server-render of 18 pages in both languages, no English leaks), 118 SQL, Edge Function helper tests; Playwright E2E specs and a 3-job CI.
- Accessibility fix: the icon-only search button had no accessible name on phones.

## Honestly still open (after the second pass)
Live Supabase verification, deployment, real embedding provider, E2E and CI runs (need network), Arabic review by a native speaker, signed URLs for photos, click-to-pin map.

## Third pass (November 2026): signed URLs and click-to-pin
- **Private photos.** `supabase/migrations/008_private_images_signed_urls.sql` makes the `item-images` bucket private and replaces the storage SELECT policy: a file can be read (and therefore signed) only from your own folder or when you can see its `item_images` row under RLS (public reports, your reports, admins). `src/lib/signedUrls.js` + `supabaseService.js` request signed URLs in one batch per list/detail page, cache them for the session, refresh them 5 minutes before the 1-hour expiry, and never break the page if signing fails. `getPublicUrl` is gone.
- **Click-to-pin map.** New `PinMap` component (`src/components/ui/PinMap.jsx`, math in `src/lib/mapTiles.js`): OpenStreetMap tiles as images, drag to pan, wheel/buttons/`+`/`-` to zoom, click or tap to drop the pin, keyboard alternative (arrows + Enter at the centre cross), RTL-safe, Arabic strings. It replaces the iframe preview inside `LocationPicker`; the typed-coordinate fields and "use my location" still work and recentre the map. CSP `img-src` now allows `https://tile.openstreetmap.org`.
- `scripts/verify-live.mjs` checks that photos are not reachable by public URL and can be signed.
- Tests: SQL 118 -> 129 (private bucket; anon/other user/owner/admin access; hidden and closed reports); frontend +11 (`tests/maptiles.test.js`: projection, click-to-pin, pan, zoom, tiles, cache, migration/CSP wiring) and a Playwright E2E spec. The map was also exercised in headless Chromium (click, drag, wheel, buttons, keyboard, touch tap, typed coordinates, geolocation, Arabic RTL).

### Still open
- A native Arabic speaker should review the translation, especially the privacy/terms pages (and the 7 new map strings). This is a human task and was not done.
- Not run against a live Supabase project: signing is verified by SQL policy tests, not by a real Storage service. Run `scripts/verify-live.mjs` after applying 008.
- The 4 server-render tests and the Vite build need `npm ci` (no package access in this environment).
- OSM's public tile server is for light use only; use a tile provider before real traffic.
- A signed URL already issued keeps working until it expires (1 hour).


## Fourth pass (November 2026): professional visual identity
- **Palette** (tokens in `frontend/tailwind.config.js`): `ink` (deep navy-teal, text/hero/footer), `brand` (petrol teal 50-800: buttons, links, focus), `accent` (amber, used sparingly: hero highlight, main hero button, unread count, match score), cool `surface` page background, `lost` (brick red) and `found` (green) badges that always carry a text label. Class names changed: `cyan-*` -> `brand-*`, `navy-*` -> `ink-*`.
- **Components** (`styles/index.css`): primary button is now teal with white text (the old cyan-on-navy button had weak contrast), `btn-accent` for one hero action, inputs with a visible brand focus ring, cards with a soft shadow, reduced-motion support, Arabic heading spacing.
- **Landing page:** hero with the search box and a live example of an explainable match (two reports, similarity score, reasons); steps as an ordered list; consistent content width. Sticky navbar with a logo mark, tinted placeholders for items without photos, footer and stat tiles restyled.
- **Checked** by rendering the real pages in Chromium with Tailwind (English, Arabic/RTL, 390 px phone). That preview used Tailwind's 3.0 browser runtime with small shims for logical utilities, not your Vite build, so run `npm ci && npm run dev` once and look at it.
- **Fonts:** still the system stack (Inter if installed, else Segoe UI/system-ui; Noto Sans Arabic/Tahoma for Arabic). Loading web fonts from Google would need relaxing the CSP; the CSP-friendly way is `npm i @fontsource-variable/inter @fontsource/noto-sans-arabic` and importing them in `main.jsx`.

## Migration 009 and follow-up fixes
- **Matching scalability:** `run_matching` now compares a report only with candidates (same category within 90 days, or a similar name found through a new trigram index; newest 300). Suggested matches whose partner left the candidate set are removed. New partial indexes support the lookup. *Behaviour change:* a cross-category pair is only suggested when the names are similar.
- **Profile privacy:** counterparts no longer read the full `profiles` row. They see names through the new `contact_profiles` view; `listRequests` uses it.
- **Privacy features:** `export_my_data()` and `delete_my_account()` (refuses if you are the only admin), with Profile-page buttons. The app deletes the user's photo files through the Storage API first.
- **Flags:** `reported_user_id` is filled from the report owner by a trigger and cannot be spoofed.
- **Edge Function:** `claim_embedding_attempt` limits retries (3 per photo, 30 photos per owner per hour); CORS origin configurable with `ALLOWED_ORIGIN`.
- **Suspended users** can no longer upload photos to Storage.
- **Retention:** optional `pg_cron` schedule for `close_stale_items(90)`.
- **Admin page:** lists load 50 rows at a time with a "Load more" button; headline totals come from `admin_stats`.
- **Tooling:** `@babel/core` declared in `devDependencies`; stray empty `frontend/env.local` removed; `verify-live.mjs` also checks the new tables and functions; stale docs corrected.
- **Not verified in this delivery:** the SQL changes (migration 009 and `tests/02_hardening_tests.sql`) were written without a PostgreSQL server available. Run `bash supabase/run_local_tests.sh` (or the CI `database` job) before applying them to any real project.

## Auth automation safeguards (November 2026)
- `frontend/src/context/AuthContext.jsx`: signup is now single-flight; a duplicate or concurrent signup request is rejected instead of being retried.
- `scripts/signup-guard.mjs`: explicit-instruction gate with a hard one-request limit, no retries and no parallel signup tests. The helper makes no network requests by itself.
- `frontend/tests/signup-guard.test.js` and `frontend/tests/static-security.test.js`: regression tests for the one-shot signup policy.
- `docs/AUTH_TEST_POLICY.md`: documented cooldown, one-shot, existing-account and no-rate-limit-change rules.
