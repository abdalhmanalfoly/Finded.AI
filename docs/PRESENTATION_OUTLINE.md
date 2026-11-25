> **Historical planning/status document.** This file reflects an earlier snapshot and may not match the current code.
> For the authoritative published state, see [`RELEASE_STATUS.md`](RELEASE_STATUS.md) and the root [`README.md`](../README.md).
# FindIt AI – Presentation Outline (10–12 slides)

1. **Title:** FindIt AI, "Lost Something? Let AI Find It." Name, date.
2. **The problem:** scattered posts, manual matching, public phone numbers → scams. One real-life story.
3. **The solution:** report → match → connect → resolved (4-step graphic).
4. **Live demo / screenshots:** landing, report form, matches page with score and reasons. *(Add screenshots after the first run.)*
5. **How matching works:** weighted signals (name, category, description, color, brand, location, date); score is an estimate; show the 86% vs 43% examples.
6. **Why we can explain it:** reasons list per match; no black box; honest about image AI not being built yet.
7. **Privacy and safety:** public view hides private fields; request-and-approve contact; flags and admin review.
8. **Architecture:** React SPA → Supabase (Auth, Postgres with RLS, Storage); no custom server; diagram.
9. **Quality:** 80 database tests (security + matching), 20 frontend tests; what is not yet tested (browser, real Supabase, deployment).
10. **Admin and moderation:** hide reports, handle flags, suspend users, audit log.
11. **Roadmap:** Arabic/RTL, image similarity, maps, email notifications, real-time chat.
12. **Q&A / call to action.**

Speaker notes: keep the "similarity estimate, not proof" message in slides 5–6; show a false-match example (iPhone vs Samsung) to demonstrate honesty.
