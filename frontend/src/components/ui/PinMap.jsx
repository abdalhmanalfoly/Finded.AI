import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import {
  DEFAULT_VIEW, MAX_ZOOM, MIN_ZOOM, isValidPin, latLngToPoint, panBy, pointToLatLng, roundCoord, visibleTiles, zoomTo,
} from '../../lib/mapTiles.js'

const DRAG_THRESHOLD = 5 // pixels: below this a press is a click (drops the pin), above it the map is being dragged
const KEY_PAN = 80
const PIN_ZOOM = 15

// Click-to-pin map with no map library and no API key: OpenStreetMap tiles as <img>, drag to pan, wheel / buttons /
// keys to zoom. A click or tap drops the pin; the keyboard does the same with Enter at the centre crosshair.
export default function PinMap({ lat, lng, onPick, className = 'h-64' }) {
  const { t } = useI18n()
  const boxRef = useRef(null)
  const drag = useRef(null)
  const lastPicked = useRef('')
  const pinned = isValidPin(lat, lng)
  const [size, setSize] = useState({ width: 640, height: 256 })
  const [view, setView] = useState(() => (pinned ? { lat: Number(lat), lng: Number(lng), zoom: PIN_ZOOM } : DEFAULT_VIEW))
  const [tileFailed, setTileFailed] = useState(false)
  const full = useMemo(() => ({ ...view, ...size }), [view, size])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    // clientWidth/Height = the area children are positioned in (inside the border)
    const measure = () => { if (el.clientWidth > 0 && el.clientHeight > 0) setSize({ width: el.clientWidth, height: el.clientHeight }) }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The pin changed from outside (device location, typed coordinates): bring it into view. Clicks on the map itself
  // are skipped so the map does not jump under the user's finger.
  useEffect(() => {
    if (!pinned) return
    const key = `${roundCoord(lat)},${roundCoord(lng)}`
    if (key === lastPicked.current) return
    setView((v) => ({ lat: Number(lat), lng: Number(lng), zoom: Math.max(v.zoom, PIN_ZOOM) }))
  }, [lat, lng, pinned])

  // The wheel listener must be non-passive to stop the page from scrolling while the pointer is over the map.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setView((v) => zoomTo({ ...v, ...size }, v.zoom + (e.deltaY < 0 ? 1 : -1), e.clientX - r.left - el.clientLeft, e.clientY - r.top - el.clientTop))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [size])

  const pick = (point) => {
    const la = roundCoord(point.lat); const ln = roundCoord(point.lng)
    lastPicked.current = `${la},${ln}`
    onPick({ lat: la, lng: ln })
  }

  // pointer position relative to the area tiles and the pin are positioned in (inside the 1px border)
  const local = (e) => { const el = boxRef.current; const r = el.getBoundingClientRect(); return { x: e.clientX - r.left - el.clientLeft, y: e.clientY - r.top - el.clientTop } }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return
    if (e.target.closest('button, a')) return
    boxRef.current.setPointerCapture?.(e.pointerId)
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return
    d.moved = true
    const dx = e.clientX - d.lastX; const dy = e.clientY - d.lastY
    d.lastX = e.clientX; d.lastY = e.clientY
    setView((v) => panBy({ ...v, ...size }, dx, dy))
  }
  function onPointerUp(e) {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId || d.moved) return
    const p = local(e)
    pick(pointToLatLng(full, p.x, p.y))
  }

  function onKeyDown(e) {
    const step = { ArrowLeft: [KEY_PAN, 0], ArrowRight: [-KEY_PAN, 0], ArrowUp: [0, KEY_PAN], ArrowDown: [0, -KEY_PAN] }[e.key]
    if (step) { e.preventDefault(); setView((v) => panBy({ ...v, ...size }, step[0], step[1])) }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setView((v) => zoomTo({ ...v, ...size }, v.zoom + 1)) }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); setView((v) => zoomTo({ ...v, ...size }, v.zoom - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick({ lat: view.lat, lng: view.lng }) }
  }

  const zoom = (delta) => setView((v) => zoomTo({ ...v, ...size }, v.zoom + delta))
  const pin = pinned ? latLngToPoint(full, Number(lat), Number(lng)) : null
  const tiles = visibleTiles(full)

  return (
    <div>
      <div
        ref={boxRef} dir="ltr" tabIndex={0} role="application" data-testid="pin-map"
        aria-label={t('Interactive map. Click or tap to drop the pin. Keyboard: arrow keys move the map, plus and minus zoom, Enter drops the pin at the cross in the centre.')}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null }}
        onKeyDown={onKeyDown}
        className={`relative w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-slate-200 bg-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${className}`}
        style={{ touchAction: 'none' }}
      >
        {tiles.map((tile) => (
          <img key={tile.key} src={tile.url} alt="" width={256} height={256} draggable={false} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; setTileFailed(true) }}
            className="pointer-events-none absolute max-w-none" style={{ left: tile.left, top: tile.top }} />
        ))}
        {/* crosshair marks the keyboard target (map centre) */}
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 opacity-60">
          <span className="absolute left-1/2 top-0 h-full w-px bg-slate-700" /><span className="absolute left-0 top-1/2 h-px w-full bg-slate-700" />
        </span>
        {pin && (
          <svg aria-hidden="true" data-testid="pin-marker" viewBox="0 0 24 32" width="28" height="36" className="pointer-events-none absolute drop-shadow"
            style={{ left: pin.x, top: pin.y, transform: 'translate(-50%, -100%)' }}>
            <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.6 12 32 12 32s12-11.4 12-20.3C24 5.2 18.6 0 12 0z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" />
            <circle cx="12" cy="11.5" r="4.5" fill="#fff" />
          </svg>
        )}
        <div className="absolute end-2 top-2 flex flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow">
          <button type="button" aria-label={t('Zoom in')} disabled={view.zoom >= MAX_ZOOM} onClick={() => zoom(1)} className="h-8 w-8 text-lg leading-none hover:bg-slate-100 disabled:opacity-40">+</button>
          <button type="button" aria-label={t('Zoom out')} disabled={view.zoom <= MIN_ZOOM} onClick={() => zoom(-1)} className="h-8 w-8 border-t border-slate-300 text-lg leading-none hover:bg-slate-100 disabled:opacity-40">−</button>
        </div>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
          className="absolute bottom-0 end-0 bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700 hover:underline">© OpenStreetMap contributors</a>
      </div>
      <p className="mt-1 text-xs text-slate-600">{t('Click or tap the map to drop the pin. Drag to move the map.')}</p>
      {tileFailed && <p role="status" className="mt-1 text-xs text-amber-800">{t('Some map tiles could not be loaded. You can still use your current location or type the coordinates.')}</p>}
      <p role="status" className="sr-only">{pinned ? t('Pin set at {lat}, {lng}', { lat: roundCoord(lat), lng: roundCoord(lng) }) : t('No pin set')}</p>
    </div>
  )
}
