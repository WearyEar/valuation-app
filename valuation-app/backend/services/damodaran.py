"""
Damodaran dataset loader.

Downloads and caches Excel files from Damodaran's NYU Stern website.
Provides sector betas, EV/EBITDA multiples, P/E multiples, and implied ERP.
Files are refreshed weekly from:  https://pages.stern.nyu.edu/~adamodar/pc/datasets/
"""

import logging
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data" / "damodaran"
CACHE_DAYS = 7

# Damodaran's standard dataset URLs (updated annually each January)
# Verified live as of early 2026
URLS = {
    "betaUS":  "https://pages.stern.nyu.edu/~adamodar/pc/datasets/betas.xls",
    "wacc":    "https://pages.stern.nyu.edu/~adamodar/pc/datasets/wacc.xls",
    "evmult":  "https://pages.stern.nyu.edu/~adamodar/pc/datasets/vebitda.xls",
    "pe":      "https://pages.stern.nyu.edu/~adamodar/pc/datasets/pedata.xls",
    "ps":      "https://pages.stern.nyu.edu/~adamodar/pc/datasets/psdata.xls",
    "margins": "https://pages.stern.nyu.edu/~adamodar/pc/datasets/margin.xls",
    "erp":     "https://pages.stern.nyu.edu/~adamodar/pc/datasets/histimpl.xls",
}


# ── file fetching ─────────────────────────────────────────────────────────────

def _get_file(name: str) -> Path:
    """Return path to cached dataset, downloading if stale or missing."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{name}.xls"

    if path.exists():
        age = datetime.now() - datetime.fromtimestamp(path.stat().st_mtime)
        if age < timedelta(days=CACHE_DAYS):
            return path

    url = URLS.get(name)
    if not url:
        raise ValueError(f"Unknown dataset: {name}")

    try:
        r = requests.get(
            url,
            timeout=30,
            headers={"User-Agent": "valuation-app/1.0 (educational use)"},
        )
        r.raise_for_status()
        path.write_bytes(r.content)
        logger.info(f"Downloaded Damodaran dataset: {name}")
    except Exception as exc:
        if path.exists():
            logger.warning(f"Could not refresh {name} ({exc}); using cached copy")
        else:
            raise RuntimeError(f"Cannot download {name}: {exc}") from exc

    return path


def _parse_excel(path: Path) -> pd.DataFrame:
    """
    Parse a Damodaran Excel file into a clean DataFrame.

    Damodaran's files typically have a few rows of metadata at the top before
    the actual data table begins.  We locate the header row by finding the
    first row that contains the word 'industry name'.

    Prefers the 'Industry Averages' sheet if present (most Damodaran files
    have a 'Variables & FAQ' sheet first that we must skip).
    """
    for engine in ("xlrd", "openpyxl"):
        try:
            all_sheets = pd.read_excel(path, sheet_name=None, header=None, engine=engine)
            break
        except Exception:
            continue
    else:
        raise ValueError(f"Cannot read {path} with xlrd or openpyxl")

    # Prefer the 'Industry Averages' sheet; fall back to first non-empty sheet
    sheet_order = sorted(
        all_sheets.keys(),
        key=lambda s: (0 if "industry averages" in s.lower() else 1),
    )
    raw = None
    for sheet in sheet_order:
        candidate = all_sheets[sheet]
        if not candidate.empty and candidate.shape[0] > 5:
            raw = candidate
            break

    if raw is None:
        raise ValueError(f"No usable sheet found in {path.name}")

    # Find the row that is the actual column header.
    # Look for a cell containing exactly "industry name" (Damodaran's standard label).
    # Fall back to any cell that starts with "industry" if the exact label isn't found.
    header_row = None
    for i, row in raw.iterrows():
        vals_lower = [str(v).strip().lower() for v in row.values]
        if any(v == "industry name" for v in vals_lower):
            header_row = i
            break
    if header_row is None:
        for i, row in raw.iterrows():
            vals_lower = [str(v).strip().lower() for v in row.values]
            if any(v.startswith("industry") and len(v) < 25 for v in vals_lower):
                header_row = i
                break

    if header_row is None:
        raise ValueError(f"Header row not found in {path.name}")

    df = raw.copy()
    cols_raw = raw.iloc[header_row].astype(str).str.strip().tolist()
    # Deduplicate column names (pandas keeps duplicates which breaks scalar access)
    seen: dict[str, int] = {}
    unique_cols = []
    for c in cols_raw:
        if c in seen:
            seen[c] += 1
            unique_cols.append(f"{c}.{seen[c]}")
        else:
            seen[c] = 0
            unique_cols.append(c)
    df.columns = unique_cols
    df = df.iloc[header_row + 1 :].reset_index(drop=True)

    # Drop footer/totals rows
    industry_col = next(c for c in df.columns if "industry" in c.lower())
    mask = (
        df[industry_col].notna()
        & ~df[industry_col].astype(str).str.lower().isin(
            ["nan", "", "total", "market", "industry name"]
        )
    )
    return df[mask].reset_index(drop=True)


def _safe_float(val) -> float | None:
    try:
        v = float(val)
        return None if (np.isnan(v) or np.isinf(v)) else v
    except Exception:
        return None


def _industry_col(df: pd.DataFrame) -> str:
    return next(
        c for c in df.columns
        if isinstance(c, str) and "industry" in c.lower()
    )


def _find_col(df: pd.DataFrame, *keywords: str) -> str | None:
    """Return the first column whose name (lowercased) contains all keywords."""
    for col in df.columns:
        if not isinstance(col, str):
            continue
        col_l = col.lower()
        if all(kw in col_l for kw in keywords):
            return col
    return None


def _extract_dict(df: pd.DataFrame, value_col: str,
                  lo: float, hi: float) -> dict[str, float]:
    """Build {industry_name: float_value} with sanity-range filtering."""
    ind_col = _industry_col(df)
    result: dict[str, float] = {}
    for _, row in df.iterrows():
        name = str(row[ind_col]).strip()
        val = _safe_float(row[value_col])
        if val is not None and lo < val < hi:
            result[name] = val
    return result


# ── public data accessors ─────────────────────────────────────────────────────

def get_sector_betas() -> dict[str, float]:
    """Return {industry: unlevered_beta} from Damodaran's betaUS dataset."""
    try:
        df = _parse_excel(_get_file("betaUS"))
        # Prefer a column explicitly named 'unlevered beta' or similar
        col = (
            _find_col(df, "unlevered", "beta")
            or _find_col(df, "beta", "unlevered")
            # Some years the column is just 'Unlevered Beta corrected for cash'
            or next((c for c in df.columns if "unlevered" in c.lower()), None)
        )
        if col is None:
            logger.warning("betaUS: unlevered beta column not found")
            return {}
        return _extract_dict(df, col, 0.0, 5.0)
    except Exception as exc:
        logger.warning(f"get_sector_betas failed: {exc}")
        return {}


