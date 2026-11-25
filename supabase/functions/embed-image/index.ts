// Supabase Edge Function (Deno): computes image embeddings for the caller's report and stores them.
// Deploy:  supabase functions deploy embed-image
// Secrets: supabase secrets set EMBEDDING_URL=... EMBEDDING_API_KEY=... EMBEDDING_MODEL=...
//   EMBEDDING_URL   HTTP endpoint that accepts raw image bytes (POST, Content-Type = image type) and returns a JSON vector.
//                   Works with Hugging Face Inference "feature-extraction" endpoints for CLIP models, or your own server.
//   EMBEDDING_API_KEY  optional bearer token for that endpoint.
//   EMBEDDING_MODEL    label stored with each vector (e.g. clip-vit-base-patch32); vectors of different sizes are never compared.
//   ALLOWED_ORIGIN     your site, e.g. https://findit.example.com (CORS). Defaults to http://localhost:5173 for local development; other origins are rejected.
// Rate limit: public.claim_embedding_attempt (migration 009) allows 3 tries per photo and 30 photos per owner per hour.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { parseEmbedding, checkImage } from './embedding.ts'

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? 'http://localhost:5173'
const cors = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  // Fail closed: a browser origin that is not explicitly configured cannot use the function.
  const origin = req.headers.get('Origin')
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed.' }, 403)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const embeddingUrl = Deno.env.get('EMBEDDING_URL')
  if (!embeddingUrl) return json({ error: 'Image matching is not configured.' }, 501)

  // 1. Who is calling?
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Please log in first.' }, 401)

  let itemId: string
  try { itemId = String((await req.json()).itemId ?? '') } catch { return json({ error: 'Invalid JSON' }, 400) }
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ error: 'Invalid itemId' }, 400)

  // 2. Does the caller own this report? (RLS: users only see their own rows in `items`.)
  const { data: own } = await userClient.from('items').select('id').eq('id', itemId).maybeSingle()
  if (!own) return json({ error: 'Report not found.' }, 404)

  // 3. Embed the photos that still have no vector.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: pending } = await userClient.rpc('my_unembedded_images', { p_item_id: itemId })
  const ids: string[] = (pending ?? []).slice(0, 3)
  const results: Record<string, string> = {}

  for (const id of ids) {
    try {
      const { data: allowed, error: claimError } = await admin.rpc('claim_embedding_attempt', { p_image_id: id })
      if (claimError) throw new Error('rate limit check failed')
      if (!allowed) { results[id] = 'skipped: retry limit reached'; continue }
      const { data: img } = await admin.from('item_images').select('storage_path').eq('id', id).single()
      const { data: blob, error: dlError } = await admin.storage.from('item-images').download(img!.storage_path)
      if (dlError || !blob) throw new Error('download failed')
      const problem = checkImage(blob.type, blob.size)
      if (problem) throw new Error(problem)

      const res = await fetch(embeddingUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type, ...(Deno.env.get('EMBEDDING_API_KEY') ? { Authorization: `Bearer ${Deno.env.get('EMBEDDING_API_KEY')}` } : {}) },
        body: blob,
      })
      if (!res.ok) throw new Error(`provider ${res.status}`)
      const vector = parseEmbedding(await res.json())
      const { error } = await admin.rpc('store_image_embedding', { p_image_id: id, p_embedding: vector, p_model: Deno.env.get('EMBEDDING_MODEL') ?? 'unknown' })
      if (error) throw new Error('store failed')
      results[id] = 'ok'
    } catch (e) {
      results[id] = e instanceof Error ? e.message : 'failed'
    }
  }
  return json({ itemId, results })
})
