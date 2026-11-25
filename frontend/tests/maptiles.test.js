import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  project, unproject, pointToLatLng, latLngToPoint, panBy, zoomTo, visibleTiles, isValidPin, roundCoord, wrapLng, MIN_ZOOM, MAX_ZOOM,
} from '../src/lib/mapTiles.js'
import { createSignedUrlCache } from '../src/lib/signedUrls.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`)
const view = { lat: 30.0444, lng: 31.2357, zoom: 15, width: 600, height: 300 }

test('project/unproject round-trip and known tile positions', () => {
  for (const [lat, lng, z] of [[30.0444, 31.2357, 15], [-33.86, 151.21, 10], [0, 0, 3], [60, -120, 18]]) {
    const p = project(lat, lng, z); const q = unproject(p.x, p.y, z)
    near(q.lat, lat, 1e-7); near(q.lng, lng, 1e-7)
  }
  const o = project(0, 0, 1) // equator / prime meridian = middle of the world image
  assert.deepEqual([o.x, o.y], [256, 256])
})

test('a click in the middle of the viewport is the view centre; corners are consistent', () => {
  const c = pointToLatLng(view, 300, 150)
  near(c.lat, view.lat, 1e-7); near(c.lng, view.lng, 1e-7)
  const tl = pointToLatLng(view, 0, 0); const back = latLngToPoint(view, tl.lat, tl.lng)
  near(back.x, 0, 1e-6); near(back.y, 0, 1e-6)
  assert.ok(tl.lat > view.lat && tl.lng < view.lng, 'top-left is north-west of the centre')
})

test('pin is drawn at the clicked pixel (click -> coordinates -> marker position)', () => {
  const picked = pointToLatLng(view, 123, 77)
  const p = latLngToPoint(view, Number(roundCoord(picked.lat)), Number(roundCoord(picked.lng)))
  near(p.x, 123, 0.5); near(p.y, 77, 0.5) // 5-decimal rounding is far below one pixel at zoom 15
})

test('panning by a drag moves the map under the pointer', () => {
  const moved = panBy(view, 50, 0) // drag right -> centre moves west
  assert.ok(moved.lng < view.lng)
  near(moved.lat, view.lat, 1e-9)
  const spot = pointToLatLng(view, 100, 100)
  const after = latLngToPoint(moved, spot.lat, spot.lng)
  near(after.x, 150, 1e-6); near(after.y, 100, 1e-6)
})

test('zooming keeps the point under the cursor fixed and respects the limits', () => {
  const spot = pointToLatLng(view, 500, 40)
  const z = zoomTo(view, view.zoom + 2, 500, 40)
  assert.equal(z.zoom, view.zoom + 2)
  const p = latLngToPoint(z, spot.lat, spot.lng)
  near(p.x, 500, 1e-6); near(p.y, 40, 1e-6)
  assert.equal(zoomTo(view, 99).zoom, MAX_ZOOM)
  assert.equal(zoomTo(view, -5).zoom, MIN_ZOOM)
})

test('visibleTiles covers the viewport with valid, wrapped OpenStreetMap URLs', () => {
  const tiles = visibleTiles(view)
  assert.ok(tiles.length >= 6 && tiles.length <= 12)
  for (const t of tiles) assert.match(t.url, /^https:\/\/tile\.openstreetmap\.org\/15\/\d+\/\d+\.png$/)
  assert.ok(tiles.some((t) => t.left <= 0 && t.left + 256 >= 0) && tiles.some((t) => t.left + 256 >= 600))
  const edge = visibleTiles({ lat: 0, lng: 179.9, zoom: 3, width: 600, height: 300 }) // crosses the antimeridian
  assert.ok(edge.every((t) => { const x = Number(t.url.split('/').at(-2)); return x >= 0 && x < 8 }))
  const pole = visibleTiles({ lat: 85, lng: 0, zoom: 3, width: 600, height: 600 })
  assert.ok(pole.every((t) => Number(t.url.split('/').at(-1).replace('.png', '')) >= 0))
})