def get_ev_ebitda() -> dict[str, float]:
    """Return {industry: EV/EBITDA} from Damodaran's EV multiples dataset."""
    try:
        df = _parse_excel(_get_file("evmult"))
        # Prefer exact "EV/EBITDA" to avoid matching "EV/EBITDAR&D"
        col = next(
            (c for c in df.columns if isinstance(c, str) and c.strip().upper() == "EV/EBITDA"),
            None,
        )
        if col is None:
            col = _find_col(df, "ev/ebitda")
        if col is None:
            logger.warning("evmult: EV/EBITDA column not found")
            return {}
        return _extract_dict(df, col, 0.5, 300.0)
    except Exception as exc:
        logger.warning(f"get_ev_ebitda failed: {exc}")
        return {}


def get_pe_ratios() -> dict[str, float]:
    """Return {industry: P/E} from Damodaran's P/E dataset."""
    try:
        df = _parse_excel(_get_file("pe"))
        col = (
            _find_col(df, "current", "pe")
            or _find_col(df, "pe")
            or next((c for c in df.columns if "p/e" in c.lower()), None)
        )
        if col is None:
            logger.warning("pe: P/E column not found")
            return {}
        return _extract_dict(df, col, 1.0, 500.0)
    except Exception as exc:
        logger.warning(f"get_pe_ratios failed: {exc}")
        return {}


def get_ps_ratios() -> dict[str, float]:
    """Return {industry: P/S} from Damodaran's P/Sales dataset."""
    try:
        df = _parse_excel(_get_file("ps"))
        col = (
            _find_col(df, "price/sales")
            or _find_col(df, "ps")
            or next(
                (c for c in df.columns
                 if ("p/s" in c.lower() or "price/sale" in c.lower() or "ps" in c.lower())),
                None,
            )
        )
        if col is None:
            return {}
        return _extract_dict(df, col, 0.0, 200.0)
    except Exception as exc:
        logger.warning(f"get_ps_ratios failed: {exc}")
        return {}


