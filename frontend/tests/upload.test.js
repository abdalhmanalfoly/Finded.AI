// Behavioral tests for the photo-upload flow. The real supabaseService.js is imported with its
// supabase client swapped for a fake one (see helpers/service-loader.mjs), so these tests exercise
// auth checks, Storage paths, error handling and cleanup - not source-code regexes.
import { register } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setLanguage, translate } from '../src/i18n/core.js'
import { clearSubmitDiagnostics, getSubmitDiagnostics } from '../src/lib/submitDiagnostics.js'
import { validateReport } from '../src/lib/validation.js'
import { CATEGORIES, COLORS } from '../src/data/sampleData.js'

register('./helpers/service-loader.mjs', import.meta.url)
const svc = await import('../src/services/supabaseService.js')
setLanguage('ar')

const VALUES = {
  name: 'Black phone', category: 'Phones', description: 'Cracked screen', location: 'Maadi',
  city: 'Cairo', date: '2026-01-01', time: '', color: 'Black', brand: 'Samsung', extra: '', lat: '', lng: '',
}
const photo = () => ({ type: 'image/jpeg', size: 1024 })
const arabic = (key) => {
  const text = translate(key)
  assert.match(text, /[\u0600-\u06FF]/, `missing Arabic translation for: ${key}`)
  return text
}

function fakeSupabase(opts = {}) {
  const {
    session = { access_token: 'valid-jwt' }, sessionError = null, user = { id: 'u-owner' },
    getUserError = null, uploadError = null, imageInsertError = null, itemInsertError = null,
    rollbackDeleteError = null,
  } = opts
  const calls = { getSession: 0, getUser: 0, uploads: [], imageInserts: [], itemInserts: [], itemDeletes: [], removes: [] }
  globalThis.__SB = {
    auth: {
      async getSession() { calls.getSession++; return { data: { session }, error: sessionError } },
      async getUser() { calls.getUser++; return getUserError ? { data: { user: null }, error: getUserError } : { data: { user }, error: null } },
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, blob, options) { calls.uploads.push({ bucket, path, blob, options }); return { error: uploadError } },
          async remove(paths) { calls.removes.push({ bucket, paths }); return { error: null } },
        }
      },
    },
    functions: { async invoke() { return { error: null } } },
    from(table) {
      if (table === 'items') return {
        insert(row) {
          calls.itemInserts.push(row)
          return { select: () => ({ async single() { return { data: { id: 'item-1' }, error: itemInsertError } } }) }
        },
        delete() {
          return { async eq(col, id) { calls.itemDeletes.push({ col, id }); return { data: { id }, error: rollbackDeleteError } } }
        },
      }
      if (table === 'item_images') {
        return { insert(row) { calls.imageInserts.push(row); return Promise.resolve({ data: { id: 'img-1' }, error: imageInsertError }) } }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return calls
}

test('authenticated upload uses the signed-in user folder and creates image metadata', async () => {
  const calls = fakeSupabase()
  const problem = await svc.uploadImages('item-1', [photo()])
  assert.equal(problem, null)
  assert.equal(calls.getSession, 1)
  assert.equal(calls.getUser, 1)
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.uploads[0].bucket, 'item-images')
  assert.match(calls.uploads[0].path, /^u-owner\/[0-9a-f-]{36}\.jpg$/)
  assert.equal(calls.imageInserts[0].item_id, 'item-1')
  assert.equal(calls.imageInserts[0].storage_path, calls.uploads[0].path)
})

test('upload without a session fails in Arabic before any Storage or database call', async () => {
  const calls = fakeSupabase({ session: null })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message === arabic('Please log in first.'))
  assert.equal(calls.uploads.length, 0)
  assert.equal(calls.itemInserts.length, 0)
})

test('expired/invalid session fails with a session error instead of being treated as anonymous', async () => {
  const calls = fakeSupabase({ getUserError: { status: 401, message: 'unauthorized' } })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message === arabic('Your session has expired. Please sign in again.'))
  assert.equal(calls.uploads.length, 0)
  assert.equal(calls.itemInserts.length, 0)
})

test('Storage RLS rejection is reported and does not leave a report behind', async () => {
  const calls = fakeSupabase({ uploadError: { status: 403, message: 'new row violates row-level security policy' } })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message === arabic('You don’t have permission to upload photos.'))
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.imageInserts.length, 0)
  assert.equal(calls.itemInserts.length, 1)
  assert.equal(calls.itemDeletes.length, 1)
})

