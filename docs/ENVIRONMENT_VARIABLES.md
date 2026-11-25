# Environment Variables

## Frontend variables
| Name | Required | Purpose | Secret? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes for real mode | Supabase project URL | No |
| `VITE_SUPABASE_ANON_KEY` | Yes for real mode | Public anon/publishable key; RLS must protect data | No |

Copy `frontend/.env.example` to `frontend/.env.local`. Vite exposes `VITE_` variables to browser code.

## Never expose
- Supabase `service_role` key
- Database password
- SMTP credentials
- Private AI provider API keys

These must remain in trusted server/hosting secret stores. No external AI provider is currently configured.

## Edge Function secrets (`supabase secrets set`)
| Name | Purpose |
|---|---|
| `EMBEDDING_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` | Image-embedding provider (optional photo matching) |
| `ALLOWED_ORIGIN` | Your site URL for CORS on `embed-image` (defaults to `http://localhost:5173`; other browser origins are rejected; set it in production) |
