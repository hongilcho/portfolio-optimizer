import React from 'react';
import Plot from 'react-plotly.js';

export default function Visualizer({ optimizationResult, backtestResult }) {
  if (!optimizationResult && !backtestResult) return null;

  return (
    <div className="card">
      <h2>Results Visualization</h2>
      
      {optimizationResult && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
          <div>
            <h3>Optimal Weights</h3>
            <Plot
              data={[{
                values: Object.values(optimizationResult.weights),
                labels: Object.keys(optimizationResult.weights),
                type: 'pie',
                hole: 0.4
              }]}
              layout={{ width: 400, height: 400, margin: { t: 0, b: 0, l: 0, r: 0 } }}
            />
          </div>
          
          <div>
            <h3>Correlation Matrix</h3>
            {/* Simple representation, a real heatmap would map the nested dict to a 2D array */}
            <Plot
              data={[{
                z: Object.values(optimizationResult.correlation_matrix).map(row => Object.values(row)),
                x: Object.keys(optimizationResult.correlation_matrix),
                y: Object.keys(optimizationResult.correlation_matrix),
                type: 'heatmap',
                colorscale: 'RdBu'
              }]}
              layout={{ width: 400, height: 400, margin: { t: 30 } }}
            />
          </div>
        </div>
      )}

      {backtestResult && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Backtest Equity Curve</h3>
          <Plot
            data={[{
              x: backtestResult.dates,
              y: backtestResult.portfolio_values,
              type: 'scatter',
              mode: 'lines',
              name: 'Portfolio Value'
            }]}
            layout={{ width: '100%', height: 400, margin: { t: 30 } }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
