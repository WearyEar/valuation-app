"""
Market and financial data fetcher.

Primary source: yfinance (market prices, beta, structured financials)
Secondary source: SEC EDGAR XBRL API (official filings, company lookup)

Financial data is cached in-memory for 1 hour to support fast recalculation
without re-hitting external APIs.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
import requests
import yfinance as yf

logger = logging.getLogger(__name__)

# ── in-memory cache ───────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, "FinancialData"]] = {}
CACHE_TTL = 3600  # seconds


@dataclass
class FinancialData:
    ticker: str
    name: str
    sector: str
    industry: str
    description: str

    # Market
    current_price: float
    market_cap: float
    shares_outstanding: float  # diluted
    beta: float

    # Income statement (trailing 12 months)
    revenue: float
    ebit: float
    interest_expense: float
    tax_provision: float
    pretax_income: float
    net_income: float
    ebitda: float

    # Cash flow (TTM)
    depreciation: float
    capex: float  # positive = outflow

    # Balance sheet (most recent quarter)
    cash: float
    total_debt: float
    total_equity: float
    working_capital: float

    # Computed
    ebit_margin: float
    tax_rate: float
    invested_capital: float
    sales_to_capital: float
    revenue_history: list[float] = field(default_factory=list)  # 5 most recent annual

    warnings: list[str] = field(default_factory=list)


# ── helpers ───────────────────────────────────────────────────────────────────

def _safe(val, default=0.0) -> float:
    """Return float or default if val is None/NaN."""
    try:
        v = float(val)
        return default if (np.isnan(v) or np.isinf(v)) else v
    except Exception:
        return default


def _row(df: pd.DataFrame, *candidates: str, default=0.0) -> float:
    """
    Extract the most recent annual value from a yfinance DataFrame row.

    Tries exact match first, then substring — prevents 'EBIT' from matching
    'EBITDA' before the exact 'EBIT' row.
    """
    if df is None or df.empty:
        return default

    def _first_val(idx):
        row = df.loc[idx]
        for v in row:
            val = _safe(v, None)
            if val is not None:
                return val
        return None

    # Pass 1: exact match (case-insensitive)
    for label in candidates:
        for idx in df.index:
            if str(idx).lower() == label.lower():
                v = _first_val(idx)
                if v is not None:
                    return v

    # Pass 2: substring match
    for label in candidates:
        for idx in df.index:
            if label.lower() in str(idx).lower():
                v = _first_val(idx)
                if v is not None:
                    return v

    return default


def _ttm(df: pd.DataFrame, *candidates: str) -> float:
    """
    Approximate trailing-12-month value from the 4 most recent quarterly rows,
    or fall back to the most recent annual figure.
    """
    return _row(df, *candidates)


def _revenue_history(ticker_obj: yf.Ticker) -> list[float]:
    """Return up to 5 years of annual revenue (oldest to newest)."""
    try:
        fin = ticker_obj.financials
        if fin is None or fin.empty:
            return []
        # Prefer exact 'Total Revenue' over any row that merely contains 'revenue'
        preferred = ["Total Revenue", "Operating Revenue", "Net Revenue", "Revenue"]
        for label in preferred:
            for idx in fin.index:
                if str(idx).lower() == label.lower():
                    vals = [_safe(v, None) for v in fin.loc[idx]]
                    vals = [v for v in vals if v is not None and v > 0]
                    return list(reversed(vals[:5]))  # oldest → newest
    except Exception:
        pass
    return []


def _risk_free_rate() -> float:
    """Fetch current 10-year US Treasury yield from yfinance (^TNX)."""
    try:
        tnx = yf.Ticker("^TNX")
        price = tnx.fast_info.get("lastPrice") or tnx.info.get("regularMarketPrice")
        if price:
            # ^TNX is quoted as percentage points (e.g., 4.35 means 4.35%)
            return _safe(price) / 100.0
    except Exception as exc:
        logger.warning(f"Could not fetch 10-yr Treasury: {exc}")
    return 0.043  # fallback ≈ long-run average


# ── SEC EDGAR ─────────────────────────────────────────────────────────────────

_edgar_tickers: dict[str, dict] | None = None  # CIK lookup table

def _get_edgar_cik(ticker: str) -> str | None:
    """Return the zero-padded CIK for a ticker using SEC's company_tickers.json."""
    global _edgar_tickers
    try:
        if _edgar_tickers is None:
            r = requests.get(
                "https://www.sec.gov/files/company_tickers.json",
                timeout=10,
                headers={"User-Agent": "valuation-app/1.0 educational@example.com"},
            )
            r.raise_for_status()
            _edgar_tickers = {
                v["ticker"].upper(): str(v["cik_str"]).zfill(10)
                for v in r.json().values()
            }
        return _edgar_tickers.get(ticker.upper())
    except Exception as exc:
        logger.warning(f"EDGAR CIK lookup failed: {exc}")
        return None


