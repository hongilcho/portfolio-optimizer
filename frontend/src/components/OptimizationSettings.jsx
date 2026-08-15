import React from 'react';

export default function OptimizationSettings({ tickers = [], constraints = {}, setConstraints }) {
  const tickerBounds = constraints.ticker_bounds || {};

  const handleTickerBoundChange = (ticker, field, value) => {
    let parsed = parseFloat(value);
    if (isNaN(parsed)) parsed = 0;
    const decimalVal = Math.max(0, Math.min(1.0, parsed / 100));

    const currentBounds = tickerBounds[ticker] || { min: constraints.min_weight || 0.0, max: constraints.max_weight ?? 1.0 };
    const updatedBounds = {
      ...currentBounds,
      [field]: decimalVal
    };

    setConstraints({
      ...constraints,
      ticker_bounds: {
        ...tickerBounds,
        [ticker]: updatedBounds
      }
    });
  };

  const toPercent = (val) => val != null ? Math.round(val * 10000) / 100 : 0;

  return (
    <div className="card">
      <h3>Optimization Constraints</h3>
      
      {tickers.length === 0 ? (
        <p style={{ color: '#64748b' }}>No tickers selected. Add tickers in the Data & Analysis tab.</p>
      ) : (
        <div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600', color: '#475569' }}>
            Per-Asset Weight Bounds (%):
          </label>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Ticker</th>
                  <th style={{ padding: '0.5rem' }}>Min Weight (%)</th>
                  <th style={{ padding: '0.5rem' }}>Max Weight (%)</th>
                </tr>
              </thead>
              <tbody>
                {tickers.map(ticker => {
                  const b = tickerBounds[ticker] || {};
                  const minVal = b.min !== undefined ? b.min : (constraints.min_weight || 0.0);
                  const maxVal = b.max !== undefined ? b.max : (constraints.max_weight ?? 1.0);

                  return (
                    <tr key={ticker} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#1e293b' }}>{ticker}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <input 
                          className="input"
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          style={{ width: '85px', padding: '4px 8px' }}
                          value={toPercent(minVal)}
                          onChange={e => handleTickerBoundChange(ticker, 'min', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input 
                          className="input"
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          style={{ width: '85px', padding: '4px 8px' }}
                          value={toPercent(maxVal)}
                          onChange={e => handleTickerBoundChange(ticker, 'max', e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Target Volatility (%, Optional, leave 0 for Max Sharpe)</label>
        <input 
          className="input"
          type="number" 
          name="target_volatility" 
          step="1"
          min="0"
          value={toPercent(constraints.target_volatility)} 
          onChange={e => {
            let parsed = parseFloat(e.target.value);
            if (isNaN(parsed)) parsed = 0;
            setConstraints({ ...constraints, target_volatility: parsed / 100 });
          }} 
        />
      </div>
    </div>
  );
}

