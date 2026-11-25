import { useI18n } from '../../i18n/index.jsx'

// OpenStreetMap embed: no API key and no extra JavaScript library. Allowed by the CSP `frame-src` in vercel.json.
function mapUrls(lat, lng, delta = 0.008) {
  const la = Number(lat); const ln = Number(lng)
  const bbox = [ln - delta * 1.4, la - delta, ln + delta * 1.4, la + delta].map((x) => x.toFixed(5)).join(',')
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${la.toFixed(5)},${ln.toFixed(5)}`,
    full: `https://www.openstreetmap.org/?mlat=${la.toFixed(5)}&mlon=${ln.toFixed(5)}#map=16/${la.toFixed(5)}/${ln.toFixed(5)}`,
  }
}

export default function MapEmbed({ lat, lng, className = 'h-56' }) {
  const { t } = useI18n()
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || lat === null || lng === null) return null
  const { embed, full } = mapUrls(lat, lng)
  return (
    <div>
      <iframe title={t('Map showing the approximate location')} src={embed} loading="lazy" referrerPolicy="no-referrer"
        className={`w-full rounded-lg border border-slate-200 ${className}`} />
      <a href={full} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-brand-700 hover:underline">{t('View larger map')}</a>
    </div>
  )
}
