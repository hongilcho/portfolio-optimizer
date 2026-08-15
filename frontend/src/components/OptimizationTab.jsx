import React, { useState, useEffect } from 'react';
import * as api from '../api';
import OptimizationSettings from './OptimizationSettings';
import Plot from 'react-plotly.js';

export default function OptimizationTab({ session, setSession }) {
  const [result, setResult] = useState(session.constraints?.opt_result || null);
  const [editableWeights, setEditableWeights] = useState(
    session.constraints?.custom_weights || session.constraints?.opt_result?.weights || {}
  );
  const [isCustomMode, setIsCustomMode] = useState(!!session.constraints?.is_custom_mode);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    if (session.constraints?.opt_result) {
      setResult(session.constraints.opt_result);
      setEditableWeights(session.constraints.custom_weights || session.constraints.opt_result.weights || {});
      setIsCustomMode(!!session.constraints.is_custom_mode);
    }
  }, [session.id]);

  const updateSessionWithOpt = (optRes, weightsObj, customMode) => {
    setSession({
      ...session,
      constraints: {
        ...session.constraints,
        opt_result: optRes,
        custom_weights: weightsObj,
        is_custom_mode: customMode
      }
    });
  };

  // Fallback defaults
  const lookback = session.constraints.lookback_period || '5y';
  const objective = session.constraints.objective || 'max_sharpe';

  const handleOptimize = async () => {
    if (session.tickers.length === 0) return alert("Please add tickers first in the Data & Analysis tab.");
    setLoading(true);
    try {
      const optResult = await api.optimizePortfolio(
        session.tickers, session.constraints, lookback, objective, session.constraints.proxies || {}
      );
      setResult(optResult);
      setEditableWeights(optResult.weights);
      setIsCustomMode(false);
      updateSessionWithOpt(optResult, optResult.weights, false);
    } catch (err) {
      console.error(err);
      alert("Optimization failed. Check console for details.");
    } finally {
      setLoading(false);
    }
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
        session.tickers, updatedWeights, lookback, session.constraints.proxies || {}
      );
      const newResult = {
        ...result,
        weights: updatedWeights,
        expected_annual_return: evalResult.expected_annual_return,
        annual_volatility: evalResult.annual_volatility,
        sharpe_ratio: evalResult.sharpe_ratio
      };
      setResult(newResult);
      updateSessionWithOpt(newResult, updatedWeights, true);
    } catch (err) {
      console.error("Custom portfolio evaluation failed", err);
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
        session.tickers, normalized, lookback, session.constraints.proxies || {}
      );
      const newResult = {
        ...result,
        weights: normalized,
        expected_annual_return: evalResult.expected_annual_return,
        annual_volatility: evalResult.annual_volatility,
        sharpe_ratio: evalResult.sharpe_ratio
      };
      setResult(newResult);
      updateSessionWithOpt(newResult, normalized, true);
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

  const renderResult = () => {
    if (!result) return null;

    const currentWeights = editableWeights || result.weights;
    const labels = Object.keys(currentWeights).filter(k => currentWeights[k] > 0.0001);
    const values = labels.map(k => currentWeights[k]);
    const totalSumPercent = (Object.values(currentWeights).reduce((a, b) => a + b, 0) * 100).toFixed(1);

    return (
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Portfolio Weights ({isCustomMode ? 'Custom' : 'Optimal'})</h3>
              {isCustomMode && (
                <span style={{ fontSize: '0.8rem', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Custom Edited
                </span>
              )}
            </div>
            <Plot
              data={[{
                labels,
                values,
                type: 'pie',
                hole: 0.4,
                textinfo: 'label+percent',
                marker: { colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'] }
              }]}
              layout={{ 
                autosize: true, 
                margin: { l: 20, r: 20, t: 20, b: 20 },
                showlegend: false
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "300px" }}
            />
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Portfolio Performance</h3>
              {evaluating && <small style={{ color: '#3b82f6' }}>Calculating...</small>}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '1.1rem' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 0', color: '#64748b' }}>Expected Annual Return</td>
                  <td style={{ padding: '0.75rem 0', fontWeight: 'bold', textAlign: 'right' }}>{(result.expected_annual_return * 100).toFixed(2)}%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.75rem 0', color: '#64748b' }}>Annual Volatility (Risk)</td>
                  <td style={{ padding: '0.75rem 0', fontWeight: 'bold', textAlign: 'right' }}>{(result.annual_volatility * 100).toFixed(2)}%</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.75rem 0', color: '#64748b' }}>Sharpe Ratio</td>
                  <td style={{ padding: '0.75rem 0', fontWeight: 'bold', textAlign: 'right' }}>{result.sharpe_ratio.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
            
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, color: '#475569' }}>Asset Weights Editor:</h4>
                <button 
                  className="btn"
                  style={{ padding: '2px 8px', fontSize: '0.8rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
                  onClick={handleNormalizeWeights}
                >
                  Normalize to 100%
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '0.4rem 0' }}>Ticker</th>
                    <th style={{ padding: '0.4rem 0', textAlign: 'right' }}>Weight (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {session.tickers.map(t => {
                    const w = currentWeights[t] !== undefined ? currentWeights[t] : 0;
                    const percentVal = Math.round(w * 10000) / 100;
                    return (
                      <tr key={t} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.4rem 0', fontWeight: '600' }}>{t}</td>
                        <td style={{ padding: '0.4rem 0', textAlign: 'right' }}>
                          <input 
                            className="input"
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            style={{ width: '90px', textAlign: 'right', padding: '3px 6px', fontWeight: 'bold' }}
                            value={percentVal}
                            onChange={e => handleWeightChange(t, e.target.value)}
                          /> %
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              <div style={{ marginTop: '0.5rem', textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
                Total: <strong style={{ color: Math.abs(totalSumPercent - 100.0) < 0.1 ? '#10b981' : '#ef4444' }}>
                  {totalSumPercent}%
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <OptimizationSettings 
          tickers={session.tickers}
          constraints={session.constraints}
          setConstraints={(newConstraints) => setSession({...session, constraints: newConstraints})}
        />

        <div className="card">
          <h3>Optimization Engine</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Lookback Period (Used for expected returns & covariance)</label>
            <input className="input" type="text" value={lookback} disabled style={{ backgroundColor: '#f1f5f9' }} />
            <small style={{ color: '#64748b' }}>* Change this in the Data & Analysis tab.</small>
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
            {loading ? 'Optimizing...' : 'Run Optimization'}
          </button>
        </div>
      </div>

      {renderResult()}
    </div>
  );
}

