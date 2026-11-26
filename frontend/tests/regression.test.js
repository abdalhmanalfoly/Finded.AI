import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('public item details query safe public view before protected table', () => {
  const source = read('../src/services/supabaseService.js')
  const start = source.indexOf('export async function getItem')
  const end = source.indexOf('export async function getMyItems', start)
  const fn = source.slice(start, end)
  assert.ok(fn.indexOf("from('public_items')") < fn.indexOf("from('items')"))
  assert.match(fn, /privateResult\.error\.code !== '42501'/)
})

test('signed-out visitors can read public item details without a session', () => {
  const source = read('../src/services/supabaseService.js')
  const start = source.indexOf('export async function getItem')
  const end = source.indexOf('export async function getMyItems', start)
  const fn = source.slice(start, end)
  assert.match(fn, /auth\.getSession\(\)/)
  assert.match(fn, /if \(sessionData\?\.session\)/)
  assert.match(fn, /if \(!authError\) authUser = authData\.user/)
  assert.ok(!/if \(authError\) fail\(authError\)/.test(fn))
})

test('real search includes brand and event-date bounds', () => {
  const source = read('../src/services/supabaseService.js')
  assert.match(source, /brand\.ilike/)
  assert.match(source, /gte\('event_date', dateFrom\)/)
  assert.match(source, /lte\('event_date', dateTo\)/)
})

test('sample search supports the same date bounds', () => {
  const source = read('../src/services/sampleService.js')
  assert.match(source, /if \(dateFrom && i\.date < dateFrom\)/)
  assert.match(source, /if \(dateTo && i\.date > dateTo\)/)
})

test('admin suspension is revoked from direct authenticated updates', () => {
  const migration = read('../../supabase/migrations/005_harden_admin_suspension.sql')
  assert.match(migration, /revoke update \(is_suspended\) on public\.profiles from authenticated/i)
})

test('database test runner fails on pipeline errors and SQL errors', () => {
  const runner = read('../../supabase/run_local_tests.sh')
  assert.match(runner, /set -euo pipefail/)
  assert.match(runner, /-v ON_ERROR_STOP=1/)
  assert.match(runner, /test\.results where not ok/)
})


test('mutations detect RLS-filtered updates and deletes instead of reporting false success', () => {
  const source = read('../src/services/supabaseService.js')
  for (const fnName of ['updateItem', 'setItemStatus', 'removeImage', 'deleteItem', 'updateProfile']) {
    const start = source.indexOf(`export async function ${fnName}`)
    assert.notEqual(start, -1, `${fnName} exists`)
    const next = source.indexOf('export async function ', start + 1)
    const body = source.slice(start, next === -1 ? source.length : next)
    assert.match(body, /maybeSingle\(\)/, `${fnName} checks whether a row was actually affected`)
    assert.match(body, /if \(!data\)/, `${fnName} reports a missing/unauthorized row`)
  }
})

test('delete report checks image lookup errors before deleting the report', () => {
  const source = read('../src/services/supabaseService.js')
  const start = source.indexOf('export async function deleteItem')
  const end = source.indexOf('async function itemsByIds', start)
  const body = source.slice(start, end)
  assert.ok(body.indexOf('if (imageQueryError) fail(imageQueryError)') < body.indexOf(".from('items').delete()"))
})

test('migration 006 provides retention, audit-log reader and abuse guards', () => {
  const sql = read('../../supabase/migrations/006_retention_audit_abuse_guards.sql')
  for (const needle of ['close_stale_items', 'admin_list_actions', 'flags_guard', 'messages_rate_limit', 'flags_one_open_per_reporter_item']) {
    assert.ok(sql.includes(needle), `${needle} defined`)
  }
  assert.match(sql, /revoke all on function public\.admin_list_actions\(int\), public\.close_stale_items\(int\) from public, anon/)
  const runner = read('../../supabase/run_local_tests.sh')
  assert.match(runner, /006_retention_audit_abuse_guards\.sql/)
})

