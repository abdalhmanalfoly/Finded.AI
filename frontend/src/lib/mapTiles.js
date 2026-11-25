// Web-Mercator "slippy map" math for the click-to-pin picker. Pure functions, no DOM and no dependencies, so they
// are unit-tested in Node. Tiles come from OpenStreetMap (allowed by `img-src` in vercel.json).
export const TILE = 256
export const MIN_ZOOM = 3
export const MAX_ZOOM = 18
export const MAX_LAT = 85.0511
export const DEFAULT_VIEW = { lat: 30.0444, lng: 31.2357, zoom: 11 } // Cairo; only used until a pin exists

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180
export const worldSize = (zoom) => TILE * 2 ** zoom
export const tileUrl = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`

/** Latitude/longitude -> pixel in the world image at this zoom. */
export function project(lat, lng, zoom) {
  const s = worldSize(zoom)
  const sin = Math.sin(rad(clamp(lat, -MAX_LAT, MAX_LAT)))
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }
}

/** Pixel in the world image -> latitude/longitude (longitude wrapped to -180..180). */
export function unproject(x, y, zoom) {
  const s = worldSize(zoom)
  return { lat: deg(Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / s))), lng: wrapLng((x / s) * 360 - 180) }
}

// A view is { lat, lng, zoom, width, height }: the centre of a width x height viewport.
const origin = (v) => { const c = project(v.lat, v.lng, v.zoom); return { x: c.x - v.width / 2, y: c.y - v.height / 2 } }

/** Viewport pixel (px, py measured from its top-left corner) -> latitude/longitude. */
export function pointToLatLng(v, px, py) {
  const o = origin(v)
  const p = unproject(o.x + px, clamp(o.y + py, 0, worldSize(v.zoom)), v.zoom)
  return { lat: clamp(p.lat, -MAX_LAT, MAX_LAT), lng: p.lng }
}

/** Latitude/longitude -> viewport pixel, choosing the copy of the world closest to the centre. */
export function latLngToPoint(v, lat, lng) {
  const o = origin(v); const p = project(lat, lng, v.zoom); const s = worldSize(v.zoom)
  let x = p.x - o.x
  const centreX = v.width / 2
  if (x - centreX > s / 2) x -= s
  else if (x - centreX < -s / 2) x += s
  return { x, y: p.y - o.y }
}

/** Moves the view by a drag of (dx, dy) pixels. The latitude is kept inside the map. */
export function panBy(v, dx, dy) {
  const c = project(v.lat, v.lng, v.zoom)
  const p = unproject(c.x - dx, clamp(c.y - dy, 0, worldSize(v.zoom)), v.zoom)
  return { ...v, lat: clamp(p.lat, -MAX_LAT, MAX_LAT), lng: p.lng }
}

/** Changes the zoom while keeping the point under (px, py) fixed (wheel / pinch behaviour). Defaults to the centre. */
export function zoomTo(v, zoom, px = v.width / 2, py = v.height / 2) {
  const z = clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM)
  if (z === v.zoom) return v
  const anchor = pointToLatLng(v, px, py)
  const a = project(anchor.lat, anchor.lng, z)
  const centre = unproject(a.x - px + v.width / 2, clamp(a.y - py + v.height / 2, 0, worldSize(z)), z)
  return { ...v, zoom: z, lat: clamp(centre.lat, -MAX_LAT, MAX_LAT), lng: centre.lng }
}

/** The tiles that cover the viewport, each with its on-screen position. Tile x wraps around the world; y does not. */
export function visibleTiles(v) {
  const o = origin(v); const n = 2 ** v.zoom
  const x0 = Math.floor(o.x / TILE); const x1 = Math.floor((o.x + v.width) / TILE)
  const y0 = Math.max(0, Math.floor(o.y / TILE)); const y1 = Math.min(n - 1, Math.floor((o.y + v.height) / TILE))
  const tiles = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const wrapped = ((tx % n) + n) % n
      tiles.push({ key: `${v.zoom}/${tx}/${ty}`, url: tileUrl(v.zoom, wrapped, ty), left: Math.round(tx * TILE - o.x), top: Math.round(ty * TILE - o.y) })
    }
  }
  return tiles
}

export const roundCoord = (n) => Number(n).toFixed(5)

/** True when both values are real, in-range coordinates (accepts the strings the form keeps in state). */
export function isValidPin(lat, lng) {
  if (lat === '' || lng === '' || lat == null || lng == null) return false
  const la = Number(lat); const ln = Number(lng)
  return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180
}
