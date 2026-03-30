import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

function fmtBig(n) {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toFixed(0)}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        p.value != null && (
          <div key={p.name} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-mono text-gray-900 dark:text-gray-100">{fmtBig(p.value)}</span>
          </div>
        )
      ))}
    </div>
  )
}

export default function FinancialsChart({ result, isDark = true }) {
  if (!result?.revenue_history || result.revenue_history.length < 2) return null

  const n = result.revenue_history.length
  const currentYear = new Date().getFullYear()

  const data = result.revenue_history.map((rev, i) => {
    const year = currentYear - (n - 1 - i)
    return {
      year: String(year),
      Revenue: rev,
      EBITDA: result.ebitda_history?.[i] ?? null,
      'Net Income': result.net_income_history?.[i] ?? null,
    }
  })

  const hasNegative = data.some(
    (d) => (d.EBITDA != null && d.EBITDA < 0) || (d['Net Income'] != null && d['Net Income'] < 0)
  )

  const grid = isDark ? '#1f2937' : '#f3f4f6'
  const tick  = isDark ? '#9ca3af' : '#6b7280'
  const ref   = isDark ? '#374151' : '#e5e7eb'

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Historical Financials</h3>
        <p className="text-xs text-gray-500 mt-0.5">Annual · last 5 years</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="year" tick={{ fill: tick, fontSize: 11 }} />
          <YAxis tickFormatter={fmtBig} tick={{ fill: tick, fontSize: 11 }} width={58} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: tick, paddingTop: 8 }} />
          {hasNegative && <ReferenceLine y={0} stroke={ref} />}
          <Bar dataKey="Revenue" fill="#1e3a5f" radius={[2, 2, 0, 0]} />
          <Bar dataKey="EBITDA" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Net Income" fill="#10b981" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
