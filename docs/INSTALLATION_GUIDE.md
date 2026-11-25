# Installation Guide

## Requirements
Node.js 20+ recommended and npm. A Supabase project is optional for preview mode and required for real persistence/authentication.

## Local run
1. Extract the archive.
2. `cd frontend`
3. `npm install`
4. Optional real backend: copy `.env.example` to `.env.local` and fill in the two public Supabase values.
5. `npm run dev`

## Checks
- `npm test` runs Node's built-in frontend tests.
- `npm run build` creates the production bundle.

If Supabase variables are absent, the app intentionally uses sample Preview Mode. Follow `SUPABASE_SETUP.md` to connect a backend.
