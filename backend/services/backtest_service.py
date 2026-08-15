import pandas as pd
import numpy as np
from typing import Dict, List, Tuple

def run_backtest(data: pd.DataFrame, weights: Dict[str, float], initial_capital: float, dca_amount: float, rebalance_frequency: str, rebalance_threshold: float) -> Tuple[List[str], List[float], List[float], List[float], List[float]]:
    """
    Run portfolio backtest and equal weight benchmark.
    Returns: dates, portfolio_values, returns, rolling_volatility, benchmark_values
    """
    if data.empty:
        return [], [], [], [], []

    dates = [d.strftime('%Y-%m-%d') for d in data.index]
    daily_returns = data.pct_change().fillna(0)
    
    # Init main portfolio
    current_capital = initial_capital
    portfolio_values = []
    
    # Init benchmark (Equal weight)
    bm_capital = initial_capital
    benchmark_values = []
    bm_weights = {ticker: 1.0 / len(data.columns) for ticker in data.columns}
    
    initial_prices = data.iloc[0]
    units = {ticker: (current_capital * weight) / initial_prices[ticker] for ticker, weight in weights.items() if weight > 0}
    bm_units = {ticker: (bm_capital * weight) / initial_prices[ticker] for ticker, weight in bm_weights.items()}
    
    last_month = data.index[0].month
    
    for i, date in enumerate(data.index):
        current_month = date.month
        prices = data.iloc[i]
        
        # DCA and Rebalance logic
        if current_month != last_month and dca_amount > 0:
            current_capital_before_dca = sum(units[t] * prices[t] for t in units)
            new_capital = current_capital_before_dca + dca_amount
            units = {t: (new_capital * w) / prices[t] for t, w in weights.items() if w > 0}
            
            # Benchmark DCA
            bm_cap_before = sum(bm_units[t] * prices[t] for t in bm_units)
            new_bm_cap = bm_cap_before + dca_amount
            bm_units = {t: (new_bm_cap * w) / prices[t] for t, w in bm_weights.items()}
            
            last_month = current_month
            
        elif rebalance_frequency == 'monthly' and current_month != last_month:
            current_cap = sum(units[t] * prices[t] for t in units)
            units = {t: (current_cap * w) / prices[t] for t, w in weights.items() if w > 0}
            
            bm_cap = sum(bm_units[t] * prices[t] for t in bm_units)
            bm_units = {t: (bm_cap * w) / prices[t] for t, w in bm_weights.items()}
            
            last_month = current_month
        
        daily_value = sum(units.get(t, 0) * prices[t] for t in weights)
        portfolio_values.append(daily_value)
        
        bm_daily_value = sum(bm_units.get(t, 0) * prices[t] for t in bm_weights)
        benchmark_values.append(bm_daily_value)
        
    port_series = pd.Series(portfolio_values)
    port_returns = port_series.pct_change().fillna(0)
    
    rolling_vol = port_returns.rolling(window=30).std() * np.sqrt(252)
    rolling_vol = rolling_vol.fillna(0).tolist()
    
    return dates, portfolio_values, port_returns.tolist(), rolling_vol, benchmark_values
