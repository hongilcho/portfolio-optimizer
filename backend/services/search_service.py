import json
from pathlib import Path
import requests

_data_file = Path(__file__).resolve().parent.parent / "data_krx.json"
_cached_tickers = []
_krx_map = {}

def _init_cache():
    global _cached_tickers, _krx_map
    if _cached_tickers:
        return
    try:
        if _data_file.exists():
            with open(_data_file, "r", encoding="utf-8") as f:
                raw_list = json.load(f)
                _cached_tickers = [{"symbol": item["s"], "name": item["n"], "market": "KRX"} for item in raw_list]
                _krx_map = {item["s"]: item["n"] for item in raw_list}
                # Also index pure numeric codes (e.g., '069500' -> 'KODEX 200')
                for item in raw_list:
                    pure_code = item["s"].replace(".KS", "").replace(".KQ", "")
                    _krx_map[pure_code] = item["n"]
            print(f"SearchService: Instant zero-overhead cache loaded with {len(_cached_tickers)} KRX/ETF symbols.")
    except Exception as e:
        print(f"SearchService: Warning loading static krx data: {e}")

_init_cache()

def search_tickers(query: str, limit: int = 10):
    query_str = query.strip()
    if not query_str:
        return []
    
    _init_cache()
    query_lower = query_str.lower()
    results = []
    seen_symbols = set()

    # 1. Search in fast pre-indexed KRX/Domestic tickers
    for t in _cached_tickers:
        symbol = t['symbol'].lower()
        name = t['name'].lower()
        if symbol.startswith(query_lower) or name.startswith(query_lower) or query_lower in symbol or query_lower in name:
            results.append(t)
            seen_symbols.add(t['symbol'].upper())
            if len(results) >= limit:
                return results

    # 2. Search Yahoo Finance live for US/Global tickers
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query_str}&quotesCount=8&newsCount=0"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        resp = requests.get(url, headers=headers, timeout=3)
        if resp.status_code == 200:
            quotes = resp.json().get("quotes", [])
            for q in quotes:
                sym = q.get("symbol", "").upper()
                name = q.get("shortname") or q.get("longname") or sym
                quote_type = q.get("quoteType", "")
                if sym and sym not in seen_symbols and quote_type in ("EQUITY", "ETF", "MUTUALFUND", "INDEX"):
                    results.append({
                        "symbol": sym,
                        "name": name,
                        "market": q.get("exchange", "US")
                    })
                    seen_symbols.add(sym)
                    if len(results) >= limit:
                        break
    except Exception as e:
        print(f"SearchService: Yahoo live search error: {e}")

    # 3. Fallback: If exact ticker typed (e.g. SPY, QQQ, AAPL), ensure it's suggested
    upper_query = query_str.upper()
    if upper_query not in seen_symbols and len(upper_query) <= 6 and upper_query.isalpha():
        results.insert(0, {
            "symbol": upper_query,
            "name": f"{upper_query} (US Asset)",
            "market": "US"
        })

    return results[:limit]

def get_ticker_names(tickers):
    if not tickers:
        return {}
        
    _init_cache()
    result_names = {}
    
    for t in tickers:
        upper_t = t.upper()
        pure_code = upper_t.replace('.KS', '').replace('.KQ', '')
        
        if t in _krx_map:
            result_names[t] = _krx_map[t]
        elif upper_t in _krx_map:
            result_names[t] = _krx_map[upper_t]
        elif pure_code in _krx_map:
            result_names[t] = _krx_map[pure_code]
        elif t.endswith('.KS') or t.endswith('.KQ'):
            result_names[t] = _krx_map.get(t, t)
        else:
            # For US stocks (SPY, QQQ etc.), per user display rule, ticker itself is standard
            result_names[t] = t

    return result_names
