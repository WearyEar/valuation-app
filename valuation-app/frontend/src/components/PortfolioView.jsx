import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, AreaChart, Area,
} from 'recharts'

// ── Formatters ───────────────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n)
}

function fmtBig(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${n < 0 ? '-$' : '$'}${abs.toFixed(0)}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDrift(d) {
  if (d == null) return '—'
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`
}

function fmtPct(n) {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

const SECTOR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6b7280',
]

function BarChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-700 dark:text-gray-300 font-semibold">{d.payload.ticker}</p>
      <p className={`font-mono mt-0.5 ${d.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {d.value >= 0 ? '+' : ''}{d.value}% upside
      </p>
    </div>
  )
}

function SectorTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-700 dark:text-gray-300 font-semibold">{d.name}</p>
      <p className="text-gray-500 mt-0.5">{d.value} stock{d.value !== 1 ? 's' : ''} · {d.payload.pct}%</p>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SortTh({ col, label, sort, onSort, right = false, extraClass = '' }) {
  const active = sort.col === col
  return (
    <th onClick={() => onSort(col)}
      className={`text-xs font-medium pb-3 pr-3 cursor-pointer select-none group ${extraClass}`}>
      <span className={`flex items-center gap-1 text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 transition-colors whitespace-nowrap ${right ? 'justify-end' : ''}`}>
        {label}
        <span className={active ? 'text-blue-500 dark:text-blue-400' : 'text-gray-300 dark:text-gray-700 group-hover:text-gray-400'}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}

function InlineInput({ value, onChange, placeholder, right = false, width = 'w-20', type = 'text' }) {
  return (
    <input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined}
      value={value ?? ''} onChange={e => onChange(e.target.value)} onClick={e => e.stopPropagation()}
      placeholder={placeholder}
      className={`bg-transparent text-xs font-mono text-gray-600 dark:text-gray-400 placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none focus:text-gray-900 dark:focus:text-gray-200 border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 transition-colors ${width} ${right ? 'text-right' : ''}`}
    />
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data }) {
  if (!data?.length || data.length < 2) {
    return <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
  }
  const first = data[0].composite_price
  const last  = data[data.length - 1].composite_price
  const up    = last >= first
  const color = up ? '#10b981' : '#ef4444'
  const changePct = (last - first) / first * 100
  return (
    <div className="flex items-center gap-1.5">
      <AreaChart width={60} height={22} data={data} margin={{ top: 1, right: 0, bottom: 1, left: 0 }}>
        <Area
          type="monotone" dataKey="composite_price"
          stroke={color} fill={color} fillOpacity={0.15}
          dot={false} strokeWidth={1.5} isAnimationActive={false}
        />
      </AreaChart>
      <span className={`text-xs font-mono ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
      </span>
    </div>
  )
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(rows) {
  const headers = [
    'Ticker', 'Company', 'Sector', 'Industry',
    'Current Price', 'Price at Add', 'Drift %',
    'Target Price', 'Upside %', 'DCF Price', 'Multiples Avg', 'Analyst Target',
    'Shares', 'Cost/Share', 'Market Value', 'Total Cost', 'P&L $', 'P&L %', 'Weight %',
    'Added Date', 'Last Refreshed', 'Notes',
  ]
  const data = rows.map(p => [
    p.ticker, p.name, p.sector || '', p.damodaran_industry || '',
    p.current_price?.toFixed(2) ?? '', p.price_at_add?.toFixed(2) ?? '',
    p.drift != null ? p.drift.toFixed(1) : '',
    p.composite_price?.toFixed(2) ?? '', p.upside_pct?.toFixed(1) ?? '',
    p.dcf_price?.toFixed(2) ?? '', p.multiples_avg_price?.toFixed(2) ?? '',
    p.analyst_mean_target?.toFixed(2) ?? '',
    p.shares ?? '', p.cost_basis?.toFixed(2) ?? '',
    p.market_value?.toFixed(2) ?? '', p.total_cost?.toFixed(2) ?? '',
    p.pnl_dollar?.toFixed(2) ?? '', p.pnl_pct?.toFixed(1) ?? '',
    p.weight_pct?.toFixed(1) ?? '',
    p.added_at ? fmtDate(p.added_at) : '', p.refreshed_at ? fmtDate(p.refreshed_at) : '',
    p.note || '',
  ])
  const csv = [headers, ...data]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `portfolio_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortfolioView({
  portfolio, onRemove, onRowClick,
  onRefreshAll, refreshing,
  onUpdateNote, onUpdatePosition,
  isDark = true,
}) {
  const [sort, setSort]               = useState({ col: 'upside_pct', dir: 'desc' })
  const [showPositions, setShowPositions] = useState(false)
  const [filterText, setFilterText]   = useState('')
  const [filterSector, setFilterSector] = useState('')

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })
  }

  // ── Enrich rows ───────────────────────────────────────────────────────────
  const enriched = portfolio.map(p => {
    const total_cost   = p.shares && p.cost_basis ? p.shares * p.cost_basis : null
    const market_value = p.shares ? p.shares * p.current_price : null
    const target_value = p.shares ? p.shares * p.composite_price : null
    const pnl_dollar   = market_value != null && total_cost != null ? market_value - total_cost : null
    const pnl_pct      = pnl_dollar != null && total_cost > 0 ? pnl_dollar / total_cost * 100 : null
    const drift        = p.price_at_add != null && p.refreshed_at
      ? (p.current_price - p.price_at_add) / p.price_at_add * 100 : null
    const target_trend_pct = p.history?.length >= 2
      ? (p.history[p.history.length - 1].composite_price - p.history[0].composite_price) / p.history[0].composite_price * 100
      : null
    return { ...p, drift, total_cost, market_value, target_value, pnl_dollar, pnl_pct, target_trend_pct }
  })

  const totalMarketValue = enriched.reduce((s, p) => s + (p.market_value ?? 0), 0)

  const withWeight = enriched.map(p => ({
    ...p,
    weight_pct: totalMarketValue > 0 && p.market_value ? p.market_value / totalMarketValue * 100 : null,
  }))

  // ── Filter ────────────────────────────────────────────────────────────────
  const sectors = [...new Set(portfolio.map(p => p.sector).filter(Boolean))].sort()

  const filtered = withWeight.filter(p => {
    const q = filterText.toLowerCase()
    const matchText = !q || p.ticker.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    const matchSector = !filterSector || p.sector === filterSector
    return matchText && matchSector
  })

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.col], bv = b[sort.col]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sort.dir === 'asc' ? cmp : -cmp
  })

  // ── Summary stats ─────────────────────────────────────────────────────────
  const avgUpside   = portfolio.reduce((s, p) => s + p.upside_pct, 0) / portfolio.length
  const undervalued = portfolio.filter(p => p.upside_pct > 0).length
  const overvalued  = portfolio.filter(p => p.upside_pct <= 0).length
  const bestTicker  = portfolio.reduce((best, p) => p.upside_pct > best.upside_pct ? p : best).ticker

  const hasPositions   = portfolio.some(p => p.shares)
  const hasCostBasis   = portfolio.some(p => p.shares && p.cost_basis)
  const totalCostBasis = hasCostBasis ? withWeight.reduce((s, p) => s + (p.total_cost ?? 0), 0) : null
  const totalPnlDollar = totalCostBasis != null ? totalMarketValue - totalCostBasis : null
  const totalPnlPct    = totalCostBasis > 0 ? totalPnlDollar / totalCostBasis * 100 : null
  const totalTargetValue = withWeight.reduce((s, p) => s + (p.target_value ?? 0), 0)

  // ── Chart data ────────────────────────────────────────────────────────────
  const barData = [...withWeight]
    .sort((a, b) => a.upside_pct - b.upside_pct)
    .map(p => ({ ticker: p.ticker, upside: parseFloat(p.upside_pct.toFixed(1)) }))

  const sectorCounts = portfolio.reduce((acc, p) => {
    const s = p.sector || 'Unknown'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const sectorData = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: ((value / portfolio.length) * 100).toFixed(0) }))

  const barHeight    = Math.max(80, portfolio.length * 40)
  const chartGrid    = isDark ? '#1f2937' : '#f3f4f6'
  const chartTick    = isDark ? '#9ca3af' : '#6b7280'
  const chartRef     = isDark ? '#374151' : '#e5e7eb'
  const chartCursor  = isDark ? '#1f2937' : '#f9fafb'

  const lastRefreshed = portfolio.reduce((latest, p) => {
    if (!p.refreshed_at) return latest
    return !latest || p.refreshed_at > latest ? p.refreshed_at : latest
  }, null)

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!portfolio.length) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
        <div className="text-5xl mb-2">📋</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Portfolio is empty</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Search for a stock, run a valuation, then click "Add to Portfolio" to track it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Summary stats ─────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap gap-6">
          <div className="stat-block">
            <span className="stat-label">Avg Upside</span>
            <span className={`stat-value ${avgUpside >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {avgUpside >= 0 ? '+' : ''}{avgUpside.toFixed(1)}%
            </span>
          </div>
          <div className="stat-block">
            <span className="stat-label">Undervalued</span>
            <span className="stat-value text-emerald-600 dark:text-emerald-400">{undervalued} / {portfolio.length}</span>
          </div>
          <div className="stat-block">
            <span className="stat-label">Overvalued</span>
            <span className="stat-value text-red-600 dark:text-red-400">{overvalued} / {portfolio.length}</span>
          </div>
          <div className="stat-block">
            <span className="stat-label">Best Upside</span>
            <span className="stat-value text-gray-900 dark:text-gray-200">{bestTicker}</span>
          </div>
        </div>

        {showPositions && hasPositions && (
          <>
            <div className="divider" />
            <div className="flex flex-wrap gap-6">
              <div className="stat-block">
                <span className="stat-label">Market Value</span>
                <span className="stat-value text-gray-900 dark:text-gray-200">{fmtBig(totalMarketValue)}</span>
              </div>
              {totalCostBasis > 0 && (
                <>
                  <div className="stat-block">
                    <span className="stat-label">Cost Basis</span>
                    <span className="stat-value text-gray-900 dark:text-gray-200">{fmtBig(totalCostBasis)}</span>
                  </div>
                  <div className="stat-block">
                    <span className="stat-label">Unrealized P&amp;L</span>
                    <span className={`stat-value ${totalPnlDollar >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmtBig(totalPnlDollar)}{' '}
                      <span className="text-sm font-normal">({fmtPct(totalPnlPct)})</span>
                    </span>
                  </div>
                </>
              )}
              {totalTargetValue > 0 && (
                <div className="stat-block">
                  <span className="stat-label">Target Value</span>
                  <span className="stat-value text-blue-500 dark:text-blue-400">{fmtBig(totalTargetValue)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Charts ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upside bar chart */}
        <div className="card">
          <p className="label mb-4">Upside / Downside by Stock</p>
          <ResponsiveContainer width="100%" height={barHeight}>
            <BarChart data={barData} layout="vertical" margin={{ top: 2, right: 40, left: 8, bottom: 2 }}>
              <XAxis type="number" tick={{ fill: chartTick, fontSize: 11 }}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} axisLine={false} tickLine={false} />
              <YAxis dataKey="ticker" type="category" width={52}
                tick={{ fill: chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarChartTooltip />} cursor={{ fill: chartCursor }} />
              <ReferenceLine x={0} stroke={chartRef} strokeWidth={1} />
              <Bar dataKey="upside" radius={[0, 3, 3, 0]} maxBarSize={22}>
                {barData.map(d => <Cell key={d.ticker} fill={d.upside >= 0 ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sector distribution */}
        <div className="card">
          <p className="label mb-4">Sector Breakdown</p>
          {sectorData.length === 1 && sectorData[0].name === 'Unknown' ? (
            <p className="text-xs text-gray-500 py-8 text-center">No sector data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, barHeight)}>
              <PieChart>
                <Pie
                  data={sectorData} cx="50%" cy="45%"
                  innerRadius="40%" outerRadius="65%"
                  paddingAngle={2} dataKey="value"
                >
                  {sectorData.map((_, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<SectorTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: chartTick, fontSize: 11 }}>{value}</span>
                  )}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="card">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Search by ticker or name…"
              className="input text-xs py-1.5 flex-1"
            />
            {sectors.length > 1 && (
              <select
                value={filterSector}
                onChange={e => setFilterSector(e.target.value)}
                className="input text-xs py-1.5 w-full sm:w-44"
              >
                <option value="">All sectors</option>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => exportCSV(sorted)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
              Export CSV
            </button>
            <button onClick={() => setShowPositions(s => !s)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                showPositions ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
              Positions
            </button>
            <button onClick={onRefreshAll} disabled={refreshing}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                refreshing ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
              {refreshing && (
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              )}
              {refreshing ? 'Refreshing…' : 'Refresh All'}
            </button>
          </div>
        </div>

        {filtered.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-8">No stocks match your filter.</p>
        )}

        {/* ── Mobile card view ──────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="sm:hidden space-y-3">
            {sorted.map(p => {
              const up      = p.upside_pct >= 0
              const driftUp = p.drift != null ? p.drift >= 0 : null
              return (
                <div key={p.ticker} onClick={() => onRowClick(p.ticker)}
                  className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                          {p.ticker}
                        </span>
                        <span className={up ? 'badge-up' : 'badge-down'}>
                          {up ? '▲' : '▼'} {Math.abs(p.upside_pct).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-800 dark:text-gray-200">{p.name}</p>
                      {(p.damodaran_industry || p.sector) && (
                        <p className="text-xs text-gray-500 mt-0.5">{p.damodaran_industry || p.sector}</p>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); onRemove(p.ticker) }}
                      className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1">
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500 mb-0.5">Current</p>
                      <p className="font-mono text-gray-800 dark:text-gray-200">{fmt(p.current_price)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Target</p>
                      <p className={`font-mono ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {fmt(p.composite_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-0.5">Drift</p>
                      <p className={`font-mono ${
                        driftUp == null ? 'text-gray-400' :
                        driftUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>{fmtDrift(p.drift)}</p>
                    </div>
                  </div>
                  {showPositions && p.shares && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 mb-0.5">Shares</p>
                        <p className="font-mono text-gray-800 dark:text-gray-200">{p.shares}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Mkt Value</p>
                        <p className="font-mono text-gray-800 dark:text-gray-200">{fmt(p.market_value, 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">P&L</p>
                        <p className={`font-mono ${p.pnl_dollar == null ? 'text-gray-400' : p.pnl_dollar >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {p.pnl_dollar != null ? fmt(p.pnl_dollar, 0) : '—'}
                        </p>
                      </div>
                    </div>
                  )}
                  {p.target_trend_pct != null && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-1.5 text-xs">
                      <span className="text-gray-500">Target trend</span>
                      <span className={`font-mono ${p.target_trend_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {p.target_trend_pct >= 0 ? '+' : ''}{p.target_trend_pct.toFixed(1)}%
                      </span>
                      <span className="text-gray-400 dark:text-gray-600">since add</span>
                    </div>
                  )}
                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/50" onClick={e => e.stopPropagation()}>
                    <InlineInput value={p.note} placeholder="Add note…" width="w-full"
                      onChange={v => onUpdateNote(p.ticker, v)} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Desktop table view ────────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <SortTh col="ticker"              label="Ticker"        sort={sort} onSort={toggleSort} />
                  <SortTh col="name"                label="Company"       sort={sort} onSort={toggleSort} />
                  <SortTh col="damodaran_industry"  label="Industry"      sort={sort} onSort={toggleSort} extraClass="hidden md:table-cell" />
                  <SortTh col="current_price"       label="Current"       sort={sort} onSort={toggleSort} right />
                  <SortTh col="drift"               label="Drift"         sort={sort} onSort={toggleSort} right />
                  <SortTh col="composite_price"     label="Target"        sort={sort} onSort={toggleSort} right />
                  <SortTh col="upside_pct"          label="Upside"        sort={sort} onSort={toggleSort} right />
                  <SortTh col="dcf_price"           label="DCF"           sort={sort} onSort={toggleSort} right extraClass="hidden lg:table-cell" />
                  <SortTh col="multiples_avg_price" label="Multiples Avg" sort={sort} onSort={toggleSort} right extraClass="hidden lg:table-cell" />
                  <SortTh col="analyst_mean_target" label="Analyst"       sort={sort} onSort={toggleSort} right extraClass="hidden lg:table-cell" />
                  <SortTh col="added_at"            label="Added"         sort={sort} onSort={toggleSort} right extraClass="hidden lg:table-cell" />
                  <SortTh col="target_trend_pct"    label="Trend"         sort={sort} onSort={toggleSort} right extraClass="hidden lg:table-cell" />
                  {showPositions && <>
                    <th className="text-xs font-medium pb-3 pr-3 text-gray-500 text-right whitespace-nowrap">Shares</th>
                    <th className="text-xs font-medium pb-3 pr-3 text-gray-500 text-right whitespace-nowrap">Cost/Share</th>
                    <SortTh col="market_value" label="Mkt Value"  sort={sort} onSort={toggleSort} right />
                    <SortTh col="total_cost"   label="Cost Basis" sort={sort} onSort={toggleSort} right />
                    <SortTh col="pnl_dollar"   label="P&L $"      sort={sort} onSort={toggleSort} right />
                    <SortTh col="pnl_pct"      label="P&L %"      sort={sort} onSort={toggleSort} right />
                    <SortTh col="weight_pct"   label="Weight"     sort={sort} onSort={toggleSort} right />
                  </>}
                  <th className="text-xs font-medium pb-3 pr-3 text-gray-500 text-left whitespace-nowrap">Notes</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const up      = p.upside_pct >= 0
                  const driftUp = p.drift != null ? p.drift >= 0 : null
                  const pnlUp   = p.pnl_dollar != null ? p.pnl_dollar >= 0 : null
                  return (
                    <tr key={p.ticker} onClick={() => onRowClick(p.ticker)}
                      className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors">
                      <td className="py-3 pr-3">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                          {p.ticker}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-gray-800 dark:text-gray-200 max-w-[150px] truncate">{p.name}</td>
                      <td className="py-3 pr-3 text-xs text-gray-500 hidden md:table-cell max-w-[130px] truncate">
                        {p.damodaran_industry || p.sector || '—'}
                      </td>
                      <td className="py-3 pr-3 text-xs font-mono text-gray-800 dark:text-gray-200 text-right">{fmt(p.current_price)}</td>
                      <td className="py-3 pr-3 text-xs font-mono text-right">
                        {p.drift == null ? <span className="text-gray-400 dark:text-gray-600">—</span>
                          : <span className={driftUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{fmtDrift(p.drift)}</span>}
                      </td>
                      <td className="py-3 pr-3 text-xs font-mono text-right">
                        <span className={up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{fmt(p.composite_price)}</span>
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span className={up ? 'badge-up' : 'badge-down'}>
                          {up ? '▲' : '▼'} {Math.abs(p.upside_pct).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs font-mono text-gray-500 text-right hidden lg:table-cell">{fmt(p.dcf_price)}</td>
                      <td className="py-3 pr-3 text-xs font-mono text-gray-500 text-right hidden lg:table-cell">{fmt(p.multiples_avg_price)}</td>
                      <td className="py-3 pr-3 text-xs font-mono text-gray-500 text-right hidden lg:table-cell">
                        {p.analyst_mean_target != null ? fmt(p.analyst_mean_target) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                      </td>
                      <td className="py-3 pr-3 text-xs text-gray-500 text-right hidden lg:table-cell whitespace-nowrap">{fmtDate(p.added_at)}</td>
                      <td className="py-3 pr-3 hidden lg:table-cell">
                        <Sparkline data={p.history} />
                      </td>

                      {showPositions && <>
                        <td className="py-3 pr-3 text-right" onClick={e => e.stopPropagation()}>
                          <InlineInput type="number" value={p.shares} right width="w-16" placeholder="—"
                            onChange={v => onUpdatePosition(p.ticker, 'shares', v)} />
                        </td>
                        <td className="py-3 pr-3 text-right" onClick={e => e.stopPropagation()}>
                          <InlineInput type="number" value={p.cost_basis} right width="w-20" placeholder="—"
                            onChange={v => onUpdatePosition(p.ticker, 'cost_basis', v)} />
                        </td>
                        <td className="py-3 pr-3 text-xs font-mono text-gray-800 dark:text-gray-200 text-right">
                          {p.market_value != null ? fmt(p.market_value, 0) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                        </td>
                        <td className="py-3 pr-3 text-xs font-mono text-gray-500 text-right">
                          {p.total_cost != null ? fmt(p.total_cost, 0) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                        </td>
                        <td className="py-3 pr-3 text-xs font-mono text-right">
                          {pnlUp == null ? <span className="text-gray-400 dark:text-gray-600">—</span>
                            : <span className={pnlUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{fmt(p.pnl_dollar, 0)}</span>}
                        </td>
                        <td className="py-3 pr-3 text-xs font-mono text-right">
                          {p.pnl_pct == null ? <span className="text-gray-400 dark:text-gray-600">—</span>
                            : <span className={p.pnl_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{fmtPct(p.pnl_pct)}</span>}
                        </td>
                        <td className="py-3 pr-3 text-xs font-mono text-gray-500 text-right">
                          {p.weight_pct != null ? `${p.weight_pct.toFixed(1)}%` : <span className="text-gray-400 dark:text-gray-600">—</span>}
                        </td>
                      </>}

                      <td className="py-3 pr-3" onClick={e => e.stopPropagation()}>
                        <InlineInput value={p.note} width="w-28" placeholder="Add note…"
                          onChange={v => onUpdateNote(p.ticker, v)} />
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={e => { e.stopPropagation(); onRemove(p.ticker) }}
                          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1" title="Remove">
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <p className="text-xs text-gray-400 dark:text-gray-600 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              {lastRefreshed
                ? `Last refreshed ${new Date(lastRefreshed).toLocaleString()}. `
                : 'Prices are from when each stock was added. '}
              Drift shows price change since stock was added. Click a row to reload the full valuation.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
