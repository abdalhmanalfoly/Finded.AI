import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon.jsx'
import ItemGrid from '../components/items/ItemGrid.jsx'
import ScoreBar from '../components/ui/ScoreBar.jsx'
import { TypeBadge } from '../components/ui/Badge.jsx'
import useAsync from '../hooks/useAsync.js'
import { getLatest } from '../services/itemsService.js'
import { useI18n } from '../i18n/index.jsx'

const STEPS = [
  ['1. Report', 'Add details and photos of what you lost or found.'],
  ['2. Match', 'We suggest possible matches and explain why.'],
  ['3. Connect', 'Send a safe contact request. No private details are shared.'],
  ['4. Resolved', 'Agree on a safe handover and close the report.'],
]

const BENEFITS = [
  ['Explainable matches', 'Every suggestion shows the reasons behind its score.'],
  ['Privacy first', 'Your email and phone are never shown publicly.'],
  ['Free to use', 'Report, search and connect at no cost.'],
  ['Works on any device', 'Phone, tablet or desktop.'],
]

export default function Landing() {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const lost = useAsync(() => getLatest('lost', 3), [])
  const found = useAsync(() => getLatest('found', 3), [])

  function onSearch(e) {
    e.preventDefault()
    navigate(`/lost?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <>
      <section className="bg-ink-900 py-14 text-white sm:py-20">
        <div className="mx-auto grid max-w-content px-4 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl">
              {t('Lost something?')} <span className="block text-accent-400">{t('Let AI find it.')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">{t('Report, search and match lost and found items in one place.')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/report/lost" className="btn-accent">{t('I lost something')}</Link>
              <Link to="/report/found" className="btn border border-white/40 text-white hover:bg-white/10">{t('I found something')}</Link>
            </div>
            <form onSubmit={onSearch} className="mt-8 flex max-w-xl gap-2 rounded-xl bg-white p-1.5 shadow-lift" role="search">
              <label htmlFor="hero-search" className="sr-only">{t('Search lost items')}</label>
              <input id="hero-search" className="input border-transparent hover:border-transparent" placeholder={t('Black Samsung phone, Maadi')} value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="submit" className="btn-primary shrink-0" aria-label={t('Search')}><Icon name="search" /><span className="hidden sm:inline">{t('Search')}</span></button>
            </form>
          </div>

          {/* A real example of what the product does: two reports and the reasons they were matched. Decorative. */}
          <div aria-hidden="true" className="hidden rounded-card bg-white p-5 text-ink-900 shadow-lift lg:block">
            <div className="space-y-3">
              {['lost', 'found'].map((type) => (
                <div key={type} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon name="pin" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{t('Black Samsung phone')}</div>
                    <div className="truncate text-xs text-slate-600">{t('Maadi, near the metro station')}</div>
                  </div>
                  <TypeBadge type={type} />
                </div>
              ))}
            </div>
            <div className="mt-5"><ScoreBar score={86} /></div>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
              {[t('Same category: {x}', { x: t('Phones') }), t('Same color: {x}', { x: t('Black') }), t('Same area')].map((r) => (
                <li key={r} className="flex items-center gap-2"><span className="text-found-text"><Icon name="check" className="h-4 w-4" /></span>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-content px-4">
          <h2 className="text-2xl font-bold">{t('How it works')}</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([h, d]) => (
              <li key={h} className="rounded-card border border-slate-200 border-t-4 border-t-brand-600 bg-surface p-4"><div className="font-bold text-brand-800">{t(h)}</div><p className="mt-1.5 text-sm text-slate-600">{t(d)}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-content px-4 pt-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('Latest lost items')}</h2>
          <Link to="/lost" className="text-sm font-semibold text-brand-700 hover:underline">{t('View all')}</Link>
        </div>
        <ItemGrid loading={lost.loading} error={lost.error} items={lost.data} onRetry={lost.reload}
          emptyTitle={t('No lost items yet')} emptyText={t('When someone reports a lost item, it will show here.')}
          emptyAction={{ actionLabel: t('Report a lost item'), to: '/report/lost' }} />
      </section>

      <section className="mx-auto max-w-content px-4 py-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('Latest found items')}</h2>
          <Link to="/found" className="text-sm font-semibold text-brand-700 hover:underline">{t('View all')}</Link>
        </div>
        <ItemGrid loading={found.loading} error={found.error} items={found.data} onRetry={found.reload}
          emptyTitle={t('No found items yet')} emptyText={t('Found something? Help someone get it back.')}
          emptyAction={{ actionLabel: t('Report a found item'), to: '/report/found' }} />
      </section>

      <section className="border-y border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-content px-4">
          <h2 className="text-2xl font-bold">{t('Why FindIt AI')}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(([h, d]) => (
              <div key={h} className="flex gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Icon name="check" className="h-4 w-4" /></span>
                <div><div className="font-bold">{t(h)}</div><p className="mt-0.5 text-sm text-slate-600">{t(d)}</p></div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-900 px-4 py-14 text-center text-white">
        <h2 className="text-2xl font-bold">{t('Ready to find it?')}</h2>
        <Link to="/register" className="btn-accent mt-6">{t('Create free account')}</Link>
      </section>
    </>
  )
}
