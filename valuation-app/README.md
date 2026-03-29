# Stock Valuation App — Damodaran Method

Intrinsic value estimates for US-listed public companies using:
- **Damodaran's datasets** (NYU Stern) — sector betas, equity risk premium, EV/EBITDA, P/E, P/S multiples
- **SEC EDGAR** — company lookup
- **yfinance** — market data & structured financials (10-K/10-Q)

### Valuation methodology
1. **Full Damodaran-style DCF** — 10-year revenue/margin/FCF projection + terminal value (Gordon Growth at stable ROIC = WACC)
2. **Relative valuation** — EV/EBITDA, P/E, P/S vs. Damodaran's sector medians
3. **Composite target price** — 60% DCF + 40% multiples average

---

## Setup

### Backend (Python 3.11+)
```bash
cd valuation-app/backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (Node 18+)
```bash
cd valuation-app/frontend
npm install
npm run dev
```

Then open **http://localhost:5173**

> **First run:** The backend downloads Damodaran's Excel datasets (~7 files) from
> NYU Stern on first use. Expect a ~15-second delay. Files are cached in
> `backend/data/damodaran/` and refreshed weekly.

---

## Usage

1. Enter a ticker symbol (e.g., `AAPL`) or company name in the search bar
2. Review the DCF intrinsic value, multiples-implied range, and composite target
3. Edit any assumption in the **Assumptions** panel — valuation updates automatically (debounced, ~0.7s)

---

## Data notes
- US companies only
- Damodaran's sector datasets are updated annually (January). The app refreshes
  them weekly from his NYU Stern site.
- Financial data from yfinance (annual filings). For the most accurate data,
  yfinance uses Yahoo Finance's structured view of SEC EDGAR filings.
- Valuations are sensitive to assumptions. The defaults are reasonable starting
  points, not recommendations.
