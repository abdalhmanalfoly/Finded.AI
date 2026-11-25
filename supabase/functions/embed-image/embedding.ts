// Pure helpers (no Deno APIs) so they can be unit-tested with Node: `node --test supabase/functions/embed-image/`

/** Accepts a flat vector, a one-row matrix ([[...]]), or {embedding|embeddings|data: ...}. Returns number[] or throws. */
export function parseEmbedding(json: unknown): number[] {
  let v: unknown = json
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    v = o.embedding ?? o.embeddings ?? o.data ?? o.vector
    if (Array.isArray(v) && v.length && typeof v[0] === 'object' && !Array.isArray(v[0])) v = (v[0] as Record<string, unknown>).embedding
  }
  while (Array.isArray(v) && v.length === 1 && Array.isArray(v[0])) v = v[0]
  if (!Array.isArray(v) || v.length < 64 || v.length > 4096 || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    throw new Error('Provider returned an unexpected embedding format.')
  }
  return v as number[]
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function checkImage(type: string, size: number): string | null {
  if (!ALLOWED_TYPES.includes(type)) return 'Unsupported image type.'
  if (size <= 0 || size > MAX_IMAGE_BYTES) return 'Image is empty or larger than 5 MB.'
  return null
}
