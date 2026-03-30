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
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${n.toFixed(0)}`
}

function pct(v, decimals = 1) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(decimals)}%`
}

function UpsideBadge({ pct }) {
  const up = pct >= 0
  return (
    <span className={up ? 'badge-up' : 'badge-down'}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% {up ? 'upside' : 'downside'}
    </span>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-xs font-mono text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  )
}

function PriceBar({ label, value, current, max }) {
  if (!value || value <= 0) return null
  const width = Math.min(100, Math.max(4, (value / max) * 100))
  const isAbove = value > current
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 dark:text-gray-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-2 relative">
        <div
          className={`h-2 rounded-full transition-all ${isAbove ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${width}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-400 rounded"
          style={{ left: `${Math.min(100, (current / max) * 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-800 dark:text-gray-200 w-16 text-right">{fmt(value)}</span>
    </div>
  )
}

export default function ValuationResults({ result, isInPortfolio, onAddToPortfolio }) {
  if (!result) return null

  const { dcf_detail: dcf, multiples_detail: md, assumptions: a } = result
  const ad = result.analyst_data
  const maxBar = Math.max(
    result.current_price, result.dcf_price,
    md.ev_ebitda_implied_price || 0, md.pe_implied_price || 0, md.ps_implied_price || 0,
    ad?.mean_target || 0,
  ) * 1.1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{result.name}</h2>
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                {result.ticker}
              </span>
              {result.damodaran_industry && (
                <span className="text-xs text-gray-500">↳ {result.damodaran_industry}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{result.sector} · {result.industry}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-xs text-gray-500">Market Cap</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{fmtBig(result.market_cap)}</p>
            </div>
            <button
              onClick={onAddToPortfolio}
              disabled={isInPortfolio}
              className={isInPortfolio
                ? 'text-xs rounded-lg px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 cursor-default'
                : 'text-xs rounded-lg px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors'}
            >
              {isInPortfolio ? 'In Portfolio' : '+ Add to Portfolio'}
            </button>
          </div>
        </div>
      </div>

      {/* Price Summary */}
      <div className="card">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-block">
            <span className="stat-label">Current Price</span>
            <span className="stat-value text-gray-900 dark:text-gray-100">{fmt(result.current_price)}</span>
          </div>
          <div className="stat-block">
            <span className="stat-label">Target (Composite)</span>
            <span className={`stat-value ${result.upside_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {fmt(result.composite_price)}
            </span>
          </div>
          <div className="stat-block items-end">
            <span className="stat-label">Verdict</span>
            <UpsideBadge pct={result.upside_pct} />
            <span className="text-xs text-gray-500 mt-1">vs. current price</span>
          </div>
        </div>

        <div className="divider" />

        <div className="space-y-2.5">
          <p className="label mb-3">Implied Price by Method</p>
          <PriceBar label="DCF (Intrinsic)"  value={result.dcf_price}           current={result.current_price} max={maxBar} />
          <PriceBar label="EV/EBITDA"        value={md.ev_ebitda_implied_price}  current={result.current_price} max={maxBar} />
          <PriceBar label="P/E"              value={md.pe_implied_price}         current={result.current_price} max={maxBar} />
          <PriceBar label="P/S"              value={md.ps_implied_price}         current={result.current_price} max={maxBar} />
          {ad?.mean_target && (
            <PriceBar label="Analyst Mean" value={ad.mean_target} current={result.current_price} max={maxBar} />
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
          Gray marker = current price. Composite = 60% DCF + 40% multiples average. Analyst Mean shown for reference only.
        </p>
      </div>

      {/* Analyst Consensus */}
      {ad && (
        <div className="card">
          <p className="label mb-3">Analyst Consensus</p>
          <div className="flex flex-wrap items-center gap-4">
            {ad.recommendation && (
              <div className="flex flex-col items-center">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  ad.recommendation === 'Strong Buy' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                  ad.recommendation === 'Buy'        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                  ad.recommendation === 'Hold'       ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
                  'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                }`}>{ad.recommendation}</span>
                {ad.recommendation_mean != null && (
                  <span className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                    score {ad.recommendation_mean.toFixed(1)} / 5.0
                  </span>
                )}
              </div>
            )}
            {ad.mean_target && (
              <div className="stat-block">
                <span className="stat-label">Mean Target</span>
                <span className={`stat-value ${ad.mean_target > result.current_price ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {fmt(ad.mean_target)}
                </span>
                {ad.num_analysts != null && (
                  <span className="text-xs text-gray-400 dark:text-gray-600">{ad.num_analysts} analyst{ad.num_analysts !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}
            {ad.high_target && ad.low_target && (
              <div className="stat-block">
                <span className="stat-label">Target Range</span>
                <span className="stat-value text-gray-700 dark:text-gray-300 text-sm">
                  {fmt(ad.low_target)} – {fmt(ad.high_target)}
                </span>
              </div>
            )}
            {ad.median_target && (
              <div className="stat-block">
                <span className="stat-label">Median Target</span>
                <span className="stat-value text-gray-700 dark:text-gray-300 text-sm">{fmt(ad.median_target)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
            Analyst targets are for reference only and are not incorporated into the composite price.
          </p>
        </div>
      )}

      {/* DCF Detail & Multiples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <p className="label mb-3">DCF Breakdown</p>
          <MetricRow label="WACC"                   value={pct(dcf.wacc)} />
          <MetricRow label="Cost of Equity"         value={pct(dcf.cost_of_equity)} />
          <MetricRow label="After-tax Cost of Debt" value={pct(dcf.after_tax_cost_of_debt)} />
          <MetricRow label="Equity Weight"          value={pct(dcf.equity_weight)} />
          <MetricRow label="PV of FCFFs (10 yrs)"   value={fmtBig(dcf.pv_fcff_sum)} />
          <MetricRow label="PV of Terminal Value"   value={fmtBig(dcf.pv_terminal)} />
          <MetricRow label="Operating Asset Value"  value={fmtBig(dcf.op_asset_value)} />
          <MetricRow label="+ Cash"                 value={fmtBig(result.cash)} />
          <MetricRow label="− Total Debt"           value={fmtBig(result.total_debt)} />
          <MetricRow label="Equity Value"           value={fmtBig(dcf.equity_value)} />
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">DCF Price / Share</span>
            <span className="text-lg font-bold text-blue-500 dark:text-blue-400">{fmt(dcf.price)}</span>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <p className="label mb-3">Trailing Financials</p>
            <MetricRow label="Revenue (TTM)"    value={fmtBig(result.revenue)} />
            <MetricRow label="EBITDA (TTM)"     value={fmtBig(result.ebitda)} />
            <MetricRow label="Net Income (TTM)" value={fmtBig(result.net_income)} />
            <MetricRow label="EBIT Margin"      value={pct(a.current_operating_margin)} />
            <MetricRow label="Tax Rate"         value={pct(a.tax_rate)} />
          </div>
          <div>
            <p className="label mb-3">Sector Multiples (Damodaran)</p>
            {md.sector_ev_ebitda && (
              <MetricRow label="EV/EBITDA" value={`${md.sector_ev_ebitda}× → ${fmt(md.ev_ebitda_implied_price)}`} />
            )}
            {md.sector_pe && (
              <MetricRow label="P/E" value={`${md.sector_pe}× → ${fmt(md.pe_implied_price)}`} />
            )}
            {md.sector_ps && (
              <MetricRow label="P/S" value={`${md.sector_ps}× → ${fmt(md.ps_implied_price)}`} />
            )}
            {!md.sector_ev_ebitda && !md.sector_pe && !md.sector_ps && (
              <p className="text-xs text-gray-500 italic">No sector multiples matched. Composite uses DCF only.</p>
            )}
          </div>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">Data Notes</p>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-800 dark:text-amber-200/70">⚠ {w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
        Data as of {result.data_as_of} · Source: SEC EDGAR, yfinance, Damodaran (NYU Stern)
      </p>
    </div>
  )
}