def get_sector_margins() -> dict[str, float]:
    """Return {industry: net_margin} from Damodaran's margins dataset."""
    try:
        df = _parse_excel(_get_file("margins"))
        col = (
            _find_col(df, "net", "margin")
            or _find_col(df, "after-tax", "margin")
            or next(
                (c for c in df.columns if "net margin" in c.lower()),
                None,
            )
        )
        if col is None:
            return {}
        return _extract_dict(df, col, -1.0, 1.0)
    except Exception as exc:
        logger.warning(f"get_sector_margins failed: {exc}")
        return {}


def get_erp() -> float:
    """
    Return Damodaran's implied equity risk premium for the US market.

    Parses histimpl.xls ('Historical Impl Premiums' sheet), column 15
    'Implied ERP (FCFE)'.  Falls back to 4.5% if unavailable.
    """
    try:
        path = _get_file("erp")
        for engine in ("xlrd", "openpyxl"):
            try:
                raw = pd.read_excel(
                    path,
                    sheet_name="Historical Impl Premiums",
                    header=None,
                    engine=engine,
                )
                break
            except Exception:
                continue
        else:
            return 0.045

        # Header at row 6; col 15 = "Implied ERP (FCFE)", col 16 = risk-adjusted version
        # Get the last non-NaN value in columns 15 or 16 (most recent year)
        data = raw.iloc[7:]  # skip header rows
        for col in (15, 16, 13):  # FCFE, risk-adj, DDM — try in preference order
            if col >= raw.shape[1]:
                continue
            series = data[col].apply(lambda v: _safe_float(v))
            series = series[series.notna() & (series > 0.01) & (series < 0.20)]
            if not series.empty:
                return round(float(series.iloc[-1]), 4)

    except Exception as exc:
        logger.warning(f"get_erp failed: {exc}")

    return 0.045  # Damodaran's typical US ERP


# ── industry matching ─────────────────────────────────────────────────────────

def match_industry(yf_industry: str, damodaran_dict: dict[str, float]) -> str | None:
    """
    Fuzzy-match a yfinance industry string to a Damodaran industry name.

    Strategy (in order):
    1. Exact match (case-insensitive)
    2. Substring containment either way
    3. Keyword overlap score
    """
    if not yf_industry or not damodaran_dict:
        return None

    yf_lower = yf_industry.lower()

    # 1. Exact
    for name in damodaran_dict:
        if name.lower() == yf_lower:
            return name

    # 2. Substring
    for name in damodaran_dict:
        nl = name.lower()
        if yf_lower in nl or nl in yf_lower:
            return name

    # 3. Keyword overlap
    keywords = [w for w in yf_lower.split() if len(w) > 3]
    best_name, best_score = None, 0
    for name in damodaran_dict:
        nl = name.lower()
        score = sum(1 for kw in keywords if kw in nl)
        if score > best_score:
            best_score, best_name = score, name

    return best_name if best_score > 0 else None


def get_sector_data(industry: str, sector: str = "") -> dict:
    """
    Return all Damodaran inputs for a given yfinance industry/sector.

    Each dataset is matched independently because Damodaran's industry names
    can differ slightly across files (e.g., 'Electronics (Consumer & Office)'
    in betas vs 'Electronics (General)' in pe).
    """
    betas    = get_sector_betas()
    ev_ebitda = get_ev_ebitda()
    pe       = get_pe_ratios()
    ps       = get_ps_ratios()
    erp      = get_erp()

    def _match(d):
        return match_industry(industry, d) or match_industry(sector, d)

    dam_beta  = _match(betas)
    dam_ev    = _match(ev_ebitda)
    dam_pe    = _match(pe)
    dam_ps    = _match(ps)

    return {
        "matched_industry": dam_beta,
        "unlevered_beta":   betas.get(dam_beta, 0.9) if dam_beta else 0.9,
        "ev_ebitda":        ev_ebitda.get(dam_ev) if dam_ev else None,
        "pe_ratio":         pe.get(dam_pe) if dam_pe else None,
        "ps_ratio":         ps.get(dam_ps) if dam_ps else None,
        "erp":              erp,
    }
