import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MODEL_ID, EMBEDDING_DIMENSIONS, buildPassageText, buildQueryText,
  buildEmbeddingPayload, parseEmbeddingResponse, checkImage, contentHash,
} from './nemotron.mjs'

const item = {
  name: 'Red backpack', category: 'Bags', description: 'Red backpack with black straps',
  color: 'Red', brand: 'NoName', additional_details: '', location_text: 'Cairo', city: 'Cairo',
  event_date: '2026-11-20', type: 'lost',
}
const vec = (n) => Array.from({ length: n }, (_, i) => (i % 9) / 9)

test('passage and query builders only use real item fields', () => {
  const passage = buildPassageText(item)
  const query = buildQueryText(item)
  assert.ok(passage.includes('Red backpack') && passage.includes('Cairo'))
  assert.ok(query.includes('black straps'))
  assert.ok(!passage.includes('undefined') && !query.includes('null'))
})

test('verified payload shapes use passage/query mode and one image document', () => {
  const q = buildEmbeddingPayload('query', buildQueryText(item))
  assert.equal(q.model, MODEL_ID)
  assert.equal(q.input_type, 'query')
  assert.equal(q.input, 'Red backpack. Red backpack with black straps. Red. NoName. Bags. Cairo. Cairo')

  const p = buildEmbeddingPayload('passage', 'text only')
  assert.equal(p.input_type, 'passage')
  assert.equal(p.input, 'text only')

  const m = buildEmbeddingPayload('passage', 'a bag', { dataUrl: 'data:image/png;base64,AAA' })
  assert.equal(m.input_type, 'passage')
  assert.equal(m.input[0].content.length, 2)
  assert.equal(m.input[0].content[1].image_url.url, 'data:image/png;base64,AAA')
})

test('embedding response validation rejects malformed vectors', () => {
  const ok = parseEmbeddingResponse({ model: MODEL_ID, data: [{ embedding: vec(EMBEDDING_DIMENSIONS) }] })
  assert.equal(ok.embedding.length, 4096)
  assert.throws(() => parseEmbeddingResponse({ data: [] }))
  assert.throws(() => parseEmbeddingResponse({ data: [{ embedding: vec(10) }] }))
  assert.throws(() => parseEmbeddingResponse({ data: [{ embedding: [...vec(4095), NaN] }] }))
})

test('image guard accepts PNG/JPEG only', () => {
  assert.equal(checkImage('image/png', 1000), null)
  assert.equal(checkImage('image/jpeg', 1000), null)
  assert.ok(checkImage('image/webp', 1000))
  assert.ok(checkImage('image/png', 6 * 1024 * 1024))
})

test('content hash is stable and changes with content', async () => {
  const a = await contentHash(MODEL_ID, ['same', 'v1'])
  const b = await contentHash(MODEL_ID, ['same', 'v1'])
  const c = await contentHash(MODEL_ID, ['same', 'v2'])
  assert.equal(a, b)
  assert.notEqual(a, c)
})
