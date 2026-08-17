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
        # Load both KRX stocks and domestic ETFs
        for m in ['KRX', 'ETF/KR']:
            try:
                df = fdr.StockListing(m)
                for _, row in df.iterrows():
                    code = str(row.get('Code', '') or row.get('Symbol', ''))
                    name = str(row.get('Name', ''))
                    market = str(row.get('Market', 'KOSPI'))
                    if market == 'KOSDAQ':
                        code += '.KQ'
                    else:
                        code += '.KS'
                    temp_tickers.append({'symbol': code, 'name': name, 'market': m})
            except Exception as sub_e:
                print(f"SearchService: Warning loading {m}: {sub_e}")

        with _cache_lock:
            _cached_tickers = temp_tickers
            _loaded = True
        print(f"SearchService: Loaded {len(_cached_tickers)} domestic symbols (KRX + ETF/KR).")
    except Exception as e:
        print(f"SearchService: Warning during background load: {e}")
    finally:
        with _cache_lock:
            _loading = False

def ensure_cache_loaded(wait_for_completion=False):
    global _loaded, _loading
    if not _loaded:
        if not _loading:
            t = threading.Thread(target=_background_load, daemon=True)
            t.start()
            if wait_for_completion:
                t.join(timeout=8)
        elif wait_for_completion:
            import time
            for _ in range(30):
                if _loaded:
                    break
                time.sleep(0.2)

# Start background cache load immediately on import
ensure_cache_loaded()



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
        
    ensure_cache_loaded(wait_for_completion=True)
    result_names = {}
    
    with _cache_lock:
        krx_map = {t['symbol']: t['name'] for t in _cached_tickers}
        
    for t in tickers:
        upper_t = t.upper()
        # Strip suffix to try matching 6-digit code as well (e.g., '069500')
        pure_code = upper_t.replace('.KS', '').replace('.KQ', '')
        
        if t in krx_map:
            result_names[t] = krx_map[t]
        elif upper_t in krx_map:
            result_names[t] = krx_map[upper_t]
        elif f"{pure_code}.KS" in krx_map:
            result_names[t] = krx_map[f"{pure_code}.KS"]
        elif f"{pure_code}.KQ" in krx_map:
            result_names[t] = krx_map[f"{pure_code}.KQ"]
        elif t.endswith('.KS') or t.endswith('.KQ'):
            result_names[t] = krx_map.get(t, t)
        else:
            # For US stocks (SPY, QQQ etc.), per user display rule, ticker itself is standard
            result_names[t] = t

    return result_names


