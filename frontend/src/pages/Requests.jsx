import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx'
import useAsync from '../hooks/useAsync.js'
import { listRequests, respondRequest, cancelRequest, listMessages, subscribeMessages, sendMessage } from '../services/itemsService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n, currentLocale } from '../i18n/index.jsx'

function Thread({ requestId, canSend }) {
  const { t } = useI18n()
  const { data, loading, error, reload } = useAsync(() => listMessages(requestId), [requestId])
  const [body, setBody] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stop = () => {}; let alive = true
    subscribeMessages(requestId, reload)
      .then((u) => { if (alive) stop = u; else u() })
      .catch(() => { if (alive) setProblem(t('Live updates are unavailable. Refresh this page to see new activity.')) })
    return () => { alive = false; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  async function send(e) {
    e.preventDefault()
    if (!canSend) return
    if (busy) return
    if (!body.trim()) { setProblem(t('Write a message first.')); return }
    setBusy(true); setProblem('')
    try { await sendMessage(requestId, body); setBody(''); reload() } catch (err) { setProblem(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      <p className="mb-2 text-xs text-slate-600">{t('Share contact details only if you feel comfortable. Never share ID numbers or passwords.')}</p>
      {loading && !data && <Spinner label={t('Loading messages')} />}
      {error && <ErrorState onRetry={reload} />}
      <ul className="space-y-2">
        {(data || []).map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.mine ? 'ms-auto bg-brand-600 text-white' : 'bg-white border border-slate-200'}`}>{m.body}</li>
        ))}
      </ul>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <label htmlFor={`msg-${requestId}`} className="sr-only">{t('Message')}</label>
        <input id={`msg-${requestId}`} className="input" maxLength={1000} placeholder={t('Write a message')} value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="submit" disabled={busy || !canSend} className="btn-primary">{t('Send')}</button>
      </form>
      {problem && <p role="alert" className="mt-2 text-xs text-red-700">{problem}</p>}
    </div>
  )
}

export default function Requests() {
  const { t } = useI18n()
  const { isSuspended } = useAuth()
  const { data, loading, error, reload } = useAsync(listRequests, [])
  const [problem, setProblem] = useState('')
  const [open, setOpen] = useState(null)
  const [busyId, setBusyId] = useState('')

  async function act(id, fn) {
    if (busyId) return
    setProblem(''); setBusyId(id)
    try { await fn(); reload() } catch (e) { setProblem(e.message) } finally { setBusyId('') }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('Contact requests')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('Your contact details stay private until you choose to share them in a chat.')}</p>
      {isSuspended && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t('Your account is suspended. You can browse, but you can’t create reports or send requests.')}</p>}
      {problem && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{problem}</p>}
      <div className="mt-6 space-y-4">
        {loading && <Spinner label={t('Loading requests')} />}
        {error && <ErrorState onRetry={reload} />}
        {!loading && !error && data?.length === 0 && <EmptyState title={t('No contact requests yet')} text={t('When you request contact about a match, or someone asks about your report, it shows here.')} actionLabel={t('See matches')} to="/matches" />}
        {(data || []).map((r) => (
          <article key={r.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{r.direction === 'incoming' ? t('{name} asked about', { name: r.otherName }) : t('You asked {name} about', { name: r.otherName })} <Link to={`/items/${r.itemId}`} className="text-brand-700 hover:underline">{r.itemName}</Link></div>
                <div className="text-xs text-slate-600">{new Date(r.createdAt).toLocaleString(currentLocale())}</div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize">{t(r.status.charAt(0).toUpperCase() + r.status.slice(1))}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">“{r.message}”</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === 'pending' && r.direction === 'incoming' && (
                <>
                  <button type="button" className="btn-primary" disabled={busyId === r.id} onClick={() => act(r.id, () => respondRequest(r.id, true))}>{t('Accept')}</button>
                  <button type="button" className="btn-secondary" disabled={busyId === r.id} onClick={() => act(r.id, () => respondRequest(r.id, false))}>{t('Decline')}</button>
                </>
              )}
              {r.status === 'pending' && r.direction === 'outgoing' && <button type="button" className="btn-secondary" disabled={busyId === r.id} onClick={() => act(r.id, () => cancelRequest(r.id))}>{t('Cancel request')}</button>}
              {r.status === 'accepted' && <button type="button" className="btn-secondary" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? t('Hide chat') : t('Open chat')}</button>}
            </div>
            {r.status === 'accepted' && open === r.id && <Thread requestId={r.id} canSend={!isSuspended} />}
          </article>
        ))}
      </div>
    </div>
  )
}
