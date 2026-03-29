"""
Relative valuation (trading multiples) engine.

Applies Damodaran's sector median multiples (EV/EBITDA, P/E, P/S) to the
company's trailing financials to derive implied equity values per share.

The spread across multiples gives the relative-valuation range shown in the UI.
"""

from .schemas import MultiplesDetail


def run_multiples(
    ebitda: float,
    net_income: float,
    revenue: float,
    total_debt: float,
    cash: float,
    shares: float,
    dam: dict,          # output of damodaran.get_sector_data()
) -> MultiplesDetail:
    """
    Return implied prices from EV/EBITDA, P/E, and P/S multiples.

    For EV multiples:
        EV = EBITDA × sector_EV/EBITDA
        Equity value = EV - debt + cash
        Price = equity_value / shares

    For price multiples:
        Price = EPS × sector_P/E
        Price = (revenue / shares) × sector_P/S
    """
    net_debt = total_debt - cash
    eps      = net_income / shares if shares > 0 else None
    rev_ps   = revenue / shares if shares > 0 else None

    sector_ev_ebitda = dam.get("ev_ebitda")
    sector_pe        = dam.get("pe_ratio")
    sector_ps        = dam.get("ps_ratio")

    # EV/EBITDA implied price
    ev_ebitda_implied = None
    if sector_ev_ebitda and ebitda and ebitda > 0 and shares > 0:
        implied_ev       = ebitda * sector_ev_ebitda
        implied_equity   = implied_ev - net_debt
        ev_ebitda_implied = implied_equity / shares

    # P/E implied price
    pe_implied = None
    if sector_pe and eps and eps > 0:
        pe_implied = eps * sector_pe

    # P/S implied price
    ps_implied = None
    if sector_ps and rev_ps and rev_ps > 0:
        ps_implied = rev_ps * sector_ps

    return MultiplesDetail(
        sector_ev_ebitda=round(sector_ev_ebitda, 2) if sector_ev_ebitda else None,
        sector_pe=round(sector_pe, 2) if sector_pe else None,
        sector_ps=round(sector_ps, 2) if sector_ps else None,
        ev_ebitda_implied_price=round(ev_ebitda_implied, 2) if ev_ebitda_implied else None,
        pe_implied_price=round(pe_implied, 2) if pe_implied else None,
        ps_implied_price=round(ps_implied, 2) if ps_implied else None,
    )


def multiples_range(m: MultiplesDetail) -> tuple[float | None, float | None]:
    """Return (low, high) of the multiples-implied price range."""
    vals = [v for v in [
        m.ev_ebitda_implied_price,
        m.pe_implied_price,
        m.ps_implied_price,
    ] if v is not None and v > 0]

    if not vals:
        return None, None
    return round(min(vals), 2), round(max(vals), 2)


def composite_price(dcf: float, multiples: MultiplesDetail) -> float:
    """
    Weighted composite of DCF (60%) and available multiples (40%).

    If no multiples data, returns the DCF price.
    """
    vals = [v for v in [
        multiples.ev_ebitda_implied_price,
        multiples.pe_implied_price,
        multiples.ps_implied_price,
    ] if v is not None and v > 0]

    if not vals:
        return dcf

    multiples_avg = sum(vals) / len(vals)
    return round(0.60 * dcf + 0.40 * multiples_avg, 2)
