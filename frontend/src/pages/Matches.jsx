import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ScoreBar from '../components/ui/ScoreBar.jsx'
import { TypeBadge } from '../components/ui/Badge.jsx'
import Field from '../components/ui/Field.jsx'
import { Spinner, ErrorState, EmptyState } from '../components/ui/States.jsx'
import useAsync from '../hooks/useAsync.js'
import { getMatches, dismissMatch, requestContact } from '../services/itemsService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

function Side({ item, mine }) {
  const { t } = useI18n()
  return (
    <Link to={`/items/${item.id}`} className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
      <div className="flex items-center gap-2"><TypeBadge type={item.type} />{mine && <span className="text-xs text-slate-600">{t('Your report')}</span>}</div>
      <div className="mt-1 font-medium">{item.name}</div>
      <div className="text-xs text-slate-600">{item.location}, {item.city}</div>
      <div className="text-xs text-slate-600">{item.date}</div>
    </Link>
  )
}

function MatchCard({ m, myId, onDismiss, busy = false, canRequest = true }) {
  const { t } = useI18n()
  const lostMine = myId ? m.lost.userId === myId : false
  const foundMine = myId ? m.found.userId === myId : false
  const other = lostMine && !foundMine ? m.found : !lostMine && foundMine ? m.lost : m.found
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [state, setState] = useState({ sent: false, busy: false, problem: '' })

  async function send(e) {
    e.preventDefault()
    if (!canRequest || state.busy) return
    if (msg.trim().length < 10) { setErr(t('Write a short message (at least 10 characters).')); return }
    setErr(''); setState({ sent: false, busy: true, problem: '' })
    try { await requestContact(other.id, msg.trim(), m.id); setState({ sent: true, busy: false, problem: '' }) }
    catch (e2) { setState({ sent: false, busy: false, problem: e2.message }) }
  }

  return (
    <article className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><Side item={m.lost} mine={lostMine} /><Side item={m.found} mine={foundMine} /></div>
      <ScoreBar score={m.score} />
      <div>
        <h2 className="text-sm font-semibold">{t('Why this was suggested')}</h2>
        <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm text-slate-700">{m.reasons.map((r) => <li key={r}>{t(r)}</li>)}</ul>
      </div>
      {state.sent ? (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{t('Request sent. We’ll notify you when they respond.')}</p>
      ) : open ? (
        <form onSubmit={send} noValidate className="space-y-3">
          <Field label={t('Message to the other person')} id={`msg-${m.id}`} error={err}>
            <textarea id={`msg-${m.id}`} rows={3} maxLength={500} className="input" placeholder={t('Describe something only the owner would know')} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </Field>
          {state.problem && <p role="alert" className="text-sm text-red-700">{state.problem}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={state.busy} className="btn-primary">{state.busy ? t('Sending…') : t('Send request')}</button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{t('Cancel')}</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          {canRequest ? (
            <button type="button" className="btn-primary" onClick={() => setOpen(true)}>{t('Request contact')}</button>
          ) : (
            <span className="self-center text-sm text-red-700">{t('Your account is suspended. You can browse, but you can’t create reports or send requests.')}</span>
          )}
          <button type="button" className="btn-secondary" disabled={busy} onClick={onDismiss}>{t('Not a match')}</button>
        </div>
      )}
    </article>
  )
}

export default function Matches() {
  const { t } = useI18n()
  const { user, isSuspended } = useAuth()
  const { data, loading, error, reload } = useAsync(getMatches, [])
  const [matches, setMatches] = useState([])
  const [problem, setProblem] = useState('')
  const [dismissingId, setDismissingId] = useState('')

  useEffect(() => { if (data) setMatches(data) }, [data])

  async function dismiss(id) {
    if (dismissingId) return
    setProblem(''); setDismissingId(id)
    try { await dismissMatch(id); setMatches((xs) => xs.filter((x) => x.id !== id)) } catch (e) { setProblem(e.message) } finally { setDismissingId('') }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-10">
      <h1 className="text-2xl font-semibold">{t('Possible matches')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('Scores are similarity estimates, not proof that two items are the same.')}</p>
      {isSuspended && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t('Your account is suspended. You can browse, but you can’t create reports or send requests.')}</p>}
      {problem && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{problem}</p>}
      <div className="mt-6 space-y-4">
        {loading && <Spinner label={t('Loading matches')} />}
        {error && <ErrorState onRetry={reload} />}
        {!loading && !error && matches.length === 0 && (
          <EmptyState title={t('No matches right now')} text={t('We’ll notify you when a possible match appears.')} actionLabel={t('Browse found items')} to="/found" />
        )}
        {matches.map((m) => <MatchCard key={m.id} m={m} myId={user?.id} onDismiss={() => dismiss(m.id)} busy={dismissingId === m.id} canRequest={!isSuspended} />)}
      </div>
    </div>
  )
}
