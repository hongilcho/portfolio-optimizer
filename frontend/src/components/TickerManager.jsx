import React, { useState } from 'react';
import * as api from '../api';

export default function TickerManager({ tickers, setTickers, proxies = {}, setProxies }) {
  const [input, setInput] = useState('');
  const [activeProxyTicker, setActiveProxyTicker] = useState(null);
  const [proxyRecommendations, setProxyRecommendations] = useState([]);
  const [customProxy, setCustomProxy] = useState('');
  const [loadingProxy, setLoadingProxy] = useState(false);

  const handleAdd = () => {
    const ticker = input.trim().toUpperCase();
    if (ticker && !tickers.includes(ticker)) {
      setTickers([...tickers, ticker]);
      setInput('');
    }
  };

  const handleRemove = (tickerToRemove) => {
    setTickers(tickers.filter(t => t !== tickerToRemove));
    if (proxies[tickerToRemove]) {
      const newProxies = { ...proxies };
      delete newProxies[tickerToRemove];
      setProxies(newProxies);
    }
  };

  const openProxyMenu = async (ticker) => {
    setActiveProxyTicker(ticker);
    setCustomProxy(proxies[ticker] || '');
    setProxyRecommendations([]);
    setLoadingProxy(true);
    try {
      const res = await api.getProxyRecommendations(ticker);
      setProxyRecommendations(res.recommendations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProxy(false);
    }
  };

  const handleSetProxy = (proxyTicker) => {
    if (!proxyTicker.trim()) {
      const newProxies = { ...proxies };
      delete newProxies[activeProxyTicker];
      setProxies(newProxies);
    } else {
      setProxies({
        ...proxies,
        [activeProxyTicker]: proxyTicker.trim().toUpperCase()
      });
    }
    setActiveProxyTicker(null);
  };

  return (
    <div className="card">
      <h3>Manage Tickers & Proxies</h3>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <input 
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. AAPL, MSFT"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn" onClick={handleAdd}>Add</button>
      </div>
      <div>
        {tickers.map(ticker => (
          <div key={ticker} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <span style={{ fontWeight: 'bold', minWidth: '60px' }}>{ticker}</span>
            
            {proxies[ticker] ? (
              <span style={{ fontSize: '0.85rem', color: '#8b5cf6', background: '#ede9fe', padding: '2px 8px', borderRadius: '12px' }}>
                Proxy: {proxies[ticker]}
              </span>
            ) : (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No proxy</span>
            )}
            
            <div style={{ marginLeft: 'auto' }}>
              <button 
                className="btn" 
                style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
                onClick={() => activeProxyTicker === ticker ? setActiveProxyTicker(null) : openProxyMenu(ticker)}
              >
                {proxies[ticker] ? 'Edit Proxy' : 'Set Proxy'}
              </button>
              <button 
                onClick={() => handleRemove(ticker)}
                style={{ background: 'none', border: 'none', marginLeft: '8px', cursor: 'pointer', color: '#ef4444', fontSize: '1.2rem' }}
                title="Remove Ticker"
              >
                &times;
              </button>
            </div>

            {activeProxyTicker === ticker && (
              <div style={{ width: '100%', marginTop: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '8px', fontWeight: 'bold' }}>Select a Proxy Ticker for {ticker}:</p>
                <p style={{ fontSize: '0.8rem', marginBottom: '12px', color: '#64748b' }}>Proxies are used to backfill missing historical data before {ticker}'s inception date.</p>
                
                {loadingProxy ? (
                  <p style={{ fontSize: '0.9rem' }}>Loading recommendations...</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {proxyRecommendations.map(rec => (
                      <button 
                        key={rec.ticker}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }}
                        onClick={() => handleSetProxy(rec.ticker)}
                      >
                        <div>
                          <strong style={{ color: '#3b82f6' }}>{rec.ticker}</strong> 
                          <span style={{ fontSize: '0.85rem', marginLeft: '8px' }}>{rec.name}</span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{rec.reason}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    className="input" 
                    placeholder="Or enter custom ticker..." 
                    value={customProxy}
                    onChange={(e) => setCustomProxy(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn" onClick={() => handleSetProxy(customProxy)}>Apply</button>
                  <button className="btn" style={{ background: '#ef4444' }} onClick={() => handleSetProxy('')}>Clear Proxy</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
