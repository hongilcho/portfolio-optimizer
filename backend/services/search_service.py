import threading
import FinanceDataReader as fdr

_cached_tickers = []
_cache_lock = threading.Lock()
_loaded = False
_loading = False

def _background_load():
    global _cached_tickers, _loaded, _loading
    with _cache_lock:
        _loading = True
    
    temp_tickers = []
    
    # Load KRX and ETF/KR
    for m in ['KRX', 'ETF/KR']:
        try:
            df_krx = fdr.StockListing(m)
            for _, row in df_krx.iterrows():
                code = str(row.get('Code', '') or row.get('Symbol', ''))
                name = str(row.get('Name', ''))
                market = str(row.get('Market', 'KOSPI')) # default to KOSPI for ETF if not specified
                if market == 'KOSPI':
                    code += '.KS'
                elif market == 'KOSDAQ':
                    code += '.KQ'
                else:
                    code += '.KS'
                temp_tickers.append({'symbol': code, 'name': name, 'market': m})
        except Exception as e:
            print(f"Failed to load {m}: {e}")

    # Load US Markets and ETF/US
    for m in ['NASDAQ', 'NYSE', 'AMEX', 'ETF/US']:
        try:
            df_us = fdr.StockListing(m)
            for _, row in df_us.iterrows():
                code = str(row.get('Symbol', ''))
                name = str(row.get('Name', ''))
                temp_tickers.append({'symbol': code, 'name': name, 'market': m})
        except Exception as e:
            print(f"Failed to load {m}: {e}")

    with _cache_lock:
        _cached_tickers = temp_tickers
        _loaded = True
        _loading = False
    print(f"Ticker search cache loaded with {len(_cached_tickers)} symbols.")

# Start background loading when module is imported
threading.Thread(target=_background_load, daemon=True).start()

def search_tickers(query: str, limit: int = 10):
    query = query.lower().strip()
    if not query:
        return []
    
    with _cache_lock:
        tickers = _cached_tickers
        
    results = []
    # Try exact match or starts with first for better relevance
    for t in tickers:
        symbol = t['symbol'].lower()
        name = t['name'].lower()
        if symbol.startswith(query) or name.startswith(query):
            results.append(t)
            if len(results) >= limit:
                return results

    # Then substring match
    for t in tickers:
        if t in results:
            continue
        symbol = t['symbol'].lower()
        name = t['name'].lower()
        if query in symbol or query in name:
            results.append(t)
            if len(results) >= limit:
                break
                
    return results

def get_ticker_names(tickers):
    with _cache_lock:
        t_map = {t['symbol']: t['name'] for t in _cached_tickers}
    return {t: t_map.get(t, t) for t in tickers}
