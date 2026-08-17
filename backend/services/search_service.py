import threading
import requests
import FinanceDataReader as fdr

_cached_tickers = []
_cache_lock = threading.Lock()
_loaded = False
_loading = False

def _background_load():
    global _cached_tickers, _loaded, _loading
    with _cache_lock:
        if _loading or _loaded:
            return
        _loading = True
    
    try:
        temp_tickers = []
        # Load KRX only
        df_krx = fdr.StockListing('KRX')
        for _, row in df_krx.iterrows():
            code = str(row.get('Code', '') or row.get('Symbol', ''))
            name = str(row.get('Name', ''))
            market = str(row.get('Market', 'KOSPI'))
            if market == 'KOSPI':
                code += '.KS'
            elif market == 'KOSDAQ':
                code += '.KQ'
            else:
                code += '.KS'
            temp_tickers.append({'symbol': code, 'name': name, 'market': 'KRX'})

        with _cache_lock:
            _cached_tickers = temp_tickers
            _loaded = True
        print(f"SearchService: Loaded {len(_cached_tickers)} KRX symbols.")
    except Exception as e:
        print(f"SearchService: Warning loading KRX: {e}")
    finally:
        with _cache_lock:
            _loading = False

def ensure_cache_loaded():
    if not _loaded and not _loading:
        threading.Thread(target=_background_load, daemon=True).start()


def search_tickers(query: str, limit: int = 10):
    query_str = query.strip()
    if not query_str:
        return []
    
    query_lower = query_str.lower()
    results = []
    seen_symbols = set()

    # 1. Search in cached KRX/Domestic tickers
    with _cache_lock:
        tickers = _cached_tickers
        
    for t in tickers:
        symbol = t['symbol'].lower()
        name = t['name'].lower()
        if symbol.startswith(query_lower) or name.startswith(query_lower) or query_lower in symbol or query_lower in name:
            results.append(t)
            seen_symbols.add(t['symbol'].upper())
            if len(results) >= limit:
                return results

    # 2. If query looks like a US/Global ticker or keyword, search Yahoo Finance live
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
        
    result_names = {}
    
    with _cache_lock:
        krx_map = {t['symbol']: t['name'] for t in _cached_tickers}
        
    for t in tickers:
        upper_t = t.upper()
        if t in krx_map:
            result_names[t] = krx_map[t]
        elif upper_t in krx_map:
            result_names[t] = krx_map[upper_t]
        elif t.endswith('.KS') or t.endswith('.KQ'):
            result_names[t] = krx_map.get(t, t)
        else:
            # For US stocks (SPY, QQQ etc.), per user display rule, ticker itself is standard
            result_names[t] = t

    return result_names

