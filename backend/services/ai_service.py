import os
import json
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

backend_env = Path(__file__).resolve().parent.parent / ".env"
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
if root_env.exists():
    load_dotenv(dotenv_path=root_env)


DEFAULT_MODEL = "gemini-3.7-flash"

AVAILABLE_MODELS = [
    {"id": "gemini-3.7-flash", "name": "👑 Gemini 3.7 Flash (심층 분석 & 추론, 권장)", "is_default": True},
    {"id": "gemini-3.5-flash", "name": "⚡ Gemini 3.5 Flash (초고속 응답)", "is_default": False},
    {"id": "gemini-flash-latest", "name": "🚀 Gemini Flash Latest (최신 안정판)", "is_default": False},
    {"id": "gemini-3.1-pro-preview", "name": "🧠 Gemini 3.1 Pro (플래그십 Pro)", "is_default": False},
]


def get_api_key(custom_key: Optional[str] = None) -> str:
    if custom_key and custom_key.strip():
        return custom_key.strip()
    return os.environ.get("GEMINI_API_KEY", "").strip()

def build_portfolio_context(session_data: Dict[str, Any]) -> str:
    """
    Build a comprehensive, structured context summary of the session's live data.
    """
    tickers = session_data.get("tickers", [])
    constraints = session_data.get("constraints", {}) or {}
    
    hedged_tickers = constraints.get("hedged_tickers", [])
    proxies = constraints.get("proxies", {})
    lookback = constraints.get("lookback_period", "5y")
    currency = constraints.get("currency", "KRW")
    
    # 1. Assets & Hedging Config
    assets_info = []
    for t in tickers:
        is_h = t in hedged_tickers
        proxy = proxies.get(t)
        h_str = "🛡️ 환헤지(H) [원달러 환율 무관]" if is_h else "🌐 환노출 [원달러 환율 연동]"
        p_str = f" (프록시: {proxy})" if proxy else ""
        assets_info.append(f"- {t}{p_str}: {h_str}")
    assets_summary = "\n".join(assets_info) if assets_info else "등록된 종목 없음"
    
    # 2. Optimization Results
    dual_opt = constraints.get("opt_dual_result", {})
    custom_w = constraints.get("custom_weights", {})
    opt_summary = "최적화 미실행"
    if dual_opt and "usd_mode" in dual_opt and "krw_mode" in dual_opt:
        usd_w = dual_opt["usd_mode"].get("weights", {})
        krw_w = dual_opt["krw_mode"].get("weights", {})
        usd_perf = dual_opt["usd_mode"].get("usd_performance", {})
        krw_perf = dual_opt["krw_mode"].get("krw_performance", {})
        deltas = dual_opt.get("weight_deltas", {})
        
        opt_lines = [
            f"• 🇺🇸 USD 모드 최적 비중 (기대수익률: {usd_perf.get('expected_annual_return', 0)*100:.2f}%, 변동성: {usd_perf.get('annual_volatility', 0)*100:.2f}%, 샤프: {usd_perf.get('sharpe_ratio', 0):.2f}):",
            f"  {json.dumps({k: f'{v*100:.1f}%' for k, v in usd_w.items()}, ensure_ascii=False)}",
            f"• 🇰🇷 KRW 모드 최적 비중 (기대수익률: {krw_perf.get('expected_annual_return', 0)*100:.2f}%, 변동성: {krw_perf.get('annual_volatility', 0)*100:.2f}%, 샤프: {krw_perf.get('sharpe_ratio', 0):.2f}):",
            f"  {json.dumps({k: f'{v*100:.1f}%' for k, v in krw_w.items()}, ensure_ascii=False)}",
            f"• 비중 변화(KRW - USD Delta): {json.dumps({k: f'{v*100:+.1f}%' for k, v in deltas.items()}, ensure_ascii=False)}"
        ]
        if custom_w:
            opt_lines.append(f"• ✏️ 사용자 지정/현재 적용 비중: {json.dumps({k: f'{v*100:.1f}%' for k, v in custom_w.items()}, ensure_ascii=False)}")
        opt_summary = "\n".join(opt_lines)

    # 3. Backtest Results
    bt_result = constraints.get("backtest_result", {})
    bt_params = constraints.get("backtest_params", {})
    bt_summary = "백테스트 미실행"
    if bt_result and "portfolio_values" in bt_result and len(bt_result["portfolio_values"]) > 0:
        total_inv = bt_result.get("total_invested", bt_params.get("initial_capital", 10000000))
        dca_amt = bt_params.get("dca_amount", 0)
        dca_cnt = bt_result.get("dca_count", 0)
        curr_sym = "₩" if currency == "KRW" else "$"
        
        p_stats = bt_result.get("portfolio_stats", {})
        bm_stats = bt_result.get("benchmark_stats", {})
        spy_stats = bt_result.get("spy_stats", {})
        
        bt_lines = [
            f"• 통화 기준: {currency} | 총 투입 원금: {curr_sym}{total_inv:,.0f} (초기: {curr_sym}{bt_params.get('initial_capital', 0):,.0f}, 월적립 {curr_sym}{dca_amt:,.0f} x {dca_cnt}회)",
            f"• 내 포트폴리오: 최종 {curr_sym}{p_stats.get('final_value', 0):,.0f}, 누적 순손익 {curr_sym}{p_stats.get('net_profit', 0):+,.0f}, 총수익률 {p_stats.get('total_return_pct', 0):+.2f}%, 연환산(MWRR) {p_stats.get('annualized_return_pct', 0):.2f}%, MDD -{abs(p_stats.get('mdd_pct', 0)):.2f}%",
            f"• 1/N 동일가중 벤치마크: 최종 {curr_sym}{bm_stats.get('final_value', 0):,.0f}, 총수익률 {bm_stats.get('total_return_pct', 0):+.2f}%, 연환산 {bm_stats.get('annualized_return_pct', 0):.2f}%, MDD -{abs(bm_stats.get('mdd_pct', 0)):.2f}%",
            f"• S&P 500 (SPY) 벤치마크: 최종 {curr_sym}{spy_stats.get('final_value', 0):,.0f}, 총수익률 {spy_stats.get('total_return_pct', 0):+.2f}%, 연환산 {spy_stats.get('annualized_return_pct', 0):.2f}%, MDD -{abs(spy_stats.get('mdd_pct', 0)):.2f}%"
        ]
        bt_summary = "\n".join(bt_lines)

    context = f"""
[현재 세션 포트폴리오 실시간 데이터]
- 세션 이름: {session_data.get('name', 'Portfolio Session')}
- 분석 대상 기간: {lookback}
- 구성 자산 및 환헤지(H) 설정:
{assets_summary}

[최적화(Optimization) 분석 결과]
{opt_summary}

[백테스트(Backtest) 실전 성과]
{bt_summary}
"""
    return context.strip()

