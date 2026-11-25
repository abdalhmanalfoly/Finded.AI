
import { useI18n } from '../../i18n/index.jsx'
const STATUS_STYLES = {
  active: 'bg-brand-50 text-brand-700',
  matched: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-slate-200 text-slate-700',
  open: 'bg-red-100 text-red-800',
  in_review: 'bg-amber-100 text-amber-800',
  dismissed: 'bg-slate-200 text-slate-700',
}

export function TypeBadge({ type }) {
  const { t } = useI18n()
  const lost = type === 'lost'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${lost ? 'bg-lost-bg text-lost-text' : 'bg-found-bg text-found-text'}`}>
      {lost ? t('Lost') : t('Found')}
    </span>
  )
}

export function StatusBadge({ status }) {
  const { t } = useI18n()
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.closed}`}>
      {t(status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '))}
    </span>
  )
}
