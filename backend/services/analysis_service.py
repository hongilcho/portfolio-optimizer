import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List

def calculate_mdd(prices: pd.Series) -> float:
    roll_max = prices.cummax()
    drawdown = prices / roll_max - 1.0
    return abs(drawdown.min())

def analyze_tickers(data: pd.DataFrame) -> Tuple[List[str], Dict[str, List[float]], Dict[str, Dict[str, float]], Dict[str, Dict[str, float]], Dict[str, Dict[str, float]]]:
    """
    Returns: dates, normalized_prices, stats (cagr, vol, mdd), correlation_matrix, covariance_matrix
    """
    if data.empty:
        return [], {}, {}, {}, {}

    dates = [d.strftime('%Y-%m-%d') for d in data.index]
    
    # Calculate daily returns
    returns = data.pct_change().dropna()
    
    # Correlation & Covariance (annualized for covariance)
    corr_matrix = returns.corr().to_dict()
    cov_matrix = (returns.cov() * 252).to_dict()
    
    # Normalized prices (Base 100)
    first_prices = data.iloc[0]
    normalized_prices = {}
    stats = {}
    
    for ticker in data.columns:
        # Normalized
        norm_series = (data[ticker] / first_prices[ticker]) * 100
        normalized_prices[ticker] = norm_series.tolist()
        
        # Stats
        ticker_returns = returns[ticker]
        cagr = (data[ticker].iloc[-1] / data[ticker].iloc[0]) ** (252 / len(data)) - 1
        vol = ticker_returns.std() * np.sqrt(252)
        mdd = calculate_mdd(data[ticker])
        
        # Calculate yearly stats
        yearly_stats = {}
        real_inception = data.attrs.get('inception_dates', {}).get(ticker)

        # Group by year
        for year, group_data in data[ticker].groupby(data.index.year):
            if len(group_data) < 2:
                continue
            year_ret = group_data.iloc[-1] / group_data.iloc[0] - 1
            idx = group_data.index.intersection(returns.index)
            year_vol = returns[ticker].loc[idx].std() * np.sqrt(252)
            if np.isnan(year_vol):
                year_vol = 0.0

            is_proxy = False
            if real_inception is not None:
                # If the first day of the year is before the real inception date, we consider the year (partially or fully) proxy
                if group_data.index[0] < real_inception:
                    is_proxy = True

            yearly_stats[str(year)] = {
                "return_rate": float(year_ret),
                "volatility": float(year_vol),
                "is_proxy": is_proxy
            }
        
        stats[ticker] = {
            "cagr": cagr,
            "annual_volatility": vol,
            "mdd": mdd,
            "yearly": yearly_stats
        }

    return dates, normalized_prices, stats, corr_matrix, cov_matrix

def calculate_fx_cushion_stats(
    data_usd: pd.DataFrame, 
    data_krw: pd.DataFrame, 
    fx_series: pd.Series, 
    hedged_tickers: List[str] = None
) -> Dict[str, Any]:
    """
    Computes correlation between each asset and USDKRW, plus USD vs KRW volatility, CAGR, and MDD comparison.
    """
    if data_usd.empty or fx_series.empty:
        return {}

    if hedged_tickers is None:
        hedged_tickers = []

    usd_returns = data_usd.pct_change().dropna()
    krw_returns = data_krw.pct_change().dropna()
    fx_returns = fx_series.pct_change().dropna()
    
    idx = usd_returns.index.intersection(fx_returns.index)
    usd_returns = usd_returns.loc[idx]
    krw_returns = krw_returns.loc[idx]
    fx_returns = fx_returns.loc[idx]
    
    fx_annual_vol = float(fx_returns.std() * np.sqrt(252))
    
    cushion_stats = {
        "fx_volatility": round(fx_annual_vol, 4),
        "tickers": {}
    }
    
    for ticker in data_usd.columns:
        t_usd_ret = usd_returns[ticker]
        t_krw_ret = krw_returns[ticker]
        
        corr_with_fx = float(t_usd_ret.corr(fx_returns))
        vol_usd = float(t_usd_ret.std() * np.sqrt(252))
        vol_krw = float(t_krw_ret.std() * np.sqrt(252))
        vol_diff = vol_krw - vol_usd
        
        cagr_usd = float((data_usd[ticker].iloc[-1] / data_usd[ticker].iloc[0]) ** (252 / len(data_usd)) - 1)
        cagr_krw = float((data_krw[ticker].iloc[-1] / data_krw[ticker].iloc[0]) ** (252 / len(data_krw)) - 1)
        
        mdd_usd = float(calculate_mdd(data_usd[ticker]))
        mdd_krw = float(calculate_mdd(data_krw[ticker]))
        
        is_hedged = ticker in hedged_tickers
        
        cushion_stats["tickers"][ticker] = {
            "is_hedged": is_hedged,
            "corr_with_fx": round(corr_with_fx, 4) if not np.isnan(corr_with_fx) else 0.0,
            "vol_usd": round(vol_usd, 4),
            "vol_krw": round(vol_krw, 4),
            "vol_diff": round(vol_diff, 4),
            "cagr_usd": round(cagr_usd, 4),
            "cagr_krw": round(cagr_krw, 4),
            "mdd_usd": round(mdd_usd, 4),
            "mdd_krw": round(mdd_krw, 4)
        }
        
    return cushion_stats

