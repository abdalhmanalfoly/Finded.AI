import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../components/ui/Field.jsx'
import { ErrorState, Spinner } from '../components/ui/States.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { updateProfile, exportMyData, deleteMyAccount } from '../services/itemsService.js'
import { useI18n } from '../i18n/index.jsx'

export default function Profile() {
  const { t } = useI18n()
  const { configured, user, profile, isAdmin, profileError, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dataMessage, setDataMessage] = useState('')

  useEffect(() => { if (profile) { setName(profile.display_name); setCity(profile.city || '') } }, [profile])

  if (!configured) return <div className="mx-auto max-w-md px-4 py-12 text-center text-slate-600">{t('Profiles need Supabase to be connected.')}</div>
  if (profileError && !profile) return (
    <div className="mx-auto max-w-md px-4 py-12">
      <ErrorState title={t('Unable to load account profile.')} text={profileError} onRetry={() => refreshProfile()} />
    </div>
  )
  if (!profile) return <Spinner label={t('Loading profile')} />

  async function onSubmit(e) {
    e.preventDefault()
    if (busy) return
    const errs = {}
    if (name.trim().length < 2) errs.name = t('Enter your name (at least 2 characters).')
    if (name.length > 60) errs.name = t('Keep your name under 60 characters.')
    if (city.length > 80) errs.city = t('Keep the city under 80 characters.')
    setErrors(errs); setMessage({ kind: '', text: '' })
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await updateProfile({ displayName: name, city })
      const refreshed = await refreshProfile()
      if (refreshed === false) throw new Error(t('Profile saved, but your changes could not be reloaded. Please refresh the page.'))
      setMessage({ kind: 'ok', text: t('Profile saved.') })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function onExport() {
    if (exporting) return
    setDataMessage(''); setExporting(true)
    try {
      const data = await exportMyData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = 'findit-my-data.json'
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (err) {
      setDataMessage(err.message)
    } finally {
      setExporting(false)
    }
  }

  async function onDelete() {
    if (deleting) return
    setDataMessage(''); setDeleting(true)
    try {
      await deleteMyAccount()
      navigate('/')
    } catch (err) {
      setDataMessage(err.message)
      setDeleting(false)
    }
  }

  const emailMatches = confirmText.trim().toLowerCase() === (user.email || '').toLowerCase()

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('Your profile')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('Your email ({email}) is never shown to other users.', { email: user.email })}</p>
      <form onSubmit={onSubmit} noValidate className="card mt-6 space-y-4">
        <Field label={t('Display name')} id="name" error={errors.name}>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('City (optional)')} id="city" error={errors.city}>
          <input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        {message.text && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{message.text}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? t('Saving…') : t('Save changes')}</button>
      </form>
      <p className="mt-4 text-center text-sm"><Link to="/reset-password" className="text-brand-700 hover:underline">{t('Change password')}</Link></p>

      <section className="card mt-8 space-y-4" aria-labelledby="your-data">
        <h2 id="your-data" className="text-lg font-semibold">{t('Your data')}</h2>
        <button type="button" className="btn-secondary w-full" disabled={exporting} onClick={onExport}>{exporting ? t('Preparing…') : t('Download a copy of your data')}</button>
        {dataMessage && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{dataMessage}</p>}
        {isAdmin ? (
          <p className="text-sm text-slate-600">{t('Administrators cannot delete their own account. Ask another admin to change your role first.')}</p>
        ) : (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">{t('This permanently deletes your account, reports, photos, requests and messages. This cannot be undone.')}</p>
            <Field label={t('Type your email ({email}) to confirm.', { email: user.email })} id="confirm-delete">
              <input id="confirm-delete" className="input" value={confirmText} autoComplete="off" onChange={(e) => setConfirmText(e.target.value)} />
            </Field>
            <button type="button" className="btn-secondary w-full text-red-700" disabled={!emailMatches || deleting} onClick={onDelete}>{deleting ? t('Deleting…') : t('Permanently delete my account')}</button>
          </div>
        )}
      </section>
    </div>
  )
}
