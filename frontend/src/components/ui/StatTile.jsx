export default function StatTile({ label, value }) {
  return (
    <div className="rounded-card border border-brand-100 bg-white p-4 shadow-card">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight text-brand-700">{value}</div>
    </div>
  )
}
