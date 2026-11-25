import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Spinner } from '../ui/States.jsx'
import { useI18n } from '../../i18n/index.jsx'

// These guards only improve the experience. Real protection is Row Level Security in the database.
export function RequireAuth() {
  const { t } = useI18n()
  const { configured, loading, user } = useAuth()
  const location = useLocation()
  if (!configured) return <Outlet />            // preview mode: no backend, nothing to protect yet
  if (loading) return <Spinner label={t('Checking your session')} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireAdmin() {
  const { t } = useI18n()
  const { configured, loading, user, isAdmin, profile, profileLoading, profileError, refreshProfile } = useAuth()
  const location = useLocation()
  if (!configured) return <Outlet />
  if (loading || (user && profileLoading)) return <Spinner label={t('Checking your access')} />
  if (user && profileError) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">{t('Unable to verify your access')}</h1>
      <p role="alert" className="mt-2 text-slate-600">{profileError}</p>
      <button type="button" className="btn-primary mt-4" onClick={() => refreshProfile()}>{t('Try again')}</button>
    </div>
  )
  if (user && !profile) return <Spinner label={t('Checking your access')} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">{t('Access denied')}</h1>
        <p className="mt-2 text-slate-600">{t('This area is for administrators only.')}</p>
      </div>
    )
  }
  return <Outlet />
}
