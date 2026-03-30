import { useState } from 'react'

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

function SortTh({ col, label, sort, onSort, right = false, extraClass = '' }) {
  const active = sort.col === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`text-xs font-medium pb-3 pr-4 cursor-pointer select-none group ${extraClass}`}
    >
      <span className={`flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap ${right ? 'justify-end' : ''}`}>
        {label}
        <span className={active ? 'text-blue-400' : 'text-gray-700 group-hover:text-gray-500'}>
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}

export default function PortfolioView({ portfolio, onRemove, onRowClick, onRefreshAll, refreshing }) {
  const [sort, setSort] = useState({ col: 'upside_pct', dir: 'desc' })

  function toggleSort(col) {
    setSort(s => s.col === col
      ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { col, dir: 'desc' }
    )
  }

  const sorted = [...portfolio].sort((a, b) => {
    const av = a[sort.col], bv = b[sort.col]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const lastRefreshed = portfolio.reduce((latest, p) => {
    if (!p.refreshed_at) return latest
    return !latest || p.refreshed_at > latest ? p.refreshed_at : latest
  }, null)

  if (!portfolio.length) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
        <div className="text-5xl mb-2">📋</div>
        <h2 className="text-lg font-semibold text-gray-200">Portfolio is empty</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Search for a stock, run a valuation, then click "Add to Portfolio" to track it here.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400">
          {portfolio.length} stock{portfolio.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={onRefreshAll}
          disabled={refreshing}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            refreshing
              ? 'bg-gray-800 text-gray-500 cursor-default'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
          }`}
        >
          {refreshing && (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          )}
          {refreshing ? 'Refreshing…' : 'Refresh All'}
        </button>
      </div>

      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-800">
            <SortTh col="ticker"              label="Ticker"       sort={sort} onSort={toggleSort} />
            <SortTh col="name"                label="Company"      sort={sort} onSort={toggleSort} />
            <SortTh col="damodaran_industry"  label="Industry"     sort={sort} onSort={toggleSort} extraClass="hidden md:table-cell" />
            <SortTh col="current_price"       label="Current"      sort={sort} onSort={toggleSort} right />
            <SortTh col="composite_price"     label="Target"       sort={sort} onSort={toggleSort} right />
            <SortTh col="upside_pct"          label="Upside"       sort={sort} onSort={toggleSort} right />
            <SortTh col="dcf_price"           label="DCF"          sort={sort} onSort={toggleSort} right extraClass="hidden lg:table-cell" />
            <SortTh col="multiples_avg_price" label="Multiples Avg" sort={sort} onSort={toggleSort} right extraClass="hidden lg:table-cell" />
            <th className="pb-3"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const up = p.upside_pct >= 0
            return (
              <tr
                key={p.ticker}
                onClick={() => onRowClick(p.ticker)}
                className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 cursor-pointer transition-colors"
              >
                <td className="py-3 pr-4">
                  <span className="font-mono text-xs bg-gray-800 text-blue-400 px-2 py-0.5 rounded">
                    {p.ticker}
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs text-gray-200 max-w-[160px] truncate">
                  {p.name}
                </td>
                <td className="py-3 pr-4 text-xs text-gray-500 hidden md:table-cell max-w-[140px] truncate">
                  {p.damodaran_industry || p.sector || '—'}
                </td>
                <td className="py-3 pr-4 text-xs font-mono text-gray-200 text-right">
                  {fmt(p.current_price)}
                </td>
                <td className="py-3 pr-4 text-xs font-mono text-right">
                  <span className={up ? 'text-emerald-400' : 'text-red-400'}>
                    {fmt(p.composite_price)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className={up ? 'badge-up' : 'badge-down'}>
                    {up ? '▲' : '▼'} {Math.abs(p.upside_pct).toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs font-mono text-gray-400 text-right hidden lg:table-cell">
                  {fmt(p.dcf_price)}
                </td>
                <td className="py-3 pr-4 text-xs font-mono text-gray-400 text-right hidden lg:table-cell">
                  {fmt(p.multiples_avg_price)}
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(p.ticker) }}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors px-1"
                    title="Remove"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-gray-800">
        {lastRefreshed
          ? `Last refreshed ${new Date(lastRefreshed).toLocaleString()}. `
          : 'Prices are from when each stock was added. '}
        Click a row to reload the full valuation.
      </p>
    </div>
  )
}
