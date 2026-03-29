import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
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
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-300 font-semibold mb-2">Year {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono">{fmtB(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ValuationChart({ projections }) {
  if (!projections?.length) return null

  const data = projections.map((p) => ({
    year: p.year,
    Revenue: p.revenue,
    NOPAT: p.nopat,
    FCFF: p.fcff,
  }))

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-200">10-Year DCF Projections</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Revenue, NOPAT, and Free Cash Flow to Firm over the projection period
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => `Y${v}`}
          />
          <YAxis
            tickFormatter={fmtB}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
          />
          <ReferenceLine y={0} stroke="#374151" />
          <Bar dataKey="Revenue" fill="#1e3a5f" radius={[2, 2, 0, 0]} name="Revenue" />
          <Line
            type="monotone"
            dataKey="NOPAT"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="NOPAT"
          />
          <Line
            type="monotone"
            dataKey="FCFF"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
            name="FCFF"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
