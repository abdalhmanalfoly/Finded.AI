import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatTile from '../components/ui/StatTile.jsx'
import { TypeBadge, StatusBadge } from '../components/ui/Badge.jsx'
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx'
import useAsync from '../hooks/useAsync.js'
import { getDashboard, setItemStatus, deleteItem } from '../services/itemsService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function Dashboard() {
  const { t } = useI18n()
  const { configured } = useAuth()
  const { data, loading, error, reload } = useAsync(getDashboard, [])
  const [reports, setReports] = useState([])
  const [confirmId, setConfirmId] = useState(null)
  const [problem, setProblem] = useState('')
  const [busyId, setBusyId] = useState('')

  useEffect(() => { if (data) setReports(data.reports) }, [data])

  if (loading) return <Spinner label={t('Loading dashboard')} />
  if (error) return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorState onRetry={reload} /></div>

  const s = data.stats
  const counts = {
    lost: reports.filter((r) => r.type === 'lost').length,
    found: reports.filter((r) => r.type === 'found').length,
    active: reports.filter((r) => r.status === 'active').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
  }

  async function resolve(id) {
    if (busyId) return
    setProblem(''); setBusyId(id)
    try { await setItemStatus(id, 'resolved'); setReports((xs) => xs.map((r) => (r.id === id ? { ...r, status: 'resolved' } : r))) } catch (e) { setProblem(e.message) } finally { setBusyId('') }
  }
  async function remove(id) {
    if (busyId) return
    setProblem(''); setBusyId(id)
    try { await deleteItem(id); setReports((xs) => xs.filter((r) => r.id !== id)); setConfirmId(null) } catch (e) { setProblem(e.message) } finally { setBusyId('') }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('Your dashboard')}</h1>
      {!configured && <p className="mt-1 text-sm text-slate-600">{t('Sample data for preview.')}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label={t('Lost reports')} value={counts.lost} />
        <StatTile label={t('Found reports')} value={counts.found} />
        <StatTile label={t('Active')} value={counts.active} />
        <StatTile label={t('Potential matches')} value={s.matches} />
        <StatTile label={t('Resolved')} value={counts.resolved} />
      </div>

      {problem && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{problem}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('My reports')}</h2>
            <div className="flex gap-2">
              <Link to="/report/lost" className="btn-primary">{t('Report lost')}</Link>
              <Link to="/report/found" className="btn-secondary">{t('Report found')}</Link>
            </div>
          </div>
          {reports.length === 0 ? (
            <div className="mt-4"><EmptyState title={t('Start your first report')} text={t('Report something you lost or found.')} actionLabel={t('Report lost item')} to="/report/lost" /></div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200 rounded-card border border-slate-200">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <Link to={`/items/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    <div className="mt-1 flex gap-2"><TypeBadge type={r.type} /><StatusBadge status={r.status} /></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {configured && <Link to={`/items/${r.id}/edit`} className="btn-secondary">{t('Edit')}</Link>}
                    {r.status !== 'resolved' && <button type="button" className="btn-secondary" disabled={Boolean(busyId)} onClick={() => resolve(r.id)}>{t('Mark resolved')}</button>}
                    {confirmId === r.id ? (
                      <>
                        <button type="button" className="btn-danger" disabled={Boolean(busyId)} onClick={() => remove(r.id)}>{t('Confirm delete')}</button>
                        <button type="button" className="btn-secondary" disabled={Boolean(busyId)} onClick={() => setConfirmId(null)}>{t('Cancel')}</button>
                      </>
                    ) : (
                      <button type="button" className="btn-secondary" disabled={Boolean(busyId)} onClick={() => setConfirmId(r.id)}>{t('Delete')}</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">{t('Recent activity')}</h2>
          {data.activity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">{t('No activity yet.')}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.activity.map((a, i) => <li key={`${i}-${a}`} className="card text-sm">{a}</li>)}
            </ul>
          )}
          <p className="mt-4 text-sm"><Link to="/notifications" className="text-brand-700 hover:underline">{t('All notifications')}</Link></p>
        </section>
      </div>
    </div>
  )
}
