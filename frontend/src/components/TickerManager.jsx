import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function TickerManager({ 
  tickers, 
  setTickers, 
  proxies = {}, 
  setProxies,
  hedgedTickers = [],
  setHedgedTickers
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
        <input 
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. QQQ, TLT, GLD, SCHD, PDBC"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn" onClick={handleAdd}>Add</button>
      </div>

      {/* Tickers List */}
      <div style={{ marginBottom: '1.5rem' }}>
        {tickers.map(ticker => {
          const isHedged = hedgedTickers && hedgedTickers.includes(ticker);
          const tCoverage = coverage?.tickers?.[ticker];

          return (
            <div key={ticker} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
              <span style={{ fontWeight: 'bold', minWidth: '60px', fontSize: '1rem', color: '#1e293b' }}>{ticker}</span>
              
              {/* Currency Hedging Badge Toggle */}
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
                      <input 
                        className="input" 
                        placeholder="직접 티커 입력 (예: GC=F, DBC, PCRAX, VUSTX, VDIGX)" 
                        value={customProxy}
                        onChange={(e) => {
                          setCustomProxy(e.target.value);
                          setValidationResult(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
                        style={{ flex: 1, fontSize: '0.88rem' }}
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

      {/* Historical Coverage & Bottleneck Analysis Card */}
      {tickers.length > 0 && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '14px 16px',
          marginTop: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
              📅 포트폴리오 과거 데이터 가용 기간 & 병목 분석 (Historical Coverage)
            </h4>
            {coverage && coverage.common_start_date && (
              <span style={{
                backgroundColor: '#1d4ed8',
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '0.85rem',
                fontWeight: 'bold'
              }}>
                공통 분석 가능: {coverage.common_start_date} ~ 현재 ({coverage.total_common_years}년)
              </span>
            )}
          </div>

          {loadingCoverage ? (
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>데이터 가용 기간을 분석하고 있습니다...</p>
          ) : coverage ? (
            <div>
              {/* Bottleneck Alert */}
              {coverage.bottleneck_ticker && (
                <div style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  color: '#92400e',
                  marginBottom: '10px',
                  lineHeight: '1.4'
                }}>
                  <strong>⚠️ 기간 제한 병목 종목:</strong> {coverage.bottleneck_message}
                  {coverage.bottleneck_ticker === 'PDBC' && (
                    <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#78350f' }}>
                      💡 <strong>추천 팁:</strong> PDBC의 프록시를 <code>DBC(2006~)</code> 대신 <strong><code>PCRAX(2002~)</code></strong> 또는 <strong><code>CL=F(2000~)</code></strong>로 변경하시면 분석 기간을 2000년~2002년까지 4~6년 더 확장할 수 있습니다!
                    </div>
                  )}
                </div>
              )}

              {/* Coverage Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', backgroundColor: '#ffffff', borderRadius: '6px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px' }}>종목</th>
                      <th style={{ padding: '6px 10px' }}>환구분</th>
                      <th style={{ padding: '6px 10px' }}>원래 상장일</th>
                      <th style={{ padding: '6px 10px' }}>적용 프록시</th>
                      <th style={{ padding: '6px 10px' }}>프록시 시작일</th>
                      <th style={{ padding: '6px 10px' }}>최종 유효 시작일</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>연장된 기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map(t => {
                      const item = coverage.tickers?.[t] || {};
                      const isBottleneck = t === coverage.bottleneck_ticker;
                      const isHedged = hedgedTickers && hedgedTickers.includes(t);

                      return (
                        <tr 
                          key={t}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isBottleneck ? '#fffbeb' : '#ffffff'
                          }}
                        >
                          <td style={{ padding: '6px 10px', fontWeight: 'bold', color: isBottleneck ? '#b45309' : '#1e293b' }}>
                            {t} {isBottleneck && <span style={{ color: '#d97706', fontSize: '0.75rem' }}>[병목]</span>}
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            {isHedged ? '🛡️ (H)' : '🌐'}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>
                            {item.original_start || '-'}
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            {item.proxy ? <strong style={{ color: '#6d28d9' }}>{item.proxy}</strong> : <span style={{ color: '#94a3b8' }}>-</span>}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>
                            {item.proxy_start || '-'}
                          </td>
                          <td style={{ padding: '6px 10px', fontWeight: '600', color: '#0f172a' }}>
                            {item.effective_start || '-'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold', color: (item.extended_years || 0) > 0 ? '#059669' : '#94a3b8' }}>
                            {(item.extended_years || 0) > 0 ? `+${item.extended_years}년` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
