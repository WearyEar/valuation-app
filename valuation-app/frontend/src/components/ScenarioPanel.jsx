import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n)
}

function pct(v, decimals = 1) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(decimals)}%`
}

const ScenarioTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-700 dark:text-gray-300 font-semibold">{d.payload.label}</p>
      <p className="font-mono mt-0.5" style={{ color: d.payload.color }}>{fmt(d.value)}</p>
    </div>
  )
}

const SCENARIOS = [
  { key: 'bear', label: 'Bear', color: '#ef4444', textClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40' },
  { key: 'base', label: 'Base', color: '#3b82f6', textClass: 'text-blue-600 dark:text-blue-400', bgClass: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40' },
  { key: 'bull', label: 'Bull', color: '#10b981', textClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40' },
]

export default function ScenarioPanel({ result, assumptions, isDark, scenarios, loading, onRun }) {
  if (!result || !assumptions) return null

  const chartTick   = isDark ? '#9ca3af' : '#6b7280'
  const chartGrid   = isDark ? '#1f2937' : '#f3f4f6'
  const chartRef    = isDark ? '#6b7280' : '#9ca3af'
  const chartCursor = isDark ? '#1f2937' : '#f9fafb'

  const barData = scenarios ? [
    { label: 'Bear', price: scenarios.bear.composite_price, color: '#ef4444' },
    { label: 'Base', price: result.composite_price,         color: '#3b82f6' },
    { label: 'Bull', price: scenarios.bull.composite_price, color: '#10b981' },
  ] : []

  const assumptionRows = scenarios ? [
    {
      label: 'Revenue Growth (Yrs 1-5)',
      bear: pct(scenarios.bearAssumptions.revenue_growth_rate),
      base: pct(assumptions.revenue_growth_rate),
      bull: pct(scenarios.bullAssumptions.revenue_growth_rate),
    },
    {
      label: 'Target Op. Margin',
      bear: pct(scenarios.bearAssumptions.target_operating_margin),
      base: pct(assumptions.target_operating_margin),
      bull: pct(scenarios.bullAssumptions.target_operating_margin),
    },
    {
      label: 'Equity Risk Premium',
      bear: pct(scenarios.bearAssumptions.equity_risk_premium),
      base: pct(assumptions.equity_risk_premium),
      bull: pct(scenarios.bullAssumptions.equity_risk_premium),
    },
    {
      label: 'DCF Price',
      bear: fmt(scenarios.bear.dcf_price),
      base: fmt(result.dcf_price),
      bull: fmt(scenarios.bull.dcf_price),
      bold: true,
    },
    {
      label: 'Composite Price',
      bear: fmt(scenarios.bear.composite_price),
      base: fmt(result.composite_price),
      bull: fmt(scenarios.bull.composite_price),
      bold: true,
    },
  ] : []

  const resultForKey = (key) => key === 'base' ? result : scenarios?.[key]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Scenario Analysis</h3>
          <p className="text-xs text-gray-500 mt-0.5">Bear / Base / Bull DCF projections</p>
        </div>
        <button
          onClick={onRun}
          disabled={loading}
          className={loading
            ? 'text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default'
            : 'text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors'}
        >
          {loading ? 'Running…' : scenarios ? 'Refresh' : 'Run Scenarios'}
        </button>
      </div>

      {!scenarios && !loading && (
        <p className="text-xs text-gray-400 dark:text-gray-600 py-6 text-center">
          Click "Run Scenarios" to compare Bear, Base, and Bull case DCF valuations.
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
          <svg className="animate-spin w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span className="text-xs">Running 3 scenarios…</span>
        </div>
      )}

      {scenarios && (
        <>
          {/* Price cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {SCENARIOS.map(({ key, label, textClass, bgClass }) => {
              const res = resultForKey(key)
              const upsidePct = (res.composite_price - result.current_price) / result.current_price * 100
              const isUp = upsidePct >= 0
              return (
                <div key={key} className={`rounded-xl border p-3 flex flex-col gap-1 ${bgClass}`}>
                  <span className={`text-xs font-semibold ${textClass}`}>{label}</span>
                  <span className={`text-base font-bold ${textClass}`}>{fmt(res.composite_price)}</span>
                  <span className={`text-xs font-mono ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(upsidePct).toFixed(1)}% vs current
                  </span>
                </div>
              )
            })}
          </div>

          {/* Bar chart */}
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: chartTick, fontSize: 11 }}
                tickFormatter={v => `$${v.toFixed(0)}`}
                width={50}
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ScenarioTooltip />} cursor={{ fill: chartCursor }} />
              <ReferenceLine
                y={result.current_price}
                stroke={chartRef}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: 'Current', fill: chartTick, fontSize: 10, position: 'insideTopRight' }}
              />
              <Bar dataKey="price" radius={[3, 3, 0, 0]} maxBarSize={64}>
                {barData.map(d => <Cell key={d.label} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Assumptions comparison table */}
          <div className="mt-5">
            <p className="label mb-3">Key Assumptions</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left text-gray-500 font-medium pb-2 pr-4">Assumption</th>
                    <th className="text-right text-red-500 dark:text-red-400 font-semibold pb-2 pr-4">Bear</th>
                    <th className="text-right text-blue-500 dark:text-blue-400 font-semibold pb-2 pr-4">Base</th>
                    <th className="text-right text-emerald-500 dark:text-emerald-400 font-semibold pb-2">Bull</th>
                  </tr>
                </thead>
                <tbody>
                  {assumptionRows.map(row => (
                    <tr key={row.label} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className={`py-2 pr-4 ${row.bold ? 'font-semibold text-gray-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {row.label}
                      </td>
                      <td className={`py-2 pr-4 font-mono text-right ${row.bold ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                        {row.bear}
                      </td>
                      <td className={`py-2 pr-4 font-mono text-right ${row.bold ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                        {row.base}
                      </td>
                      <td className={`py-2 font-mono text-right ${row.bold ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                        {row.bull}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
            Bear: growth ×0.6, margin −15%, ERP +1%. Bull: growth ×1.5, margin +15%, ERP −1%.
          </p>
        </>
      )}
    </div>
  )
}
