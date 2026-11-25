import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx'
import useAsync from '../hooks/useAsync.js'
import { listNotifications, markNotificationRead, markAllNotificationsRead, subscribeNotifications } from '../services/itemsService.js'
import { useI18n, currentLocale } from '../i18n/index.jsx'

const LINKS = { match: '/matches', contact_request: '/requests', contact_response: '/requests', message: '/requests' }

export default function Notifications() {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(listNotifications, [])
  const [items, setItems] = useState([])
  const [problem, setProblem] = useState('')
  const [busyId, setBusyId] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => { if (data) setItems(data) }, [data])
  useEffect(() => {
    let stop = () => {}; let alive = true
    subscribeNotifications(reload)
      .then((u) => { if (alive) stop = u; else u() })
      .catch(() => { if (alive) setProblem(t('Live updates are unavailable. Refresh this page to see new activity.')) })
    return () => { alive = false; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function read(id) {
    if (busyId || markingAll) return
    setBusyId(id)
    try { await markNotificationRead(id); setItems((xs) => xs.map((n) => (n.id === id ? { ...n, is_read: true } : n))) } catch (e) { setProblem(e.message) } finally { setBusyId('') }
  }
  async function readAll() {
    if (busyId || markingAll) return
    setMarkingAll(true)
    try { await markAllNotificationsRead(); setItems((xs) => xs.map((n) => ({ ...n, is_read: true }))) } catch (e) { setProblem(e.message) } finally { setMarkingAll(false) }
  }

  const unread = items.filter((n) => !n.is_read).length

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('Notifications')} {unread > 0 && <span className="text-base text-slate-600">({t('{count} unread', { count: unread })})</span>}</h1>
        {unread > 0 && <button type="button" className="btn-secondary" disabled={busyId !== '' || markingAll} onClick={readAll}>{t('Mark all as read')}</button>}
      </div>
      {problem && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{problem}</p>}
      <div className="mt-6">
        {loading && !data && <Spinner label={t('Loading notifications')} />}
        {error && <ErrorState onRetry={reload} />}
        {!loading && !error && items.length === 0 && <EmptyState title={t('You’re all caught up')} text={t('We’ll tell you when a match or contact request arrives.')} actionLabel={t('Browse found items')} to="/found" />}
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className={`card flex items-start justify-between gap-3 ${n.is_read ? '' : 'border-brand-500 bg-brand-50'}`}>
              <div>
                <div className="font-medium">{t(n.title)}</div>
                <p className="text-sm text-slate-700">{t(n.body)}</p>
                <div className="mt-1 text-xs text-slate-600">{new Date(n.created_at).toLocaleString(currentLocale())}</div>
                {LINKS[n.type] && <Link to={LINKS[n.type]} onClick={() => !n.is_read && read(n.id)} className="mt-1 inline-block text-sm text-brand-700 hover:underline">{t('View')}</Link>}
              </div>
              {!n.is_read && <button type="button" className="btn-secondary shrink-0" disabled={busyId !== '' || markingAll} onClick={() => read(n.id)}>{t('Mark read')}</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