test('missing bucket is reported as a configuration problem and rolls the report back', async () => {
  const calls = fakeSupabase({ uploadError: { status: 404, message: 'Bucket not found' } })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message === arabic('Photo storage is not configured. Ask the administrator to create the item-images bucket.'))
  assert.equal(calls.itemDeletes.length, 1)
  assert.equal(calls.imageInserts.length, 0)
})

test('upload path and item owner always come from the authenticated user', async () => {
  const calls = fakeSupabase({ user: { id: 'real-uid' } })
  await svc.createItem('lost', VALUES, [photo()])
  assert.equal(calls.itemInserts[0].user_id, 'real-uid')
  assert.equal(calls.uploads[0].path.split('/')[0], 'real-uid')
})

test('a metadata insert failure removes the uploaded object and rolls the report back', async () => {
  const calls = fakeSupabase({ imageInsertError: { code: '42501', message: 'permission denied' } })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message === arabic('You don’t have permission to attach photos to this report.'))
  assert.equal(calls.removes.length, 1)
  assert.equal(calls.removes[0].paths[0], calls.uploads[0].path)
  assert.equal(calls.itemDeletes.length, 1)
})

test('successful item creation keeps the report, the upload and its metadata', async () => {
  const calls = fakeSupabase()
  const result = await svc.createItem('lost', VALUES, [photo()])
  assert.deepEqual(result, { id: 'item-1', imageProblem: null })
  assert.equal(calls.itemInserts.length, 1)
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.imageInserts.length, 1)
  assert.equal(calls.itemDeletes.length, 0)
  assert.equal(calls.removes.length, 0)
})

test('item INSERT rejected by RLS is identified with its original code and hint', async () => {
  clearSubmitDiagnostics()
  const calls = fakeSupabase({
    itemInsertError: {
      code: '42501', message: 'new row violates row-level security policy',
      details: 'failing row contains the new report', hint: 'Grant INSERT on public.items to authenticated',
    },
  })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message === arabic('You don’t have permission to create a report.'))
  assert.equal(calls.uploads.length, 0, 'no Storage call happens when the database rejects the item')
  const entry = getSubmitDiagnostics().find((d) => d.operation === 'items.insert')
  assert.ok(entry, 'items.insert failure is recorded')
  assert.equal(entry.ok, false)
  assert.equal(entry.code, '42501')
  assert.equal(entry.hasUser, true)
  assert.equal(entry.hint, 'Grant INSERT on public.items to authenticated')
  const log = JSON.stringify(getSubmitDiagnostics())
  assert.ok(!log.includes('valid-jwt') && !log.includes('u-owner'), 'diagnostics contain no token or user id')
})

test('authenticated user can create a report without any photo', async () => {
  clearSubmitDiagnostics()
  const calls = fakeSupabase()
  const result = await svc.createItem('lost', VALUES, [])
  assert.equal(result.id, 'item-1')
  assert.equal(calls.uploads.length, 0)
  assert.equal(calls.itemDeletes.length, 0)
  assert.ok(getSubmitDiagnostics().some((d) => d.operation === 'submit.success'))
})

test('multiple photos are uploaded and indexed in order', async () => {
  const calls = fakeSupabase()
  await svc.createItem('lost', VALUES, [photo(), photo(), photo()])
  assert.equal(calls.uploads.length, 3)
  assert.equal(calls.imageInserts.length, 3)
  assert.deepEqual(calls.imageInserts.map((r) => r.position), [0, 1, 2])
})

test('a failed rollback is logged and the user is told that cleanup is incomplete', async () => {
  clearSubmitDiagnostics()
  fakeSupabase({
    imageInsertError: { code: '42501', message: 'permission denied' },
    rollbackDeleteError: { code: '42501', message: 'permission denied' },
  })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message.includes(arabic('Some leftover data could not be cleaned up automatically.')))
  const entry = getSubmitDiagnostics().find((d) => d.operation === 'rollback.items.delete')
  assert.ok(entry && entry.ok === false && entry.code === '42501')
})

test('reports without a map pin omit latitude/longitude so the INSERT needs no extra column grant', async () => {
  const calls = fakeSupabase()
  await svc.createItem('lost', VALUES, [])
  assert.ok(!('latitude' in calls.itemInserts[0]))
  assert.ok(!('longitude' in calls.itemInserts[0]))
})

