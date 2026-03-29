"""
Full Damodaran-style DCF valuation engine.

Methodology follows Damodaran's "narrative-driven DCF":
  1. Project revenues (high-growth phase → stable phase)
  2. Converge operating margin toward sector target
  3. Compute NOPAT and reinvestment via sales-to-capital ratio
  4. Discount free cash flows at WACC
  5. Terminal value via Gordon Growth (stable ROIC = WACC at competitive equilibrium)
  6. Equity value = operating asset value + cash - debt

References:
  Damodaran, A. "Investment Valuation" (3rd ed.), Chapters 12-13
  http://pages.stern.nyu.edu/~adamodar/
"""

import math
from .schemas import Assumptions, DCFDetail, YearProjection


def run_dcf(
    revenue: float,
    market_cap: float,
    total_debt: float,
    cash: float,
    shares_outstanding: float,
    assumptions: Assumptions,
) -> DCFDetail:
    """
    Run a 10-year DCF and return detailed results.

    Parameters
    ----------
    revenue : TTM revenue
    market_cap : current equity market value
    total_debt : book value of total debt
    cash : cash and equivalents
    shares_outstanding : diluted shares
    assumptions : all adjustable parameters (WACC inputs, growth, margins)
    """
    rf   = assumptions.risk_free_rate
    erp  = assumptions.equity_risk_premium
    beta = max(0.1, assumptions.beta)
    cod  = assumptions.cost_of_debt
    t    = assumptions.tax_rate
    g    = assumptions.revenue_growth_rate
    g_s  = assumptions.stable_growth_rate   # terminal / stable growth
    curr_margin   = assumptions.current_operating_margin
    target_margin = assumptions.target_operating_margin
    s2c  = max(0.1, assumptions.sales_to_capital_ratio)

    # ── WACC ─────────────────────────────────────────────────────────────────
    cost_of_equity = rf + beta * erp
    atcod = cod * (1 - t)               # after-tax cost of debt

    E = max(market_cap, 1.0)
    D = max(total_debt, 0.0)
    total_capital = E + D
    w_e = E / total_capital
    w_d = D / total_capital

    wacc = w_e * cost_of_equity + w_d * atcod
    # Bound WACC to a plausible range
    wacc = max(0.04, min(0.30, wacc))

    # Stable growth must be strictly below WACC
    g_s = min(g_s, wacc - 0.01)

    # ── 10-year projection ────────────────────────────────────────────────────
    projections: list[YearProjection] = []
    rev_t = revenue
    pv_fcff_sum = 0.0

    for yr in range(1, 11):
        # Revenue growth: high-growth phase (1-5), fade to stable (6-10)
        if yr <= 5:
            g_yr = g
        else:
            fade = (yr - 5) / 5          # 0 → 1 over years 6-10
            g_yr = g * (1 - fade) + g_s * fade

        rev_prev = rev_t
        rev_t = rev_t * (1 + g_yr)

        # Operating margin: linear convergence from current to target over 5 yrs
        if yr <= 5:
            margin = curr_margin + (target_margin - curr_margin) * yr / 5
        else:
            margin = target_margin

        # NOPAT
        ebit  = rev_t * margin
        nopat = ebit * (1 - t)

        # Reinvestment via sales-to-capital ratio
        delta_rev     = rev_t - rev_prev
        reinvestment  = delta_rev / s2c

        # FCFF
        fcff = nopat - reinvestment

        # PV
        discount = (1 + wacc) ** yr
        pv_fcff  = fcff / discount
        pv_fcff_sum += pv_fcff

        projections.append(
            YearProjection(
                year=yr,
                revenue=round(rev_t, 0),
                ebit_margin=round(margin, 4),
                nopat=round(nopat, 0),
                reinvestment=round(reinvestment, 0),
                fcff=round(fcff, 0),
                pv_fcff=round(pv_fcff, 0),
            )
        )

    # ── terminal value ────────────────────────────────────────────────────────
    # At competitive equilibrium, ROIC_stable = WACC_stable
    # → reinvestment_rate = g_s / ROIC_stable = g_s / wacc
    terminal_reinv_rate = g_s / wacc
    terminal_reinv_rate = max(0.0, min(0.6, terminal_reinv_rate))

    # Terminal NOPAT grows at g_s beyond year 10
    last_nopat   = projections[-1].nopat
    terminal_nopat = last_nopat * (1 + g_s)
    terminal_fcff  = terminal_nopat * (1 - terminal_reinv_rate)
    terminal_value = terminal_fcff / (wacc - g_s)

    pv_terminal = terminal_value / (1 + wacc) ** 10

    # ── value of operating assets ─────────────────────────────────────────────
    op_asset_value = pv_fcff_sum + pv_terminal

    # ── equity value & price per share ────────────────────────────────────────
    equity_value = op_asset_value + cash - total_debt
    price = equity_value / shares_outstanding if shares_outstanding > 0 else 0.0

    return DCFDetail(
        wacc=round(wacc, 4),
        cost_of_equity=round(cost_of_equity, 4),
        after_tax_cost_of_debt=round(atcod, 4),
        equity_weight=round(w_e, 4),
        debt_weight=round(w_d, 4),
        pv_fcff_sum=round(pv_fcff_sum, 0),
        pv_terminal=round(pv_terminal, 0),
        terminal_value=round(terminal_value, 0),
        op_asset_value=round(op_asset_value, 0),
        equity_value=round(equity_value, 0),
        price=round(price, 2),
        projections=projections,
    )


