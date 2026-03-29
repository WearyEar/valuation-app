import { useState, useRef, useCallback } from 'react'
import SearchBar from './components/SearchBar'
import ValuationResults from './components/ValuationResults'
import AssumptionsPanel from './components/AssumptionsPanel'
import ValuationChart from './components/ValuationChart'
import { valuate, recalculate } from './api'

export default function App() {
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [result, setResult]             = useState(null)
  const [assumptions, setAssumptions]   = useState(null)
  const [recalculating, setRecalc]      = useState(false)

  const debounceRef = useRef(null)

  // ── search / initial valuation ────────────────────────────────────────────
  async function handleSelect(ticker) {
    setError(null)
    setResult(null)
    setAssumptions(null)
    setLoading(true)
    try {
      const res = await valuate(ticker)
      setResult(res)
      setAssumptions(res.assumptions)
    } catch (err) {
      setError(err.message || 'Valuation failed. Please try another ticker.')
    } finally {
      setLoading(false)
    }
  }

  // ── assumptions change → debounced recalculation ──────────────────────────
  const handleAssumptionsChange = useCallback(
    (newAssumptions) => {
      setAssumptions(newAssumptions)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        if (!result) return
        setRecalc(true)
        try {
          const updated = await recalculate(result.ticker, newAssumptions)
          setResult(updated)
        } catch {
          // silently fail on recalculate; user can retry
        } finally {
          setRecalc(false)
        }
      }, 700)
    },
    [result]
  )

  return (
    <div className="min-h-screen">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="mr-4 shrink-0">
            <h1 className="text-base font-bold text-gray-100 tracking-tight">
              Stock Valuation
            </h1>
            <p className="text-xs text-gray-500">Damodaran DCF + Multiples</p>
          </div>
          <SearchBar onSelect={handleSelect} loading={loading} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* ── Loading state ─────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <LoadingSpinner />
            <p className="text-sm text-gray-400">
              Fetching financials and running valuation…
            </p>
            <p className="text-xs text-gray-600">
              (First run downloads Damodaran datasets — may take ~15s)
            </p>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────── */}
        {!loading && error && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-5">
            <p className="text-sm font-semibold text-red-400 mb-1">Valuation Error</p>
            <p className="text-sm text-red-200/70">{error}</p>
            <p className="text-xs text-gray-500 mt-2">
              Try a different ticker (US equities only). Non-standard filers (SPACs,
              foreign privates) may not have sufficient EDGAR data.
            </p>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────── */}
        {!loading && !error && !result && (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
            <div className="text-5xl mb-2">📊</div>
            <h2 className="text-lg font-semibold text-gray-200">
              Intrinsic Value, Damodaran-Style
            </h2>
            <p className="text-sm text-gray-500 max-w-sm">
              Enter a US stock ticker or company name to run a full DCF + relative
              valuation using Damodaran's sector data and SEC filings.
            </p>
            <div className="text-xs text-gray-600 mt-2 space-y-0.5">
              <p>Sources: SEC EDGAR · yfinance · Damodaran @ NYU Stern</p>
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────── */}
        {!loading && result && assumptions && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column: results + chart */}
            <div className="lg:col-span-2 space-y-4">
              <ValuationResults result={result} />
              <ValuationChart projections={result.dcf_detail?.projections} />
            </div>

            {/* Right column: assumptions */}
            <div className="lg:col-span-1">
              <AssumptionsPanel
                assumptions={assumptions}
                onChange={handleAssumptionsChange}
                wacc={result.dcf_detail?.wacc}
                recalculating={recalculating}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-16 py-6 text-center text-xs text-gray-600">
        <p>
          For educational purposes only. Not financial advice.{' '}
          <a
            href="http://pages.stern.nyu.edu/~adamodar/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-400"
          >
            Damodaran's data
          </a>{' '}
          is refreshed weekly.
        </p>
      </footer>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin text-blue-500"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-20"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
      />
    </svg>
  )
}
