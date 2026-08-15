from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class SessionBase(BaseModel):
    name: str
    tickers: List[str]
    constraints: Dict[str, Any]

class SessionCreate(SessionBase):
    pass

class SessionUpdate(SessionBase):
    pass

class SessionResponse(SessionBase):
    id: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

class BaseRequest(BaseModel):
    tickers: List[str]
    lookback_period: str = "5y"
    proxies: Dict[str, str] = {}
    hedged_tickers: List[str] = []

class OptimizationRequest(BaseRequest):
    constraints: Dict[str, Any]
    objective: str = "max_sharpe"

class OptimizationResponse(BaseModel):
    weights: Dict[str, float]
    expected_annual_return: float
    annual_volatility: float
    sharpe_ratio: float

class ModePerformance(BaseModel):
    expected_annual_return: float
    annual_volatility: float
    sharpe_ratio: float

class DualModeResult(BaseModel):
    weights: Dict[str, float]
    usd_performance: ModePerformance
    krw_performance: ModePerformance

class DualOptimizationResponse(BaseModel):
    usd_mode: DualModeResult
    krw_mode: DualModeResult
    weight_deltas: Dict[str, float]

class CustomEvaluateRequest(BaseRequest):
    weights: Dict[str, float]
    currency_mode: str = "KRW"

class CustomEvaluateResponse(BaseModel):
    expected_annual_return: float
    annual_volatility: float
    sharpe_ratio: float

class YearlyStats(BaseModel):
    return_rate: float
    volatility: float
    is_proxy: bool = False

class TickerStats(BaseModel):
    name: str = ""
    cagr: float
    annual_volatility: float
    mdd: float
    yearly: Dict[str, YearlyStats]

class AnalyzeResponse(BaseModel):
    dates: List[str]
    normalized_prices: Dict[str, List[float]]
    stats: Dict[str, TickerStats]
    correlation_matrix: Dict[str, Dict[str, float]]
    covariance_matrix: Dict[str, Dict[str, float]]

class FXCushionDetail(BaseModel):
    is_hedged: bool = False
    corr_with_fx: float
    vol_usd: float
    vol_krw: float
    vol_diff: float
    cagr_usd: float
    cagr_krw: float
    mdd_usd: float
    mdd_krw: float

class FXCushionResponse(BaseModel):
    fx_volatility: float
    tickers: Dict[str, FXCushionDetail]

class DualAnalyzeResponse(BaseModel):
    dates: List[str]
    usd: AnalyzeResponse
    krw: AnalyzeResponse
    fx_cushion: FXCushionResponse

class BacktestParams(BaseRequest):
    weights: Dict[str, float]
    initial_capital: float = 10000000.0
    dca_amount: float = 0.0
    rebalance_frequency: str = "monthly"
    rebalance_threshold: float = 0.05
    currency: str = "KRW"
    exchange_rate: Optional[float] = None

class BacktestResponse(BaseModel):
    dates: List[str]
    portfolio_values: List[float]
    benchmark_values: List[float]
    spy_values: List[float]
    returns: List[float]
    rolling_volatility: List[float]
    currency: str = "KRW"
    exchange_rate: float = 1400.0