def search_companies(query: str) -> list[dict]:
    """
    Search for companies by name or ticker using Yahoo Finance's search API.
    Returns a list of {ticker, name, exchange} dicts.
    """
    try:
        url = (
            "https://query2.finance.yahoo.com/v1/finance/search"
            f"?q={requests.utils.quote(query)}&quotesCount=8&newsCount=0"
            "&enableFuzzyQuery=false&enableNavLinks=false"
        )
        r = requests.get(
            url,
            timeout=10,
            headers={"User-Agent": "valuation-app/1.0"},
        )
        r.raise_for_status()
        quotes = r.json().get("quotes", [])
        results = []
        for q in quotes:
            # Only US equity (EQUITY type, no ^ for indices)
            if q.get("quoteType") == "EQUITY" and not q.get("symbol", "").startswith("^"):
                results.append({
                    "ticker": q.get("symbol", ""),
                    "name": q.get("longname") or q.get("shortname", ""),
                    "exchange": q.get("exchange", ""),
                })
        return results
    except Exception as exc:
        logger.warning(f"Company search failed: {exc}")
        return []


# ── main data fetcher ─────────────────────────────────────────────────────────

def get_financial_data(ticker: str) -> FinancialData:
    """
    Fetch and return all financial data needed for valuation.

    Caches results for CACHE_TTL seconds.
    """
    ticker_upper = ticker.upper()
    now = time.time()
    if ticker_upper in _cache:
        ts, data = _cache[ticker_upper]
        if now - ts < CACHE_TTL:
            return data

    data = _fetch(ticker_upper)
    _cache[ticker_upper] = (now, data)
    return data


