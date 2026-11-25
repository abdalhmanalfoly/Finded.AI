> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# Security

See `SECURITY_AUDIT.md` for the detailed source review and outstanding risks.

- Browser code may contain only the Supabase URL and public anon/publishable key.
- Never expose service-role keys, database passwords, SMTP credentials, or private AI keys.
- RLS is the actual authorization boundary; frontend route guards are UX only.
- Admin suspension must use the audited `admin_set_user_suspended()` RPC.
- Review public Storage behavior before accepting sensitive user photographs.
- Validate and constrain user input and uploaded files; client validation alone is not a security boundary.
