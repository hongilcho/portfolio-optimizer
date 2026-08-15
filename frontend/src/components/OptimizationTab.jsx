import React, { useState, useEffect } from 'react';
import * as api from '../api';
import OptimizationSettings from './OptimizationSettings';
import Plot from 'react-plotly.js';

export default function OptimizationTab({ session, setSession }) {
  const [dualResult, setDualResult] = useState(session.constraints?.opt_dual_result || null);
  const [optBase, setOptBase] = useState(session.constraints?.opt_base || 'USD'); // 'USD', 'KRW', 'DUAL'
  const [editableWeights, setEditableWeights] = useState(
    session.constraints?.custom_weights || session.constraints?.opt_result?.weights || {}
  );
  const [isCustomMode, setIsCustomMode] = useState(!!session.constraints?.is_custom_mode);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [customPerf, setCustomPerf] = useState(null);

  useEffect(() => {
    if (session.constraints?.opt_dual_result) {
      setDualResult(session.constraints.opt_dual_result);
    }
    if (session.constraints?.opt_base) {
      setOptBase(session.constraints.opt_base);
    }
    const savedWeights = session.constraints?.custom_weights || session.constraints?.user_edited_weights;
    if (savedWeights) {
      setEditableWeights(savedWeights);
      setIsCustomMode(!!session.constraints.is_custom_mode);
      if (session.tickers?.length > 0) {
        api.evaluatePortfolio(
          session.tickers, savedWeights, session.constraints.lookback_period || '5y', session.constraints.proxies || {}, session.constraints.hedged_tickers || [], 'KRW'
        ).then(res => setCustomPerf(res)).catch(e => console.error(e));
      }
    }
  }, [session.id]);


  const lookback = session.constraints.lookback_period || '5y';
  const objective = session.constraints.objective || 'max_sharpe';
  const hedgedTickers = session.constraints.hedged_tickers || [];
  const proxies = session.constraints.proxies || {};

  const handleOptimize = async () => {
    if (session.tickers.length === 0) return alert("Please add tickers first in the Data & Analysis tab.");
    setLoading(true);
    try {
      const dualRes = await api.optimizePortfolioDual(
        session.tickers, session.constraints, lookback, objective, proxies, hedgedTickers
      );
      setDualResult(dualRes);

      const activeWeights = optBase === 'KRW' ? dualRes.krw_mode.weights : dualRes.usd_mode.weights;
      setEditableWeights(activeWeights);
      setIsCustomMode(false);
      setCustomPerf(null);

      setSession({
        ...session,
        constraints: {
          ...session.constraints,
          opt_dual_result: dualRes,
          opt_result: {
            weights: activeWeights,
            expected_annual_return: (optBase === 'KRW' ? dualRes.krw_mode : dualRes.usd_mode).usd_performance.expected_annual_return,
            annual_volatility: (optBase === 'KRW' ? dualRes.krw_mode : dualRes.usd_mode).usd_performance.annual_volatility,
            sharpe_ratio: (optBase === 'KRW' ? dualRes.krw_mode : dualRes.usd_mode).usd_performance.sharpe_ratio
          },
          custom_weights: activeWeights,
          is_custom_mode: false,
          opt_base: optBase
        }
      });
    } catch (err) {
      console.error(err);
      alert("Optimization failed. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleBaseChange = (newBase) => {
    setOptBase(newBase);
    let newWeights = editableWeights;
    if (dualResult && !isCustomMode) {
      if (newBase === 'KRW') newWeights = dualResult.krw_mode.weights;
      else newWeights = dualResult.usd_mode.weights;
      setEditableWeights(newWeights);
    }

    setSession(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        opt_base: newBase,
        custom_weights: newWeights
      }
    }));
  };

  const handleApplyPreset = (targetMode) => {
    if (!dualResult) return;
    const chosenWeights = targetMode === 'KRW' ? dualResult.krw_mode.weights : dualResult.usd_mode.weights;
    setEditableWeights(chosenWeights);
    setIsCustomMode(false);
    setCustomPerf(null);

    setSession(prev => ({
      ...prev,
      constraints: {
        ...prev.constraints,
        custom_weights: chosenWeights,
        is_custom_mode: false
      }
    }));
  };

  const handleWeightChange = async (ticker, newPercentVal) => {
    let parsed = parseFloat(newPercentVal);
    if (isNaN(parsed)) parsed = 0;
    const decimalVal = Math.max(0, parsed / 100);

    const updatedWeights = {
      ...editableWeights,
      [ticker]: decimalVal
    };
    setEditableWeights(updatedWeights);
    setIsCustomMode(true);

    setEvaluating(true);
    try {
      const evalResult = await api.evaluatePortfolio(
        session.tickers, updatedWeights, lookback, proxies, hedgedTickers, optBase === 'KRW' ? 'KRW' : 'USD'
      );
      setCustomPerf(evalResult);

      setSession(prev => ({
        ...prev,
        constraints: {
          ...prev.constraints,
          custom_weights: updatedWeights,
          user_edited_weights: updatedWeights,
          is_custom_mode: true
        }
      }));
    } catch (err) {
      console.error("Custom evaluation failed", err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleNormalizeWeights = async () => {
    const total = Object.values(editableWeights).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const normalized = {};
    Object.keys(editableWeights).forEach(t => {
      normalized[t] = editableWeights[t] / total;
    });
    setEditableWeights(normalized);
    setIsCustomMode(true);

    setEvaluating(true);
    try {
      const evalResult = await api.evaluatePortfolio(
        session.tickers, normalized, lookback, proxies, hedgedTickers, optBase === 'KRW' ? 'KRW' : 'USD'
      );
      setCustomPerf(evalResult);

      setSession(prev => ({
        ...prev,
        constraints: {
          ...prev.constraints,
          custom_weights: normalized,
          user_edited_weights: normalized,
          is_custom_mode: true
        }
      }));

    } catch (err) {
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleObjectiveChange = (e) => {
    setSession({
      ...session,
      constraints: { ...session.constraints, objective: e.target.value }
    });
  };

  const renderComparisonSection = () => {
    if (!dualResult) return null;
    const tickers = session.tickers;
    const usdMode = dualResult.usd_mode;
    const krwMode = dualResult.krw_mode;
    const deltas = dualResult.weight_deltas;

    const totalSumPercent = (Object.values(editableWeights).reduce((a, b) => a + b, 0) * 100).toFixed(1);

    return (
      <div style={{ marginTop: '2rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* Dual Pie Charts Comparison */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', 
          gap: '1rem', 
          marginBottom: '1.5rem',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box'
        }}>
          <div className="card" style={{ minWidth: 0, overflow: 'hidden', margin: 0, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
              <h4 style={{ margin: 0, color: '#1d4ed8', fontSize: '0.95rem' }}>🇺🇸 USD Mode (자산 펀더멘털 기준)</h4>
              <button 
                type="button" 
                onClick={() => handleApplyPreset('USD')}
                style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer' }}
              >
                이 비중 적용
              </button>
            </div>
            <div style={{ width: '100%', minWidth: 0, height: '240px', overflow: 'hidden' }}>
              <Plot
                data={[{
                  labels: Object.keys(usdMode.weights).filter(k => usdMode.weights[k] > 0.001),
                  values: Object.keys(usdMode.weights).filter(k => usdMode.weights[k] > 0.001).map(k => usdMode.weights[k]),
                  type: 'pie',
                  hole: 0.4,
                  textinfo: 'label+percent',
                  marker: { colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'] }
                }]}
                layout={{ autosize: true, margin: { l: 15, r: 15, t: 15, b: 15 }, showlegend: false }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>

          <div className="card" style={{ minWidth: 0, overflow: 'hidden', margin: 0, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
              <h4 style={{ margin: 0, color: '#047857', fontSize: '0.95rem' }}>🇰🇷 KRW Mode (원화 환노출/헤지 기준)</h4>
              <button 
                type="button" 
                onClick={() => handleApplyPreset('KRW')}
                style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '4px', cursor: 'pointer' }}
              >
                이 비중 적용
              </button>
            </div>
            <div style={{ width: '100%', minWidth: 0, height: '240px', overflow: 'hidden' }}>
              <Plot
                data={[{
                  labels: Object.keys(krwMode.weights).filter(k => krwMode.weights[k] > 0.001),
                  values: Object.keys(krwMode.weights).filter(k => krwMode.weights[k] > 0.001).map(k => krwMode.weights[k]),
                  type: 'pie',
                  hole: 0.4,
                  textinfo: 'label+percent',
                  marker: { colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'] }
                }]}
                layout={{ autosize: true, margin: { l: 15, r: 15, t: 15, b: 15 }, showlegend: false }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>


        {/* Side-by-Side Weights & Performance Comparison Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>
              최적 자산배분 비교표 (USD vs KRW vs 사용자 임의 비중)
            </h3>
            <button 
              className="btn"
              style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
              onClick={handleNormalizeWeights}
            >
              사용자 비중 100%로 정규화
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '0.6rem' }}>Ticker</th>
                  <th style={{ padding: '0.6rem' }}>환구분</th>
                  <th style={{ padding: '0.6rem', textAlign: 'right' }}>🇺🇸 USD 최적 비중</th>
                  <th style={{ padding: '0.6rem', textAlign: 'right' }}>🇰🇷 KRW 최적 비중</th>
                  <th style={{ padding: '0.6rem', textAlign: 'right' }}>차이 (Δ KRW-USD)</th>
                  <th style={{ padding: '0.6rem', textAlign: 'right' }}>✏️ 현재/임의 비중 (%)</th>
                </tr>
              </thead>
              <tbody>
                {tickers.map(t => {
                  const isHedged = hedgedTickers.includes(t);
                  const wUsd = (usdMode.weights[t] || 0) * 100;
                  const wKrw = (krwMode.weights[t] || 0) * 100;
                  const delta = (deltas[t] || 0) * 100;
                  const curW = (editableWeights[t] || 0) * 100;

                  return (
                    <tr key={t} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.6rem', fontWeight: 'bold' }}>{t}</td>
                      <td style={{ padding: '0.6rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: isHedged ? '#ecfdf5' : '#f1f5f9',
                          color: isHedged ? '#047857' : '#475569'
                        }}>
                          {isHedged ? '🛡️ (H)' : '🌐 환노출'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>
                        {wUsd.toFixed(1)}%
                      </td>
                      <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>
                        {wKrw.toFixed(1)}%
                      </td>
                      <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 'bold', color: delta > 0 ? '#10b981' : (delta < 0 ? '#ef4444' : '#64748b') }}>
                        {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                      </td>
                      <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                        <input 
                          className="input"
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          style={{ width: '80px', textAlign: 'right', padding: '3px 6px', fontWeight: 'bold' }}
                          value={Math.round(curW * 100) / 100}
                          onChange={e => handleWeightChange(t, e.target.value)}
                        /> %
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                  <td style={{ padding: '0.6rem' }} colSpan={2}>합계 (Total)</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#1d4ed8' }}>100.0%</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#047857' }}>100.0%</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right' }}>0.0%</td>
                  <td style={{ padding: '0.6rem', textAlign: 'right', color: Math.abs(totalSumPercent - 100.0) < 0.1 ? '#10b981' : '#ef4444' }}>
                    {totalSumPercent}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Performance Comparison Summary */}
          <div style={{ marginTop: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 0.75rem 0' }}>예상 성과 지표 비교 (Expected Performance)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <strong style={{ color: '#1d4ed8', display: 'block', marginBottom: '0.4rem' }}>🇺🇸 USD Mode 포트폴리오</strong>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  기대수익률: <strong>{(usdMode.usd_performance.expected_annual_return * 100).toFixed(2)}%</strong><br />
                  변동성: <strong>{(usdMode.usd_performance.annual_volatility * 100).toFixed(2)}%</strong><br />
                  샤프지수: <strong>{usdMode.usd_performance.sharpe_ratio.toFixed(2)}</strong>
                </div>
              </div>

              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                <strong style={{ color: '#047857', display: 'block', marginBottom: '0.4rem' }}>🇰🇷 KRW Mode 포트폴리오</strong>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  기대수익률: <strong>{(krwMode.krw_performance.expected_annual_return * 100).toFixed(2)}%</strong><br />
                  변동성: <strong>{(krwMode.krw_performance.annual_volatility * 100).toFixed(2)}%</strong><br />
                  샤프지수: <strong>{krwMode.krw_performance.sharpe_ratio.toFixed(2)}</strong>
                </div>
              </div>

              {customPerf && (
                <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '8px', border: '2px solid #f59e0b', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <strong style={{ color: '#b45309', fontSize: '0.95rem' }}>✏️ 사용자 지정 포트폴리오 (Custom Portfolio)</strong>
                    <span style={{ fontSize: '0.75rem', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      실시간 계산됨
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: '#eff6ff', padding: '0.6rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                      <span style={{ color: '#1d4ed8', fontWeight: 'bold', fontSize: '0.85rem' }}>🇺🇸 USD 기준 (자산 본연 성향)</span>
                      <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.3rem', lineHeight: '1.4' }}>
                        기대수익률: <strong>{(customPerf.usd_performance.expected_annual_return * 100).toFixed(2)}%</strong><br />
                        연간 변동성: <strong>{(customPerf.usd_performance.annual_volatility * 100).toFixed(2)}%</strong><br />
                        샤프지수: <strong>{customPerf.usd_performance.sharpe_ratio.toFixed(2)}</strong>
                      </div>
                    </div>

                    <div style={{ background: '#ecfdf5', padding: '0.6rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                      <span style={{ color: '#047857', fontWeight: 'bold', fontSize: '0.85rem' }}>🇰🇷 KRW 실전 기준 (환노출/헤지 체감)</span>
                      <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.3rem', lineHeight: '1.4' }}>
                        기대수익률: <strong>{(customPerf.krw_performance.expected_annual_return * 100).toFixed(2)}%</strong><br />
                        연간 변동성: <strong>{(customPerf.krw_performance.annual_volatility * 100).toFixed(2)}%</strong><br />
                        샤프지수: <strong>{customPerf.krw_performance.sharpe_ratio.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <OptimizationSettings 

          tickers={session.tickers}
          constraints={session.constraints}
          setConstraints={(newConstraints) => setSession({...session, constraints: newConstraints})}
        />

        <div className="card">
          <h3>Optimization Engine</h3>
          
          {/* Optimization Mode Toggle */}
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>최적화 기준 (Optimization Base)</label>
          <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden', marginBottom: '1.2rem' }}>
            <button
              type="button"
              onClick={() => handleBaseChange('USD')}
              style={{
                flex: 1,
                padding: '8px',
                background: optBase === 'USD' ? '#2563eb' : '#f8fafc',
                color: optBase === 'USD' ? '#fff' : '#475569',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🇺🇸 USD 펀더멘털 (권장)
            </button>
            <button
              type="button"
              onClick={() => handleBaseChange('KRW')}
              style={{
                flex: 1,
                padding: '8px',
                background: optBase === 'KRW' ? '#2563eb' : '#f8fafc',
                color: optBase === 'KRW' ? '#fff' : '#475569',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🇰🇷 KRW 실전 리스크
            </button>
            <button
              type="button"
              onClick={() => handleBaseChange('DUAL')}
              style={{
                flex: 1,
                padding: '8px',
                background: optBase === 'DUAL' ? '#2563eb' : '#f8fafc',
                color: optBase === 'DUAL' ? '#fff' : '#475569',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              ⚖️ 두 모드 나란히 비교
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Lookback Period</label>
            <input className="input" type="text" value={lookback} disabled style={{ backgroundColor: '#f1f5f9' }} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Objective Function</label>
            <select className="input" value={objective} onChange={handleObjectiveChange}>
              <option value="max_sharpe">Maximize Sharpe Ratio (Best Risk-Adjusted)</option>
              <option value="min_volatility">Minimize Volatility (Lowest Risk)</option>
            </select>
          </div>

          <button 
            className="btn" 
            style={{ width: '100%', fontSize: '1.1rem', padding: '1rem' }} 
            onClick={handleOptimize} 
            disabled={loading || session.tickers.length === 0}
          >
            {loading ? 'Optimizing Dual Portfolios...' : 'Run Dual Optimization'}
          </button>
        </div>
      </div>

      {renderComparisonSection()}
    </div>
  );
}


