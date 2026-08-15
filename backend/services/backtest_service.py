import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Any
from scipy import optimize

def calculate_xirr(cash_flows: List[float], dates: List[pd.Timestamp]) -> float:
    """
    Calculate Money-Weighted Rate of Return (XIRR).
    """
    if len(cash_flows) < 2 or not dates:
        return 0.0
    t0 = dates[0]
    years = [(d - t0).days / 365.25 for d in dates]
    
    def npv(r):
        if r <= -0.999: return float('inf')
        return sum(cf / ((1.0 + r) ** y) for cf, y in zip(cash_flows, years))
    
    try:
        return float(optimize.brentq(npv, -0.99, 10.0, maxiter=100))
    except Exception:
        total_in = sum(-cf for cf in cash_flows if cf < 0)
        final_val = cash_flows[-1]
        total_yrs = max(years[-1], 0.1)
        if total_in > 0 and final_val > 0:
            return float((final_val / total_in) ** (1.0 / total_yrs) - 1.0)
        return 0.0

def calculate_mdd(values: List[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    max_dd = 0.0
    for val in values:
        if val > peak:
            peak = val
        if peak > 0:
            dd = (val - peak) / peak
            if dd < max_dd:
                max_dd = dd
    return float(max_dd)

def run_backtest(
    data: pd.DataFrame, 
    weights: Dict[str, float], 
    initial_capital: float, 
    dca_amount: float, 
    rebalance_frequency: str, 
    rebalance_threshold: float,
    currency: str = "KRW",
    exchange_rate: float = 1400.0
) -> Dict[str, Any]:
    """
    Run portfolio backtest, equal weight benchmark, and SPY (S&P 500) benchmark.
    Returns: dates, portfolio_values, benchmark_values, spy_values, returns, rolling_volatility, stats
    """
    if data.empty:
        return {
            "dates": [],
            "portfolio_values": [],
            "benchmark_values": [],
            "spy_values": [],
            "returns": [],
            "rolling_volatility": [],
            "total_invested": initial_capital,
            "dca_count": 0,
            "portfolio_stats": {},
            "benchmark_stats": {},
            "spy_stats": {}
        }

    dates = [d.strftime('%Y-%m-%d') for d in data.index]
    
    # Portfolio tickers (excluding SPY if SPY is not an intentional portfolio asset)
    port_tickers = [t for t in weights.keys() if t in data.columns and weights[t] > 0]
    if not port_tickers:
        port_tickers = [c for c in data.columns if c != 'SPY'] or list(data.columns)
        weights = {t: 1.0 / len(port_tickers) for t in port_tickers}

    # Normalize weights of active portfolio tickers
    total_w = sum(weights.get(t, 0) for t in port_tickers)
    norm_weights = {t: weights.get(t, 0) / total_w for t in port_tickers} if total_w > 0 else {t: 1.0 / len(port_tickers) for t in port_tickers}

    # Equal weight benchmark tickers
    bm_tickers = [t for t in port_tickers]
    bm_weights = {t: 1.0 / len(bm_tickers) for t in bm_tickers}

    # SPY benchmark availability
    has_spy = 'SPY' in data.columns
    spy_col = 'SPY' if has_spy else port_tickers[0]

    # Initial allocations
    initial_prices = data.iloc[0]
    
    # Portfolio units
    port_units = {t: (initial_capital * norm_weights[t]) / initial_prices[t] for t in port_tickers}
    bm_units = {t: (initial_capital * bm_weights[t]) / initial_prices[t] for t in bm_tickers}
    spy_units = initial_capital / initial_prices[spy_col]

    portfolio_values = []
    benchmark_values = []
    spy_values = []

    last_month = data.index[0].month
    last_quarter = (data.index[0].month - 1) // 3
    last_year = data.index[0].year

    dca_count = 0
    flow_dates = [data.index[0]]
    port_cfs = [-initial_capital]

    for i, date in enumerate(data.index):
        current_month = date.month
        current_quarter = (date.month - 1) // 3
        current_year = date.year
        prices = data.iloc[i]

        is_new_month = current_month != last_month
        is_new_quarter = current_quarter != last_quarter
        is_new_year = current_year != last_year

        # Determine if rebalance should occur
        should_rebalance = False
        if rebalance_frequency == 'monthly' and is_new_month:
            should_rebalance = True
        elif rebalance_frequency == 'quarterly' and is_new_quarter:
            should_rebalance = True
        elif rebalance_frequency == 'yearly' and is_new_year:
            should_rebalance = True

        # DCA at the start of each new month
        if is_new_month and dca_amount > 0:
            dca_count += 1
            flow_dates.append(date)
            port_cfs.append(-dca_amount)

            # 1. Main Portfolio DCA
            curr_port_val = sum(port_units[t] * prices[t] for t in port_tickers)
            new_port_val = curr_port_val + dca_amount
            
            if should_rebalance:
                port_units = {t: (new_port_val * norm_weights[t]) / prices[t] for t in port_tickers}
            else:
                for t in port_tickers:
                    port_units[t] += (dca_amount * norm_weights[t]) / prices[t]

            # 2. Equal Weight Benchmark DCA
            curr_bm_val = sum(bm_units[t] * prices[t] for t in bm_tickers)
            new_bm_val = curr_bm_val + dca_amount
            if should_rebalance:
                bm_units = {t: (new_bm_val * bm_weights[t]) / prices[t] for t in bm_tickers}
            else:
                for t in bm_tickers:
                    bm_units[t] += (dca_amount * bm_weights[t]) / prices[t]

            # 3. SPY Benchmark DCA
            spy_units += dca_amount / prices[spy_col]

        elif should_rebalance:
            # Rebalance without DCA
            curr_port_val = sum(port_units[t] * prices[t] for t in port_tickers)
            port_units = {t: (curr_port_val * norm_weights[t]) / prices[t] for t in port_tickers}

            curr_bm_val = sum(bm_units[t] * prices[t] for t in bm_tickers)
            bm_units = {t: (curr_bm_val * bm_weights[t]) / prices[t] for t in bm_tickers}

        last_month = current_month
        last_quarter = current_quarter
        last_year = current_year

        # Record daily values
        daily_port = sum(port_units[t] * prices[t] for t in port_tickers)
        daily_bm = sum(bm_units[t] * prices[t] for t in bm_tickers)
        daily_spy = spy_units * prices[spy_col]

        portfolio_values.append(round(daily_port, 2))
        benchmark_values.append(round(daily_bm, 2))
        spy_values.append(round(daily_spy, 2))

    port_series = pd.Series(portfolio_values)
    port_returns = port_series.pct_change().fillna(0)
    rolling_vol = port_returns.rolling(window=30).std() * np.sqrt(252)
    rolling_vol = rolling_vol.fillna(0).round(4).tolist()

    total_invested = round(initial_capital + dca_count * dca_amount, 2)
    final_port = portfolio_values[-1]
    final_bm = benchmark_values[-1]
    final_spy = spy_values[-1]

    # Cashflow arrays for XIRR
    flow_dates_end = flow_dates + [data.index[-1]]
    cfs_port = port_cfs + [final_port]
    cfs_bm = port_cfs + [final_bm]
    cfs_spy = port_cfs + [final_spy]

    port_stats = {
        "final_value": final_port,
        "total_invested": total_invested,
        "net_profit": round(final_port - total_invested, 2),
        "total_return_pct": round(((final_port - total_invested) / total_invested) * 100, 2),
        "annualized_return_pct": round(calculate_xirr(cfs_port, flow_dates_end) * 100, 2),
        "mdd_pct": round(calculate_mdd(portfolio_values) * 100, 2)
    }

    bm_stats = {
        "final_value": final_bm,
        "total_invested": total_invested,
        "net_profit": round(final_bm - total_invested, 2),
        "total_return_pct": round(((final_bm - total_invested) / total_invested) * 100, 2),
        "annualized_return_pct": round(calculate_xirr(cfs_bm, flow_dates_end) * 100, 2),
        "mdd_pct": round(calculate_mdd(benchmark_values) * 100, 2)
    }

    spy_stats = {
        "final_value": final_spy,
        "total_invested": total_invested,
        "net_profit": round(final_spy - total_invested, 2),
        "total_return_pct": round(((final_spy - total_invested) / total_invested) * 100, 2),
        "annualized_return_pct": round(calculate_xirr(cfs_spy, flow_dates_end) * 100, 2),
        "mdd_pct": round(calculate_mdd(spy_values) * 100, 2)
    }

    return {
        "dates": dates,
        "portfolio_values": portfolio_values,
        "benchmark_values": benchmark_values,
        "spy_values": spy_values,
        "returns": port_returns.round(4).tolist(),
        "rolling_volatility": rolling_vol,
        "currency": currency,
        "exchange_rate": exchange_rate,
        "total_invested": total_invested,
        "dca_count": dca_count,
        "portfolio_stats": port_stats,
        "benchmark_stats": bm_stats,
        "spy_stats": spy_stats
    }


