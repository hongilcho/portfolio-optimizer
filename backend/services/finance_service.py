import yfinance as yf
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple

def get_usd_krw_rate() -> float:
    """
    Fetch the latest USD/KRW exchange rate.
    """
    try:
        data = yf.Ticker("USDKRW=X").history(period="5d")
        if not data.empty and "Close" in data:
            rate = float(data["Close"].dropna().iloc[-1])
            return round(rate, 2)
    except Exception as e:
        print(f"Error fetching USD/KRW: {e}")
    return 1400.0

def get_ticker_info(ticker: str) -> Dict[str, Any]:
    try:
        info = yf.Ticker(ticker).info
        return {
            "shortName": info.get("shortName", ""),
            "longName": info.get("longName", ""),
            "category": info.get("category", ""),
            "industry": info.get("industry", "")
        }
    except Exception:
        return {}


def get_proxy_recommendations(ticker: str) -> List[Dict[str, str]]:
    """
    Returns a list of recommended proxy tickers for backfilling data.
    Most appropriate are at the top.
    """
    # Hardcoded exact mappings for common ETFs and mutual funds
    hardcoded = {
        "QQQM": [{"ticker": "QQQ", "name": "Invesco QQQ Trust", "reason": "Direct older equivalent (1999~)"}],
        "SPLG": [{"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "Tracks same S&P 500 index (1993~)"}],
        "IVV": [{"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "Tracks same index (1993~)"}],
        "VOO": [{"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "Tracks same index (1993~)"}],
        "SCHG": [{"ticker": "QQQ", "name": "Invesco QQQ Trust", "reason": "Similar large-cap growth (1999~)"}],
        "VGT": [{"ticker": "XLK", "name": "Technology Select Sector SPDR", "reason": "Broad tech sector (1998~)"}],
        "TLT": [{"ticker": "VUSTX", "name": "Vanguard Long-Term Treasury Fund", "reason": "20Y+ US Treasury Mutual Fund (1986~)"}],
        "SCHD": [
            {"ticker": "VDIGX", "name": "Vanguard Dividend Growth Fund", "reason": "US Dividend Growth Fund (1992~)"},
            {"ticker": "DVY", "name": "iShares Select Dividend ETF", "reason": "Older US Dividend ETF (2003~)"}
        ],
        "GLD": [
            {"ticker": "GC=F", "name": "Gold Continuous Futures", "reason": "Continuous Gold Futures on CME/COMEX (2000~)"},
            {"ticker": "IAU", "name": "iShares Gold Trust", "reason": "Older Gold Trust ETF (2005~)"}
        ],
        "PDBC": [
            {"ticker": "DBC", "name": "Invesco DB Commodity Index", "reason": "Broad Commodity ETF (2006~)"},
            {"ticker": "PCRAX", "name": "PIMCO Commodity Real Return Fund", "reason": "Broad Commodity Mutual Fund (2002~)"},
            {"ticker": "CL=F", "name": "Crude Oil Futures", "reason": "WTI Crude Oil Futures (2000~)"}
        ],
        "DBC": [
            {"ticker": "PCRAX", "name": "PIMCO Commodity Real Return Fund", "reason": "Broad Commodity Mutual Fund (2002~)"},
            {"ticker": "CL=F", "name": "Crude Oil Futures", "reason": "WTI Crude Oil Futures (2000~)"}
        ]
    }

    recs = []
    if ticker.upper() in hardcoded:
        recs.extend(hardcoded[ticker.upper()])

    # Add standard broad market proxies
    broad_proxies = [
        {"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "US Large Cap Equity (1993~)"},
        {"ticker": "QQQ", "name": "Invesco QQQ Trust", "reason": "US Tech / Growth Equity (1999~)"},
        {"ticker": "IWM", "name": "iShares Russell 2000 ETF", "reason": "US Small Cap Equity (2000~)"},
        {"ticker": "EFA", "name": "iShares MSCI EAFE ETF", "reason": "Developed Markets Equity (2001~)"},
        {"ticker": "EEM", "name": "iShares MSCI Emerging Markets", "reason": "Emerging Markets Equity (2003~)"},
        {"ticker": "AGG", "name": "iShares Core US Aggregate Bond", "reason": "US Broad Bonds (2003~)"},
        {"ticker": "TLT", "name": "iShares 20+ Year Treasury Bond", "reason": "US Long Term Treasury (2002~)"},
        {"ticker": "GLD", "name": "SPDR Gold Shares", "reason": "Gold / Commodities (2004~)"},
        {"ticker": "VNQ", "name": "Vanguard Real Estate ETF", "reason": "Real Estate REIT (2004~)"},
    ]

    for bp in broad_proxies:
        if bp["ticker"] != ticker.upper() and bp["ticker"] not in [r["ticker"] for r in recs]:
            recs.append(bp)
            
    return recs

def validate_proxy(proxy_ticker: str) -> Dict[str, Any]:
    """
    Validate a single proxy ticker using Yahoo Finance.
    Returns valid status, name, inception start date, end date, and years available.
    """
    ticker_clean = proxy_ticker.strip().upper()
    if not ticker_clean:
        return {"valid": False, "error": "티커를 입력해 주세요."}
    
    try:
        df = yf.download(ticker_clean, period="max", progress=False)
        if df.empty:
            return {"valid": False, "ticker": ticker_clean, "error": f"'{ticker_clean}' 데이터를 Yahoo Finance에서 찾을 수 없습니다."}
        
        col = "Adj Close" if "Adj Close" in df else ("Close" if "Close" in df else df.columns[0])
        s = df[col].dropna()
        if s.empty:
            return {"valid": False, "ticker": ticker_clean, "error": f"'{ticker_clean}'의 가격 데이터가 비어 있습니다."}
        
        start_date = s.index[0].strftime("%Y-%m-%d")
        end_date = s.index[-1].strftime("%Y-%m-%d")
        total_years = round((s.index[-1] - s.index[0]).days / 365.25, 1)
        
        info = get_ticker_info(ticker_clean)
        display_name = info.get("shortName") or info.get("longName") or ticker_clean
        
        return {
            "valid": True,
            "ticker": ticker_clean,
            "name": display_name,
            "start_date": start_date,
            "end_date": end_date,
            "years": total_years,
            "count": len(s)
        }
    except Exception as e:
        return {"valid": False, "ticker": ticker_clean, "error": str(e)}

def get_portfolio_coverage(tickers: List[str], proxies: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Analyzes inception dates and backfill coverage for all tickers in the portfolio.
    Identifies the bottleneck asset limiting the common lookback history.
    """
    if not tickers:
        return {"tickers": {}, "common_start_date": None, "bottleneck_ticker": None}
        
    if proxies is None:
        proxies = {}

    all_symbols = list(set(tickers + [p for p in proxies.values() if p]))
    try:
        raw = _download_with_cache(all_symbols, period="max")
        if isinstance(raw.columns, pd.MultiIndex):
            col_name = "Adj Close" if "Adj Close" in raw.columns.get_level_values(0) else "Close"
            data = raw[col_name]
        else:
            data = raw


        coverage_details = {}
        effective_starts = {}

        for t in tickers:
            t_first = None
            if t in data.columns:
                fvi = data[t].first_valid_index()
                if fvi is not None:
                    t_first = fvi.strftime("%Y-%m-%d")
            
            proxy = proxies.get(t)
            proxy_first = None
            if proxy and proxy in data.columns:
                pfvi = data[proxy].first_valid_index()
                if pfvi is not None:
                    proxy_first = pfvi.strftime("%Y-%m-%d")

            effective_start = proxy_first if (proxy_first and t_first and proxy_first < t_first) else (proxy_first or t_first)
            
            orig_days = (pd.to_datetime('today') - pd.to_datetime(t_first)).days if t_first else 0
            eff_days = (pd.to_datetime('today') - pd.to_datetime(effective_start)).days if effective_start else 0
            
            ext_days = eff_days - orig_days
            ext_years = round(ext_days / 365.25, 1) if ext_days > 0 else 0.0
            tot_years = round(eff_days / 365.25, 1)


            coverage_details[t] = {
                "ticker": t,
                "original_start": t_first,
                "proxy": proxy,
                "proxy_start": proxy_first,
                "effective_start": effective_start,
                "extended_years": max(0.0, ext_years),
                "total_years": tot_years
            }
            if effective_start:
                effective_starts[t] = effective_start

        if effective_starts:
            # Common start date is the LATEST (most recent) of all effective_starts
            bottleneck_t = max(effective_starts, key=effective_starts.get)
            common_start = effective_starts[bottleneck_t]
            common_years = round((pd.to_datetime('today') - pd.to_datetime(common_start)).days / 365.25, 1)
            
            b_info = coverage_details[bottleneck_t]
            p_str = f" (프록시: {b_info['proxy']})" if b_info.get('proxy') else " (프록시 없음)"
            bottleneck_msg = f"{bottleneck_t}{p_str}의 시작일({common_start})이 전체 포트폴리오의 공통 분석 기간을 제한하고 있습니다."
        else:
            common_start = None
            common_years = 0.0
            bottleneck_t = None
            bottleneck_msg = "가용 데이터가 없습니다."

        return {
            "tickers": coverage_details,
            "common_start_date": common_start,
            "total_common_years": common_years,
            "bottleneck_ticker": bottleneck_t,
            "bottleneck_message": bottleneck_msg
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"tickers": {}, "error": str(e)}

import time

# Thread-safe in-memory cache to prevent concurrent duplicate downloads and reduce RAM
_price_cache = {}
_cache_ttl_seconds = 3600  # 1 hour cache

def _get_cache_key(symbols: List[str], period: str) -> str:
    return f"{','.join(sorted(symbols))}_{period}"

def _download_with_cache(symbols: List[str], period: str) -> pd.DataFrame:
    key = _get_cache_key(symbols, period)
    now = time.time()
    if key in _price_cache:
        cached_time, cached_df = _price_cache[key]
        if now - cached_time < _cache_ttl_seconds:
            return cached_df.copy()

    data = pd.DataFrame()
    for attempt in range(3):
        try:
            data = yf.download(
                symbols, 
                period=period, 
                progress=False, 
                auto_adjust=False,
                timeout=25
            )
            if not data.empty:
                break
            time.sleep(1)
        except Exception as err:
            print(f"yfinance download attempt {attempt+1} failed: {err}")
            time.sleep(1.5)

    if not data.empty:
        # Keep cache size small: retain at most 15 most recent entries
        if len(_price_cache) > 15:
            oldest_k = min(_price_cache.keys(), key=lambda k: _price_cache[k][0])
            del _price_cache[oldest_k]
        _price_cache[key] = (now, data.copy())

    return data

def fetch_historical_data(tickers: List[str], period: str = "5y", proxies: Dict[str, str] = None) -> pd.DataFrame:
    """
    Fetch historical adjusted closing prices for the given tickers.
    If proxies are provided, it backfills missing data for a ticker using its proxy.
    """
    if not tickers:
        return pd.DataFrame()
        
    if proxies is None:
        proxies = {}

    all_tickers_to_fetch = list(set(tickers + [p for p in proxies.values() if p]))
    
    data = _download_with_cache(all_tickers_to_fetch, period=period)


    try:
        if data.empty:
            print(f"Warning: No data returned from yfinance for {all_tickers_to_fetch}")
            return pd.DataFrame()

        # Extract 'Close' or 'Adj Close'
        if isinstance(data.columns, pd.MultiIndex):
            if "Adj Close" in data.columns.get_level_values(0):
                data = data["Adj Close"].copy()
            elif "Close" in data.columns.get_level_values(0):
                data = data["Close"].copy()
        else:
            if "Adj Close" in data.columns:
                data = data["Adj Close"].copy()
            elif "Close" in data.columns:
                data = data["Close"].copy()
        
        if isinstance(data, pd.Series):
            data = data.to_frame(name=all_tickers_to_fetch[0])

        # Backfill each ticker that has a valid proxy
        for ticker, proxy in proxies.items():
            if proxy and proxy in data.columns and ticker in data.columns:
                t_first = data[ticker].first_valid_index()
                p_first = data[proxy].first_valid_index()
                
                if t_first is not None and p_first is not None and p_first < t_first:
                    # Valid slice from proxy's first date onwards
                    valid_slice = data.index[data.index >= p_first]
                    
                    t_ret = data.loc[valid_slice, ticker].pct_change(fill_method=None)
                    p_ret = data.loc[valid_slice, proxy].pct_change(fill_method=None)
                    
                    comb_ret = t_ret.copy()
                    mask = comb_ret.isna() & ~p_ret.isna()
                    comb_ret.loc[mask] = p_ret.loc[mask]
                    
                    sim_prices = (1 + comb_ret.fillna(0)).cumprod()
                    scale = data.loc[t_first, ticker] / sim_prices.loc[t_first]
                    
                    data.loc[valid_slice, ticker] = sim_prices * scale
                    
                    # Explicitly keep dates BEFORE proxy inception as NaN!
                    before_mask = data.index < p_first
                    data.loc[before_mask, ticker] = np.nan

        # Keep only the requested tickers that exist in data
        existing_tickers = [t for t in tickers if t in data.columns]
        data = data[existing_tickers]
        
        # Drop rows where ANY of the requested tickers is NaN
        data = data.dropna()
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error fetching data: {e}")
        return pd.DataFrame()

def fetch_dual_currency_data(
    tickers: List[str], 
    period: str = "5y", 
    proxies: Dict[str, str] = None, 
    hedged_tickers: List[str] = None
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series]:
    """
    Fetches historical price data in both USD and KRW.
    For tickers in hedged_tickers, the KRW series purely follows USD returns without FX fluctuations.
    For unhedged tickers, KRW price = USD price * (USD/KRW rate).
    Returns (data_usd, data_krw, fx_series).
    """
    if proxies is None:
        proxies = {}
    if hedged_tickers is None:
        hedged_tickers = []

    # 1. Fetch pure asset prices (USD) with full lookback
    data_usd = fetch_historical_data(tickers, period=period, proxies=proxies)
    if data_usd.empty:
        return pd.DataFrame(), pd.DataFrame(), pd.Series(dtype=float)

    # 2. Fetch USDKRW=X exchange rate
    fx_raw = fetch_historical_data(["USDKRW=X"], period=period)
    
    # 3. Align FX series to data_usd.index (do not drop asset history before 2003)
    if not fx_raw.empty and "USDKRW=X" in fx_raw.columns:
        fx_aligned = fx_raw["USDKRW=X"].reindex(data_usd.index)
        fx_series = fx_aligned.ffill().bfill()
    else:
        fx_series = pd.Series(1400.0, index=data_usd.index)

    # 4. Construct KRW and USD prices
    data_krw = pd.DataFrame(index=data_usd.index)
    
    # We must treat data_usd as raw_data for now, and fix it inline
    for t in data_usd.columns:
        is_krw_native = t.endswith('.KS') or t.endswith('.KQ')
        
        if is_krw_native:
            # The raw data is already in KRW
            data_krw[t] = data_usd[t]
            # Convert KRW to USD for data_usd
            data_usd[t] = data_usd[t] / fx_series
        else:
            # The raw data is in USD
            if t in hedged_tickers:
                usd_ret = data_usd[t].pct_change(fill_method=None).fillna(0)
                initial_krw_price = data_usd[t].iloc[0] * fx_series.iloc[0]
                data_krw[t] = initial_krw_price * (1 + usd_ret).cumprod()
            else:
                # Unhedged: Multiply by exchange rate
                data_krw[t] = data_usd[t] * fx_series

    data_krw.attrs = getattr(data_usd, 'attrs', {})
    return data_usd, data_krw, fx_series
