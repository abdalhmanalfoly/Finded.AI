import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

export function Spinner({ label }) {
  const { t } = useI18n()
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-slate-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <span className="text-sm">{label || t('Loading')}…</span>
    </div>
  )
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse space-y-3">
          <div className="h-28 rounded-lg bg-slate-200" />
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, text, actionLabel, to, onAction }) {
  return (
    <div className="rounded-card border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{text}</p>
      {actionLabel && to && <Link to={to} className="btn-primary mt-4">{actionLabel}</Link>}
      {actionLabel && onAction && <button type="button" onClick={onAction} className="btn-primary mt-4">{actionLabel}</button>}
    </div>
  )
}

export function ErrorState({ title, text, onRetry }) {
  const { t } = useI18n()
  return (
    <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-red-800">{title || t('Something went wrong')}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-red-800">{text || t('We couldn’t load this. Check your connection and try again.')}</p>
      {onRetry && <button type="button" onClick={onRetry} className="btn-secondary mt-4">{t('Try again')}</button>}
    </div>
  )
}
