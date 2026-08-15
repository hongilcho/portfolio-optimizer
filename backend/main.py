from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json
from datetime import datetime

import models, schemas
from database import engine, SessionLocal
from services import finance_service, optimization_service, backtest_service, analysis_service

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Portfolio Optimizer API")

# Setup CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only, should be restricted in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/sessions/", response_model=schemas.SessionResponse)
def create_session(session: schemas.SessionCreate, db: Session = Depends(get_db)):
    now = datetime.now().isoformat()
    db_session = models.PortfolioSession(
        name=session.name,
        tickers=json.dumps(session.tickers),
        constraints=json.dumps(session.constraints),
        created_at=now,
        updated_at=now
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return schemas.SessionResponse(
        id=db_session.id,
        name=db_session.name,
        tickers=json.loads(db_session.tickers),
        constraints=json.loads(db_session.constraints),
        created_at=db_session.created_at,
        updated_at=db_session.updated_at
    )

@app.get("/sessions/", response_model=List[schemas.SessionResponse])
def get_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sessions = db.query(models.PortfolioSession).offset(skip).limit(limit).all()
    result = []
    for s in sessions:
        result.append(schemas.SessionResponse(
            id=s.id,
            name=s.name,
            tickers=json.loads(s.tickers),
            constraints=json.loads(s.constraints),
            created_at=s.created_at,
            updated_at=s.updated_at
        ))
    return result

@app.get("/sessions/{session_id}", response_model=schemas.SessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.PortfolioSession).filter(models.PortfolioSession.id == session_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return schemas.SessionResponse(
        id=s.id,
        name=s.name,
        tickers=json.loads(s.tickers),
        constraints=json.loads(s.constraints),
        created_at=s.created_at,
        updated_at=s.updated_at
    )

@app.put("/sessions/{session_id}", response_model=schemas.SessionResponse)
def update_session(session_id: int, session: schemas.SessionUpdate, db: Session = Depends(get_db)):
    s = db.query(models.PortfolioSession).filter(models.PortfolioSession.id == session_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    s.name = session.name
    s.tickers = json.dumps(session.tickers)
    s.constraints = json.dumps(session.constraints)
    s.updated_at = datetime.now().isoformat()
    
    db.commit()
    db.refresh(s)
    
    return schemas.SessionResponse(
        id=s.id,
        name=s.name,
        tickers=json.loads(s.tickers),
        constraints=json.loads(s.constraints),
        created_at=s.created_at,
        updated_at=s.updated_at
    )

@app.get("/proxy/recommendations")
def get_proxy_recommendations(ticker: str):
    recs = finance_service.get_proxy_recommendations(ticker)
    return {"ticker": ticker, "recommendations": recs}

@app.post("/analyze", response_model=schemas.AnalyzeResponse)
def analyze(request: schemas.BaseRequest):
    tickers = request.tickers
    lookback = request.lookback_period
    proxies = request.proxies
    
    if not tickers:
        raise HTTPException(status_code=400, detail="No tickers provided")
        
    try:
        # Pass proxies to finance_service
        data = finance_service.fetch_historical_data(tickers, period=lookback, proxies=proxies)
        if data.empty:
            raise ValueError("No data found for the given tickers and period.")
            
        dates, normalized_prices, stats, corr, cov = analysis_service.analyze_tickers(data)
        
        # Add ticker names to stats
        for ticker in stats.keys():
            info = finance_service.get_ticker_info(ticker)
            stats[ticker]["name"] = info.get("shortName", "") or info.get("longName", "")
            
        return schemas.AnalyzeResponse(
            dates=dates,
            normalized_prices=normalized_prices,
            stats=stats,
            correlation_matrix=corr,
            covariance_matrix=cov
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/optimize", response_model=schemas.OptimizationResponse)
def optimize(request: schemas.OptimizationRequest):
    try:
        data = finance_service.fetch_historical_data(request.tickers, period=request.lookback_period, proxies=request.proxies)
        if data.empty:
            raise ValueError("No data found for the given tickers.")
            
        # Drop dates for optimization
        # optimization_service uses data directly
        weights, exp_return, annual_vol, sharpe = optimization_service.optimize_portfolio(
            data, request.constraints, request.objective
        )
        return schemas.OptimizationResponse(
            weights=weights,
            expected_annual_return=exp_return,
            annual_volatility=annual_vol,
            sharpe_ratio=sharpe
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@app.post("/backtest", response_model=schemas.BacktestResponse)
def backtest(request: schemas.BacktestParams):
    try:
        data = finance_service.fetch_historical_data(request.tickers, period=request.lookback_period, proxies=request.proxies)
        if data.empty:
            raise ValueError("No data found for the given tickers.")
            
        dates, port_vals, bench_vals, returns, roll_vol = backtest_service.run_backtest(
            data, request.weights, request.initial_capital, request.dca_amount, 
            request.rebalance_frequency, request.rebalance_threshold
        )
        return schemas.BacktestResponse(
            dates=dates,
            portfolio_values=port_vals,
            benchmark_values=bench_vals,
            returns=returns,
            rolling_volatility=roll_vol
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")