test('admin audit log and stale-report closing are exposed through the service layer and UI', () => {
  assert.match(read('../src/services/itemsService.js'), /listAdminActions/)
  assert.match(read('../src/services/supabaseService.js'), /rpc\('admin_list_actions'/)
  assert.match(read('../src/pages/Admin.jsx'), /Audit log/)
})

test('privacy and terms pages are routed and linked from the footer', () => {
  const app = read('../src/App.jsx')
  assert.match(app, /path="\/privacy"/)
  assert.match(app, /path="\/terms"/)
  assert.match(read('../src/components/layout/Footer.jsx'), /to="\/privacy"/)
})

test('owners can reopen closed or resolved reports', () => {
  assert.match(read('../src/pages/ItemDetails.jsx'), /setItemStatus\(item\.id, 'active'\)/)
})

test('vercel config sets CSP and HSTS headers', () => {
  const v = read('../vercel.json')
  assert.match(v, /Content-Security-Policy/)
  assert.match(v, /Strict-Transport-Security/)
})

test('migration 007 adds photo matching, map coordinates, realtime and storage hardening', () => {
  const sql = read('../../supabase/migrations/007_image_ai_arabic_maps_realtime.sql')
  for (const needle of ['image_embeddings', 'store_image_embedding', 'image_similarity', 'approx_lat', 'supabase_realtime', 'item_images_storage_read_own', 'distance_km']) {
    assert.ok(sql.includes(needle), `${needle} defined`)
  }
  assert.match(sql, /revoke all on function public\.store_image_embedding/)
  assert.match(sql, /revoke all on public\.image_embeddings from anon, authenticated/)
})

test('frontend wires realtime, embeddings and coordinates through the service layer', () => {
  const svc = read('../src/services/supabaseService.js')
  assert.match(svc, /postgres_changes/)
  assert.match(svc, /functions\.invoke\('embed-image'/)
  assert.match(svc, /row\.latitude = Number\(v\.lat\)/)
  assert.match(svc, /row\.longitude = Number\(v\.lng\)/)
  assert.match(read('../src/hooks/useUnreadCount.js'), /subscribeNotifications/)
  assert.match(read('../src/pages/Requests.jsx'), /subscribeMessages/)
})

test('migration 011 adds Nemotron pgvector documents, asymmetric retrieval and AI-owned matches', () => {
  const sql = read('../../supabase/migrations/011_nemotron_item_embeddings.sql')
  for (const needle of [
    'nvidia/nemotron-3.5-embed-8b:free', 'extensions.vector(4096)',
    'match_items_by_embedding', 'persist_ai_matches', 'input_mode', 'engine',
    'get_openrouter_api_key',
  ]) {
    assert.ok(sql.includes(needle), `${needle} defined`)
  }
  assert.match(sql, /revoke all on public\.item_embeddings from anon, authenticated/)
  assert.match(sql, /revoke all on function public\.match_items_by_embedding/)
  assert.match(sql, /Only passage embeddings may be stored/)
  // pgvector ANN indexes cap vector columns at 2000 dimensions; 4096 needs an exact scan.
  assert.ok(!sql.includes('using hnsw'))
  assert.ok(!sql.includes('using ivfflat'))
})

test('migration 012 exposes the allowed origin only to service_role', () => {
  const sql = read('../../supabase/migrations/012_nemotron_allowed_origin.sql')
  assert.ok(sql.includes('get_allowed_origin'))
  assert.ok(sql.includes("d.name = 'ALLOWED_ORIGIN'"))
  assert.match(sql, /revoke all on function public\.get_allowed_origin\(\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.get_allowed_origin\(\) to service_role/)
})

test('migration 013 restores only service_role reads needed by the Edge Function', () => {
  const sql = read('../../supabase/migrations/013_nemotron_service_role_reads.sql')
  for (const table of ['items', 'item_images', 'item_embeddings']) {
    assert.match(sql, new RegExp(`grant select on public\\.${table} to service_role`))
  }
  assert.ok(!/grant .*(insert|update|delete|all)/i.test(sql))
  assert.ok(!/to anon|to authenticated/.test(sql))
})

test('frontend triggers Nemotron matching without waiting for inference', () => {
  const svc = read('../src/services/supabaseService.js')
  assert.match(svc, /functions\.invoke\('nemotron-match'/)
  assert.match(svc, /requestAiMatching\(data\.id\) \/\/ fire-and-forget/)
  assert.ok(!/OPENROUTER_API_KEY/.test(svc))
})

test('CSP allows only the OpenStreetMap frame and geolocation for self', () => {
  const v = read('../vercel.json')
  assert.match(v, /frame-src https:\/\/www\.openstreetmap\.org/)
  assert.match(v, /geolocation=\(self\)/)
})

test('Edge Function never trusts the client: it checks the user, ownership and file type', () => {
  const fn = read('../../supabase/functions/embed-image/index.ts')
  assert.match(fn, /auth\.getUser\(\)/)
  assert.match(fn, /from\('items'\)\.select\('id'\)\.eq\('id', itemId\)/)
  assert.match(fn, /checkImage/)
  assert.ok(!/VITE_/.test(fn))
})

test('Edge Function CORS fails closed for unconfigured browser origins', () => {
  const fn = read('../../supabase/functions/embed-image/index.ts')
  assert.doesNotMatch(fn, /\?\? '\*'/)
  assert.match(fn, /origin !== allowedOrigin/)
  assert.match(fn, /Origin not allowed/)
})

test('data and realtime failures are surfaced instead of silently returning empty state', () => {
  const svc = read('../src/services/supabaseService.js')
  const unread = svc.slice(svc.indexOf('export async function unreadCount'), svc.indexOf('export async function markNotificationRead'))
  assert.match(unread, /if \(error\) fail\(error\)/)
  assert.match(svc, /if \(own\.error && own\.error\.code !== '42501'\) fail\(own\.error\)/)
  assert.match(svc, /if \(pub\.error\) fail\(pub\.error\)/)
  assert.match(svc, /if \(profilesError\) fail\(profilesError\)/)
  const hook = read('../src/hooks/useUnreadCount.js')
  assert.match(hook, /setProblem\(/)
  assert.match(read('../src/pages/Notifications.jsx'), /Live updates are unavailable/)
  assert.match(read('../src/pages/Requests.jsx'), /Live updates are unavailable/)
})

test('profile load failures show retry UI and never throw from refreshProfile', () => {
  const profile = read('../src/pages/Profile.jsx')
  assert.match(profile, /ErrorState title=\{t\('Unable to load account profile\.'\)\}/)
  assert.match(profile, /refreshed === false/)
  const auth = read('../src/context/AuthContext.jsx')
  const refresh = auth.slice(auth.indexOf('async refreshProfile()'), auth.indexOf('}), [session'))
  assert.match(refresh, /return false/)
  assert.doesNotMatch(refresh, /throw new Error/)
})

test('suspended users cannot send requests or messages in the UI', () => {
  const item = read('../src/pages/ItemDetails.jsx')
  const matches = read('../src/pages/Matches.jsx')
  const requests = read('../src/pages/Requests.jsx')
  assert.match(item, /configured, user, isSuspended/)
  assert.match(item, /Boolean\(user\) && !isSuspended/)
  assert.match(matches, /canRequest=\{!isSuspended\}/)
  assert.match(requests, /canSend=\{!isSuspended\}/)
})
