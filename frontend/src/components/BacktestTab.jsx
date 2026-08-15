import React, { useState } from 'react';
import * as api from '../api';
import Plot from 'react-plotly.js';

export default function BacktestTab({ session, setSession }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({
    initial_capital: 10000,
    dca_amount: 0,
    rebalance_frequency: 'monthly',
    rebalance_threshold: 0.05
  });

  const lookback = session.constraints.lookback_period || '5y';
  // Note: Optimally we would store the optimal weights in the session, 
  // but since we aren't saving them yet, we need to run optimization again.
  // Let's just ask user to make sure they optimized. For simplicity, we re-run optimize here if we don't have weights,
  // but it's better to fetch optimal weights or require OptimizationTab to pass them.
  // Since we only have `session`, let's just run optimize -> backtest.
  
  const handleRunBacktest = async () => {
    if (session.tickers.length === 0) return alert("Please add tickers.");
    setLoading(true);
    try {
      // First get weights
      const optResult = await api.optimizePortfolio(session.tickers, session.constraints, lookback, session.constraints.objective || 'max_sharpe');
      
      const btResult = await api.runBacktest(session.tickers, optResult.weights, lookback, params);
      setResult({ ...btResult, weights: optResult.weights });
    } catch (err) {
      console.error(err);
      alert("Backtest failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setParams({
      ...params,
      [name]: isNaN(value) ? value : parseFloat(value)
    });
  };

  const renderChart = () => {
    if (!result) return null;

    return (
      <div className="card" style={{ marginTop: '2rem' }}>
        <h3>Equity Curve: Optimal Portfolio vs Equal-Weight Benchmark</h3>
        <Plot
          data={[
            {
              x: result.dates,
              y: result.portfolio_values,
              type: 'scatter',
              mode: 'lines',
              name: 'Optimized Portfolio',
              line: { color: '#3b82f6', width: 2 }
            },
            {
              x: result.dates,
              y: result.benchmark_values,
              type: 'scatter',
              mode: 'lines',
              name: 'Equal Weight Benchmark',
              line: { color: '#94a3b8', width: 2, dash: 'dot' }
            }
          ]}
          layout={{
            autosize: true,
            margin: { l: 60, r: 20, t: 20, b: 40 },
            legend: { orientation: 'h', y: -0.2 },
            yaxis: { title: 'Portfolio Value ($)', tickformat: ',.0f' }
          }}
          useResizeHandler={true}
          style={{ width: "100%", height: "500px" }}
        />
      </div>
    );
  };

  return (
    <div>
      <div className="card">
        <h3>Backtest Settings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Initial Capital ($)</label>
            <input className="input" type="number" name="initial_capital" value={params.initial_capital} onChange={handleChange} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Monthly DCA Amount ($)</label>
            <input className="input" type="number" name="dca_amount" value={params.dca_amount} onChange={handleChange} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Rebalance Frequency</label>
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
          {loading ? 'Running Backtest...' : 'Run Backtest Simulation'}
        </button>
      </div>

      {renderChart()}
    </div>
  );
}