SYSTEM_INSTRUCTION = """당신은 세계 최고 수준의 금융공학 퀀트 애널리스트이자 자산배분 전문 포트폴리오 매니저 'Gemini AI Portfolio Advisor'입니다.

당신의 임무:
1. 사용자가 구성한 포트폴리오의 실시간 수치(자산군, 환헤지/환노출 여부, 상관관계, USD vs KRW 최적화 비중, 백테스트 순손익, MWRR, MDD 등)를 정밀하게 분석하고 전문적이면서도 알기 쉽게 설명합니다.
2. 환노출 자산의 '환쿠션(FX Cushion, 달러 강세 시 원화 평가액 방어 효과)'과 환헤지(H) 자산의 '순수 채권/자산 가격 수익률 보존'의 전략적 상호작용을 거시경제적 관점에서 예리하게 짚어줍니다.
3. 벤치마크(S&P 500, 1/N 동일가중) 대비 리스크-리턴 효율성(샤프지수)과 최대 낙폭(MDD) 방어력의 원인을 데이터에 근거해 명확히 규명합니다.
4. 답변은 정중하고 친절한 한국어 존댓말을 사용하며, 가독성을 높이기 위해 핵심 요약, 글머리 기호(bullet points), 굵은 글씨, 표(markdown table)를 적절히 활용합니다.
"""

