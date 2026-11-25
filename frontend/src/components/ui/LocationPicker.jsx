import { useState } from 'react'
import PinMap from './PinMap.jsx'
import { isValidPin } from '../../lib/mapTiles.js'
import { useI18n } from '../../i18n/index.jsx'

// Optional map location: click or tap the map to drop a pin, use the device position, or type coordinates.
export default function LocationPicker({ lat, lng, onChange, error }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const has = lat !== '' && lat != null && lng !== '' && lng != null

  function locate() {
    setProblem('')
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setProblem(t('Location is not available in this browser.')); return }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); onChange({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) }) },
      () => { setBusy(false); setProblem(t('Could not get your location. Check the browser permission.')) },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium">{t('Pin the location on the map (optional)')}</legend>
      <p className="text-xs text-slate-600">{t('Others only see an approximate spot (about 100 m).')}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <button type="button" className="btn-secondary" onClick={locate} disabled={busy}>{busy ? t('Locating…') : t('Use my current location')}</button>
        <label className="text-xs">{t('Latitude')}
          <input id="lat" className="input mt-1 w-32" inputMode="decimal" value={lat ?? ''} onChange={(e) => onChange({ lat: e.target.value, lng })} />
        </label>
        <label className="text-xs">{t('Longitude')}
          <input id="lng" className="input mt-1 w-32" inputMode="decimal" value={lng ?? ''} onChange={(e) => onChange({ lat, lng: e.target.value })} />
        </label>
        <button type="button" className="btn-secondary" disabled={!has} onClick={() => onChange({ lat: '', lng: '' })}>{t('Remove location')}</button>
      </div>
      {(problem || error) && <p role="alert" className="mt-2 text-sm text-red-700">{problem || error}</p>}
      <div className="mt-3">
        <PinMap lat={isValidPin(lat, lng) ? lat : ''} lng={isValidPin(lat, lng) ? lng : ''} onPick={onChange} className="h-64" />
      </div>
    </fieldset>
  )
}