test('longitude wraps and out-of-range pins are rejected', () => {
  assert.equal(wrapLng(190), -170)
  assert.equal(wrapLng(-181), 179)
  assert.ok(isValidPin('30.04', '31.23') && isValidPin(0, 0))
  for (const [a, b] of [['', ''], [null, 5], ['abc', '1'], ['91', '0'], ['0', '181']]) assert.equal(isValidPin(a, b), false)
})

test('signed URL cache: batches, de-duplicates, reuses, refreshes before expiry, survives failures', async () => {
  let clock = 0; const calls = []
  const sign = async (paths, ttl) => { calls.push([...paths]); return { data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}?t=${clock}`, error: null })), error: null } }
  const cache = createSignedUrlCache({ sign, ttl: 3600, margin: 300_000, now: () => clock })
  let m = await cache.get(['a.jpg', 'b.jpg', 'a.jpg', null, undefined])
  assert.equal(calls.length, 1); assert.deepEqual(calls[0], ['a.jpg', 'b.jpg'])
  assert.match(m.get('a.jpg'), /a\.jpg/)
  await cache.get(['a.jpg', 'b.jpg']); assert.equal(calls.length, 1, 'cached')
  await cache.get(['a.jpg', 'c.jpg']); assert.deepEqual(calls[1], ['c.jpg'], 'only the new path is requested')
  clock = 3600_000 - 299_000 // inside the refresh margin
  await cache.get(['a.jpg']); assert.deepEqual(calls[2], ['a.jpg'], 'refreshed before it expires')
  cache.forget(['a.jpg']); await cache.get(['a.jpg']); assert.equal(calls.length, 4)

  const broken = createSignedUrlCache({ sign: async () => { throw new Error('offline') } })
  assert.equal((await broken.get(['z.jpg'])).get('z.jpg'), null)
  const denied = createSignedUrlCache({ sign: async (p) => ({ data: p.map((x) => ({ path: x, signedUrl: null, error: 'Object not found' })), error: null }) })
  assert.equal((await denied.get(['z.jpg'])).get('z.jpg'), null)
  const errored = createSignedUrlCache({ sign: async () => ({ data: null, error: { message: 'x' } }) })
  assert.equal((await errored.get(['z.jpg'])).get('z.jpg'), null)
  assert.equal(broken.failureCount(), 1)
  assert.equal(denied.failureCount(), 1)
  assert.equal(errored.failureCount(), 1)
})

test('photos are served through signed URLs, never public URLs', () => {
  const svc = read('../src/services/supabaseService.js')
  assert.doesNotMatch(svc, /getPublicUrl/)
  assert.match(svc, /createSignedUrls/)
  assert.match(svc, /signedUrls\(\(imgs/)
  assert.match(svc, /itemsByIds[\s\S]*mapItems\(pub\.data/)
})

test('migration 008 makes the bucket private and ties file access to report visibility', () => {
  const sql = read('../../supabase/migrations/008_private_images_signed_urls.sql')
  assert.match(sql, /update storage\.buckets set public = false where id = 'item-images'/)
  assert.match(sql, /create policy item_images_storage_read on storage\.objects for select to anon, authenticated/)
  assert.match(sql, /from public\.item_images ii where ii\.storage_path = objects\.name/)
  assert.match(read('../../supabase/run_local_tests.sh'), /008_private_images_signed_urls\.sql/)
})

test('click-to-pin map: component, CSP tiles, picker wiring and Arabic strings', () => {
  const picker = read('../src/components/ui/LocationPicker.jsx'); const pin = read('../src/components/ui/PinMap.jsx')
  assert.match(picker, /<PinMap[^>]+onPick=\{onChange\}/)
  assert.match(pin, /dir="ltr"/, 'map geometry must not flip in RTL')
  assert.match(pin, /onKeyDown/, 'keyboard alternative to clicking')
  assert.match(pin, /passive: false/)
  assert.match(read('../vercel.json'), /img-src[^;]*https:\/\/tile\.openstreetmap\.org/)
})
