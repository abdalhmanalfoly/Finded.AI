# FindIt AI — Frontend

React 18 + Vite + Tailwind CSS + React Router + Supabase JS.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Node test suite
npm run build
```

Without both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the application intentionally runs in Preview Mode using sample data. To connect a real backend, follow `../docs/SUPABASE_SETUP.md` and `../docs/DATABASE_SETUP.md`.

Never put the Supabase service-role key, database password, SMTP password, or private provider credentials in frontend environment variables.
