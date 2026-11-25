import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../components/ui/Field.jsx'
import { validateEmail } from '../lib/validation.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function ForgotPassword() {
  const { t } = useI18n()
  const { configured, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const errs = validateEmail(email)
    setErrors(errs); setMessage({ kind: '', text: '' })
    if (Object.keys(errs).length) return
    if (!configured) { setMessage({ kind: 'error', text: t('Password reset is turned off in preview mode. Connect Supabase first.') }); return }
    setBusy(true)
    try {
      await resetPassword(email)
      setMessage({ kind: 'ok', text: t('If an account exists for that email, a reset link is on its way.') })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('Reset your password')}</h1>
      <form onSubmit={onSubmit} noValidate className="card mt-6 space-y-4">
        <Field label={t('Email')} id="email" error={errors.email}>
          <input id="email" type="email" className="input" placeholder={t('name@company.com')} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {message.text && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{message.text}</p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? t('Sending…') : t('Send reset link')}</button>
        <p className="text-center text-sm"><Link to="/login" className="text-brand-700 hover:underline">{t('Back to log in')}</Link></p>
      </form>
    </div>
  )
}
