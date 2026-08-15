import React, { useState } from 'react';
import * as api from '../api';
import OptimizationSettings from './OptimizationSettings';
import Plot from 'react-plotly.js';

export default function OptimizationTab({ session, setSession }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fallback defaults
  const lookback = session.constraints.lookback_period || '5y';
  const objective = session.constraints.objective || 'max_sharpe';

  const handleOptimize = async () => {
    if (session.tickers.length === 0) return alert("Please add tickers first in the Data & Analysis tab.");
    setLoading(true);
    try {
      const optResult = await api.optimizePortfolio(session.tickers, session.constraints, lookback, objective);
      setResult(optResult);
    } catch (err) {
      console.error(err);
      alert("Optimization failed. Check console for details.");
    } finally {
      setLoading(false);
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

    const labels = Object.keys(result.weights).filter(k => result.weights[k] > 0.001);
    const values = labels.map(k => result.weights[k]);

    return (
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="card">
            <h3>Optimal Weights</h3>
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
            <h3>Portfolio Expected Performance</h3>
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
            
            <div style={{ marginTop: '2rem' }}>
              <h4 style={{ marginBottom: '0.5rem', color: '#64748b' }}>Weight Details:</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {labels.map(l => (
                  <li key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                    <span>{l}</span>
                    <span style={{ fontWeight: 'bold' }}>{(result.weights[l] * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
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
