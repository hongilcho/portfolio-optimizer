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
    # Hardcoded exact mappings for common new ETFs
    hardcoded = {
        "QQQM": [{"ticker": "QQQ", "name": "Invesco QQQ Trust", "reason": "Direct older equivalent"}],
        "SPLG": [{"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "Tracks same index"}],
        "IVV": [{"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "Tracks same index"}],
        "VOO": [{"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "Tracks same index"}],
        "SCHG": [{"ticker": "QQQ", "name": "Invesco QQQ Trust", "reason": "Similar large-cap growth"}],
        "VGT": [{"ticker": "XLK", "name": "Technology Select Sector SPDR", "reason": "Broad tech sector"}],
    }

    recs = []
    if ticker.upper() in hardcoded:
        recs.extend(hardcoded[ticker.upper()])

    # Add standard broad market proxies
    broad_proxies = [
        {"ticker": "SPY", "name": "SPDR S&P 500 ETF", "reason": "US Large Cap Equity"},
        {"ticker": "QQQ", "name": "Invesco QQQ Trust", "reason": "US Tech / Growth Equity"},
        {"ticker": "IWM", "name": "iShares Russell 2000 ETF", "reason": "US Small Cap Equity"},
        {"ticker": "EFA", "name": "iShares MSCI EAFE ETF", "reason": "Developed Markets Equity"},
        {"ticker": "EEM", "name": "iShares MSCI Emerging Markets", "reason": "Emerging Markets Equity"},
        {"ticker": "AGG", "name": "iShares Core US Aggregate Bond", "reason": "US Broad Bonds"},
        {"ticker": "TLT", "name": "iShares 20+ Year Treasury Bond", "reason": "US Long Term Treasury"},
        {"ticker": "GLD", "name": "SPDR Gold Shares", "reason": "Gold / Commodities"},
        {"ticker": "VNQ", "name": "Vanguard Real Estate ETF", "reason": "Real Estate (REIT)"},
    ]

    for bp in broad_proxies:
        if bp["ticker"] != ticker.upper() and bp["ticker"] not in [r["ticker"] for r in recs]:
            recs.append(bp)
            
    return recs

def fetch_historical_data(tickers: List[str], period: str = "5y", proxies: Dict[str, str] = None) -> pd.DataFrame:
    """
    Fetch historical adjusted closing prices for the given tickers.
    If proxies are provided, it backfills missing data for a ticker using its proxy.
    """
    if not tickers:
        return pd.DataFrame()
        
    if proxies is None:
        proxies = {}

    all_tickers_to_fetch = list(set(tickers + list(proxies.values())))
    
    try:
        data = yf.download(all_tickers_to_fetch, period=period)
        
        # yfinance changed its API, so we extract 'Close' or 'Adj Close'
        if isinstance(data.columns, pd.MultiIndex):
            if "Adj Close" in data.columns.get_level_values(0):
                data = data["Adj Close"]
            elif "Close" in data.columns.get_level_values(0):
                data = data["Close"]
        else:
            if "Adj Close" in data.columns:
                data = data["Adj Close"]
            elif "Close" in data.columns:
                data = data["Close"]
        
        if isinstance(data, pd.Series):
            data = data.to_frame(name=all_tickers_to_fetch[0])

        # Save original inception dates before backfilling
        inception_dates = {}
        for ticker in tickers:
            if ticker in data.columns:
                inception_dates[ticker] = data[ticker].first_valid_index()
        data.attrs['inception_dates'] = inception_dates

        # For each ticker that has a proxy, we backfill its missing returns
        for ticker in tickers:
            if ticker in proxies and proxies[ticker] in data.columns and ticker in data.columns:
                proxy = proxies[ticker]
                # Calculate daily returns for both
                ticker_ret = data[ticker].pct_change()
                proxy_ret = data[proxy].pct_change()
                
                # Where ticker is NaN but proxy is not, use proxy return
                mask = ticker_ret.isna() & ~proxy_ret.isna()
                
                # To backfill prices, we can just fill the returns and reconstruct the price curve from the first valid price
                # Or backwards from the first valid price
                first_valid_idx = data[ticker].first_valid_index()
                if first_valid_idx is not None and mask.any():
                    # We have a starting point and missing past
                    combined_returns = ticker_ret.copy()
                    combined_returns.loc[mask] = proxy_ret.loc[mask]
                    
                    # Reconstruct prices: P_t = P_0 * cumprod(1 + R)
                    # We need to anchor it to the first valid price of the ticker
                    # Actually, we can anchor to the LAST valid price to ensure today's price is real, 
                    # but usually anchoring to the FIRST valid price of the ticker and calculating backwards is cleaner.
                    
                    # Let's rebuild the entire price series working backwards and forwards from first_valid_idx
                    base_val = data.loc[first_valid_idx, ticker]
                    
                    # Forward (should just match existing data)
                    # Backward
                    reconstructed = pd.Series(index=data.index, dtype=float)
                    reconstructed.loc[first_valid_idx] = base_val
                    
                    # Calculate cumulative returns relative to first_valid_idx
                    # For forward:
                    forward_mask = data.index > first_valid_idx
                    if forward_mask.any():
                        reconstructed.loc[forward_mask] = base_val * (1 + combined_returns.loc[forward_mask]).cumprod()
                        
                    # For backward: 
                    # P_{t-1} = P_t / (1 + R_t)
                    backward_mask = data.index < first_valid_idx
                    if backward_mask.any():
                        # reverse the slice
                        back_idx = data.index[backward_mask][::-1]
                        curr_val = base_val
                        for d in back_idx:
                            # The return on d+1 takes us from d to d+1
                            # So P_d = P_{d+1} / (1 + R_{d+1})
                            # Wait, we need the return of the day AFTER d. 
                            # Let's just use a loop on the indices
                            pass
                            
                        # Easier way:
                        # R_t is return from t-1 to t
                        # So P_0 = P_T / cumprod(1+R)
                        # We can just use cumprod on the whole combined_returns, then normalize it to match the actual price at first_valid_idx
                    
                    # Let's do the normalization approach:
                    # 1. Create a full price series starting at 1.0 using combined_returns
                    sim_prices = (1 + combined_returns.fillna(0)).cumprod()
                    # 2. Find the scaling factor to match the real price at first_valid_idx
                    scale = base_val / sim_prices.loc[first_valid_idx]
                    # 3. Apply scale
                    data[ticker] = sim_prices * scale

        # Keep only the requested tickers that exist in data
        existing_tickers = [t for t in tickers if t in data.columns]
        data = data[existing_tickers]
        
        # Drop rows where ANY of the requested tickers is STILL NaN (meaning proxy didn't help enough)
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

    # Fetch tickers + proxies + USDKRW=X
    all_needed = list(set(tickers + list(proxies.values()) + ["USDKRW=X"]))
    
    raw_data = fetch_historical_data(all_needed, period=period, proxies=proxies)
    if raw_data.empty:
        return pd.DataFrame(), pd.DataFrame(), pd.Series(dtype=float)
        
    fx_series = raw_data["USDKRW=X"] if "USDKRW=X" in raw_data.columns else pd.Series(1400.0, index=raw_data.index)
    
    avail_tickers = [t for t in tickers if t in raw_data.columns and t != "USDKRW=X"]
    data_usd = raw_data[avail_tickers].copy()
    
    data_krw = pd.DataFrame(index=data_usd.index)
    for t in avail_tickers:
        if t in hedged_tickers:
            # Currency-hedged: purely follows USD returns
            usd_ret = data_usd[t].pct_change().fillna(0)
            initial_krw_price = data_usd[t].iloc[0] * fx_series.iloc[0]
            data_krw[t] = initial_krw_price * (1 + usd_ret).cumprod()
        else:
            # Unhedged: tracks USD price * FX rate
            data_krw[t] = data_usd[t] * fx_series
            
    return data_usd, data_krw, fx_series

