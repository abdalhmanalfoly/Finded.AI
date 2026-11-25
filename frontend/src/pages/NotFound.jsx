import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">{t('Page not found')}</h1>
      <p className="mt-2 text-slate-600">{t('The page you’re looking for doesn’t exist or was moved.')}</p>
      <Link to="/" className="btn-primary mt-6">{t('Go to home')}</Link>
    </div>
  )
}
