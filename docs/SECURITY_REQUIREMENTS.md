> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# FindIt AI – Security Requirements

## Authentication
- Supabase Auth with email + password; minimum 8 characters.
- Password reset via emailed link; tokens expire.
- Protected routes in the UI **and** enforced by RLS (UI checks alone are not security).
- Session tokens handled by supabase-js; no custom token storage.

## Authorization
- Roles: user, admin. Role stored in `profiles.role`, changeable only by service role / SQL, never by the user.
- RLS on every table with least-privilege policies (see DATABASE_REQUIREMENTS.md).
- Admin-only operations verified server-side.

## Secrets and configuration
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (public by design; protected by RLS).
- Service-role key only in server-side secrets (Edge Functions), never in frontend code or git.
- `.env` in `.gitignore`; `.env.example` with names only.

## Privacy
- No public display of emails, phones or exact addresses.
- Contact info only exchanged voluntarily inside accepted threads.
- Forms warn: do not enter passwords, serial numbers, ID numbers.
- Public views expose only needed columns.
- Users can delete their reports; account deletion planned (P1).

## Image uploads
- Allowed types: JPEG, PNG, WebP. No SVG.
- Max 5 MB per image, max 3 per report; validated on client and enforced by storage policy.
- Files stored under `{user_id}/{uuid}.ext`; original filenames discarded.
- Users can write only to their own folder.

## Input validation and XSS
- Validate all fields client-side and with database constraints (length, enums, date not in future).
- Render user text only through React (auto-escaped); never `dangerouslySetInnerHTML`.
- Parameterized queries via Supabase client only.

## Abuse prevention
- Flag/report button, admin review queue.
- Rate limits: reports per day, contact requests per day (enforced in DB or Edge Function).
- Suspended users blocked from writing.
- Safety tips shown before meeting: meet in public places, don't share sensitive IDs, ask for proof of ownership via hidden details.

## Logging and errors
- Friendly error messages to users; no stack traces or SQL errors exposed.
- Admin actions recorded in `admin_actions`.

## Verification (Phase 8)
Security will be considered verified only after real tests: RLS tests with different roles, upload tests with bad files, access tests on admin routes, and secret scanning of the repo.
