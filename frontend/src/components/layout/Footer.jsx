import { Link } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../i18n/index.jsx'

export default function Footer() {
  const { t } = useI18n()
  return (
    <footer className="bg-ink-950 text-slate-300">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-accent-400"><Icon name="search" className="h-[18px] w-[18px]" /></span>{t('FindIt AI')}
          </div>
          <p className="mt-2 text-sm">{t('Lost something? Let AI find it.')}</p>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t('Browse')}</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link className="hover:text-white" to="/lost">{t('Lost items')}</Link></li>
            <li><Link className="hover:text-white" to="/found">{t('Found items')}</Link></li>
            <li><Link className="hover:text-white" to="/matches">{t('Matches')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t('Get started')}</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link className="hover:text-white" to="/report/lost">{t('Report a lost item')}</Link></li>
            <li><Link className="hover:text-white" to="/report/found">{t('Report a found item')}</Link></li>
            <li><Link className="hover:text-white" to="/login">{t('Log in')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs">
        © 2026 FindIt AI · <Link className="hover:text-white" to="/privacy">{t('Privacy')}</Link> · <Link className="hover:text-white" to="/terms">{t('Terms')}</Link>
      </div>
    </footer>
  )
}
