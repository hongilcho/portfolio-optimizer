import React, { useState, useEffect } from 'react';
import * as api from '../api';
import Plot from 'react-plotly.js';

export default function BacktestTab({ session, setSession }) {
  const [result, setResult] = useState(session.constraints?.backtest_result || null);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(session.constraints?.exchange_rate || 1400.0);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [currency, setCurrency] = useState(session.constraints?.currency || 'KRW');

  const [params, setParams] = useState(session.constraints?.backtest_params || {
    initial_capital: 10000000,
    dca_amount: 1000000,
    rebalance_frequency: 'monthly',
    rebalance_threshold: 0.05
  });

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  useEffect(() => {
    if (session.constraints?.backtest_result) {
      setResult(session.constraints.backtest_result);
    }
    if (session.constraints?.backtest_params) {
      setParams(session.constraints.backtest_params);
    }
    if (session.constraints?.currency) {
      setCurrency(session.constraints.currency);
    }
    if (session.constraints?.exchange_rate) {
      setExchangeRate(session.constraints.exchange_rate);
    }
  }, [session.id]);

  const fetchExchangeRate = async () => {
    setFetchingRate(true);
    try {
      const data = await api.getExchangeRate();
      if (data && data.usd_krw) {
        setExchangeRate(data.usd_krw);
        setSession(prev => ({
          ...prev,
          constraints: {
            ...prev.constraints,
            exchange_rate: data.usd_krw
          }
        }));
      }
    } catch (err) {
      console.error("Failed to fetch exchange rate", err);
    } finally {
      setFetchingRate(false);
    }
  };

  const lookback = session.constraints.lookback_period || '5y';

  const handleRunBacktest = async () => {
    if (session.tickers.length === 0) return alert("Please add tickers in Data & Analysis tab first.");
    setLoading(true);
    try {
      let targetWeights = session.constraints?.custom_weights || session.constraints?.opt_result?.weights;
      
      if (!targetWeights) {
        const optResult = await api.optimizePortfolio(
          session.tickers, session.constraints, lookback, session.constraints.objective || 'max_sharpe', session.constraints.proxies || {}
        );
        targetWeights = optResult.weights;
      }
      
      const payload = {
        ...params,
        currency,
        exchange_rate: exchangeRate
      };

      const hedgedTickers = session.constraints?.hedged_tickers || [];
      const btResult = await api.runBacktest(
        session.tickers, targetWeights, lookback, payload, session.constraints?.proxies || {}, hedgedTickers
      );
      const fullResult = { ...btResult, weights: targetWeights };

      
      setResult(fullResult);
      
      setSession({
        ...session,
        constraints: {
          ...session.constraints,
          currency,
          exchange_rate: exchangeRate,
          backtest_params: params,
          backtest_result: fullResult
        }
      });
    } catch (err) {
      console.error(err);
      alert("Backtest failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedParams = {
      ...params,
      [name]: isNaN(value) || value === '' ? value : parseFloat(value)
    };
    setParams(updatedParams);
    setSession({
      ...session,
      constraints: {
        ...session.constraints,
        backtest_params: updatedParams
      }
    });
  };

  const handleCurrencyChange = (newCurr) => {
    if (newCurr === currency) return;
    let newInit = params.initial_capital;
    let newDca = params.dca_amount;

    if (newCurr === 'KRW' && currency === 'USD') {
      newInit = Math.round(params.initial_capital * exchangeRate);
      newDca = Math.round(params.dca_amount * exchangeRate);
    } else if (newCurr === 'USD' && currency === 'KRW') {
      newInit = Math.round(params.initial_capital / exchangeRate);
      newDca = Math.round(params.dca_amount / exchangeRate);
    }

    const updatedParams = { ...params, initial_capital: newInit, dca_amount: newDca };
    setCurrency(newCurr);
    setParams(updatedParams);
    setSession({
      ...session,
      constraints: {
        ...session.constraints,
        currency: newCurr,
        backtest_params: updatedParams
      }
    });
  };

  const formatKoreanCurrency = (val) => {
    if (!val || isNaN(val)) return '';
    if (val >= 100000000) {
      const eok = Math.floor(val / 100000000);
      const man = Math.floor((val % 100000000) / 10000);
      return man > 0 ? `(${eok}억 ${man.toLocaleString()}만 원)` : `(${eok}억 원)`;
    }
    if (val >= 10000) {
      return `(${Math.floor(val / 10000).toLocaleString()}만 원)`;
    }
    return `(${Number(val).toLocaleString()}원)`;
  };

  const calculateMaxDrawdown = (values) => {
    if (!values || values.length === 0) return 0;
    let peak = values[0];
    let maxDd = 0;
    for (let val of values) {
      if (val > peak) peak = val;
      const dd = (val - peak) / peak;
      if (dd < maxDd) maxDd = dd;
    }
    return maxDd;
  };

  const renderComparisonTable = () => {
    if (!result || !result.portfolio_values || result.portfolio_values.length === 0) return null;

    const pFinal = result.portfolio_values[result.portfolio_values.length - 1];
    const bmFinal = result.benchmark_values ? result.benchmark_values[result.benchmark_values.length - 1] : 0;
    const spyFinal = result.spy_values ? result.spy_values[result.spy_values.length - 1] : 0;

    const pStart = result.portfolio_values[0];
    const bmStart = result.benchmark_values ? result.benchmark_values[0] : 1;
    const spyStart = result.spy_values ? result.spy_values[0] : 1;

    const pTotalReturn = ((pFinal - pStart) / pStart) * 100;
    const bmTotalReturn = ((bmFinal - bmStart) / bmStart) * 100;
    const spyTotalReturn = ((spyFinal - spyStart) / spyStart) * 100;

    const pMdd = calculateMaxDrawdown(result.portfolio_values) * 100;
    const bmMdd = calculateMaxDrawdown(result.benchmark_values) * 100;
    const spyMdd = calculateMaxDrawdown(result.spy_values) * 100;

    const currSymbol = currency === 'KRW' ? '₩' : '$';

    return (
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3>Performance Summary Comparison</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '0.6rem' }}>Strategy</th>
              <th style={{ padding: '0.6rem', textAlign: 'right' }}>Final Portfolio Value</th>
              <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total Return (%)</th>
              <th style={{ padding: '0.6rem', textAlign: 'right' }}>Max Drawdown (MDD)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#eff6ff' }}>
              <td style={{ padding: '0.6rem', fontWeight: 'bold', color: '#1d4ed8' }}>
                ● Optimized / Custom Portfolio
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 'bold' }}>
                {currSymbol}{Math.round(pFinal).toLocaleString()}
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 'bold', color: pTotalReturn >= 0 ? '#10b981' : '#ef4444' }}>
                {pTotalReturn.toFixed(2)}%
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', color: '#ef4444' }}>
                {pMdd.toFixed(2)}%
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.6rem', fontWeight: '600', color: '#059669' }}>
                ● Equal-Weight Benchmark (1/N)
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 'bold' }}>
                {currSymbol}{Math.round(bmFinal).toLocaleString()}
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 'bold', color: bmTotalReturn >= 0 ? '#10b981' : '#ef4444' }}>
                {bmTotalReturn.toFixed(2)}%
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', color: '#ef4444' }}>
                {bmMdd.toFixed(2)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.6rem', fontWeight: '600', color: '#d97706' }}>
                ● S&P 500 Benchmark (SPY)
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 'bold' }}>
                {currSymbol}{Math.round(spyFinal).toLocaleString()}
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 'bold', color: spyTotalReturn >= 0 ? '#10b981' : '#ef4444' }}>
                {spyTotalReturn.toFixed(2)}%
              </td>
              <td style={{ padding: '0.6rem', textAlign: 'right', color: '#ef4444' }}>
                {spyMdd.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderChart = () => {
    if (!result || !result.portfolio_values) return null;

    const currSymbol = currency === 'KRW' ? '₩' : '$';

    const traces = [
      {
        x: result.dates,
        y: result.portfolio_values,
        type: 'scatter',
        mode: 'lines',
        name: 'Portfolio (Optimized / Custom)',
        line: { color: '#2563eb', width: 2.5 }
      }
    ];

    if (result.benchmark_values && result.benchmark_values.length > 0) {
      traces.push({
        x: result.dates,
        y: result.benchmark_values,
        type: 'scatter',
        mode: 'lines',
        name: 'Equal-Weight Benchmark (1/N)',
        line: { color: '#10b981', width: 2, dash: 'dash' }
      });
    }

    if (result.spy_values && result.spy_values.length > 0) {
      traces.push({
        x: result.dates,
        y: result.spy_values,
        type: 'scatter',
        mode: 'lines',
        name: 'S&P 500 Index (SPY)',
        line: { color: '#f59e0b', width: 2, dash: 'dot' }
      });
    }

    return (
      <div className="card" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>
            Equity Curve: Portfolio vs Benchmarks ({currency})
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            적용 환율: <strong>1 USD = {Number(exchangeRate).toLocaleString()} KRW</strong>
          </span>
        </div>
        <Plot
          data={traces}
          layout={{
            autosize: true,
            margin: { l: 75, r: 20, t: 20, b: 40 },
            legend: { orientation: 'h', y: -0.2 },
            yaxis: { 
              title: `Portfolio Value (${currSymbol})`, 
              tickprefix: currSymbol,
              tickformat: ',.0f' 
            },
            xaxis: { title: 'Date' }
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "500px" }}
        />
        {renderComparisonTable()}
      </div>
    );
  };

  const renderWeightsCard = () => {
    const appliedWeights = session.constraints?.custom_weights || session.constraints?.opt_result?.weights || {};
    const dualRes = session.constraints?.opt_dual_result;
    const hedgedTickers = session.constraints?.hedged_tickers || [];
    const tickers = session.tickers;

    if (tickers.length === 0) return null;

    // Detect which mode matches current weights
    let weightSourceLabel = '✏️ 사용자 지정 / 현재 비중';
    if (session.constraints?.is_custom_mode) {
      weightSourceLabel = '✏️ 사용자 직접 편집 비중';
    } else if (dualRes) {
      const isUsdMatch = Object.keys(dualRes.usd_mode.weights).every(
        t => Math.abs((dualRes.usd_mode.weights[t] || 0) - (appliedWeights[t] || 0)) < 0.001
      );
      const isKrwMatch = Object.keys(dualRes.krw_mode.weights).every(
        t => Math.abs((dualRes.krw_mode.weights[t] || 0) - (appliedWeights[t] || 0)) < 0.001
      );
      if (isUsdMatch) weightSourceLabel = '🇺🇸 USD 모드 최적 비중';
      else if (isKrwMatch) weightSourceLabel = '🇰🇷 KRW 모드 최적 비중';
    }

    const applyWeightsPreset = (newWeights, isCustom = false) => {
      setSession(prev => ({
        ...prev,
        constraints: {
          ...prev.constraints,
          custom_weights: newWeights,
          is_custom_mode: isCustom
        }
      }));
    };

    const userCustomWeights = session.constraints?.user_edited_weights || (session.constraints?.is_custom_mode ? session.constraints?.custom_weights : null);

    return (
      <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, color: '#1e293b' }}>🎯 백테스트에 적용되는 포트폴리오 비중</h4>
            <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 'bold' }}>
              {weightSourceLabel}
            </span>
          </div>

          {/* Quick Preset Selector */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {dualRes?.usd_mode?.weights && (
              <button
                type="button"
                onClick={() => applyWeightsPreset(dualRes.usd_mode.weights, false)}
                style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
              >
                🇺🇸 USD 최적 비중
              </button>
            )}
            {dualRes?.krw_mode?.weights && (
              <button
                type="button"
                onClick={() => applyWeightsPreset(dualRes.krw_mode.weights, false)}
                style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#fff', border: '1px solid #a7f3d0', color: '#047857', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
              >
                🇰🇷 KRW 최적 비중
              </button>
            )}
            {userCustomWeights && (
              <button
                type="button"
                onClick={() => applyWeightsPreset(userCustomWeights, true)}
                style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
              >
                ✏️ 사용자 직접 편집 비중
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const eqW = {};
                tickers.forEach(t => { eqW[t] = 1.0 / tickers.length; });
                applyWeightsPreset(eqW, true);
              }}
              style={{ padding: '3px 8px', fontSize: '0.75rem', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer' }}
            >
              ⚖️ 1/N 동일 비중
            </button>
          </div>
        </div>


        {/* Ticker Badges Grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {tickers.map(t => {
            const w = appliedWeights[t] !== undefined ? appliedWeights[t] : (1.0 / tickers.length);
            const isHedged = hedgedTickers.includes(t);
            const percent = (w * 100).toFixed(1);

            return (
              <div 
                key={t}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.85rem'
                }}
              >
                <strong style={{ color: '#0f172a' }}>{t}</strong>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: isHedged ? '#ecfdf5' : '#f1f5f9',
                  color: isHedged ? '#047857' : '#64748b'
                }}>
                  {isHedged ? '🛡️(H)' : '🌐환노출'}
                </span>
                <span style={{ fontWeight: 'bold', color: '#2563eb' }}>
                  {percent}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderWeightsCard()}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Backtest Settings</h3>
          
          {/* Currency Toggle & Live Exchange Rate Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => handleCurrencyChange('KRW')}
                style={{
                  padding: '4px 12px',
                  background: currency === 'KRW' ? '#2563eb' : '#f8fafc',
                  color: currency === 'KRW' ? '#fff' : '#475569',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                KRW (원화 ₩)
              </button>
              <button
                type="button"
                onClick={() => handleCurrencyChange('USD')}
                style={{
                  padding: '4px 12px',
                  background: currency === 'USD' ? '#2563eb' : '#f8fafc',
                  color: currency === 'USD' ? '#fff' : '#475569',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                USD ($)
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', color: '#334155' }}>
              <span>적용 환율: <strong>1 USD = {Number(exchangeRate).toLocaleString()} KRW</strong></span>
              <button
                type="button"
                onClick={fetchExchangeRate}
                disabled={fetchingRate}
                title="실시간 환율 새로고침"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2563eb',
                  fontSize: '0.85rem',
                  padding: '0 2px'
                }}
              >
                {fetchingRate ? '...' : '🔄'}
              </button>
            </div>
          </div>
        </div>

        {/* Currency Logic Explanation Banner */}
        <div style={{ backgroundColor: currency === 'KRW' ? '#f0fdf4' : '#eff6ff', border: `1px solid ${currency === 'KRW' ? '#bbf7d0' : '#bfdbfe'}`, padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', marginBottom: '1rem' }}>
          {currency === 'KRW' ? (
            <span>
              🇰🇷 <strong>[원화 실전 백테스트]</strong>: 과거 {lookback} 기간 동안의 <strong>매일매일 실제 원/달러 환율(USDKRW=X)</strong>과 종목별 <strong>환헤지(H) / 환노출</strong> 설정이 시계열에 일별로 정확하게 반영됩니다.
            </span>
          ) : (
            <span>
              🇺🇸 <strong>[달러 순수 백테스트]</strong>: 환율 변동의 개입 없이 미국 본토 달러 자산의 순수 주가 수익률로만 자산 가치를 시뮬레이션합니다.
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Initial Capital ({currency === 'KRW' ? '원 ₩' : '$'})
              {currency === 'KRW' && (
                <span style={{ color: '#2563eb', marginLeft: '0.5rem', fontWeight: 'bold', fontSize: '0.9em' }}>
                  {formatKoreanCurrency(params.initial_capital)}
                </span>
              )}
            </label>
            <input 
              className="input" 
              type="number" 
              name="initial_capital" 
              value={params.initial_capital} 
              onChange={handleChange} 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Monthly DCA Amount ({currency === 'KRW' ? '원 ₩' : '$'})
              {currency === 'KRW' && (
                <span style={{ color: '#2563eb', marginLeft: '0.5rem', fontWeight: 'bold', fontSize: '0.9em' }}>
                  {formatKoreanCurrency(params.dca_amount)}
                </span>
              )}
            </label>
            <input 
              className="input" 
              type="number" 
              name="dca_amount" 
              value={params.dca_amount} 
              onChange={handleChange} 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Rebalance Frequency</label>
            <select className="input" name="rebalance_frequency" value={params.rebalance_frequency} onChange={handleChange}>
              <option value="none">Buy and Hold (No Rebalance)</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Annually</option>
            </select>
          </div>
        </div>

        <button 
          className="btn" 
          style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.1rem', padding: '1rem' }} 
          onClick={handleRunBacktest}
          disabled={loading || session.tickers.length === 0}
        >
          {loading ? 'Running Backtest Simulation...' : 'Run Backtest Simulation'}
        </button>
      </div>

      {renderChart()}
    </div>
  );
}



