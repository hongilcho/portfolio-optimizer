import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple
from pypfopt.expected_returns import mean_historical_return
from pypfopt.risk_models import CovarianceShrinkage
from pypfopt.efficient_frontier import EfficientFrontier

def optimize_portfolio(data: pd.DataFrame, constraints: Dict[str, Any], objective: str = "max_sharpe") -> Tuple[Dict[str, float], float, float, float, Dict[str, Dict[str, float]]]:
    """
    Optimizes portfolio based on historical data, constraints, and objective function.
    Returns weights, expected_return, volatility, sharpe_ratio, correlation_matrix
    """
    mu = mean_historical_return(data)
    S = CovarianceShrinkage(data).ledoit_wolf()
    
    correlation_matrix = data.corr().to_dict()

    ticker_bounds = constraints.get("ticker_bounds", {})
    global_min = float(constraints.get("min_weight", 0.0))
    global_max = float(constraints.get("max_weight", 1.0))
    
    min_b = []
    max_b = []
    for t in mu.index:
        bounds = ticker_bounds.get(t, {})
        min_w = float(bounds.get("min", global_min))
        max_w = float(bounds.get("max", global_max))
        min_b.append(min_w)
        max_b.append(max_w)
    
    ef = EfficientFrontier(mu, S, weight_bounds=(min_b, max_b))
    
    target_volatility = constraints.get("target_volatility", 0.0)
    
    if target_volatility > 0:
        try:
            raw_weights = ef.efficient_risk(target_volatility)
        except Exception:
            # Fallback
            raw_weights = ef.max_sharpe() if objective == "max_sharpe" else ef.min_volatility()
    else:
        if objective == "min_volatility":
            raw_weights = ef.min_volatility()
        else:
            raw_weights = ef.max_sharpe()
        
    cleaned_weights = ef.clean_weights()
    expected_return, volatility, sharpe_ratio = ef.portfolio_performance()

    return cleaned_weights, expected_return, volatility, sharpe_ratio, correlation_matrix

def calculate_portfolio_performance(data: pd.DataFrame, weights: Dict[str, float]) -> Tuple[float, float, float]:
    """
    Calculates expected return, volatility, and sharpe ratio for custom weights.
    """
    mu = mean_historical_return(data)
    S = CovarianceShrinkage(data).ledoit_wolf()
    
    weight_list = [weights.get(col, 0.0) for col in data.columns]
    total_w = sum(weight_list)
    if total_w > 0:
        weight_vec = np.array([w / total_w for w in weight_list])
    else:
        weight_vec = np.array([1.0 / len(data.columns)] * len(data.columns))
        
    exp_return = float(np.sum(weight_vec * mu.values))
    volatility = float(np.sqrt(np.dot(weight_vec.T, np.dot(S.values, weight_vec))))
    risk_free_rate = 0.02
    sharpe_ratio = float((exp_return - risk_free_rate) / volatility) if volatility > 0 else 0.0
    
    return exp_return, volatility, sharpe_ratio

