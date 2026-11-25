> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# FindIt AI — Security Audit

## Positive controls found
- Supabase RLS is enabled across application tables in migration 002.
- Public listings use a restricted `public_items` view rather than exposing all item columns.
- Browser configuration uses only the public anon key; service-role credentials are explicitly prohibited.
- Contact, match dismissal, and admin workflows use database functions with authorization checks.
- Storage upload paths are scoped to the authenticated user's ID in the existing policy design.
- Vercel config includes baseline clickjacking, MIME-sniffing, referrer, and permissions headers.

## Fix delivered
The original migration granted `UPDATE(is_suspended)` to authenticated users. This allowed an admin with direct table access to alter suspension without invoking the audit-logging RPC. The grant was removed from migration 002 and forward migration `005_harden_admin_suspension.sql` revokes it from existing installations. Suspension changes should use `admin_set_user_suspended()`.

## Risks still requiring owner decision/testing
1. **Image bucket (resolved by migration 008):** the bucket is private and photos use 1-hour signed URLs. Remaining caveat: a signed URL that was already issued works until it expires, even if the report is hidden afterwards.
2. **Profile row access:** contact participants can read profile rows. Consider a narrow public profile view/RPC and avoid exposing unnecessary columns.
3. **File validation:** MIME/size checks do not prove file content. Consider server-side image decoding/re-encoding and malware scanning for higher-risk deployment.
4. **Rate limiting:** database functions include some workflow limits; add infrastructure-level abuse controls where appropriate.
5. **Operational secrets:** keep DB password, service-role key, SMTP credentials, and provider secrets in Supabase/Vercel secret settings only. Never use `VITE_` for secrets.
6. **Dependencies:** run `npm audit` against the actual lockfile/runtime before release; no force-fix command should be used blindly.
7. **Backups/monitoring:** configure database backups, alerting, and incident response in the Supabase project.

## Verification limitation
This is a source review. No live penetration test, remote RLS test, dependency advisory scan, or production configuration inspection was possible without project access.
