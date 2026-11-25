import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import useUnreadCount from '../../hooks/useUnreadCount.js'
import { useI18n } from '../../i18n/index.jsx'

const linkClass = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100 hover:text-ink-900'}`

export default function Navbar() {
  const { t, lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const { configured, user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const { count: unread, problem: unreadProblem } = useUnreadCount(Boolean(user))
  const close = () => setOpen(false)
  const loggedIn = Boolean(user)

  const links = [
    { to: '/lost', label: t('Lost items') },
    { to: '/found', label: t('Found items') },
    ...(loggedIn || !configured ? [{ to: '/matches', label: t('Matches') }, { to: '/dashboard', label: t('Dashboard') }, { to: '/requests', label: t('Requests') }] : []),
    ...(isAdmin || !configured ? [{ to: '/admin', label: t('Admin') }] : []),
  ]

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    close()
    try { await signOut(); navigate('/') } finally { setLoggingOut(false) }
  }

  const bell = loggedIn && (
    <Link to="/notifications" onClick={close} className="relative rounded-lg p-2 hover:bg-slate-100" title={unreadProblem || undefined} aria-label={unreadProblem ? `${t('Notifications')}: ${unreadProblem}` : unread ? `${t('Notifications')}, ${t('{count} unread', { count: unread })}` : t('Notifications')}>
      <Icon name="bell" className="h-6 w-6" />
      {unread > 0 && <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-400 px-1 text-xs font-bold text-ink-950">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  )

  const langToggle = (
    <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="rounded-lg px-2 py-1 text-sm font-medium hover:bg-slate-100" lang={lang === 'ar' ? 'en' : 'ar'}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}>
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  )

  const authButtons = loggedIn ? (
    <>
      <Link to="/profile" onClick={close} className="text-sm font-medium hover:underline">{profile?.display_name || t('Profile')}</Link>
      <button type="button" onClick={logout} disabled={loggingOut} className="btn-secondary">{loggingOut ? t('Logging out…') : t('Log out')}</button>
    </>
  ) : (
    <>
      <Link to="/login" onClick={close} className="btn-secondary">{t('Log in')}</Link>
      <Link to="/register" onClick={close} className="btn-primary">{t('Sign up')}</Link>
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3">
        <Link to="/" onClick={close} className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-accent-400"><Icon name="search" className="h-[18px] w-[18px]" /></span>{t('FindIt AI')}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t('Main')}>
          {links.map((l) => <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>)}
        </nav>

        <div className="hidden items-center gap-2 md:flex">{langToggle}{bell}{authButtons}</div>

        <div className="flex items-center gap-1 md:hidden">
          {langToggle}
          {bell}
          <button type="button" className="rounded-lg p-2 hover:bg-slate-100" aria-label={open ? t('Close menu') : t('Open menu')} aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'close' : 'menu'} className="h-6 w-6" />
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-slate-200 px-4 pb-4 md:hidden" aria-label={t('Mobile')}>
          <div className="space-y-1 py-2">
            {links.map((l) => <NavLink key={l.to} to={l.to} className={linkClass} onClick={close}>{l.label}</NavLink>)}
          </div>
          <div className="flex items-center gap-2">{authButtons}</div>
        </nav>
      )}
    </header>
  )
}
