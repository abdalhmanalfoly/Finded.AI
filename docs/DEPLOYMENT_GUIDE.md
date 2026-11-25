# FindIt AI — Deployment Guide

## Frontend (Vercel)
1. Push the project to a private Git repository without `.env` files or secrets.
2. Import the `frontend` directory as the Vercel project root.
3. Framework preset: Vite. Build command: `npm run build`; output directory: `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Project → Settings → Environment Variables for Preview and Production.
5. Deploy, then configure the production domain in Supabase Auth redirect allow-list.
6. Test deep links, login, reset-password redirects, public item pages, uploads, matching, requests, and admin routes.

## Backend
Create/configure Supabase separately and apply migrations 001–010 in order (010 is safe to apply to projects that already ran 001–009; see docs/PHOTO_MATCHING_AND_REALTIME.md for the optional photo-matching function). Configure Auth email delivery. The photo bucket is private after migration 008; run `scripts/verify-live.mjs` to confirm photos are not reachable by public URL but can be signed.

## Important
A Vercel config file is not proof of deployment. This source archive has not been deployed. Do not claim production readiness until a deployment URL and real workflow test results are recorded.
