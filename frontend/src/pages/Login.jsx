import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Field from '../components/ui/Field.jsx'
import { validateLogin } from '../lib/validation.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function Login() {
  const { t } = useI18n()
  const { configured, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [v, setV] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const errs = validateLogin(v)
    setErrors(errs); setMessage('')
    if (Object.keys(errs).length) return
    if (!configured) { setMessage(t('Login is turned off in preview mode. Connect Supabase first.')); return }
    setBusy(true)
    try {
      await signIn(v)
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">{t('Log in')}</h1>
      <form onSubmit={onSubmit} noValidate className="card mt-6 space-y-4">
        <Field label={t('Email')} id="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" className="input" placeholder={t('name@company.com')} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Field>
        <Field label={t('Password')} id="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" className="input" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        </Field>
        {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? t('Logging in…') : t('Log in')}</button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-brand-700 hover:underline">{t('Forgot password?')}</Link>
          <Link to="/register" className="text-brand-700 hover:underline">{t('Create account')}</Link>
        </div>
      </form>
    </div>
  )
}
