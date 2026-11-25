# Photo matching, maps, realtime and Arabic

## 1. Photo matching (optional)
How it works: after a report's photos are uploaded the app calls the `embed-image` Edge Function. The function checks the user owns the report, downloads each photo that has no vector yet, sends it to an embedding service, and stores a unit-length vector with `store_image_embedding` (service role only). The matcher (`compute_match`) adds up to **+20 points** when both reports have vectors (cosine similarity 0.70 → 0 points, 1.00 → 20 points) and adds the reasons "Photos look similar / very similar". Reports without vectors behave exactly as before.

Setup (about 10 minutes, needs your Supabase project):
1. Apply migrations 001–010 (009 adds the per-photo and per-owner embedding rate limit; 010 restores the INSERT grant on already deployed projects). Set `ALLOWED_ORIGIN` to your deployed site URL (the function rejects unconfigured browser origins).
2. Provide an HTTP endpoint that accepts raw image bytes (POST, `Content-Type: image/jpeg|png|webp`) and returns a JSON vector (flat array, `[[...]]`, or `{embedding: [...]}`) of 64–4096 numbers, always the same model and size. A Hugging Face Inference endpoint for a CLIP model works, or host your own (for example `open_clip` behind FastAPI).
3. `supabase functions deploy embed-image`
4. `supabase secrets set EMBEDDING_URL=https://... EMBEDDING_API_KEY=... EMBEDDING_MODEL=clip-vit-base-patch32`
5. Create a report with a photo and check `select count(*) from image_embeddings;` (SQL editor).
Without `EMBEDDING_URL` the function answers 501 and the app keeps working with text matching only. Do not change the model after launch without clearing `image_embeddings` (vectors of different models must not be compared; different sizes are ignored automatically).

Privacy: photos leave your Supabase project for the embedding service. The privacy page says so; choose a provider accordingly.

## 2. Maps
Reports can carry an optional pin. The public view exposes coordinates rounded to 3 decimals (~110 m); owners and admins see exact values in their own record. The page uses an OpenStreetMap embed (no key). If both reports have pins, distance (<5 km) raises the location part of the score.

## 3. Realtime
Migration 007 adds `notifications` and `messages` to the `supabase_realtime` publication. If Realtime is disabled in your project the app still works through 2-minute polling.

## 4. Arabic / RTL
Translations are in `frontend/src/i18n/ar.js` (key = English text). To add a phrase: use `t('English text')` in the code, add the Arabic below. Server-generated English text (notifications, match reasons, errors) is translated by pattern from the same file. `npm test` renders every page in both languages and fails if a UI sentence stays English.

## 5. Verify a live project
`SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify-live.mjs` — anonymous checks are read-only; add `TEST_EMAIL` and `TEST_PASSWORD` to also create and delete one test report.
