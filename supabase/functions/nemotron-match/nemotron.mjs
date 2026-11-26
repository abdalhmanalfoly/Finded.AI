// Pure helpers for the Nemotron Edge Function (no Deno APIs) so Node can unit-test them.

export const MODEL_ID = 'nvidia/nemotron-3.5-embed-8b:free'
export const MODEL_VERSION = 'nvidia/nemotron-3.5-embed-8b-20261021'
export const EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings'
export const EMBEDDING_DIMENSIONS = 4096
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png']

const text = (v) => (typeof v === 'string' ? v.trim() : '')

/** Only fields that actually exist on the report are included. No invented attributes. */
export function buildPassageText(item) {
  return [
    text(item.name),
    text(item.category),
    text(item.description),
    text(item.color),
    text(item.brand),
    text(item.additional_details),
    text(item.location_text),
    text(item.city),
  ].filter(Boolean).join('. ')
}

/** Text-only query. Asymmetric model: queries are never images. */
export function buildQueryText(item) {
  return [
    text(item.name),
    text(item.description),
    text(item.color),
    text(item.brand),
    text(item.category),
    text(item.location_text),
    text(item.city),
  ].filter(Boolean).join('. ')
}

export function checkImage(type, size) {
  if (!SUPPORTED_IMAGE_TYPES.includes(type)) return 'Unsupported image type (only PNG/JPEG are accepted by this model).'
  if (size <= 0 || size > MAX_IMAGE_BYTES) return 'Image is empty or larger than 5 MB.'
  return null
}

/** Verified request shapes. Native passage/query mode; one image per document. */
export function buildEmbeddingPayload(mode, passageText, image) {
  if (mode === 'query') {
    return { model: MODEL_ID, input_type: 'query', input: passageText, encoding_format: 'float' }
  }
  if (image) {
    return {
      model: MODEL_ID,
      input_type: 'passage',
      input: [{
        content: [
          { type: 'text', text: passageText },
          { type: 'image_url', image_url: { url: image.dataUrl } },
        ],
      }],
      encoding_format: 'float',
    }
  }
  return { model: MODEL_ID, input_type: 'passage', input: passageText, encoding_format: 'float' }
}

/** Validates the live OpenRouter response before anything is persisted. */
export function parseEmbeddingResponse(json) {
  if (!json || typeof json !== 'object') throw new Error('Embedding response was not an object.')
  const list = json.data
  if (!Array.isArray(list) || list.length === 0) throw new Error('Embedding response contained no data.')
  const first = list[0]
  const embedding = first?.embedding
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS ||
      !embedding.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new Error(`Embedding must contain ${EMBEDDING_DIMENSIONS} finite numbers.`)
  }
  return { embedding: embedding, model: typeof json.model === 'string' ? json.model : null }
}

/** Content hash: model + text + image identity. Unchanged content never triggers a new API call. */
export async function contentHash(model, parts) {
  const bytes = new TextEncoder().encode(JSON.stringify([model, parts]))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** OpenRouter error details without leaking the request or key. */
export function providerError(status, json) {
  const e = (json && typeof json === 'object') ? json.error : null
  const msg = e && typeof e === 'object' ? String(e.message ?? '') : ''
  return `OpenRouter ${status}${msg ? ': ' + msg.slice(0, 300) : ''}`
}
