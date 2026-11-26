// Supabase Edge Function (Deno): Nemotron 3.5 Embed 8B document embeddings + asymmetric retrieval.
// Deploy:  supabase functions deploy nemotron-match
// Secrets: ALLOWED_ORIGIN and OPENROUTER_API_KEY as Supabase project secrets,
//          or as Vault secrets (service-role RPC fallback) named the same.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
// Provider and CORS configuration are read ONLY from server-side stores; never from a browser env var.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import {
  MODEL_ID, MODEL_VERSION, EMBEDDINGS_URL, EMBEDDING_DIMENSIONS,
  buildPassageText, buildQueryText, buildEmbeddingPayload, checkImage,
  parseEmbeddingResponse, contentHash, providerError,
} from './nemotron.mjs'

const FALLBACK_ORIGIN = 'http://localhost:5173'

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function embed(payload: Record<string, unknown>, key: string): Promise<number[]> {
  const res = await fetch(EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/abdalhmanalfoly/Finded.AI',
      'X-Title': 'Finded.AI Nemotron matching',
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body: unknown = null
  try { body = JSON.parse(text) } catch { /* error text is not echoed */ }
  if (!res.ok) throw new Error(providerError(res.status, body))
  const parsed = parseEmbeddingResponse(body)
  if (parsed.embedding.length !== EMBEDDING_DIMENSIONS) throw new Error('Unexpected embedding dimensions.')
  return parsed.embedding
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Prefer a project secret. Otherwise read the allowed browser origin from
  // Vault through a service-role-only RPC. It is never read from a browser env var.
  const envOrigin = Deno.env.get('ALLOWED_ORIGIN')?.trim()
  let allowedOrigin = envOrigin || FALLBACK_ORIGIN
  if (!envOrigin) {
    const { data, error } = await admin.rpc('get_allowed_origin')
    if (!error && typeof data === 'string' && data.trim()) allowedOrigin = data.trim()
  }
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  const origin = req.headers.get('Origin')
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed.' }, 403)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Prefer a project secret. Otherwise read the provider key from Vault.
  // Neither is ever read from a browser env var.
  let key = Deno.env.get('OPENROUTER_API_KEY') ?? null
  if (!key) {
    const { data, error } = await admin.rpc('get_openrouter_api_key')
    if (!error && typeof data === 'string' && data.trim()) key = data.trim()
  }
  if (!key) return json({ error: 'Nemotron matching is not configured.' }, 501)

  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Please log in first.' }, 401)

  let itemId: string
  try { itemId = String((await req.json()).itemId ?? '') } catch { return json({ error: 'Invalid JSON' }, 400) }
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ error: 'Invalid itemId' }, 400)

  // items SELECT policy is owner-or-admin only, so this is an ownership check too.
  const { data: own } = await userClient.from('items').select('id').eq('id', itemId).maybeSingle()
  if (!own) return json({ error: 'Report not found.' }, 404)

  const { data: claimed, error: claimError } = await admin.rpc('claim_ai_job', { p_item_id: itemId })
  if (claimError || !claimed) {
    return json({ itemId, skipped: 'AI job already processing or retry limit reached.' })
  }

  try {
    const { data: item, error: itemError } = await admin.from('items').select('*').eq('id', itemId).single()
    if (itemError || !item) throw new Error('Report could not be loaded.')
    const { data: images, error: imageError } = await admin
      .from('item_images').select('id, storage_path').eq('item_id', itemId).order('position')
    if (imageError) throw new Error('Photos could not be loaded.')

    const passageText = buildPassageText(item as Record<string, unknown>)
    const queryText = buildQueryText(item as Record<string, unknown>)
    if (!passageText || !queryText) throw new Error('Report has no text to embed.')

    const documents: Array<{ imageId: string | null; type: 'text' | 'multimodal'; hash: string }> = [
      { imageId: null, type: 'text', hash: await contentHash(MODEL_ID, [passageText, 'text']) },
    ]
    for (const img of (images ?? []).slice(0, 3)) {
      documents.push({
        imageId: img.id,
        type: 'multimodal',
        hash: await contentHash(MODEL_ID, [passageText, img.storage_path, String(item.updated_at ?? '')]),
      })
    }

    let stored = 0
    for (const doc of documents) {
      const { data: exists } = await admin.rpc('ai_embedding_exists', {
        p_item_id: itemId, p_image_id: doc.imageId,
        p_embedding_type: doc.type, p_content_hash: doc.hash,
      })
      if (exists) continue

      let payload: Record<string, unknown>
      if (doc.imageId) {
        const row = (images ?? []).find((i) => i.id === doc.imageId)!
        const { data: blob, error: dlError } = await admin.storage.from('item-images').download(row.storage_path)
        if (dlError || !blob) continue // an unavailable photo must not block text retrieval
        const problem = checkImage(blob.type, blob.size)
        if (problem) continue // PNG/JPEG only, matching the verified model capability
        const mime = blob.type || 'image/jpeg'
        const dataUrl = `data:${mime};base64,${toBase64(await blob.arrayBuffer())}`
        payload = buildEmbeddingPayload('passage', passageText, { dataUrl })
      } else {
        payload = buildEmbeddingPayload('passage', passageText)
      }

      const embedding = await embed(payload, key)
      const { error: storeError } = await admin.rpc('store_item_embedding', {
        p_item_id: itemId,
        p_image_id: doc.imageId,
        p_embedding_type: doc.type,
        p_input_mode: 'passage',
        p_embedding: embedding,
        p_model_name: MODEL_ID,
        p_model_version: MODEL_VERSION,
        p_dimensions: EMBEDDING_DIMENSIONS,
        p_content_hash: doc.hash,
      })
      if (storeError) throw new Error('Embedding could not be stored.')
      stored++
    }

    // Query vector is used for retrieval only; it is never stored as a document embedding.
    const queryVector = await embed(buildEmbeddingPayload('query', queryText), key)
    const { data: matches, error: matchError } = await admin.rpc('match_items_by_embedding', {
      p_item_id: itemId, p_query: queryVector, p_limit: 10,
    })
    if (matchError) throw new Error('Similarity search failed.')

    const { data: storedDocs } = await admin.from('item_embeddings')
      .select('id, image_id, embedding_type').eq('item_id', itemId)
    const typeById = new Map<string, string>()
    for (const d of storedDocs ?? []) typeById.set(d.id, d.embedding_type)

    const candidates = (matches ?? []).map((m) => ({
      candidateId: m.candidate_id,
      similarity: m.similarity,
      embeddingId: m.embedding_id,
      imageId: m.image_id,
      modelName: m.model_name || MODEL_ID,
      documentType: typeById.get(m.embedding_id) ?? 'text',
    }))
    const { data: persisted, error: persistError } = await admin.rpc('persist_ai_matches', {
      p_item_id: itemId, p_candidates: candidates,
    })
    if (persistError) throw new Error('Match candidates could not be saved.')

    await admin.rpc('finish_ai_job', { p_item_id: itemId, p_status: 'done' })
    return json({
      itemId, model: MODEL_ID, dimensions: EMBEDDING_DIMENSIONS,
      storedDocuments: stored, candidates: candidates.length, persistedMatches: persisted ?? 0,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI matching failed.'
    await admin.rpc('finish_ai_job', { p_item_id: itemId, p_status: 'failed', p_error: message.slice(0, 500) })
    return json({ itemId, error: message }, 502)
  }
})