def generate_chat_response(
    session_data: Dict[str, Any],
    chat_history: List[Dict[str, str]],
    user_message: str,
    model_name: str = DEFAULT_MODEL,
    custom_api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Call Gemini API with structured portfolio context and chat history.
    """
    api_key = get_api_key(custom_api_key)
    if not api_key:
        return {
            "success": False,
            "error_type": "NO_API_KEY",
            "message": "Gemini API 키가 설정되지 않았습니다. 우측 상단의 키 설정(⚙️) 아이콘을 눌러 API 키를 입력하시거나, 서버 환경변수(GEMINI_API_KEY)를 등록해 주세요."
        }

    context = build_portfolio_context(session_data)
    
    # Format contents for Gemini generateContent API
    contents = []
    
    # Inject system context prompt as the first message or system_instruction
    prompt_with_context = f"{context}\n\n[사용자 질문]\n{user_message}"
    
    # Add prior conversation turns (capped at last 10 messages for efficiency)
    recent_history = chat_history[-10:] if len(chat_history) > 10 else chat_history
    for msg in recent_history:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.get("content", "")}]
        })
    
    # Add current user message with embedded context
    contents.append({
        "role": "user",
        "parts": [{"text": prompt_with_context}]
    })

    # Candidate models for fallback if primary experiences temporary 503 overload
    fallback_models = [model_name]
    for alt in ["gemini-3.5-flash", "gemini-flash-latest"]:
        if alt not in fallback_models:
            fallback_models.append(alt)

    last_error_msg = ""
    last_status = 500

    for current_model in fallback_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={api_key}"
        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": SYSTEM_INSTRUCTION}]
            },
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 2048,
            }
        }

        # Try up to 2 times for transient network/503 issues
        for attempt in range(2):
            try:
                response = requests.post(url, json=payload, timeout=35)
                
                # Handle Rate Limit / Quota Exceeded (429)
                if response.status_code == 429:
                    return {
                        "success": False,
                        "error_type": "QUOTA_EXCEEDED",
                        "model_used": current_model,
                        "message": f"⚠️ 현재 {current_model} 무료 요청 한도에 도달했습니다. 잠시 후 다시 시도하시거나 상단에서 다른 모델을 선택해 주세요."
                    }
                
                # Handle 503 / 500 overloaded - retry or fallback
                if response.status_code in (503, 500, 502, 504):
                    last_status = response.status_code
                    last_error_msg = "Google 서버 일시적 과부하 (High Demand)"
                    import time
                    time.sleep(1)
                    continue
                
                if response.status_code != 200:
                    err_data = {}
                    try:
                        err_data = response.json()
                    except Exception:
                        pass
                    err_msg = err_data.get("error", {}).get("message", response.text)
                    return {
                        "success": False,
                        "error_type": "API_ERROR",
                        "message": f"Gemini API 오류 ({response.status_code}): {err_msg}"
                    }

                res_json = response.json()
                candidates = res_json.get("candidates", [])
                if not candidates:
                    return {
                        "success": False,
                        "error_type": "EMPTY_RESPONSE",
                        "message": "AI 응답을 생성하지 못했습니다."
                    }

                reply_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return {
                    "success": True,
                    "reply": reply_text,
                    "model_used": current_model
                }

            except requests.exceptions.Timeout:
                last_error_msg = "응답 시간 초과"
                continue
            except Exception as e:
                last_error_msg = str(e)
                continue

    return {
        "success": False,
        "error_type": "SERVER_OVERLOADED",
        "message": f"Google Gemini 서버가 현재 일시적인 트래픽 폭주(503 High Demand) 상태입니다. 잠시 후 다시 전송 버튼을 누르시면 정상 처리됩니다. (사유: {last_error_msg})"
    }
