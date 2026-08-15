import pandas as pd
import numpy as np
from typing import Dict, List, Tuple

def run_backtest(
    data: pd.DataFrame, 
    weights: Dict[str, float], 
    initial_capital: float, 
    dca_amount: float, 
    rebalance_frequency: str, 
    rebalance_threshold: float,
    currency: str = "KRW",
    exchange_rate: float = 1400.0
) -> Tuple[List[str], List[float], List[float], List[float], List[float], List[float]]:
    """
    Run portfolio backtest, equal weight benchmark, and SPY (S&P 500) benchmark.
    Returns: dates, portfolio_values, benchmark_values, spy_values, returns, rolling_volatility
    """
    if data.empty:
        return [], [], [], [], [], []

    dates = [d.strftime('%Y-%m-%d') for d in data.index]
    
    # Portfolio tickers (excluding SPY if SPY is not an intentional portfolio asset)
    port_tickers = [t for t in weights.keys() if t in data.columns and weights[t] > 0]
    if not port_tickers:
        # Fallback to all columns except SPY
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
    
    # Equal weight units
    bm_units = {t: (initial_capital * bm_weights[t]) / initial_prices[t] for t in bm_tickers}
    
    # SPY units
    spy_units = initial_capital / initial_prices[spy_col]

    portfolio_values = []
    benchmark_values = []
    spy_values = []

    last_month = data.index[0].month
    last_quarter = (data.index[0].month - 1) // 3
    last_year = data.index[0].year

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

    return dates, portfolio_values, benchmark_values, spy_values, port_returns.round(4).tolist(), rolling_vol

