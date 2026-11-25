import ItemCard from './ItemCard.jsx'
import { CardSkeleton, EmptyState, ErrorState } from '../ui/States.jsx'

export default function ItemGrid({ loading, error, items, onRetry, emptyTitle, emptyText, emptyAction }) {
  if (loading) return <CardSkeleton />
  if (error) return <ErrorState onRetry={onRetry} />
  if (!items || items.length === 0) return <EmptyState title={emptyTitle} text={emptyText} {...emptyAction} />
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => <ItemCard key={i.id} item={i} />)}
    </div>
  )
}
