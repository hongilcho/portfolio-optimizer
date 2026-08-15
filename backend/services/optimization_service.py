import pandas as pd
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

    min_weight = constraints.get("min_weight", 0.0)
    max_weight = constraints.get("max_weight", 1.0)
    
    ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
    
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
