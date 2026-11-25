import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from '../../scripts/verify-live.mjs'

const res = (status, body = []) => ({ status, ok: status >= 200 && status < 300, json: async () => body })

// A fake Supabase that behaves like a correctly locked-down project.
const good = async (url, opts = {}) => {
  if (url.includes('/rest/v1/public_items')) return res(200, [{ id: '1', name: 'x' }])
  if (url.includes('/storage/v1/object/list')) return res(200, [])
  return res(401)
}
// A fake project where RLS/grants were forgotten.
const leaky = async (url) => {
  if (url.includes('/rest/v1/public_items')) return res(200, [{ id: '1', name: 'x', user_id: 'u', latitude: 1 }])
  if (url.includes('/storage/v1/object/list')) return res(200, [{ name: 'a.jpg' }])
  return res(200, [])
}

test('verify-live passes against a locked-down project', async () => {
  const r = await run({ url: 'https://x.supabase.co', anonKey: 'k', fetchFn: good, log: () => {} })
  assert.equal(r.failed, 0)
  assert.ok(r.passed >= 14)
})

test('verify-live catches leaked tables, columns, rpcs and storage listing', async () => {
  const r = await run({ url: 'https://x.supabase.co', anonKey: 'k', fetchFn: leaky, log: () => {} })
  assert.ok(r.failed >= 10)
  assert.ok(r.results.some((x) => x.name.includes('private columns') && !x.ok))
  assert.ok(r.results.some((x) => x.name.includes('list storage') && !x.ok))
})
