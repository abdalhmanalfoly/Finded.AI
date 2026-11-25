
import { useI18n } from '../../i18n/index.jsx'

export default function Pagination({ page, total, pageSize, onChange }) {
  const { t } = useI18n()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label={t('Pagination')}>
      <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>{t('Previous')}</button>
      <span className="text-sm text-slate-600">{t('Page {page} of {pages}', { page, pages })}</span>
      <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>{t('Next')}</button>
    </nav>
  )
}
