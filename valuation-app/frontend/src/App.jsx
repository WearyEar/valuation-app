import { useState, useRef, useCallback, useEffect } from 'react'
import SearchBar from './components/SearchBar'
import ValuationResults from './components/ValuationResults'
import AssumptionsPanel from './components/AssumptionsPanel'
import ValuationChart from './components/ValuationChart'
import PortfolioView from './components/PortfolioView'
import { valuate, recalculate } from './api'

export default function App() {
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [result, setResult]           = useState(null)
  const [assumptions, setAssumptions] = useState(null)
  const [recalculating, setRecalc]    = useState(false)
  const [activeTab, setActiveTab]     = useState('search')
  const [portfolio, setPortfolio]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('valuation_portfolio')) ?? [] }
    catch { return [] }
  })
  const [refreshing, setRefreshing]   = useState(false)
  const [theme, setTheme]             = useState(() => localStorage.getItem('theme') ?? 'dark')

  const isDark = theme === 'dark'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', theme)
  }, [theme, isDark])

  const debounceRef = useRef(null)

  // ── portfolio helpers ─────────────────────────────────────────────────────
  function savePortfolio(updated) {
    setPortfolio(updated)
    localStorage.setItem('valuation_portfolio', JSON.stringify(updated))
  }

  function handleAddToPortfolio() {
    if (!result || portfolio.some(p => p.ticker === result.ticker)) return
    const md = result.multiples_detail
    const vals = [md.ev_ebitda_implied_price, md.pe_implied_price, md.ps_implied_price]
      .filter(v => v != null && v > 0)
    savePortfolio([...portfolio, {
      ticker: result.ticker, name: result.name, sector: result.sector,
      damodaran_industry: result.damodaran_industry,
      current_price: result.current_price, composite_price: result.composite_price,
      upside_pct: result.upside_pct, dcf_price: result.dcf_price,
      multiples_avg_price: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      price_at_add: result.current_price,
      added_at: new Date().toISOString(),
    }])
  }

  function handleRemoveFromPortfolio(ticker) {
    savePortfolio(portfolio.filter(p => p.ticker !== ticker))
  }

  function handleUpdateNote(ticker, note) {
    savePortfolio(portfolio.map(p => p.ticker === ticker ? { ...p, note } : p))
  }

  function handleUpdatePosition(ticker, field, value) {
    const parsed = value === '' ? null : parseFloat(value)
    savePortfolio(portfolio.map(p =>
      p.ticker === ticker ? { ...p, [field]: isNaN(parsed) ? null : parsed } : p
    ))
  }

  async function handleRefreshAll() {
    if (refreshing || !portfolio.length) return
    setRefreshing(true)
    try {
      const updated = await Promise.all(
        portfolio.map(async (p) => {
          try {
            const res = await valuate(p.ticker)
            const md = res.multiples_detail
            const vals = [md.ev_ebitda_implied_price, md.pe_implied_price, md.ps_implied_price]
              .filter(v => v != null && v > 0)
            return {
              ...p,
              current_price: res.current_price,
              composite_price: res.composite_price,
              upside_pct: res.upside_pct,
              dcf_price: res.dcf_price,
              multiples_avg_price: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
              refreshed_at: new Date().toISOString(),
            }
          } catch { return p }
        })
      )
      savePortfolio(updated)
    } finally {
      setRefreshing(false)
    }
  }

  function handlePortfolioRowClick(ticker) {
    setActiveTab('search')
    handleSelect(ticker)
  }

  const isInPortfolio = portfolio.some(p => p.ticker === result?.ticker)

  // ── search / initial valuation ────────────────────────────────────────────
  async function handleSelect(ticker) {
    setError(null); setResult(null); setAssumptions(null); setLoading(true)
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
        } catch { /* silently fail */ } finally { setRecalc(false) }
      }, 700)
    },
    [result]
  )

  return (
    <div className="min-h-screen">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="mr-4 shrink-0">
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">Stock Valuation</h1>
            <p className="text-xs text-gray-500">Damodaran DCF + Multiples</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('search')}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'search'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'portfolio'
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Portfolio
              {portfolio.length > 0 && (
                <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0 leading-4 min-w-[18px] text-center">
                  {portfolio.length}
                </span>
              )}
            </button>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="text-xs px-2 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? '☀' : '☾'}
            </button>
          </div>

          {activeTab === 'search' && (
            <SearchBar onSelect={handleSelect} loading={loading} />
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {activeTab === 'search' && (
          <>
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <LoadingSpinner />
                <p className="text-sm text-gray-500 dark:text-gray-400">Fetching financials and running valuation…</p>
                <p className="text-xs text-gray-400 dark:text-gray-600">(First run downloads Damodaran datasets — may take ~15s)</p>
              </div>
            )}

            {!loading && error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl p-5">
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Valuation Error</p>
                <p className="text-sm text-red-800/70 dark:text-red-200/70">{error}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Try a different ticker (US equities only). Non-standard filers (SPACs, foreign privates) may not have sufficient EDGAR data.
                </p>
              </div>
            )}

            {!loading && !error && !result && (
              <div className="flex flex-col items-center justify-center py-28 gap-3 text-center">
                <div className="text-5xl mb-2">📊</div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Intrinsic Value, Damodaran-Style</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  Enter a US stock ticker or company name to run a full DCF + relative
                  valuation using Damodaran's sector data and SEC filings.
                </p>
                <div className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                  <p>Sources: SEC EDGAR · yfinance · Damodaran @ NYU Stern</p>
                </div>
              </div>
            )}

            {!loading && result && assumptions && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <ValuationResults
                    result={result}
                    isInPortfolio={isInPortfolio}
                    onAddToPortfolio={handleAddToPortfolio}
                  />
                  <ValuationChart projections={result.dcf_detail?.projections} isDark={isDark} />
                </div>
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
          </>
        )}

        {activeTab === 'portfolio' && (
          <PortfolioView
            portfolio={portfolio}
            onRemove={handleRemoveFromPortfolio}
            onRowClick={handlePortfolioRowClick}
            onRefreshAll={handleRefreshAll}
            refreshing={refreshing}
            onUpdateNote={handleUpdateNote}
            onUpdatePosition={handleUpdatePosition}
            isDark={isDark}
          />
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 py-6 text-center text-xs text-gray-400 dark:text-gray-600">
        <p>
          For educational purposes only. Not financial advice.{' '}
          <a href="http://pages.stern.nyu.edu/~adamodar/" target="_blank" rel="noopener noreferrer"
            className="text-blue-500 dark:text-blue-600 hover:text-blue-400">
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
    <svg className="animate-spin text-blue-500" width="36" height="36" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  )
}
