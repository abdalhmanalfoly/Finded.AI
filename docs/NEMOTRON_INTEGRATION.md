# Nemotron 3.5 multimodal retrieval — integration notes

## Model and verified contract

- Model: `nvidia/nemotron-3.5-embed-8b:free` through `POST https://openrouter.ai/api/v1/embeddings`.
- Live-verified on 2026-11-26: `input_type: passage` (text and text+image) and `input_type: query` (text) all returned 4096 finite values.
- Documents are indexed; queries are text-only and are never stored as document embeddings. Direct image-to-image similarity is not used.

## Flow

1. An item is created/updated (or a photo is added/removed). Trigger `items_ai_enqueue` / `item_images_ai_enqueue` inserts one row in `public.ai_processing_jobs`.
2. The frontend fire-and-forgets `nemotron-match` with `{ itemId }`. The function authenticates the caller, checks ownership through RLS, then claims the job (max 3 attempts).
3. With the service role it loads the item and its photos from private Storage. It builds:
   - a **text passage** from real fields only (name, category, description, color, brand, extra details, location, city);
   - one **combined text+image passage** per PNG/JPEG photo (max 3);
   - a **text query** from real descriptive fields.
4. Content hashes prevent repeated OpenRouter calls for unchanged content. Only `passage` vectors are written to `public.item_embeddings` (pgvector `vector(4096)`). Retrieval uses an exact cosine scan: pgvector's HNSW/IVFFlat indexes accept at most 2000 dimensions for `vector`, while this model returns 4096.
5. The query vector searches only the opposite type (`lost -> found`, `found -> lost`), with `active|matched`, visible, different-owner filters. Best similarity per item is aggregated by minimum cosine distance.
6. `persist_ai_matches` writes/updates rows in the existing `matches` table with `engine='ai'`, raw similarity, model and source embedding. `status`, `dismissed_by` and user-acted rows are never reset. Legacy rule-based results are kept only as a fallback and cannot overwrite AI-owned suggestions.

`score` is `round(similarity * 100)` as a **ranking score only**. It is not a calibrated probability. Threshold is `public.ai_match_threshold()` (default `0.45`) and should be calibrated with labeled real matches.

## Deployment

```bash
# Apply supabase/migrations/001..012 in order (SQL Editor or CLI).
supabase functions deploy nemotron-match
# Either a project secret:
supabase secrets set ALLOWED_ORIGIN=https://your-site.example
# Or the Supabase Vault secret used by this deployment:
-- select vault.create_secret('https://your-site.example', 'ALLOWED_ORIGIN', 'Browser origin allowed to call Nemotron matching');
# Either a project secret:
supabase secrets set OPENROUTER_API_KEY=...
# Or the Supabase Vault secret used by this deployment:
-- select vault.create_secret('...', 'OPENROUTER_API_KEY', 'OpenRouter key for Nemotron matching');
```

`OPENROUTER_API_KEY` and `ALLOWED_ORIGIN` must exist only as Supabase server-side secrets (project secret or Vault). The function reads project secrets first, then falls back to Vault through the service-role-only RPCs `get_openrouter_api_key` and `get_allowed_origin`. Never put the provider key in `frontend/.env*`, a `VITE_` variable, GitHub, or chat. The service-role key is never exposed to the browser.

Supabase project for this work: `https://gtbvqmuuyidmdhgmwsjv.supabase.co`. The MCP connection must be switched to this project before applying migration 011 or deploying.

Current deployment state: migrations 011 and 012 are applied, the Vault secrets `OPENROUTER_API_KEY` and `ALLOWED_ORIGIN=https://frontend-rho-two-51.vercel.app` are set (service-role-only RPC fallbacks), and `nemotron-match` version 2 is deployed with `verify_jwt: true`. A preflight `OPTIONS` from that origin now returns `200` with the matching `Access-Control-Allow-Origin`; an unconfigured origin still returns `403`. No browser env file contains the provider key.

## Operational limits and privacy

- Free tier: 20 requests/minute and 50/day below 10 lifetime credits, or 1000/day at/above 10 credits. One item uses at most 5 requests (text doc + up to 3 images + 1 query). Jobs retry at most 3 times and stop on `429`; no infinite loops.
- The free endpoint logs sessions and must not receive confidential/personal data such as faces. Use synthetic or consented images. WebP photos are skipped by the AI path (model accepts PNG/JPEG only); text retrieval still works.
- A provider outage or missing secret returns a clear error and leaves the report usable; it does not fabricate scores.
- Do not change the model ID, `input_type` values, or vector dimensions without re-verifying the API and adding a new migration. Never mix vectors from different models/configurations in the same column.

## Validation status

- Live OpenRouter capability verification: passed (3 requests, see `NEMOTRON_MODEL_VERIFICATION.md`).
- Migrations 011 and 012 applied to `gtbvqmuuyidmdhgmwsjv`; `list_migrations` reports `20261126195441 / nemotron_item_embeddings` and the `nemotron_allowed_origin` migration.
- `nemotron-match` deployed (`verify_jwt: true`, version 2). A gateway check without a JWT returns `401`, and an anon-JWT check reaches the function and returns `Please log in first.` instead of `not configured`, confirming the Vault key path. Preflight from `https://frontend-rho-two-51.vercel.app` returns `200`; from `https://evil.example` returns `403 Origin not allowed.`.
- One-pair live integration run on 2026-11-26: one synthetic `lost` item and one synthetic `found` item owned by different existing users. Three requests returned 4096-dimensional vectors from `nvidia/nemotron-3.5-embed-8b` (usage 49/34/40 tokens). Retrieval returned exactly one opposite-type candidate at similarity `0.728`. Both documents were stored with `input_mode='passage'`; no query vector was stored. The pre-existing `contacted` match stayed `engine='rule'`, `score=70`, `ai_similarity=null`, confirming user-acted rows are not overwritten. Both AI jobs finished `done`.
- Node helper tests: 5/5 passed. Frontend tests: 89/89 passed. `npm run build` passed.
- CI applies migrations 001-012 with `pgvector/pgvector:pg16`; SQL suites were not run locally because `psql`/`docker` are unavailable.
- Still required before production: rotate the exposed OpenRouter key and update the Vault secret, and run one authenticated browser/HTTP smoke test with a real user session. AI accuracy has not been measured; `0.45` is an uncalibrated ranking cut-off, not a probability threshold.