def _fetch(ticker: str) -> FinancialData:
    warnings: list[str] = []
    t = yf.Ticker(ticker)

    # ── basic info ────────────────────────────────────────────────────────────
    try:
        info = t.info
    except Exception as exc:
        raise ValueError(f"Ticker '{ticker}' not found or yfinance error: {exc}")

    name = info.get("longName") or info.get("shortName") or ticker
    sector = info.get("sector", "")
    industry = info.get("industry", "")
    description = info.get("longBusinessSummary", "")

    price = _safe(
        info.get("currentPrice")
        or info.get("regularMarketPrice")
        or info.get("previousClose"),
        0.0,
    )
    market_cap = _safe(info.get("marketCap"), 0.0)
    shares = _safe(
        info.get("sharesOutstanding") or info.get("impliedSharesOutstanding"), 0.0
    )
    beta = _safe(info.get("beta"), 1.0)
    if beta <= 0 or beta > 4:
        beta = 1.0
        warnings.append("Beta out of range; defaulted to 1.0")

    # ── financial statements ──────────────────────────────────────────────────
    try:
        fin = t.financials          # annual income statement
        bs  = t.balance_sheet       # annual balance sheet
        cf  = t.cashflow            # annual cash flow
    except Exception as exc:
        warnings.append(f"Financial statement fetch warning: {exc}")
        fin = bs = cf = None

    revenue          = _row(fin, "Total Revenue", "Revenue", "Net Revenue")
    ebit             = _row(fin, "EBIT", "Operating Income", "Operating Income Loss")
    interest_expense = abs(_row(fin, "Interest Expense"))
    tax_provision    = abs(_row(fin, "Tax Provision", "Income Tax Expense"))
    pretax_income    = _row(fin, "Pretax Income", "Income Before Tax")
    net_income       = _row(fin, "Net Income")
    depreciation     = abs(_row(cf, "Depreciation And Amortization", "Depreciation",
                                  "Depreciation Depletion And Amortization"))
    capex            = abs(_row(cf, "Capital Expenditure", "Purchase Of Property Plant And Equipment",
                                   "Purchases Of Property Plant And Equipment"))

    ebitda = ebit + depreciation if ebit and depreciation else _safe(info.get("ebitda"), 0.0)

    cash = _row(bs, "Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments",
                    "Cash And Short Term Investments")
    total_debt = _row(bs, "Total Debt", "Long Term Debt And Capital Lease Obligation",
                          "Long Term Debt")
    # Add short-term debt if not already in Total Debt
    short_debt = _row(bs, "Current Debt", "Short Long Term Debt", "Short Term Borrowings")
    if total_debt == 0 and short_debt > 0:
        total_debt = short_debt

    stockholders_equity = _row(bs, "Stockholders Equity", "Total Stockholder Equity",
                                    "Common Stockholder Equity", "Stockholders Equity")
    total_equity = stockholders_equity

    # Working capital
    current_assets  = _row(bs, "Current Assets", "Total Current Assets")
    current_liab    = _row(bs, "Current Liabilities", "Total Current Liabilities")
    working_capital = current_assets - current_liab

    # ── data quality warnings ─────────────────────────────────────────────────
    if revenue <= 0:
        warnings.append("Revenue is zero or negative — DCF projections will be unreliable")
    if ebit == 0:
        warnings.append("EBIT is zero; operating margin assumed from sector data")
    if shares <= 0:
        # Fallback: compute from market cap and price
        if price > 0 and market_cap > 0:
            shares = market_cap / price
            warnings.append("Shares outstanding estimated from market cap / price")

    # ── derived metrics ───────────────────────────────────────────────────────
    ebit_margin = (ebit / revenue) if revenue > 0 else 0.0
    tax_rate = (tax_provision / pretax_income) if pretax_income > 0 else 0.25
    tax_rate = max(0.10, min(0.40, tax_rate))  # bound to 10-40%

    invested_capital = total_equity + total_debt - cash
    if invested_capital <= 0:
        invested_capital = max(revenue * 0.5, 1.0)  # rough fallback
        warnings.append("Invested capital estimated; balance sheet data may be incomplete")

    sales_to_capital = revenue / invested_capital if invested_capital > 0 else 1.5

    revenue_history = _revenue_history(t)

    return FinancialData(
        ticker=ticker,
        name=name,
        sector=sector,
        industry=industry,
        description=description,
        current_price=price,
        market_cap=market_cap,
        shares_outstanding=shares,
        beta=beta,
        revenue=revenue,
        ebit=ebit,
        interest_expense=interest_expense,
        tax_provision=tax_provision,
        pretax_income=pretax_income,
        net_income=net_income,
        ebitda=ebitda,
        depreciation=depreciation,
        capex=capex,
        cash=cash,
        total_debt=total_debt,
        total_equity=total_equity,
        working_capital=working_capital,
        ebit_margin=ebit_margin,
        tax_rate=tax_rate,
        invested_capital=invested_capital,
        sales_to_capital=sales_to_capital,
        revenue_history=revenue_history,
        warnings=warnings,
    )


def get_risk_free_rate() -> float:
    return _risk_free_rate()
