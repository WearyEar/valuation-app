import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

function fmtB(n) {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">Year {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-gray-900 dark:text-gray-100">{fmtB(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ValuationChart({ projections, isDark = true }) {
  if (!projections?.length) return null

  const data = projections.map((p) => ({
    year: p.year, Revenue: p.revenue, NOPAT: p.nopat, FCFF: p.fcff,
  }))

  const grid  = isDark ? '#1f2937' : '#f3f4f6'
  const tick  = isDark ? '#9ca3af' : '#6b7280'
  const ref   = isDark ? '#374151' : '#e5e7eb'

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">10-Year DCF Projections</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Revenue, NOPAT, and Free Cash Flow to Firm over the projection period
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="year" tick={{ fill: tick, fontSize: 11 }} tickFormatter={(v) => `Y${v}`} />
          <YAxis tickFormatter={fmtB} tick={{ fill: tick, fontSize: 11 }} width={58} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: tick, paddingTop: 8 }} />
          <ReferenceLine y={0} stroke={ref} />
          <Bar dataKey="Revenue" fill="#1e3a5f" radius={[2, 2, 0, 0]} name="Revenue" />
          <Line type="monotone" dataKey="NOPAT" stroke="#3b82f6" strokeWidth={2} dot={false} name="NOPAT" />
          <Line type="monotone" dataKey="FCFF" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 3" name="FCFF" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
