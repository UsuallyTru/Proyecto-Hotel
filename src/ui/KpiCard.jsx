export default function KpiCard({ title, value, subtitle }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-graysoft/80">{title}</div>
      <div className="text-2xl font-semibold text-champagne">{value}</div>
      {subtitle && <div className="text-sm text-graysoft/60">{subtitle}</div>}
    </div>
  )
}
