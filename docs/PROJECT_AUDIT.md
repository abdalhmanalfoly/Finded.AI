> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# FindIt AI — Project Audit

Audit basis: supplied source archive (95 files in the supplied archive) and its documentation. This is a source-code audit, not a live Supabase or production audit.

## Executive summary
The existing React 18/Vite application has a substantial MVP foundation: routes and UI, a service abstraction with sample and Supabase implementations, SQL schema/security/functions/matching migrations, and automated frontend/database test assets. Preserve this architecture; do not rebuild.

## Verified in source
- React/Vite frontend with React Router and Tailwind.
- Supabase client reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; no service-role key is required by browser code.
- Sample-data mode is selected when either public Supabase variable is absent.
- Five migrations define the schema, RLS/storage, RPC workflows, weighted PostgreSQL matching, and the forward security hardening fix.
- Frontend unit/static tests are present.
- Vercel SPA rewrite and baseline security headers are present.

## Issues addressed in this delivery
1. Public item detail lookup previously queried the RLS-protected `items` table first and only used `public_items` when no error occurred. Anonymous permission errors could block public detail pages. Lookup now starts from the safe public view, then optionally overlays an authorized private row for an owner/admin.
2. Real search omitted `brand` and date-range filters. Search now includes brand and supports event-date bounds in both real and sample services.
3. Auth profile/session loading previously lacked complete rejection/error state handling. The provider now tracks profile loading/errors and admin route guard offers a retry.
4. Password reset previously ignored most operational errors. It now surfaces operational failures while retaining a generic success response for account-not-found responses.
5. Authenticated users had direct column-level permission to update `profiles.is_suspended`, bypassing the audited admin RPC. The direct grant is removed and migration 005 revokes it for existing deployments.
6. SQL test runner now enables `pipefail`, `ON_ERROR_STOP`, and checks captured output for failure markers.
7. Item/profile mutations now detect RLS-filtered zero-row updates/deletes instead of showing false success; item deletion checks image-query and Storage cleanup errors.
8. A GitHub Actions workflow now runs frontend tests and a production build on pushes and pull requests.

## Not verified
- No Supabase project, credentials, remote schema, Storage bucket, Auth settings, SMTP, Vercel account, or deployed URL was supplied.
- SQL migrations have not been applied to a live project in this environment.
- Browser end-to-end workflows against a live backend have not been executed.
- External AI/image-recognition provider is not configured; matching is deterministic PostgreSQL text/rule similarity, not image AI.
- A successful production deployment cannot be claimed.

## Remaining material risks
- (Resolved in migration 008) The Storage bucket was public; it is now private and photos use signed URLs.
- Profile row visibility is broader than a strict column-level public profile design for contact-request participants.
- Image checks rely on browser MIME/size validation and Storage content type; server-side content inspection/scanning is not present.
- Admin UI is narrower than a full moderation/audit console.
- No browser E2E suite or committed dependency lockfile exists in the supplied archive. The added CI workflow has not yet run because this archive has not been pushed to GitHub.

## Current delivery verification
See `TESTING_REPORT.md`. Results are environment-specific and explicitly distinguish checks run here from checks requiring Supabase credentials.
