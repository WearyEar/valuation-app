"""
Damodaran Valuation App — FastAPI backend

Endpoints:
  GET  /api/search?q={query}       → list of matching companies
  GET  /api/valuate/{ticker}       → full valuation result
  POST /api/recalculate            → re-run valuation with custom assumptions

Run with:
  uvicorn main:app --reload --port 8000
"""

import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from services import damodaran, market_data
from valuation import dcf as dcf_engine, multiples as mult_engine
from valuation.schemas import Assumptions, AnalystData, RecalculateRequest, ValuationResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Damodaran Valuation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _run_full_valuation(
    fin: market_data.FinancialData,
    assumptions: Assumptions,
    dam: dict,
) -> ValuationResult:
    """Core valuation logic shared by /valuate and /recalculate."""

    dcf_result = dcf_engine.run_dcf(
        revenue=fin.revenue,
        market_cap=fin.market_cap,
        total_debt=fin.total_debt,
        cash=fin.cash,
        shares_outstanding=fin.shares_outstanding,
        assumptions=assumptions,
    )

    mult_result = mult_engine.run_multiples(
        ebitda=fin.ebitda,
        net_income=fin.net_income,
        revenue=fin.revenue,
        total_debt=fin.total_debt,
        cash=fin.cash,
        shares=fin.shares_outstanding,
        dam=dam,
    )

    m_low, m_high = mult_engine.multiples_range(mult_result)
    comp = mult_engine.composite_price(dcf_result.price, mult_result)

    upside = (
        (comp - fin.current_price) / fin.current_price * 100
        if fin.current_price > 0
        else 0.0
    )

    analyst_data = None
    if fin.analyst_mean_target is not None or fin.analyst_recommendation_key is not None:
        analyst_data = AnalystData(
            mean_target=fin.analyst_mean_target,
            median_target=fin.analyst_median_target,
            high_target=fin.analyst_high_target,
            low_target=fin.analyst_low_target,
            num_analysts=fin.analyst_num_opinions,
            recommendation=fin.analyst_recommendation_key,
            recommendation_mean=fin.analyst_recommendation_mean,
        )

    return ValuationResult(
        ticker=fin.ticker,
        name=fin.name,
        sector=fin.sector,
        industry=fin.industry,
        description=fin.description,
        damodaran_industry=dam.get("matched_industry"),
        current_price=fin.current_price,
        market_cap=fin.market_cap,
        shares_outstanding=fin.shares_outstanding,
        dcf_price=dcf_result.price,
        multiples_low=m_low,
        multiples_high=m_high,
        composite_price=comp,
        upside_pct=round(upside, 1),
        dcf_detail=dcf_result,
        multiples_detail=mult_result,
        assumptions=assumptions,
        revenue=fin.revenue,
        ebitda=fin.ebitda,
        net_income=fin.net_income,
        total_debt=fin.total_debt,
        cash=fin.cash,
        warnings=fin.warnings,
        analyst_data=analyst_data,
        data_as_of=datetime.now().strftime("%Y-%m-%d"),
    )


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/api/search")
async def search(q: str):
    """Search companies by name or ticker symbol."""
    if not q or len(q.strip()) < 1:
        return []
    results = market_data.search_companies(q.strip())
    return results


@app.get("/api/valuate/{ticker}")
async def valuate(ticker: str):
    """
    Run a full Damodaran-style valuation for the given ticker.

    Returns intrinsic value (DCF), relative value (multiples), composite price,
    and all assumptions so the frontend can display and allow editing.
    """
    ticker = ticker.upper().strip()
    try:
        fin = market_data.get_financial_data(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception(f"Data fetch error for {ticker}")
        raise HTTPException(status_code=502, detail=f"Data fetch failed: {exc}")

    rf  = market_data.get_risk_free_rate()
    dam = damodaran.get_sector_data(fin.industry, fin.sector)

    assumptions = dcf_engine.build_default_assumptions(fin, dam, rf)

    return _run_full_valuation(fin, assumptions, dam)


@app.post("/api/recalculate")
async def recalculate(req: RecalculateRequest):
    """
    Re-run valuation with user-supplied assumptions.

    Financial data is served from the in-memory cache (populated by /valuate),
    so recalculation is fast without re-hitting external APIs.
    """
    ticker = req.ticker.upper().strip()
    try:
        fin = market_data.get_financial_data(ticker)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Data fetch failed: {exc}")

    dam = damodaran.get_sector_data(fin.industry, fin.sector)
    return _run_full_valuation(fin, req.assumptions, dam)


@app.get("/health")
async def health():
    return {"status": "ok"}
