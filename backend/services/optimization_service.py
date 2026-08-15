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

def optimize_portfolio_dual(
    data_usd: pd.DataFrame, 
    data_krw: pd.DataFrame, 
    constraints: Dict[str, Any], 
    objective: str = "max_sharpe"
) -> Dict[str, Any]:
    """
    Computes optimal portfolio weights under both USD fundamental base and KRW unhedged base.
    Also evaluates cross-currency performance for both optimal portfolios.
    """
    # 1. Optimize on USD Base
    usd_weights, usd_exp_ret, usd_vol, usd_sharpe, _ = optimize_portfolio(data_usd, constraints, objective)
    usd_in_krw_ret, usd_in_krw_vol, usd_in_krw_sharpe = calculate_portfolio_performance(data_krw, usd_weights)
    
    # 2. Optimize on KRW Base
    krw_weights, krw_exp_ret, krw_vol, krw_sharpe, _ = optimize_portfolio(data_krw, constraints, objective)
    krw_in_usd_ret, krw_in_usd_vol, krw_in_usd_sharpe = calculate_portfolio_performance(data_usd, krw_weights)
    
    # Weight differences
    all_tickers = list(data_usd.columns)
    deltas = {t: round(krw_weights.get(t, 0.0) - usd_weights.get(t, 0.0), 4) for t in all_tickers}
    
    return {
        "usd_mode": {
            "weights": usd_weights,
            "usd_performance": {
                "expected_annual_return": usd_exp_ret,
                "annual_volatility": usd_vol,
                "sharpe_ratio": usd_sharpe
            },
            "krw_performance": {
                "expected_annual_return": usd_in_krw_ret,
                "annual_volatility": usd_in_krw_vol,
                "sharpe_ratio": usd_in_krw_sharpe
            }
        },
        "krw_mode": {
            "weights": krw_weights,
            "usd_performance": {
                "expected_annual_return": krw_in_usd_ret,
                "annual_volatility": krw_in_usd_vol,
                "sharpe_ratio": krw_in_usd_sharpe
            },
            "krw_performance": {
                "expected_annual_return": krw_exp_ret,
                "annual_volatility": krw_vol,
                "sharpe_ratio": krw_sharpe
            }
        },
        "weight_deltas": deltas
    }


