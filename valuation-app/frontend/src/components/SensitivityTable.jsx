export default function SensitivityTable({ result, assumptions, sensitivityData, loading, onRun }) {
  if (!result || !assumptions) return null

  if (!sensitivityData && !loading) {
    return (
      <div className="card">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">DCF Sensitivity</h3>
          <p className="text-xs text-gray-500 mt-0.5">Revenue Growth vs. Operating Margin</p>
        </div>
        <button
          onClick={onRun}
          className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          Run Sensitivity
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">DCF Sensitivity</h3>
          <p className="text-xs text-gray-500 mt-0.5">Revenue Growth vs. Operating Margin</p>
        </div>
        <div className="flex items-center gap-2 py-4">
          <svg className="animate-spin text-blue-500" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span className="text-xs text-gray-500">Running 25 DCF scenarios…</span>
        </div>
      </div>
    )
  }

  const { rows, cols, dcf_prices, base_row_idx, base_col_idx, current_price } = sensitivityData

  function cellStyle(price) {
    const diff = price - current_price
    const opacity = Math.min(0.65, Math.abs(diff) / current_price * 1.5)
    if (diff > 0) return { backgroundColor: `rgba(16,185,129,${opacity})` }
    if (diff < 0) return { backgroundColor: `rgba(239,68,68,${opacity})` }
    return {}
  }

  function fmtPct(v, showSign = false) {
    const s = (v * 100).toFixed(1) + '%'
    return showSign && v > 0 ? '+' + s : s
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">DCF Sensitivity</h3>
          <p className="text-xs text-gray-500 mt-0.5">Revenue Growth vs. Operating Margin</p>
        </div>
        <button
          onClick={onRun}
          className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          Recalculate
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-gray-500 dark:text-gray-400 pr-2 pb-1.5 font-normal whitespace-nowrap">
                Growth \ Margin
              </th>
              {cols.map((m, j) => (
                <th
                  key={j}
                  className={`text-center pb-1.5 px-1 font-medium whitespace-nowrap ${
                    j === base_col_idx
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {fmtPct(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g, i) => (
              <tr key={i}>
                <td className={`pr-2 py-0.5 font-medium whitespace-nowrap ${
                  i === base_row_idx
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {fmtPct(g, true)}
                </td>
                {dcf_prices[i].map((price, j) => {
                  const isBase = i === base_row_idx && j === base_col_idx
                  return (
                    <td
                      key={j}
                      style={cellStyle(price)}
                      className={`text-center px-2 py-1 rounded font-mono text-gray-900 ${
                        isBase ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                      }`}
                    >
                      ${price.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
        Varies revenue growth (rows) and operating margin (cols) from current assumptions. All other inputs held constant.
      </p>
    </div>
  )
}
