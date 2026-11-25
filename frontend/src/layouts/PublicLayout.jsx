import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from '../components/layout/Navbar.jsx'
import Footer from '../components/layout/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function PublicLayout() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const { configured, isSuspended } = useAuth()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      {!configured && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
          {t('Preview mode: sample data only. Supabase isn’t configured, so login and saving are turned off.')}
        </div>
      )}
      {isSuspended && (
        <div role="alert" className="bg-red-100 px-4 py-2 text-center text-xs text-red-900">
          {t('Your account is suspended. You can browse, but you can’t create reports or send requests.')}
        </div>
      )}
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
