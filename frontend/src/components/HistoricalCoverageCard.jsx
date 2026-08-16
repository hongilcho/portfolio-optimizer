import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { formatTickerDisplay } from '../utils/formatters';

export default function HistoricalCoverageCard({ tickers = [], proxies = {}, hedgedTickers = [], tickerNames = {} }) {
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tickers && tickers.length > 0) {
      setLoading(true);
      api.getPortfolioCoverage(tickers, proxies)
        .then(data => {
          if (data && !data.error) {
            setCoverage(data);
          } else {
            setCoverage(null);
          }
        })
        .catch(err => {
          console.error("Coverage fetch error:", err);
          setCoverage(null);
        })
        .finally(() => setLoading(false));
    } else {
      setCoverage(null);
    }
  }, [JSON.stringify(tickers), JSON.stringify(proxies)]);

  if (!tickers || tickers.length === 0) return null;

  return (
    <div className="card" style={{ width: '100%', marginTop: '1.5rem', overflowX: 'auto', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>📅</span>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1e293b' }}>
            포트폴리오 과거 데이터 가용 기간 & 병목 분석 (Historical Coverage)
          </h3>
        </div>
        {coverage && coverage.common_start_date && (
          <span style={{
            backgroundColor: '#1d4ed8',
            color: '#ffffff',
            padding: '5px 14px',
            borderRadius: '20px',
            fontSize: '0.88rem',
            fontWeight: 'bold',
            boxShadow: '0 2px 6px rgba(29, 78, 216, 0.25)'
          }}>
            공통 분석 가능: {coverage.common_start_date} ~ 현재 ({coverage.total_common_years}년)
          </span>
        )}
      </div>

      {loading && (
        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
          <span>⏳ 티커 및 프록시의 과거 데이터 가용 기간을 분석하고 있습니다...</span>
        </div>
      )}

      {!loading && coverage && (
        <div>
          {/* Bottleneck Notice Banner */}
          {coverage.bottleneck_ticker && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.88rem',
              color: '#92400e',
              marginBottom: '14px',
              lineHeight: '1.5'
            }}>
              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span>⚠️ 기간 제한 병목 종목:</span>
                <span style={{ color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                  {coverage.bottleneck_ticker}
                  {coverage.tickers?.[coverage.bottleneck_ticker]?.proxy ? ` (프록시: ${coverage.tickers[coverage.bottleneck_ticker].proxy})` : ''}
                </span>
                <span>— 시작일: {coverage.common_start_date}</span>
              </div>
              <div style={{ color: '#78350f', fontSize: '0.84rem' }}>
                전체 포트폴리오의 공통 분석 기간은 <strong>{coverage.bottleneck_ticker}</strong>의 시작일에 의해 제한되고 있습니다.
                {coverage.bottleneck_ticker === 'PDBC' && (
                  <span style={{ marginLeft: '6px' }}>
                    💡 <strong>추천 팁:</strong> PDBC의 프록시를 <code>DBC(2006~)</code> 대신 <strong><code>PCRAX(2002~)</code></strong> 또는 <strong><code>CL=F(2000~)</code></strong>로 변경하시면 분석 기간을 2000년~2002년까지 4~6년 더 확장할 수 있습니다.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Full-width Detailed Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginTop: '4px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>종목</th>
                <th style={{ padding: '10px 12px' }}>환구분</th>
                <th style={{ padding: '10px 12px' }}>원래 상장일</th>
                <th style={{ padding: '10px 12px' }}>적용 프록시</th>
                <th style={{ padding: '10px 12px' }}>프록시 시작일</th>
                <th style={{ padding: '10px 12px' }}>최종 유효 시작일</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>확장된 기간</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>총 가용 기간</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map(t => {
                const item = coverage.tickers?.[t] || {};
                const isBottleneck = t === coverage.bottleneck_ticker;
                const isHedged = hedgedTickers && hedgedTickers.includes(t);
                const isDomestic = t.endsWith('.KS') || t.endsWith('.KQ');

                return (
                  <tr 
                    key={t}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: isBottleneck ? '#fffbeb' : '#ffffff'
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: isBottleneck ? '#b45309' : '#1e293b' }}>
                      {formatTickerDisplay(t, tickerNames)}
                      {isBottleneck && (
                        <span style={{ 
                          backgroundColor: '#fde68a', 
                          color: '#92400e', 
                          fontSize: '0.75rem', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          marginLeft: '6px',
                          fontWeight: 'bold' 
                        }}>
                          병목
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isDomestic ? (
                        <span style={{
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 'bold'
                        }}>
                          🇰🇷 국내자산
                        </span>
                      ) : isHedged ? (
                        <span style={{ color: '#047857', fontWeight: '600' }}>🛡️ (H) 환헤지</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>🌐 환노출</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {item.original_start || '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {item.proxy ? (
                        <span style={{ backgroundColor: '#ede9fe', color: '#6d28d9', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                          {item.proxy}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>
                      {item.proxy_start || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#0f172a' }}>
                      {item.effective_start || '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: (item.extended_years || 0) > 0 ? '#059669' : '#94a3b8' }}>
                      {(item.extended_years || 0) > 0 ? `+${item.extended_years}년` : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                      {item.total_years !== undefined ? `${item.total_years}년` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
