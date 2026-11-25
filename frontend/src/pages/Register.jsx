import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../components/ui/Field.jsx'
import { validateRegister } from '../lib/validation.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function Register() {
  const { t } = useI18n()
  const { configured, signUp } = useAuth()
  const navigate = useNavigate()
  const [v, setV] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    const errs = validateRegister(v)
    setErrors(errs); setMessage({ kind: '', text: '' })
    if (Object.keys(errs).length) return
    if (!configured) { setMessage({ kind: 'error', text: t('Registration is turned off in preview mode. Connect Supabase first.') }); return }
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp(v)
      if (needsConfirmation) setMessage({ kind: 'ok', text: t('Account created. Check your email and confirm your address, then log in.') })
      else navigate('/dashboard', { replace: true })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('Create your account')}</h1>
      <form onSubmit={onSubmit} noValidate className="card mt-6 space-y-4">
        <Field label={t('Name')} id="name" error={errors.name}>
          <input id="name" autoComplete="name" className="input" value={v.name} onChange={set('name')} />
        </Field>
        <Field label={t('Email')} id="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className="input" placeholder={t('name@company.com')} value={v.email} onChange={set('email')} />
        </Field>
        <Field label={t('Password')} id="password" error={errors.password} hint={t('At least 8 characters.')}>
          <input id="password" type="password" autoComplete="new-password" className="input" value={v.password} onChange={set('password')} />
        </Field>
        <Field label={t('Confirm password')} id="confirm" error={errors.confirm}>
          <input id="confirm" type="password" autoComplete="new-password" className="input" value={v.confirm} onChange={set('confirm')} />
        </Field>
        {message.text && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${message.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>{message.text}</p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? t('Creating account…') : t('Create account')}</button>
        <p className="text-center text-sm">{t('Already have an account?')} <Link to="/login" className="text-brand-700 hover:underline">{t('Log in')}</Link></p>
      </form>
    </div>
  )
}
