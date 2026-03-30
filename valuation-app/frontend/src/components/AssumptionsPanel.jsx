import { useState } from 'react'

function pct(v) { return (v * 100).toFixed(2) }
function fromPct(s) { return parseFloat(s) / 100 }

function SliderRow({ label, hint, value, min, max, step = 0.001, onChange }) {
  const display = (value * 100).toFixed(2)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            className="w-20 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-0.5 text-xs
                       text-right text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={display}
            step={0.1}
            onChange={(e) => onChange(fromPct(e.target.value))}
          />
          <span className="text-xs text-gray-500">%</span>
        </div>
      </div>
      <input type="range" className="range-track" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint && <p className="text-xs text-gray-400 dark:text-gray-600">{hint}</p>}
    </div>
  )
}

function NumRow({ label, hint, value, step = 0.01, min, max, onChange }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <div>
        <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
        {hint && <p className="text-xs text-gray-400 dark:text-gray-600">{hint}</p>}
      </div>
      <input
        type="number"
        className="w-24 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs
                   text-right text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={value} step={step} min={min} max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  )
}

export default function AssumptionsPanel({ assumptions, onChange, wacc, recalculating }) {
  const [open, setOpen] = useState(true)

  function update(key, val) { onChange({ ...assumptions, [key]: val }) }

  return (
    <div className="card">
      <button className="w-full flex justify-between items-center" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Assumptions</span>
          {recalculating && <span className="text-xs text-blue-500 dark:text-blue-400 animate-pulse">Recalculating…</span>}
        </div>
        <span className="text-gray-500 text-xs">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          <div className="flex gap-2 flex-wrap">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 flex flex-col items-center gap-0.5 flex-1 min-w-24">
              <span className="text-lg font-bold text-blue-500 dark:text-blue-400">
                {wacc != null ? (wacc * 100).toFixed(1) + '%' : '—'}
              </span>
              <span className="text-xs text-gray-500">WACC</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 flex flex-col items-center gap-0.5 flex-1 min-w-24">
              <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {((assumptions.risk_free_rate + assumptions.beta * assumptions.equity_risk_premium) * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">Cost of Equity</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 flex flex-col items-center gap-0.5 flex-1 min-w-24">
              <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {(assumptions.cost_of_debt * (1 - assumptions.tax_rate) * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">AT Cost of Debt</span>
            </div>
          </div>

          <div className="divider" />

          <div className="space-y-4">
            <p className="label">Growth</p>
            <SliderRow label="Revenue Growth Rate (Yrs 1–5)" hint="Fades linearly to stable growth by year 10"
              value={assumptions.revenue_growth_rate} min={-0.20} max={0.50} step={0.001}
              onChange={(v) => update('revenue_growth_rate', v)} />
            <SliderRow label="Stable / Terminal Growth Rate" hint="Should approximate long-run nominal GDP growth (≈ risk-free rate)"
              value={assumptions.stable_growth_rate} min={0.0} max={0.06} step={0.001}
              onChange={(v) => update('stable_growth_rate', v)} />
          </div>

          <div className="divider" />

          <div className="space-y-4">
            <p className="label">Profitability</p>
            <SliderRow label="Current Operating Margin" hint="Trailing EBIT / Revenue"
              value={assumptions.current_operating_margin} min={-0.30} max={0.60} step={0.001}
              onChange={(v) => update('current_operating_margin', v)} />
            <SliderRow label="Target Operating Margin" hint="Converges from current over 5 years (sector or analyst target)"
              value={assumptions.target_operating_margin} min={-0.10} max={0.60} step={0.001}
              onChange={(v) => update('target_operating_margin', v)} />
          </div>

          <div className="divider" />

          <div className="space-y-4">
            <p className="label">Cost of Capital</p>
            <SliderRow label="Risk-Free Rate" hint="10-year US Treasury yield"
              value={assumptions.risk_free_rate} min={0.01} max={0.08} step={0.001}
              onChange={(v) => update('risk_free_rate', v)} />
            <SliderRow label="Equity Risk Premium" hint="Damodaran's implied ERP for US market"
              value={assumptions.equity_risk_premium} min={0.02} max={0.10} step={0.001}
              onChange={(v) => update('equity_risk_premium', v)} />
            <SliderRow label="Beta (Levered)" hint="Re-levered from Damodaran's sector unlevered beta"
              value={assumptions.beta / 4} min={0.05} max={0.75} step={0.0025}
              onChange={(v) => update('beta', v * 4)} />
            <p className="text-xs text-gray-500 -mt-2">
              Beta: <span className="text-gray-700 dark:text-gray-300 font-mono">{assumptions.beta.toFixed(2)}</span>
            </p>
            <SliderRow label="Pre-tax Cost of Debt" hint="Interest expense / total debt"
              value={assumptions.cost_of_debt} min={0.02} max={0.15} step={0.001}
              onChange={(v) => update('cost_of_debt', v)} />
            <NumRow label="Effective Tax Rate" value={(assumptions.tax_rate * 100).toFixed(1)}
              step={0.1} min={5} max={40} onChange={(v) => update('tax_rate', v / 100)} />
          </div>

          <div className="divider" />

          <div className="space-y-4">
            <p className="label">Capital Efficiency</p>
            <NumRow label="Sales-to-Capital Ratio" hint="Revenue / Invested Capital (drives reinvestment)"
              value={assumptions.sales_to_capital_ratio.toFixed(2)} step={0.1} min={0.1} max={10}
              onChange={(v) => update('sales_to_capital_ratio', v)} />
          </div>
        </div>
      )}
    </div>
  )
}
