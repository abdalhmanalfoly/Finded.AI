#!/usr/bin/env node
// Smoke-tests a REAL Supabase project after you applied migrations 001-010.
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=... node scripts/verify-live.mjs
// Optional write test (creates then deletes one report): add TEST_EMAIL=... TEST_PASSWORD=...
// Read-only for anonymous checks. Never use the service_role key here.
import { pathToFileURL } from 'node:url'

export async function run({ url, anonKey, email, password, fetchFn = fetch, log = console.log }) {
  const base = url.replace(/\/$/, '')
  const H = (token) => ({ apikey: anonKey, Authorization: `Bearer ${token || anonKey}`, 'Content-Type': 'application/json' })
  const results = []
  const check = (name, ok, detail = '') => { results.push({ name, ok }); log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`) }
  const denied = (r) => r.status === 401 || r.status === 403 || r.status === 404

  const get = (path, token) => fetchFn(`${base}/rest/v1/${path}`, { headers: H(token) })
  const rpc = (fn, body, token) => fetchFn(`${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(token), body: JSON.stringify(body || {}) })

  let r = await get('public_items?select=id,name&limit=1')
  check('anon can read public_items', r.status === 200, `status ${r.status}`)
  if (r.status === 200) {
    const rows = await r.json()
    check('public_items exposes no private columns', rows.length === 0 || !('user_id' in rows[0]) && !('additional_details' in rows[0]) && !('latitude' in rows[0]), JSON.stringify(Object.keys(rows[0] || {})))
  }
  for (const table of ['items', 'profiles', 'notifications', 'messages', 'contact_requests', 'matches', 'flags', 'admin_actions', 'image_embeddings', 'embedding_attempts', 'contact_profiles']) {
    r = await get(`${table}?select=*&limit=1`)
    check(`anon cannot read ${table}`, denied(r), `status ${r.status}`)
  }
  for (const [fn, body] of [['admin_stats', {}], ['close_stale_items', { p_days: 90 }], ['admin_list_actions', { p_limit: 5 }], ['run_matching', { p_item_id: '00000000-0000-0000-0000-000000000000' }], ['export_my_data', {}], ['delete_my_account', {}], ['claim_embedding_attempt', { p_image_id: '00000000-0000-0000-0000-000000000000' }]]) {
    r = await rpc(fn, body)
    check(`anon cannot call ${fn}`, denied(r), `status ${r.status}`)
  }
  r = await fetchFn(`${base}/storage/v1/object/list/item-images`, { method: 'POST', headers: H(), body: JSON.stringify({ prefix: '', limit: 5 }) })
  const listing = r.ok ? await r.json() : []
  check('anon cannot list storage objects', denied(r) || (Array.isArray(listing) && listing.length === 0), `status ${r.status}, ${Array.isArray(listing) ? listing.length : '?'} objects`)

  // Photos: the bucket must be private (migration 008), but a public report's photo must still be signable.
  r = await get('public_items?select=cover_path&cover_path=not.is.null&limit=1')
  const withPhoto = r.ok ? await r.json() : []
  if (Array.isArray(withPhoto) && withPhoto[0]?.cover_path) {
    const path = withPhoto[0].cover_path
    const direct = await fetchFn(`${base}/storage/v1/object/public/item-images/${path}`)
    check('photos are not reachable through a public URL (bucket is private)', !direct.ok, `status ${direct.status}`)
    const signed = await fetchFn(`${base}/storage/v1/object/sign/item-images/${path}`, { method: 'POST', headers: H(), body: JSON.stringify({ expiresIn: 60 }) })
    const body = signed.ok ? await signed.json() : {}
    check('anon can get a signed URL for a public report photo', signed.ok && Boolean(body.signedURL || body.signedUrl), `status ${signed.status}`)
  }

  if (email && password) {
    r = await fetchFn(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: H(), body: JSON.stringify({ email, password }) })
    const session = r.ok ? await r.json() : null
    check('test user can sign in', Boolean(session?.access_token), `status ${r.status}`)
    if (session?.access_token) {
      const t = session.access_token
      r = await rpc('admin_stats', {}, t)
      check('normal user cannot call admin_stats', !r.ok, `status ${r.status}`)
      const row = { user_id: session.user.id, type: 'lost', name: 'verify-live test item', category: 'Other', description: 'Temporary item created by verify-live.mjs',
        location_text: 'Nowhere', city: 'Testville', event_date: new Date().toISOString().slice(0, 10), color: 'Blue' }
      r = await fetchFn(`${base}/rest/v1/items`, { method: 'POST', headers: { ...H(t), Prefer: 'return=representation' }, body: JSON.stringify(row) })
      const created = r.ok ? (await r.json())[0] : null
      check('user can create a report', Boolean(created?.id), `status ${r.status}`)
      if (created?.id) {
        r = await get(`public_items?id=eq.${created.id}&select=id`)
        check('new report is publicly visible', r.ok && (await r.json()).length === 1, `status ${r.status}`)
        r = await fetchFn(`${base}/rest/v1/items?id=eq.${created.id}`, { method: 'DELETE', headers: H(t) })
        check('user can delete own report (cleanup)', r.status === 204 || r.ok, `status ${r.status}`)
      }
    }
  }
  const failed = results.filter((x) => !x.ok).length
  log(`\n${results.length - failed}/${results.length} checks passed.`)
  return { passed: results.length - failed, failed, results }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD } = process.env
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY.'); process.exit(2) }
  run({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, email: TEST_EMAIL, password: TEST_PASSWORD }).then((r) => process.exit(r.failed ? 1 : 0))
}
