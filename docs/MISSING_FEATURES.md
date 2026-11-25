# FindIt AI — Missing and Partial Features

| Feature | Current evidence | Status / next step |
|---|---|---|
| Supabase connection | Client and services exist; `frontend/.env.local` holds the project URL and a publishable key | Wired. Live project state (migrations applied, Auth settings) must be confirmed with `scripts/verify-live.mjs` |
| Auth | Signup/login/session/reset code exists | Requires live Auth configuration and E2E verification |
| Lost/found CRUD | Service methods and forms exist | Requires live integration testing |
| Image upload | Supabase Storage code and bucket migration exist | Requires bucket setup; MIME/size checks are not content scanning |
| Public details | Fixed to use safe public view first | Code fix delivered; verify against live RLS |
| Search | Name/description/location/city; brand now added; category/color/date range | Implemented; sorting and richer facets remain |
| Matching | Weighted PostgreSQL trigram/word similarity, trigger-driven | Implemented as deterministic matching; requires live DB verification |
| Image recognition | Migration 007 (vector storage, cosine similarity, +20 score weight, tested) + `embed-image` Edge Function + automatic call after upload | Implemented; **needs you to deploy the function and set EMBEDDING_URL**, not tested against a live provider |
| Contact requests/chat | RPC and message services exist; live updates through Supabase Realtime | Requires live workflow verification |
| Notifications | Database-backed in-app notifications | Requires live workflow verification; email delivery not present |
| User dashboard | Aggregated service/UI exists | Requires live data verification |
| Admin | Reports/flags/users, audited RPCs, audit-log tab, stale-report closing | Implemented; full complaint workflow (notes to reporter) remains |
| Privacy | RLS and safe public view exist; photo bucket is private (migration 008) and photos use short-lived signed URLs that Storage only issues for reports the caller may see | Implemented and tested in SQL; needs a run against a live project (`scripts/verify-live.mjs`) |
| Arabic/RTL | Full UI translation (470 phrases), language switch, RTL layout, Arabic-aware text matching, server texts translated | Implemented; rendered and tested in both languages; legal text needs native-speaker review |
| Maps | Optional pin per report (click or tap the map, device location, or typed coordinates), OpenStreetMap tiles, public coordinates rounded to ~110 m, distance used in matching | Implemented, including a click/tap/keyboard pin picker (`PinMap`, no map library); no map of all reports |
| CI/E2E | 55 frontend tests, SQL suites 01 (security/matching) and 02 (migration 009), Playwright E2E specs, CI with frontend/e2e/database jobs | E2E specs written but **not yet run**; CI not yet run on GitHub |
| Account deletion / data export | `delete_my_account()` and `export_my_data()` (migration 009) + Profile page buttons; photo files removed through the Storage API first | Implemented; needs a live run |
| Matching at scale | Candidates limited to same category within 90 days, or similar name (trigram index), newest 300 (migration 009) | Implemented; cross-category matches now need a similar name |
| Embedding abuse limits | 3 tries per photo, 30 photos per owner per hour (migration 009) | Implemented |
| Retention | `close_stale_items(90)` + Reopen button (decision #10) | Implemented; schedule with pg_cron |
| Abuse limits | One open flag per user/report, no self-flagging, 60 messages/hour | Implemented in migration 006 |
| Legal pages | /privacy and /terms starter text | Implemented; needs legal review |
| Realtime | Notifications and chat subscribe to Supabase Realtime (2-minute polling fallback) | Implemented; verify on a live project |
| Production deployment | Vercel config/docs exist | Not deployed; requires account and credentials |

| Live verification | `scripts/verify-live.mjs` checks a real project | Ready; **you must run it** after creating Supabase |

Do not treat “code exists” as “production verified.”