def build_default_assumptions(
    fin,          # FinancialData
    dam: dict,    # output of damodaran.get_sector_data()
    rf: float,
) -> Assumptions:
    """
    Construct default assumptions from financial data and Damodaran sector parameters.

    The user can override any of these via the AssumptionsPanel.
    """
    # Revenue growth: 5-year CAGR from historical data, floored/capped
    revenue_cagr = _estimate_revenue_growth(fin)

    # Sector unlevered beta re-levered for company's capital structure
    unlevered_beta = dam.get("unlevered_beta", 0.9)
    d_e = fin.total_debt / fin.market_cap if fin.market_cap > 0 else 0.0
    relevered_beta = unlevered_beta * (1 + (1 - fin.tax_rate) * d_e)
    # If company beta is available and plausible, blend (60/40 sector/company)
    if 0.2 < fin.beta < 3.0:
        relevered_beta = 0.6 * relevered_beta + 0.4 * fin.beta
    relevered_beta = round(max(0.2, min(3.0, relevered_beta)), 2)

    erp = dam.get("erp", 0.045)

    # Cost of debt: interest expense / total debt, bounded below by rf
    cod = (
        fin.interest_expense / fin.total_debt
        if fin.total_debt > 0 and fin.interest_expense > 0
        else rf + 0.015
    )
    cod = round(max(rf, min(0.15, cod)), 4)

    # Operating margins
    curr_margin   = max(-0.5, min(0.6, fin.ebit_margin))
    # Target = current margin converging upward if negative, else hold
    target_margin = max(curr_margin, 0.05) if curr_margin < 0.05 else curr_margin
    target_margin = round(max(-0.2, min(0.5, target_margin)), 4)

    # Stable growth ≈ long-run nominal GDP growth (~2-3%).
    # Must be below the high-growth rate (can't accelerate in perpetuity).
    stable_growth = round(min(rf * 0.6, 0.03, max(revenue_cagr - 0.01, 0.01)), 4)

    return Assumptions(
        risk_free_rate=round(rf, 4),
        equity_risk_premium=round(erp, 4),
        beta=relevered_beta,
        cost_of_debt=cod,
        tax_rate=round(fin.tax_rate, 4),
        revenue_growth_rate=round(revenue_cagr, 4),
        stable_growth_rate=stable_growth,
        current_operating_margin=round(curr_margin, 4),
        target_operating_margin=round(target_margin, 4),
        sales_to_capital_ratio=round(max(0.5, min(5.0, fin.sales_to_capital)), 4),
    )


def _estimate_revenue_growth(fin) -> float:
    """Estimate expected revenue growth from historical data."""
    history = fin.revenue_history
    if len(history) >= 2 and history[0] > 0 and history[-1] > 0:
        n = len(history) - 1
        cagr = (history[-1] / history[0]) ** (1 / n) - 1
        # Mean-revert extreme values toward a moderate growth rate
        cagr = max(-0.20, min(0.40, cagr))
        # Blend historical CAGR (70%) with mean reversion (30% toward 8%)
        return 0.70 * cagr + 0.30 * 0.08
    # Fallback: modest positive growth
    return 0.08
