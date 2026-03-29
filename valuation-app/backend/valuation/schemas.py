"""Pydantic schemas for API request/response."""

from typing import Optional
from pydantic import BaseModel


class Assumptions(BaseModel):
    # Cost of capital
    risk_free_rate: float           # e.g., 0.043
    equity_risk_premium: float      # e.g., 0.045
    beta: float                     # levered
    cost_of_debt: float             # pre-tax, e.g., 0.05
    tax_rate: float                 # effective, e.g., 0.21

    # Growth
    revenue_growth_rate: float      # high-growth phase (years 1-5), e.g., 0.10
    stable_growth_rate: float       # terminal, e.g., 0.025

    # Profitability
    current_operating_margin: float # trailing EBIT/revenue
    target_operating_margin: float  # convergence target (sector or analyst)

    # Capital efficiency
    sales_to_capital_ratio: float   # revenue / invested capital


class YearProjection(BaseModel):
    year: int
    revenue: float
    ebit_margin: float
    nopat: float
    reinvestment: float
    fcff: float
    pv_fcff: float


class DCFDetail(BaseModel):
    wacc: float
    cost_of_equity: float
    after_tax_cost_of_debt: float
    equity_weight: float
    debt_weight: float
    pv_fcff_sum: float
    pv_terminal: float
    terminal_value: float
    op_asset_value: float
    equity_value: float
    price: float
    projections: list[YearProjection]


class MultiplesDetail(BaseModel):
    sector_ev_ebitda: Optional[float] = None
    sector_pe: Optional[float] = None
    sector_ps: Optional[float] = None
    ev_ebitda_implied_price: Optional[float] = None
    pe_implied_price: Optional[float] = None
    ps_implied_price: Optional[float] = None


class ValuationResult(BaseModel):
    ticker: str
    name: str
    sector: str
    industry: str
    description: str
    damodaran_industry: Optional[str] = None

    current_price: float
    market_cap: float
    shares_outstanding: float

    # Core outputs
    dcf_price: float
    multiples_low: Optional[float] = None
    multiples_high: Optional[float] = None
    composite_price: float
    upside_pct: float

    # Detail
    dcf_detail: DCFDetail
    multiples_detail: MultiplesDetail
    assumptions: Assumptions

    # Raw financials (for recalculate)
    revenue: float
    ebitda: float
    net_income: float
    total_debt: float
    cash: float

    warnings: list[str]
    data_as_of: str  # e.g., "2024 annual"


class RecalculateRequest(BaseModel):
    ticker: str
    assumptions: Assumptions
