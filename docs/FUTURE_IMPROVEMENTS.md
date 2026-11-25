> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# Future Improvements

**Do first (before real users)**
1. Run the app locally, fix whatever the first run reveals, and add screenshots to the README.
2. Test everything on a real Supabase project (auth emails, storage uploads, RLS); then complete the deployment checklist.
3. Add browser tests (Playwright) for register → report → match → contact.
4. Configure custom SMTP for reliable email delivery.

**Product**
- Arabic translation with right-to-left layout (the code already uses logical Tailwind classes).
- Email and push notifications; real-time updates and chat (Supabase Realtime).
- Map picker and distance-based matching; coordinates are already in the schema.
- Image similarity (embeddings + `pgvector`), added as one more weighted signal.
- Smarter text matching: synonyms, multilingual embeddings, tuning weights on real data.
- Report expiry and "still looking?" reminders; auto-close stale reports.
- Verified organisations (airports, universities, transport) and hand-in points.
- Social login, account deletion, data export.

**Security and operations**
- Content-Security-Policy header after testing.
- Scan uploaded images (type sniffing, malware). (Private storage with signed URLs is done: migration 008.)
- Captcha or stricter rate limits on sign-up and contact requests.
- Monitoring, error tracking, and database backups.
- Independent security review and penetration test.
