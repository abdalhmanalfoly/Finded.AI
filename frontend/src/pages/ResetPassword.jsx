import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../components/ui/Field.jsx'
import { Spinner } from '../components/ui/States.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function ResetPassword() {
  const { t } = useI18n()
  const { configured, loading, user, recovery, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!configured) return <div className="mx-auto max-w-md px-4 py-12 text-center text-slate-600">{t('Password reset needs Supabase to be connected.')}</div>
  if (loading) return <Spinner label={t('Checking your link')} />
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">{t('Link expired or invalid')}</h1>
        <p className="mt-2 text-slate-600">{t('Request a new reset link to continue.')}</p>
        <Link to="/forgot-password" className="btn-primary mt-5">{t('Request new link')}</Link>
      </div>
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (password.length < 8) errs.password = t('Use at least 8 characters.')
    if (confirm !== password) errs.confirm = t('Passwords do not match.')
    setErrors(errs); setMessage('')
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{recovery ? t('Choose a new password') : t('Change your password')}</h1>
      <form onSubmit={onSubmit} noValidate className="card mt-6 space-y-4">
        <Field label={t('New password')} id="password" error={errors.password} hint={t('At least 8 characters.')}>
          <input id="password" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t('Confirm new password')} id="confirm" error={errors.confirm}>
          <input id="confirm" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
        {done && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{t('Password updated.')}</p>}
        <button type="submit" disabled={busy || done} className="btn-primary w-full">{busy ? t('Saving…') : t('Save password')}</button>
      </form>
    </div>
  )
}
