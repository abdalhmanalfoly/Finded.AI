import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StatTile from '../components/ui/StatTile.jsx'
import { TypeBadge, StatusBadge } from '../components/ui/Badge.jsx'
import { Spinner, ErrorState } from '../components/ui/States.jsx'
import useAsync from '../hooks/useAsync.js'
import { getAdminData, adminSetHidden, adminSuspend, adminResolveFlag, listAdminActions, closeStaleItems, listAdminPage } from '../services/itemsService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n, currentLocale } from '../i18n/index.jsx'

const TABS = ['Reports', 'Flagged', 'Users', 'Audit log']

function AdminPanel({ initial, configured }) {
  const { t } = useI18n()
  const [tab, setTab] = useState('Reports')
  const [reports, setReports] = useState(initial.reports)
  const [flags, setFlags] = useState(initial.flags)
  const [users, setUsers] = useState(initial.users)
  const [problem, setProblem] = useState('')
  const [notice, setNotice] = useState('')
  const [actions, setActions] = useState(null)
  const [closedFlags, setClosedFlags] = useState(0)
  const [loadingMore, setLoadingMore] = useState('')
  const [busy, setBusy] = useState(false)
  const lists = { reports: [reports, setReports], flags: [flags, setFlags], users: [users, setUsers] }
  const totals = initial.totals || { reports: reports.length, flags: flags.length, users: users.length }
  const openFlags = Math.max(0, initial.stats.openFlags - closedFlags)

  async function loadMore(kind) {
    if (loadingMore || busy) return
    const [list, setList] = lists[kind]
    setProblem(''); setLoadingMore(kind)
    try {
      const rows = await listAdminPage(kind, list.length)
      setList((xs) => [...xs, ...rows.filter((r) => !xs.some((x) => x.id === r.id))])
    } catch (e) { setProblem(e.message) } finally { setLoadingMore('') }
  }
  const moreButton = (kind) => (lists[kind][0].length < totals[kind] ? (
    <div className="mt-4 text-center">
      <button type="button" className="btn-secondary" disabled={loadingMore === kind || busy} onClick={() => loadMore(kind)}>{t('Load more')}</button>
    </div>
  ) : null)

  useEffect(() => {
    if (tab !== 'Audit log' || actions !== null) return
    listAdminActions(100).then(setActions).catch((e) => { setProblem(e.message); setActions([]) })
  }, [tab, actions])

  async function closeStale() {
    if (busy || loadingMore) return
    setProblem(''); setNotice(''); setBusy(true)
    try {
      const n = await closeStaleItems(90)
      setNotice(t('{count} report(s) with no activity for 90 days were closed.', { count: n }))
      setActions(null)
    } catch (e) { setProblem(e.message) } finally { setBusy(false) }
  }

  async function run(fn, apply) {
    if (busy || loadingMore) return
    setProblem(''); setBusy(true)
    try { await fn(); apply() } catch (e) { setProblem(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('Admin dashboard')}</h1>
      {!configured && <p className="mt-1 text-sm text-amber-900">{t('Preview only. In preview mode admin access control and saving are turned off.')}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label={t('Users')} value={initial.stats.users} />
        <StatTile label={t('Reports')} value={initial.stats.reports} />
        <StatTile label={t('Matches')} value={initial.stats.matches} />
        <StatTile label={t('Open flags')} value={openFlags} />
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {problem && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{problem}</p>}

      <div role="tablist" className="mt-8 flex gap-2 border-b border-slate-200">
        {TABS.map((name) => (
          <button key={name} role="tab" type="button" aria-selected={tab === name} onClick={() => setTab(name)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === name ? 'border-brand-500 text-ink-900' : 'border-transparent text-slate-600'}`}>{t(name)}</button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        {tab === 'Reports' && (
          <table className="w-full text-sm">
            <thead className="text-slate-600"><tr><th className="p-2 text-start">{t('Item')}</th><th className="p-2 text-start">{t('Type')}</th><th className="p-2 text-start">{t('Status')}</th><th className="p-2 text-start">{t('Action')}</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="p-2"><Link className="hover:underline" to={`/items/${r.id}`}>{r.name}</Link>{r.hidden && <span className="ms-2 text-xs text-red-700">{t('hidden')}</span>}</td>
                  <td className="p-2"><TypeBadge type={r.type} /></td>
                  <td className="p-2"><StatusBadge status={r.status} /></td>
                  <td className="p-2">
                    <button type="button" className="btn-secondary" disabled={busy || Boolean(loadingMore)} onClick={() => run(() => adminSetHidden(r.id, !r.hidden), () => setReports((xs) => xs.map((x) => (x.id === r.id ? { ...x, hidden: !x.hidden } : x))))}>
                      {r.hidden ? t('Unhide') : t('Hide')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'Reports' && moreButton('reports')}

        {tab === 'Flagged' && (
          flags.length === 0 ? <p className="p-4 text-sm text-slate-600">{t('No flagged reports.')}</p> : (
            <ul className="space-y-3">
              {flags.map((f) => (
                <li key={f.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t(f.reason)} <StatusBadge status={f.status} /></div>
                    {f.details && <p className="text-sm text-slate-600">{f.details}</p>}
                    {f.itemId && <Link to={`/items/${f.itemId}`} className="text-sm text-brand-700 hover:underline">{t('View report')}</Link>}
                  </div>
                  {f.status !== 'resolved' && f.status !== 'dismissed' && (
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary" disabled={busy || Boolean(loadingMore)} onClick={() => run(() => adminResolveFlag(f.id, 'resolved'), () => { setClosedFlags((n) => n + 1); setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, status: 'resolved' } : x))) })}>{t('Resolve')}</button>
                      <button type="button" className="btn-secondary" disabled={busy || Boolean(loadingMore)} onClick={() => run(() => adminResolveFlag(f.id, 'dismissed'), () => { setClosedFlags((n) => n + 1); setFlags((xs) => xs.map((x) => (x.id === f.id ? { ...x, status: 'dismissed' } : x))) })}>{t('Dismiss')}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
        {tab === 'Flagged' && moreButton('flags')}

        {tab === 'Audit log' && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">{t('Every admin action is recorded here (newest first).')}</p>
              <button type="button" className="btn-secondary" disabled={!configured || busy} onClick={closeStale}>{t('Close reports idle for 90+ days')}</button>
            </div>
            {actions === null ? <Spinner label={t('Loading audit log')} /> : actions.length === 0 ? (
              <p className="p-4 text-sm text-slate-600">{t('No admin actions recorded yet.')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-slate-600"><tr><th className="p-2 text-start">{t('When')}</th><th className="p-2 text-start">{t('Admin')}</th><th className="p-2 text-start">{t('Action')}</th><th className="p-2 text-start">{t('Target')}</th><th className="p-2 text-start">{t('Note')}</th></tr></thead>
                <tbody>
                  {actions.map((x) => (
                    <tr key={x.id} className="border-t border-slate-200">
                      <td className="p-2 whitespace-nowrap">{new Date(x.createdAt).toLocaleString(currentLocale())}</td>
                      <td className="p-2">{x.admin}</td>
                      <td className="p-2">{t(x.action.replaceAll('_', ' '))}</td>
                      <td className="p-2">{t(x.targetType)}{x.targetId ? ` ${x.targetId.slice(0, 8)}` : ''}</td>
                      <td className="p-2">{x.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'Users' && (
          <table className="w-full text-sm">
            <thead className="text-slate-600"><tr><th className="p-2 text-start">{t('Name')}</th><th className="p-2 text-start">{t('Role')}</th><th className="p-2 text-start">{t('State')}</th><th className="p-2 text-start">{t('Action')}</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-200">
                  <td className="p-2">{u.name}</td><td className="p-2 capitalize">{u.role}</td>
                  <td className="p-2">{u.suspended ? t('Suspended') : t('Active')}</td>
                  <td className="p-2">
                    {u.role !== 'admin' && (
                      <button type="button" className="btn-secondary" disabled={busy || Boolean(loadingMore)} onClick={() => run(() => adminSuspend(u.id, !u.suspended), () => setUsers((xs) => xs.map((x) => (x.id === u.id ? { ...x, suspended: !x.suspended } : x))))}>
                        {u.suspended ? t('Restore') : t('Suspend')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'Users' && moreButton('users')}
      </div>
    </div>
  )
}

export default function Admin() {
  const { t } = useI18n()
  const { configured } = useAuth()
  const { data, loading, error, reload } = useAsync(getAdminData, [])
  if (loading) return <Spinner label={t('Loading admin data')} />
  if (error) return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorState onRetry={reload} /></div>
  return <AdminPanel initial={data} configured={configured} />
}