test('reports with a map pin include numeric coordinates', async () => {
  const calls = fakeSupabase()
  await svc.createItem('lost', { ...VALUES, lat: '30.0444', lng: '31.2357' }, [])
  assert.equal(calls.itemInserts[0].latitude, 30.0444)
  assert.equal(calls.itemInserts[0].longitude, 31.2357)
})

test('suspended user is rejected by the items RLS policy before any upload', async () => {
  clearSubmitDiagnostics()
  const calls = fakeSupabase({
    itemInsertError: { code: '42501', message: 'new row violates row-level security policy (is_suspended)' },
  })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]), (e) => e.message === arabic('You don’t have permission to create a report.'))
  assert.equal(calls.uploads.length, 0, 'no Storage call is made for a suspended user')
  const entry = getSubmitDiagnostics().find((d) => d.operation === 'items.insert')
  assert.ok(entry && entry.ok === false && entry.code === '42501')
})

test('the exact example Arabic report data passes validation and is not a permission problem', () => {
  const example = {
    name: 'ماكس كولا', category: 'Other', description: 'ماكس كولا باللمون ضاع مني',
    location: 'Misr, Cairo, EGY', city: 'assuit', date: new Date().toISOString().slice(0, 10),
    time: 'Morning', color: 'Green', brand: 'Samsung', extra: '', lat: '', lng: '',
  }
  assert.ok(CATEGORIES.includes(example.category))
  assert.ok(COLORS.includes(example.color))
  assert.deepEqual(validateReport(example, 'lost'), {}, 'valid example data must produce no field errors')
})

test('invalid category and future date are field errors, never authorization errors', () => {
  const bad = { ...VALUES, category: '', date: '2099-01-01' }
  const errs = validateReport(bad, 'lost')
  assert.ok(errs.category, 'missing category is reported')
  assert.ok(errs.date, 'future date is reported')
  assert.ok(!Object.values(errs).some((m) => /permission|صلاحية|42501/i.test(m)), 'validation errors must not be permission errors')
})

test('every column sent by the runtime INSERT is covered by migration 010 grant', async () => {
  const sql = readFileSync(new URL('../../supabase/migrations/010_restore_items_insert_privilege.sql', import.meta.url), 'utf8')
  const match = sql.match(/grant insert \(([\s\S]*?)\) on public\.items to authenticated/i)
  assert.ok(match, 'migration 010 must grant INSERT on public.items')
  const granted = new Set(match[1].split(',').map((c) => c.trim()))
  const sent = new Set()
  for (const values of [VALUES, { ...VALUES, lat: '30.0444', lng: '31.2357' }]) {
    const calls = fakeSupabase()
    await svc.createItem('lost', values, [])
    Object.keys(calls.itemInserts[0]).forEach((c) => sent.add(c))
  }
  for (const column of sent) assert.ok(granted.has(column), `INSERT sends ${column} but migration 010 does not grant it`)
  assert.ok(sent.has('latitude') && sent.has('longitude'))
  assert.ok(!granted.has('status') && !granted.has('is_hidden'), 'grant must stay column-restricted')
})

test('diagnostics redact emails, UUIDs, tokens, keys and file paths from raw errors', async () => {
  clearSubmitDiagnostics()
  const calls = fakeSupabase({
    itemInsertError: {
      code: '23505',
      message: 'duplicate for user a1b2c3d4-1234-1234-1234-123456789012 <alice@example.com>',
      details: 'token eyJabcdefgh123456.eyJabcdefgh123456.sigabcdefgh123456',
      hint: 'see sb_publishable_ABC123/file u-owner/secret.jpg',
    },
  })
  await assert.rejects(() => svc.createItem('lost', VALUES, [photo()]))
  const entry = getSubmitDiagnostics().find((d) => d.operation === 'items.insert')
  const log = JSON.stringify(entry)
  assert.ok(log.includes('[email]'))
  assert.ok(log.includes('[uuid]'))
  assert.ok(log.includes('[token]'))
  assert.ok(log.includes('[key]'))
  assert.ok(log.includes('[path]'))
  assert.ok(!log.includes('alice@example.com') && !log.includes('eyJabcdefgh') && !log.includes('sb_publishable_'))
  assert.equal(calls.uploads.length, 0)
})
