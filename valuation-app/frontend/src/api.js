const BASE = '/api'

export async function searchCompanies(query) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export async function valuate(ticker) {
  const res = await fetch(`${BASE}/valuate/${encodeURIComponent(ticker)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Valuation failed' }))
    throw new Error(err.detail || 'Valuation failed')
  }
  return res.json()
}

export async function recalculate(ticker, assumptions) {
  const res = await fetch(`${BASE}/recalculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, assumptions }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Recalculation failed' }))
    throw new Error(err.detail || 'Recalculation failed')
  }
  return res.json()
}
