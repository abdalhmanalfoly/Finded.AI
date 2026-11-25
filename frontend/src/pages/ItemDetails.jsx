import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { TypeBadge, StatusBadge } from '../components/ui/Badge.jsx'
import { Spinner, ErrorState } from '../components/ui/States.jsx'
import Field from '../components/ui/Field.jsx'
import MapEmbed from '../components/ui/MapEmbed.jsx'
import useAsync from '../hooks/useAsync.js'
import { getItem, requestContact, createFlag, setItemStatus, deleteItem } from '../services/itemsService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

const FLAG_REASONS = ['Suspicious or fake listing', 'Contains private information', 'Spam', 'Inappropriate content', 'Other']

export default function ItemDetails() {
  const { t } = useI18n()
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { configured, user, isSuspended } = useAuth()
  const { data: item, loading, error, reload } = useAsync(() => getItem(id), [id])
  const [msg, setMsg] = useState('')
  const [msgError, setMsgError] = useState('')
  const [contactState, setContactState] = useState({ sent: false, problem: '', busy: false })
  const [flagOpen, setFlagOpen] = useState(false)
  const [reason, setReason] = useState(FLAG_REASONS[0])
  const [flagState, setFlagState] = useState({ done: false, busy: false, problem: '' })
  const [ownerBusy, setOwnerBusy] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [ownerProblem, setOwnerProblem] = useState('')
  const [photo, setPhoto] = useState(0)

  if (loading) return <Spinner label={t('Loading item')} />
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorState title={t('Item not found')} text={t('This item may have been removed or the link is wrong.')} onRetry={reload} />
        <p className="mt-4 text-center text-sm"><Link className="text-brand-700 hover:underline" to="/lost">{t('Browse lost items')}</Link></p>
      </div>
    )
  }

  const canAct = !configured || (Boolean(user) && !isSuspended)
  const images = item.images || []

  async function sendRequest(e) {
    e.preventDefault()
    if (contactState.busy) return
    if (msg.trim().length < 10) { setMsgError(t('Write a short message (at least 10 characters).')); return }
    setMsgError(''); setContactState({ sent: false, problem: '', busy: true })
    try { await requestContact(item.id, msg.trim()); setContactState({ sent: true, problem: '', busy: false }) }
    catch (err) { setContactState({ sent: false, problem: err.message, busy: false }) }
  }

  async function sendFlag() {
    if (flagState.busy) return
    setFlagState({ done: false, busy: true, problem: '' })
    try { await createFlag({ itemId: item.id, reason, details: '' }); setFlagState({ done: true, busy: false, problem: '' }) }
    catch (err) { setFlagState({ done: false, busy: false, problem: err.message }) }
  }

  async function ownerAction(kind, action) {
    if (ownerBusy) return
    setOwnerProblem(''); setOwnerBusy(kind)
    try { await action(); reload() } catch (err) { setOwnerProblem(err.message) } finally { setOwnerBusy('') }
  }

  async function remove() {
    if (ownerBusy) return
    setOwnerProblem(''); setOwnerBusy('delete')
    try { await deleteItem(item.id); navigate('/dashboard') } catch (err) { setOwnerProblem(err.message) } finally { setOwnerBusy('') }
  }

  const rows = [
    [t('Category'), t(item.category)], [t('Color'), t(item.color)], [t('Brand'), item.brand || t('Not specified')],
    [item.type === 'lost' ? t('Last known area') : t('Found at'), `${item.location}, ${item.city}`],
    [item.type === 'lost' ? t('Date lost') : t('Date found'), `${item.date}${item.time ? ` (${t(item.time)})` : ''}`],
  ]

  return (
    <div className="mx-auto max-w-content px-4 py-10">
      <Link to={item.type === 'lost' ? '/lost' : '/found'} className="text-sm text-brand-700 hover:underline">{item.type === 'lost' ? t('← Back to lost items') : t('← Back to found items')}</Link>
      {location.state?.notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{location.state.notice}</p>}
      {configured && isSuspended && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t('Your account is suspended. You can browse, but you can’t create reports or send requests.')}</p>
      )}

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          {images.length > 0 ? (
            <>
              <img src={images[photo]?.url} alt={t('Photo {n} of {name}', { n: photo + 1, name: item.name })} className="h-64 w-full rounded-card object-cover sm:h-80" />
              {images.length > 1 && (
                <div className="mt-2 flex gap-2">
                  {images.map((img, i) => (
                    <button key={img.id} type="button" onClick={() => setPhoto(i)} aria-label={t('Show photo {n}', { n: i + 1 })} className={`overflow-hidden rounded-lg border-2 ${i === photo ? 'border-brand-500' : 'border-transparent'}`}>
                      <img src={img.url} alt="" className="h-14 w-14 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-card bg-brand-50 text-brand-700">{t('No photo')}</div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{item.name}</h1>
            <TypeBadge type={item.type} /><StatusBadge status={item.status} />
          </div>
          <p className="mt-3 whitespace-pre-line text-slate-700">{item.description}</p>
          <dl className="mt-6 divide-y divide-slate-200 rounded-card border border-slate-200">
            {rows.map(([k, val]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <dt className="text-slate-600">{k}</dt><dd className="text-end font-medium">{val}</dd>
              </div>
            ))}
          </dl>
          {item.lat != null && item.lng != null && (
            <section className="mt-6" aria-label={t('Map (approximate area)')}>
              <h2 className="mb-2 text-sm font-semibold">{t('Map (approximate area)')}</h2>
              <MapEmbed lat={item.lat} lng={item.lng} />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {item.isOwner ? (
            <div className="card space-y-3">
              <h2 className="font-semibold">{t('Manage your report')}</h2>
              {item.extra && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="font-medium">{t('Private details (only you see this):')}</span> {item.extra}</p>}
              <div className="flex flex-wrap gap-2">
                <Link to={`/items/${item.id}/edit`} className="btn-primary">{t('Edit')}</Link>
                {item.status !== 'resolved' && item.status !== 'closed' && <button type="button" className="btn-secondary" disabled={Boolean(ownerBusy)} onClick={() => ownerAction('resolve', () => setItemStatus(item.id, 'resolved'))}>{t('Mark resolved')}</button>}
                {(item.status === 'closed' || item.status === 'resolved') && <button type="button" className="btn-secondary" disabled={Boolean(ownerBusy)} onClick={() => ownerAction('reopen', () => setItemStatus(item.id, 'active'))}>{t('Reopen')}</button>}
                {confirmDelete ? (
                  <>
                    <button type="button" className="btn-danger" disabled={Boolean(ownerBusy)} onClick={remove}>{t('Confirm delete')}</button>
                    <button type="button" className="btn-secondary" disabled={Boolean(ownerBusy)} onClick={() => setConfirmDelete(false)}>{t('Cancel')}</button>
                  </>
                ) : <button type="button" className="btn-secondary" disabled={Boolean(ownerBusy)} onClick={() => setConfirmDelete(true)}>{t('Delete')}</button>}
              </div>
              {ownerProblem && <p role="alert" className="text-sm text-red-700">{ownerProblem}</p>}
            </div>
          ) : (
            <div className="card">
              <h2 className="font-semibold">{item.type === 'lost' ? t('Did you find this?') : t('Is this yours?')}</h2>
              <p className="mt-1 text-sm text-slate-600">{t('Your contact details stay private until the owner accepts your request.')}</p>
              {!canAct ? (
                configured && user && isSuspended ? (
                  <p role="alert" className="mt-3 text-sm text-red-700">{t('Your account is suspended. You can browse, but you can’t create reports or send requests.')}</p>
                ) : (
                  <p className="mt-3 text-sm"><Link className="text-brand-700 hover:underline" to="/login" state={{ from: `/items/${item.id}` }}>{t('Log in')}</Link> {t('to send a request.')}</p>
                )
              ) : contactState.sent ? (
                <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{t('Request sent. We’ll notify you when they respond.')}</p>
              ) : (
                <form onSubmit={sendRequest} noValidate className="mt-3 space-y-3">
                  <Field label={t('Message')} id="msg" error={msgError}>
                    <textarea id="msg" rows={3} maxLength={500} className="input" placeholder={t('Describe something only the owner would know')} value={msg} onChange={(e) => setMsg(e.target.value)} />
                  </Field>
                  {contactState.problem && <p role="alert" className="text-sm text-red-700">{contactState.problem}</p>}
                  <button type="submit" disabled={contactState.busy} className="btn-primary w-full">{contactState.busy ? t('Sending…') : t('Request contact')}</button>
                </form>
              )}
            </div>
          )}

          <div className="card text-sm">
            <h2 className="font-semibold">{t('Stay safe')}</h2>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-600">
              <li>{t('Meet in a public place.')}</li>
              <li>{t('Don’t share ID numbers or passwords.')}</li>
              <li>{t('Ask for proof of ownership.')}</li>
            </ul>
            {!item.isOwner && canAct && (
              flagState.done ? (
                <p role="status" className="mt-3 text-green-800">{t('Thanks. Our team will review this listing.')}</p>
              ) : flagOpen ? (
                <div className="mt-3 space-y-2">
                  <label htmlFor="flag-reason" className="block text-sm font-medium">{t('Reason')}</label>
                  <select id="flag-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {FLAG_REASONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                  </select>
                  {flagState.problem && <p role="alert" className="text-red-700">{flagState.problem}</p>}
                  <div className="flex gap-2">
                    <button type="button" className="btn-danger" disabled={flagState.busy} onClick={sendFlag}>{flagState.busy ? t('Sending…') : t('Report listing')}</button>
                    <button type="button" className="btn-secondary" onClick={() => setFlagOpen(false)}>{t('Cancel')}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="mt-3 text-brand-700 hover:underline" onClick={() => setFlagOpen(true)}>{t('Report this listing')}</button>
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
