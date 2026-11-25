> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# QA Report — superseding delivery note

The earlier QA figures below describe a previous project snapshot and are not the verification results for the current archive. For the current delivery, see [`TESTING_REPORT.md`](TESTING_REPORT.md): 27 frontend tests pass; Vite build, PostgreSQL integration tests, live Supabase workflows, browser E2E, and deployment were not verified in this environment.

---

# FindIt AI – QA Report

Date: 2026-11-23. Scope: everything built in Phases 3–7. This report separates what was actually **tested** from what was **only written**.

## 1. Environment limits (why some things are untested)
The build environment had no internet access, so `npm install`, a real Supabase project, a browser and a Vercel deployment were not available. Tests ran against:
- a **local PostgreSQL 16** with a small mock of Supabase's `auth`/`storage` schemas (`supabase/tests/00_mock_supabase.sql`), and
- **Node 22** test runner and **esbuild** for the frontend.

## 2. Tests performed and results

### 2.1 Database security and logic – 80 tests, 80 passed
Run with `supabase/run_local_tests.sh` (applies all 4 migrations, then `01_security_and_matching_tests.sql`).

| Area | Tests | What was checked |
|------|------:|------------------|
| RLS / PRIVACY | 9 | Anonymous users cannot read `items`, `profiles`, `notifications`. The public view hides `user_id`, `additional_details`, coordinates and `is_hidden`. A user cannot see unrelated profiles. |
| AUTHZ | 13 | A user cannot edit/delete another user's report, reassign owner, hide a report, make themselves admin, suspend themselves, insert notifications or matches, call the matching function, call admin functions. |
| ADMIN | 7 | Admin reads all reports and flags, sees stats, hides a report (disappears from the public view), actions are logged, cannot suspend self, resolves flags. |
| CONTACT / MESSAGES | 12 | Cannot contact yourself, short messages rejected, duplicate pending requests rejected, only the recipient can accept, outsiders cannot see or post, no impersonation, no messages before acceptance. |
| NOTIFY | 3 | Recipient is notified, can mark as read, cannot edit notification text. |
| FLAGS | 4 | Cannot file flags as someone else; reporters see only their own; reporters cannot resolve. |
| IMAGES / STORAGE | 9 | Max 3 images per report, cannot attach to another user's report, storage policy allows only your own folder and the `item-images` bucket, anonymous cannot upload, bucket limits are 5 MB and JPEG/PNG/WebP only (configuration checked). |
| SUSPENDED / LIMIT / VALIDATION | 6 | Suspended users cannot create reports or requests; the 21st report in a day is rejected; future dates, short descriptions and invalid statuses are rejected. |
| MATCH | 16 | See 2.2. |

### 2.2 Matching engine scenarios
| Scenario | Result |
|----------|--------|
| Lost black Samsung phone and found black Samsung phone, same area | Matched, score 86, 5+ reasons, both owners notified |
| Same phone, found in another city | Matched at 73 (lower than same area) |
| Lost wallet vs found car keys | No match (score 0) |
| **False match:** black iPhone vs black Samsung phone | Not suggested (43 same city, 37 other city). Initially scored 58 and 50, which exposed a weakness; fixed with a brand-mismatch penalty |
| Same user's lost and found reports | Never matched together |
| Repeated runs | Exactly one match row (no duplicates) |
| Editing a report into something unrelated | Stale match removed; editing back restores it |
| Resolving a report | Its suggested matches are removed; new reports do not match it |
| Hiding a report | Its suggested matches are removed |
| Found 19 days before it was lost | Penalised and labelled "Found before it was lost" |

### 2.3 Frontend automated tests – 20 tests, 20 passed (`npm test`)
- Validation of login, register, report forms, image type and size (14 tests).
- Static security checks (6 tests): no `dangerouslySetInnerHTML`, `eval` or `innerHTML`; no service-role key or secrets in `src`; only the two public `VITE_SUPABASE_*` variables are read; `.env` is git-ignored and `.env.example` holds no values; file input accepts only JPEG/PNG/WebP; every internal link and `navigate()` target matches a defined route.

### 2.4 Build check
All 31+ source files bundle with esbuild (JSX syntax and every import/export resolved): **passed**. React and the router were treated as external, so this proves the code parses and its imports are consistent, **not** that pages render correctly.

## 3. Issues discovered and fixes
| # | Issue | Found by | Fix |
|---|-------|----------|-----|
| 1 | Migration order error: SQL functions referenced tables not yet created | Applying migrations | Reordered `001_schema.sql` |
| 2 | Different-brand items of the same category and colour were suggested as matches (58%, 50%) | Matching scenario S3 | Brand mismatch multiplies score by 0.75 |
| 3 | Laptop "found" 19 days before "lost" still scored 90 | Scenario S8 | Date-impossible multiplier 0.8 and an explicit reason |
| 4 | Matching threshold 40 was too permissive | Scenario scores | Threshold set to 50 |
| 5 | Test mistakes (nested data-modifying CTE, leftover session claim, comment tripping the secret scan) | Test runs | Tests corrected; the application code was right in these three cases |

## 4. NOT tested (remaining limitations)
- **Real Supabase behaviour:** the mock only imitates `auth.uid()` and storage tables. Policies were verified in PostgreSQL, but not on a real project (for example the real `storage.objects` ownership, Auth email flows, or `auth.users` trigger permissions).
- **Authentication flows:** register, email confirmation, login, logout, password reset were written but never executed.
- **Image upload end to end:** the bucket's 5 MB and MIME restrictions are configured and checked as data, but an actual oversized or SVG upload against Supabase Storage was not attempted. File content is not scanned (a renamed file with a valid MIME header would pass).
- **UI rendering:** no page was rendered in a browser. Responsive layout, keyboard navigation, focus order, colour contrast and console errors are **unverified**.
- **Performance:** not measured. Search uses `ilike` with a trigram index on name and description only; other columns may scan.
- **Deployment:** nothing was deployed; Vercel and Supabase production settings are documented only.
- **Tailwind build:** configured for Tailwind 3; not compiled here.
- **Admin bootstrap, email delivery limits, rate limits beyond the in-database daily caps:** not tested.
- **Not a penetration test.** No claim is made that the application is "secure", only that the listed controls were verified.

## 5. Known product limitations
- Matching is text-based and location is text-based (no maps or distance). Image similarity is **not implemented**.
- Found reports have no brand field (per the spec), so brand is used only when both sides provide it.
- Public image URLs are guessable only by UUID, but anyone with a link can view an image, including images of items later hidden.
- No email notifications, no real-time updates (the unread count refreshes on navigation and every 60 seconds).
- Arabic/RTL is prepared in the code style (logical Tailwind classes) but no translations exist.
