import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ItemGrid from '../components/items/ItemGrid.jsx'
import Pagination from '../components/ui/Pagination.jsx'
import useAsync from '../hooks/useAsync.js'
import { listItems } from '../services/itemsService.js'
import { CATEGORIES, COLORS } from '../data/sampleData.js'
import { useI18n } from '../i18n/index.jsx'

const PAGE_SIZE = 6

export default function ItemsList({ type }) {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const applied = params.get('q') || ''

  const { data, loading, error, reload } = useAsync(
    () => listItems({ type, q: applied, category, color, dateFrom, dateTo, page, pageSize: PAGE_SIZE }),
    [type, applied, category, color, dateFrom, dateTo, page]
  )

  const isLost = type === 'lost'
  const hasFilters = applied || category || color || dateFrom || dateTo

  function submit(e) {
    e.preventDefault()
    setPage(1)
    setParams(q.trim() ? { q: q.trim() } : {})
  }

  function clear() {
    setQ(''); setCategory(''); setColor(''); setDateFrom(''); setDateTo(''); setPage(1); setParams({})
  }

  return (
    <div className="mx-auto max-w-content px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{isLost ? t('Lost items') : t('Found items')}</h1>
        <Link to={isLost ? '/report/lost' : '/report/found'} className="btn-primary">{isLost ? t('Report a lost item') : t('Report a found item')}</Link>
      </div>

      <form onSubmit={submit} role="search" className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-[1.4fr_190px_150px_155px_155px_auto]">
        <div>
          <label htmlFor="q" className="sr-only">{t('Search')}</label>
          <input id="q" className="input" placeholder={t('Search by name, place or brand')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="category" className="sr-only">{t('Category')}</label>
          <select id="category" className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
            <option value="">{t('All categories')}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="color" className="sr-only">{t('Color')}</label>
          <select id="color" className="input" value={color} onChange={(e) => { setColor(e.target.value); setPage(1) }}>
            <option value="">{t('All colors')}</option>
            {COLORS.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="date-from" className="sr-only">{t('From date')}</label>
          <input id="date-from" type="date" className="input" aria-label={t('From date')} value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
        </div>
        <div>
          <label htmlFor="date-to" className="sr-only">{t('To date')}</label>
          <input id="date-to" type="date" className="input" aria-label={t('To date')} value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
        </div>
        <button type="submit" className="btn-primary">{t('Search')}</button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        {!loading && !error && data ? (data.total === 1 ? t('1 result') : t('{count} results', { count: data.total })) : ' '}
        {hasFilters && <button type="button" onClick={clear} className="ms-3 text-brand-700 hover:underline">{t('Clear filters')}</button>}
      </p>

      <div className="mt-4">
        <ItemGrid
          loading={loading} error={error} items={data?.items} onRetry={reload}
          emptyTitle={hasFilters ? t('No items match your search') : t(isLost ? 'No lost items yet' : 'No found items yet')}
          emptyText={hasFilters ? t('Try different words or remove a filter.') : t('Be the first to report one.')}
          emptyAction={hasFilters ? { actionLabel: t('Clear filters'), onAction: clear } : { actionLabel: t('Create a report'), to: isLost ? '/report/lost' : '/report/found' }}
        />
        {data && <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onChange={setPage} />}
      </div>
    </div>
  )
}
