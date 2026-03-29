import { useState, useRef, useEffect } from 'react'
import { searchCompanies } from '../api'

export default function SearchBar({ onSelect, loading }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)

    clearTimeout(debounceRef.current)
    if (val.trim().length < 1) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchCompanies(val.trim())
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (query.trim()) {
      setOpen(false)
      onSelect(query.trim().toUpperCase())
    }
  }

  function pickSuggestion(s) {
    setQuery(s.ticker)
    setOpen(false)
    setSuggestions([])
    onSelect(s.ticker)
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="input pr-8"
            placeholder="Enter ticker or company name (e.g. AAPL, Apple)"
            value={query}
            onChange={handleChange}
            autoFocus
            autoComplete="off"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner size={14} />
            </div>
          )}
        </div>
        <button
          type="submit"
          className="btn-primary whitespace-nowrap"
          disabled={loading || !query.trim()}
        >
          {loading ? 'Valuing…' : 'Value It'}
        </button>
      </form>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full card p-1 shadow-xl border-gray-700">
          {suggestions.map((s) => (
            <li key={s.ticker}>
              <button
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 flex items-center gap-3 text-sm"
                onMouseDown={() => pickSuggestion(s)}
              >
                <span className="font-mono font-semibold text-blue-400 w-16 shrink-0">
                  {s.ticker}
                </span>
                <span className="text-gray-300 truncate">{s.name}</span>
                <span className="text-gray-500 text-xs ml-auto shrink-0">{s.exchange}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Spinner({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="animate-spin text-gray-400"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
      />
    </svg>
  )
}
