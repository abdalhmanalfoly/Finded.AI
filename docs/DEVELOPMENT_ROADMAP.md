> **Note:** planning document from Phase 1. For what was built and tested see `FEATURES.md` and `QA_REPORT.md`.

# FindIt AI – Development Roadmap

Each phase ends with a summary and waits for approval before the next begins.

| Phase | Focus | Main output | Est. effort |
|------:|-------|-------------|-------------|
| 1 | Planning and requirements | 10 docs in `docs/` | 1 day |
| 2 | UI/UX design and frontend plan | Page structure, visual system, component list (approved before coding) | 2–3 days |
| 3 | Frontend development | React app with all pages, sample data clearly labeled | 1–2 weeks |
| 4 | Database and authentication | Supabase schema, migrations, auth, RLS, profiles | 1 week |
| 5 | Reporting system | Real forms, image upload, edit/delete, status, pagination | 1 week |
| 6 | AI matching engine | Weighted text matching, stored results, reasons, scenario tests | 1 week |
| 7 | Dashboards, notifications, contact | User/admin dashboards, notifications, contact requests | 1–2 weeks |
| 8 | Security and QA | Audit, automated tests, QA_REPORT.md, fixes | 1 week |
| 9 | Deployment | Vercel + Supabase production, tested live URL | 2–3 days |
| 10 | Final documentation | README, guides, presentation outline | 2–3 days |

## Dependencies
- Phase 3 needs approved Phase 2 design.
- Phases 4 → 5 → 6 → 7 are strictly sequential (each needs the data from the previous).
- Phase 8 needs all features complete.
- Phase 9 needs Phase 8 fixes.

## Manual tasks you will need to do
- Create a free Supabase project (Phase 4).
- Run SQL migrations in the Supabase SQL editor (Phase 4).
- Create a GitHub repository and a Vercel account (Phase 9).
- Decide on any paid API for image matching, if wanted (Phase 6, optional).

## Milestones
1. **Clickable prototype** – end of Phase 3.
2. **Real data MVP** – end of Phase 5.
3. **Smart MVP** – end of Phase 7.
4. **Production** – end of Phase 9.
