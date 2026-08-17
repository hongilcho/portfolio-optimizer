from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


from sqlalchemy import text
import models, schemas
from database import engine, SessionLocal
from services import finance_service, optimization_service, backtest_service, analysis_service, ai_service, search_service

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and ensure columns without blocking worker
    try:
        models.Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE sessions ADD COLUMN chat_history TEXT DEFAULT '[]'"))
                conn.commit()
            except Exception:
                pass
        _seed_initial_sessions()
    except Exception as e:
        print(f"Startup DB check warning: {e}")
    yield

app = FastAPI(title="Portfolio Optimizer API", lifespan=lifespan)



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

def _parse_chat_history(raw_val) -> list:
    if not raw_val:
        return []
    try:
        return json.loads(raw_val)
    except Exception:
        return []

@app.post("/sessions/", response_model=schemas.SessionResponse)
def create_session(session: schemas.SessionCreate, db: Session = Depends(get_db)):
    now = datetime.now().isoformat()
    db_session = models.PortfolioSession(
        name=session.name,
        tickers=json.dumps(session.tickers),
        constraints=json.dumps(session.constraints),
        chat_history=json.dumps(session.chat_history or []),
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
        chat_history=_parse_chat_history(db_session.chat_history),
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
            chat_history=_parse_chat_history(s.chat_history),
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
        chat_history=_parse_chat_history(s.chat_history),
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
    if session.chat_history is not None and len(session.chat_history) > 0:
        s.chat_history = json.dumps(session.chat_history)
    s.updated_at = datetime.now().isoformat()
    
    db.commit()
    db.refresh(s)
    
    return schemas.SessionResponse(
        id=s.id,
        name=s.name,
        tickers=json.loads(s.tickers),
        constraints=json.loads(s.constraints),
        chat_history=_parse_chat_history(s.chat_history),
        created_at=s.created_at,
        updated_at=s.updated_at
    )

@app.get("/sessions/export")
def export_sessions(db: Session = Depends(get_db)):
    sessions = db.query(models.PortfolioSession).all()
    data = []
    for s in sessions:
        data.append({
            "id": s.id,
            "name": s.name,
            "tickers": json.loads(s.tickers) if isinstance(s.tickers, str) else s.tickers,
            "constraints": json.loads(s.constraints) if isinstance(s.constraints, str) else s.constraints,
            "chat_history": json.loads(s.chat_history) if isinstance(s.chat_history, str) else s.chat_history,
            "created_at": s.created_at,
            "updated_at": s.updated_at
        })
    return {"sessions": data}

@app.post("/sessions/import")
def import_sessions(payload: dict, db: Session = Depends(get_db)):
    sessions_data = payload.get("sessions", [])
    now = datetime.now().isoformat()
    imported_count = 0
    for s in sessions_data:
        db_s = models.PortfolioSession(
            name=s.get("name", "Imported Session"),
            tickers=json.dumps(s.get("tickers", [])),
            constraints=json.dumps(s.get("constraints", {})),
            chat_history=json.dumps(s.get("chat_history", [])),
            created_at=s.get("created_at", now),
            updated_at=s.get("updated_at", now)
        )
        db.add(db_s)
        imported_count += 1
    db.commit()
    return {"imported_count": imported_count, "message": f"{imported_count} sessions imported successfully"}

@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.PortfolioSession).filter(models.PortfolioSession.id == session_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()
    return {"message": "Session deleted"}



@app.post("/sessions/{session_id}/duplicate", response_model=schemas.SessionResponse)
def duplicate_session(session_id: int, duplicate_req: schemas.SessionDuplicateRequest, db: Session = Depends(get_db)):
    s = db.query(models.PortfolioSession).filter(models.PortfolioSession.id == session_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    new_session = models.PortfolioSession(
        name=duplicate_req.name,
        tickers=s.tickers,
        constraints=s.constraints,
        chat_history=s.chat_history,
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return schemas.SessionResponse(
        id=new_session.id,
        name=new_session.name,
        tickers=json.loads(new_session.tickers),
        constraints=json.loads(new_session.constraints),
        chat_history=_parse_chat_history(new_session.chat_history),
        created_at=new_session.created_at,
        updated_at=new_session.updated_at
    )


@app.get("/proxy/recommendations")
def get_proxy_recommendations(ticker: str):
    recs = finance_service.get_proxy_recommendations(ticker)
    return {"ticker": ticker, "recommendations": recs}

@app.get("/proxy/validate")
def validate_proxy(ticker: str):
    return finance_service.validate_proxy(ticker)

@app.post("/tickers/coverage")
def get_portfolio_coverage(request: schemas.BaseRequest):
    return finance_service.get_portfolio_coverage(request.tickers, request.proxies)

@app.get("/tickers/search")
def search_tickers(q: str):
    return search_service.search_tickers(q)

@app.post("/tickers/names")
def get_ticker_names(request: schemas.BaseRequest):
    return search_service.get_ticker_names(request.tickers)

@app.post("/analyze", response_model=schemas.DualAnalyzeResponse)
def analyze(request: schemas.BaseRequest):
    tickers = request.tickers
    lookback = request.lookback_period
    proxies = request.proxies
    hedged_tickers = request.hedged_tickers or []
    
    if not tickers:
        raise HTTPException(status_code=400, detail="No tickers provided")
        
    try:
        data_usd, data_krw, fx_series = finance_service.fetch_dual_currency_data(
            tickers, period=lookback, proxies=proxies, hedged_tickers=hedged_tickers
        )
        if data_usd.empty:
            raise ValueError("No data found for the given tickers and period.")
            
        dates_usd, norm_usd, stats_usd, corr_usd, cov_usd = analysis_service.analyze_tickers(data_usd)
        dates_krw, norm_krw, stats_krw, corr_krw, cov_krw = analysis_service.analyze_tickers(data_krw)
        
        # Add ticker names to stats instantly using search_service
        ticker_names_map = search_service.get_ticker_names(list(stats_usd.keys()))
        for ticker in stats_usd.keys():
            name = ticker_names_map.get(ticker, "")
            stats_usd[ticker]["name"] = name
            if ticker in stats_krw:
                stats_krw[ticker]["name"] = name
                
        fx_cushion = analysis_service.calculate_fx_cushion_stats(data_usd, data_krw, fx_series, hedged_tickers)
        
        usd_res = schemas.AnalyzeResponse(
            dates=dates_usd,
            normalized_prices=norm_usd,
            stats=stats_usd,
            correlation_matrix=corr_usd,
            covariance_matrix=cov_usd
        )
        krw_res = schemas.AnalyzeResponse(
            dates=dates_krw,
            normalized_prices=norm_krw,
            stats=stats_krw,
            correlation_matrix=corr_krw,
            covariance_matrix=cov_krw
        )
        
        import gc
        gc.collect()
        
        return schemas.DualAnalyzeResponse(
            dates=dates_usd,
            usd=usd_res,
            krw=krw_res,
            fx_cushion=schemas.FXCushionResponse(**fx_cushion),
            ticker_names=ticker_names_map
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/optimize", response_model=schemas.OptimizationResponse)
def optimize(request: schemas.OptimizationRequest):
    try:
        data_usd, data_krw, _ = finance_service.fetch_dual_currency_data(
            request.tickers, period=request.lookback_period, proxies=request.proxies, hedged_tickers=request.hedged_tickers
        )
        if data_usd.empty:
            raise ValueError("No data found for the given tickers.")
            
        weights, exp_return, annual_vol, sharpe, _ = optimization_service.optimize_portfolio(
            data_usd, request.constraints, request.objective
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

@app.post("/optimize_dual", response_model=schemas.DualOptimizationResponse)
def optimize_dual(request: schemas.OptimizationRequest):
    try:
        data_usd, data_krw, _ = finance_service.fetch_dual_currency_data(
            request.tickers, period=request.lookback_period, proxies=request.proxies, hedged_tickers=request.hedged_tickers
        )
        if data_usd.empty:
            raise ValueError("No data found for the given tickers.")
            
        result = optimization_service.optimize_portfolio_dual(
            data_usd, data_krw, request.constraints, request.objective
        )
        return schemas.DualOptimizationResponse(**result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Dual optimization failed: {str(e)}")

@app.post("/evaluate_portfolio", response_model=schemas.CustomEvaluateResponse)
def evaluate_portfolio(request: schemas.CustomEvaluateRequest):
    try:
        data_usd, data_krw, _ = finance_service.fetch_dual_currency_data(
            request.tickers, period=request.lookback_period, proxies=request.proxies, hedged_tickers=request.hedged_tickers
        )
        if data_usd.empty:
            raise ValueError("No data found for the given tickers.")
            
        usd_exp, usd_vol, usd_sharpe = optimization_service.calculate_portfolio_performance(data_usd, request.weights)
        krw_exp, krw_vol, krw_sharpe = optimization_service.calculate_portfolio_performance(data_krw, request.weights)
        
        return schemas.CustomEvaluateResponse(
            usd_performance=schemas.ModePerformance(
                expected_annual_return=usd_exp,
                annual_volatility=usd_vol,
                sharpe_ratio=usd_sharpe
            ),
            krw_performance=schemas.ModePerformance(
                expected_annual_return=krw_exp,
                annual_volatility=krw_vol,
                sharpe_ratio=krw_sharpe
            )
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@app.get("/exchange_rate")
def get_exchange_rate():
    rate = finance_service.get_usd_krw_rate()
    return {"usd_krw": rate}

@app.post("/backtest", response_model=schemas.BacktestResponse)
def backtest(request: schemas.BacktestParams):
    try:
        all_tickers = list(set(request.tickers + ["SPY"]))
        data_usd, data_krw, _ = finance_service.fetch_dual_currency_data(
            all_tickers, period=request.lookback_period, proxies=request.proxies, hedged_tickers=request.hedged_tickers
        )
        if data_usd.empty:
            raise ValueError("No data found for the given tickers.")
            
        rate = request.exchange_rate or finance_service.get_usd_krw_rate()
        bt_data = data_krw if request.currency == "KRW" else data_usd
        
        bt_result = backtest_service.run_backtest(
            bt_data, request.weights, request.initial_capital, request.dca_amount, 
            request.rebalance_frequency, request.rebalance_threshold,
            currency=request.currency, exchange_rate=rate
        )
        return schemas.BacktestResponse(**bt_result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")

# ==========================================
# AI Portfolio Advisor Endpoints
# ==========================================

@app.get("/ai/models")
def get_ai_models():
    return {"models": ai_service.AVAILABLE_MODELS}

@app.get("/sessions/{session_id}/chat")
def get_chat_history(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.PortfolioSession).filter(models.PortfolioSession.id == session_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"chat_history": _parse_chat_history(s.chat_history)}

@app.post("/sessions/{session_id}/chat", response_model=schemas.ChatResponse)
def send_chat_message(session_id: int, request: schemas.ChatRequest, db: Session = Depends(get_db)):
    s = db.query(models.PortfolioSession).filter(models.PortfolioSession.id == session_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = {
        "id": s.id,
        "name": s.name,
        "tickers": json.loads(s.tickers),
        "constraints": json.loads(s.constraints),
        "created_at": s.created_at
    }
    
    chat_history = _parse_chat_history(s.chat_history)
    
    # Call Gemini API
    ai_result = ai_service.generate_chat_response(
        session_data=session_data,
        chat_history=chat_history,
        user_message=request.message,
        model_name=request.model,
        custom_api_key=request.api_key
    )
    
    if ai_result.get("success"):
        # Append user message and model response to history
        now_ts = datetime.now().strftime("%H:%M")
        chat_history.append({"role": "user", "content": request.message, "timestamp": now_ts})
        chat_history.append({"role": "model", "content": ai_result.get("reply", ""), "timestamp": now_ts, "model": request.model})
        s.chat_history = json.dumps(chat_history)
        s.updated_at = datetime.now().isoformat()
        db.commit()
    
    return schemas.ChatResponse(**ai_result)

@app.delete("/sessions/{session_id}/chat")
def clear_chat_history(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.PortfolioSession).filter(models.PortfolioSession.id == session_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    s.chat_history = json.dumps([])
    s.updated_at = datetime.now().isoformat()
    db.commit()
    return {"message": "Chat history cleared successfully"}



