import { Link } from 'react-router-dom'
import { TypeBadge, StatusBadge } from '../ui/Badge.jsx'
import Icon from '../ui/Icon.jsx'
import { useI18n } from '../../i18n/index.jsx'

export default function ItemCard({ item }) {
  const { t } = useI18n()
  return (
    <Link to={`/items/${item.id}`} className="card block transition-shadow hover:shadow-lift">
      {item.coverUrl ? (
        <img src={item.coverUrl} alt={t('Photo of {name}', { name: item.name })} loading="lazy" className="h-36 w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-36 flex-col items-center justify-center gap-1.5 rounded-lg bg-brand-50 text-sm font-medium text-brand-700"><Icon name="pin" className="h-6 w-6 text-brand-300" />{t(item.category)}</div>
      )}
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{item.name}</h3>
        <TypeBadge type={item.type} />
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
        <Icon name="pin" className="h-3.5 w-3.5" />{item.location}, {item.city}
      </p>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <span>{item.date}</span>
        <StatusBadge status={item.status} />
      </div>
    </Link>
  )
}
