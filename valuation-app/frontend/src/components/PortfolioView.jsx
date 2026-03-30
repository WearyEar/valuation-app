function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export default function PortfolioView({ portfolio, onRemove, onRowClick }) {
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
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left text-xs text-gray-500 font-medium pb-3 pr-4">Ticker</th>
            <th className="text-left text-xs text-gray-500 font-medium pb-3 pr-4">Company</th>
            <th className="text-left text-xs text-gray-500 font-medium pb-3 pr-4 hidden md:table-cell">Industry</th>
            <th className="text-right text-xs text-gray-500 font-medium pb-3 pr-4">Current</th>
            <th className="text-right text-xs text-gray-500 font-medium pb-3 pr-4">Target</th>
            <th className="text-right text-xs text-gray-500 font-medium pb-3 pr-4">Upside</th>
            <th className="text-right text-xs text-gray-500 font-medium pb-3 pr-4 hidden lg:table-cell">DCF</th>
            <th className="text-right text-xs text-gray-500 font-medium pb-3 pr-4 hidden lg:table-cell">Multiples Avg</th>
            <th className="pb-3"></th>
          </tr>
        </thead>
        <tbody>
          {portfolio.map((p) => {
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
        Prices are from when the stock was added. Click a row to reload the full valuation.
      </p>
    </div>
  )
}
