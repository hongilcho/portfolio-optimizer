import React, { useState, useEffect } from 'react';
import * as api from '../api';
import AutocompleteInput from './AutocompleteInput';
import { formatTickerDisplay } from '../utils/formatters';

export default function TickerManager({ 
  tickers, 
  setTickers, 
  proxies = {}, 
  setProxies,
  hedgedTickers = [],
  setHedgedTickers,
  tickerNames
}) {
  const [input, setInput] = useState('');
  const [activeProxyTicker, setActiveProxyTicker] = useState(null);
  const [proxyRecommendations, setProxyRecommendations] = useState([]);
  const [customProxy, setCustomProxy] = useState('');
  const [loadingProxy, setLoadingProxy] = useState(false);

  // Live validation state for custom proxy
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);

  // Portfolio historical coverage state
  const [coverage, setCoverage] = useState(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // Fetch coverage whenever tickers or proxies change
  useEffect(() => {
    if (tickers && tickers.length > 0) {
      setLoadingCoverage(true);
      api.getPortfolioCoverage(tickers, proxies)
        .then(data => {
          setCoverage(data);
        })
        .catch(err => console.error("Failed to fetch coverage:", err))
        .finally(() => setLoadingCoverage(false));
    } else {
      setCoverage(null);
    }
  }, [tickers, proxies]);

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
    if (hedgedTickers && setHedgedTickers && hedgedTickers.includes(tickerToRemove)) {
      setHedgedTickers(hedgedTickers.filter(t => t !== tickerToRemove));
    }
  };

  const toggleHedge = (ticker) => {
    if (!setHedgedTickers) return;
    if (hedgedTickers.includes(ticker)) {
      setHedgedTickers(hedgedTickers.filter(t => t !== ticker));
    } else {
      setHedgedTickers([...hedgedTickers, ticker]);
    }
  };

  const openProxyMenu = async (ticker) => {
    setActiveProxyTicker(ticker);
    setCustomProxy(proxies[ticker] || '');
    setValidationResult(null);
    setProxyRecommendations([]);
    setLoadingProxy(true);
    try {
      const res = await api.getProxyRecommendations(ticker);
      setProxyRecommendations(res.recommendations || []);
      // If there's an existing proxy, validate it immediately
      if (proxies[ticker]) {
        handleValidate(proxies[ticker]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProxy(false);
    }
  };

  const handleValidate = async (tickerToValidate) => {
    const clean = (tickerToValidate || customProxy).trim().toUpperCase();
    if (!clean) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await api.validateProxy(clean);
      setValidationResult(res);
    } catch (err) {
      setValidationResult({ valid: false, error: '검증 중 오류 발생' });
    } finally {
      setValidating(false);
    }
  };

  const handleSetProxy = (proxyTicker) => {
    const clean = proxyTicker ? proxyTicker.trim().toUpperCase() : '';
    if (!clean) {
      const newProxies = { ...proxies };
      delete newProxies[activeProxyTicker];
      setProxies(newProxies);
    } else {
      setProxies({
        ...proxies,
        [activeProxyTicker]: clean
      });
    }
    setActiveProxyTicker(null);
    setValidationResult(null);
  };

  return (
    <div className="card">
      <h3>Manage Tickers & Proxies</h3>
      
      {/* Ticker Add Form */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <AutocompleteInput 
          value={input}
          onChange={setInput}
          onSelect={(ticker) => {
            if (ticker && !tickers.includes(ticker)) {
              setTickers([...tickers, ticker]);
              setInput('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="e.g. QQQ, 삼성전자, AAPL"
        />
        <button className="btn" onClick={handleAdd}>Add</button>
      </div>

      {/* Tickers List */}
      <div style={{ marginBottom: '1.5rem' }}>
        {tickers.map(ticker => {
          const isHedged = hedgedTickers && hedgedTickers.includes(ticker);
          const tCoverage = coverage?.tickers?.[ticker];
          const isDomestic = ticker.endsWith('.KS') || ticker.endsWith('.KQ');

          return (
            <div key={ticker} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
              <span style={{ fontWeight: 'bold', minWidth: '60px', fontSize: '1rem', color: '#1e293b' }}>
                {formatTickerDisplay(ticker, tickerNames)}
              </span>
              
              {/* Currency Hedging Badge Toggle */}
              {isDomestic ? (
                <span style={{
                  fontSize: '0.8rem',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  fontWeight: 'bold',
                  cursor: 'default'
                }}>
                  🇰🇷 국내자산
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleHedge(ticker)}
                  title="클릭하여 환노출 / 환헤지(H) 전환"
                  style={{
                    fontSize: '0.8rem',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: isHedged ? '1px solid #10b981' : '1px solid #cbd5e1',
                    background: isHedged ? '#ecfdf5' : '#f8fafc',
                    color: isHedged ? '#047857' : '#64748b',
                    fontWeight: isHedged ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {isHedged ? '🛡️ (H) 환헤지' : '🌐 환노출'}
                </button>
              )}

              {/* Proxy Badge */}
              {proxies[ticker] ? (
                <span style={{ fontSize: '0.82rem', color: '#6d28d9', background: '#ede9fe', padding: '3px 10px', borderRadius: '12px', fontWeight: '500' }}>
                  Proxy: <strong>{proxies[ticker]}</strong>
                </span>
              ) : (
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No proxy</span>
              )}

              {/* Coverage date snippet */}
              {tCoverage && tCoverage.effective_start && (
                <span style={{ fontSize: '0.78rem', color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                  {tCoverage.effective_start} ~ 현재 ({tCoverage.total_years}년)
                  {tCoverage.extended_years > 0 && (
                    <strong style={{ color: '#059669', marginLeft: '4px' }}>+{tCoverage.extended_years}년 확장</strong>
                  )}
                </span>
              )}
              
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <button 
                  className="btn" 
                  style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
                  onClick={() => activeProxyTicker === ticker ? setActiveProxyTicker(null) : openProxyMenu(ticker)}
                >
                  {proxies[ticker] ? 'Edit Proxy' : 'Set Proxy'}
                </button>
                <button 
                  onClick={() => handleRemove(ticker)}
                  style={{ background: 'none', border: 'none', marginLeft: '8px', cursor: 'pointer', color: '#ef4444', fontSize: '1.3rem', lineHeight: 1 }}
                  title="Remove Ticker"
                >
                  &times;
                </button>
              </div>

              {/* Active Proxy Menu & Live Validation */}
              {activeProxyTicker === ticker && (
                <div style={{ width: '100%', marginTop: '10px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                      🔍 {ticker} 프록시(대체 자산) 설정 및 유효성 검사
                    </strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      상장 이전 과거 데이터를 연장하기 위해 이전 펀드/선물 티커를 연결합니다.
                    </span>
                  </div>
                  
                  {loadingProxy ? (
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>추천 프록시 목록 불러오는 중...</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
                      {proxyRecommendations.map(rec => (
                        <div 
                          key={rec.ticker}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px'
                          }}
                        >
                          <div>
                            <strong style={{ color: '#2563eb', fontSize: '0.9rem' }}>{rec.ticker}</strong> 
                            <span style={{ fontSize: '0.85rem', marginLeft: '8px', color: '#334155' }}>{rec.name}</span>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '10px' }}>({rec.reason})</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => { setCustomProxy(rec.ticker); handleValidate(rec.ticker); }}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              검증
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetProxy(rec.ticker)}
                              style={{ padding: '4px 10px', fontSize: '0.75rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              적용
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Custom Proxy Input & Validation Box */}
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <AutocompleteInput 
                        placeholder="직접 티커 입력 (예: 삼성전자, VUSTX)" 
                        value={customProxy}
                        onChange={(val) => {
                          setCustomProxy(val);
                          setValidationResult(null);
                        }}
                        onSelect={(ticker) => {
                          setCustomProxy(ticker);
                          handleValidate(ticker);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleValidate();
                        }}
                      />
                      <button 
                        className="btn" 
                        type="button" 
                        onClick={() => handleValidate()} 
                        disabled={validating || !customProxy.trim()}
                        style={{ background: '#475569', color: '#fff', padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        {validating ? '검증 중...' : '유효성 검사'}
                      </button>
                      <button 
                        className="btn" 
                        type="button" 
                        onClick={() => handleSetProxy(customProxy)}
                        disabled={!customProxy.trim()}
                        style={{ background: '#2563eb', color: '#fff', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        적용
                      </button>
                      <button 
                        className="btn" 
                        type="button" 
                        style={{ background: '#ef4444', color: '#fff', padding: '6px 10px', fontSize: '0.85rem' }} 
                        onClick={() => handleSetProxy('')}
                      >
                        프록시 삭제
                      </button>
                    </div>

                    {/* Live Validation Result Box */}
                    {validationResult && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        backgroundColor: validationResult.valid ? '#f0fdf4' : '#fef2f2',
                        border: validationResult.valid ? '1px solid #bbf7d0' : '1px solid #fecaca',
                        color: validationResult.valid ? '#166534' : '#991b1b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px'
                      }}>
                        {validationResult.valid ? (
                          <>
                            <span>
                              ✅ <strong>{validationResult.ticker}</strong> ({validationResult.name}) 유효함
                            </span>
                            <span>
                              가용 데이터: <strong>{validationResult.start_date} ~ {validationResult.end_date}</strong> (약 {validationResult.years}년, {validationResult.count?.toLocaleString()}일)
                            </span>
                          </>
                        ) : (
                          <span>
                            ❌ <strong>{validationResult.ticker || customProxy}</strong>: {validationResult.error || '유효하지 않은 티커이거나 데이터를 가져올 수 없습니다.'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

