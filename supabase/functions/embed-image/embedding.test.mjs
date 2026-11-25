import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEmbedding, checkImage } from './embedding.ts'

const vec = (n) => Array.from({ length: n }, (_, i) => (i % 7) / 7 + 0.01)

test('parseEmbedding accepts flat, nested and wrapped vectors', () => {
  assert.equal(parseEmbedding(vec(512)).length, 512)
  assert.equal(parseEmbedding([vec(512)]).length, 512)
  assert.equal(parseEmbedding({ embedding: vec(128) }).length, 128)
  assert.equal(parseEmbedding({ data: [{ embedding: vec(64) }] }).length, 64)
})

test('parseEmbedding rejects bad payloads', () => {
  assert.throws(() => parseEmbedding(vec(10)))
  assert.throws(() => parseEmbedding({ error: 'Model is loading' }))
  assert.throws(() => parseEmbedding([...vec(100), 'x']))
  assert.throws(() => parseEmbedding(null))
  assert.throws(() => parseEmbedding([...vec(100), NaN]))
})

test('checkImage enforces type and size', () => {
  assert.equal(checkImage('image/png', 1000), null)
  assert.ok(checkImage('image/svg+xml', 1000))
  assert.ok(checkImage('image/jpeg', 6 * 1024 * 1024))
  assert.ok(checkImage('image/jpeg', 0))
})
