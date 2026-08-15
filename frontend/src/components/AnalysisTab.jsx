import React, { useState, useEffect } from 'react';
import * as api from '../api';
import TickerManager from './TickerManager';
import Plot from 'react-plotly.js';

export default function AnalysisTab({ session, setSession }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookback, setLookback] = useState(session.constraints.lookback_period || '5y');

  useEffect(() => {
    if (session.tickers.length > 0) {
      fetchAnalysis();
    } else {
      setData(null);
    }
  }, [session.tickers, lookback]);

  const proxies = session.constraints.proxies || {};

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await api.analyzeTickers(session.tickers, lookback, proxies);
      setData(res);
      setSession({
        ...session,
        constraints: { ...session.constraints, lookback_period: lookback }
      });
    } catch (err) {
      console.error(err);
      alert("Failed to analyze data.");
    } finally {
      setLoading(false);
    }
  };

  const renderStatsTable = () => {
    if (!data || !data.stats) return null;
    const tickers = Object.keys(data.stats);
    return (
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Asset Statistics ({lookback})</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Ticker</th>
              <th style={{ padding: '0.5rem' }}>CAGR</th>
              <th style={{ padding: '0.5rem' }}>Ann. Volatility</th>
              <th style={{ padding: '0.5rem' }}>Max Drawdown</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map(t => (
              <tr key={t} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{t}</span>
                  {data.stats[t].name && <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.9em' }}>({data.stats[t].name})</span>}
                  {proxies[t] && <span style={{ color: '#8b5cf6', marginLeft: '0.5rem', fontSize: '0.8em', backgroundColor: '#ede9fe', padding: '2px 6px', borderRadius: '4px' }}>Proxy: {proxies[t]}</span>}
                </td>
                <td style={{ padding: '0.5rem' }}>{(data.stats[t].cagr * 100).toFixed(2)}%</td>
                <td style={{ padding: '0.5rem' }}>{(data.stats[t].annual_volatility * 100).toFixed(2)}%</td>
                <td style={{ padding: '0.5rem', color: '#ef4444' }}>{(data.stats[t].mdd * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderYearlyStatsTable = () => {
    if (!data || !data.stats) return null;
    const tickers = Object.keys(data.stats);
    if (tickers.length === 0) return null;

    // Collect all unique years
    const yearsSet = new Set();
    tickers.forEach(t => {
      if (data.stats[t].yearly) {
        Object.keys(data.stats[t].yearly).forEach(y => yearsSet.add(y));
      }
    });
    const years = Array.from(yearsSet).sort().reverse(); // Newest first

    if (years.length === 0) return null;

    return (
      <div className="card" style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <h3>Yearly Performance</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ padding: '0.5rem', borderBottom: '2px solid #e2e8f0', textAlign: 'left', minWidth: '80px' }}>Year</th>
              {tickers.map(t => (
                <th colSpan="2" key={t} style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>{t}</th>
              ))}
            </tr>
            <tr>
              {tickers.map(t => (
                <React.Fragment key={`${t}-cols`}>
                  <th style={{ padding: '0.5rem', borderBottom: '2px solid #e2e8f0', textAlign: 'right', borderLeft: '1px solid #e2e8f0' }}>Return</th>
                  <th style={{ padding: '0.5rem', borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>Vol</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map(y => (
              <tr key={y} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{y}</td>
                {tickers.map(t => {
                  const yData = data.stats[t].yearly?.[y];
                  const isProxy = yData?.is_proxy;
                  const bgStyle = isProxy ? { backgroundColor: '#f5f3ff' } : {}; // very subtle purple

                  return (
                    <React.Fragment key={`${t}-${y}`}>
                      <td style={{ ...bgStyle, padding: '0.5rem', textAlign: 'right', borderLeft: '1px solid #e2e8f0', color: yData?.return_rate >= 0 ? '#10b981' : '#ef4444' }}>
                        {yData ? `${(yData.return_rate * 100).toFixed(1)}%` : '-'}
                        {isProxy && <span style={{ color: '#8b5cf6', fontSize: '0.7em', verticalAlign: 'super', marginLeft: '2px' }} title="Backfilled via Proxy">*</span>}
                      </td>
                      <td style={{ ...bgStyle, padding: '0.5rem', textAlign: 'right' }}>
                        {yData ? `${(yData.volatility * 100).toFixed(1)}%` : '-'}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCharts = () => {
    if (!data) return null;

    const lineData = Object.keys(data.normalized_prices).map(ticker => ({
      x: data.dates,
      y: data.normalized_prices[ticker],
      type: 'scatter',
      mode: 'lines',
      name: ticker
    }));

    const corrTickers = Object.keys(data.correlation_matrix);
    const corrZ = corrTickers.map(t1 => corrTickers.map(t2 => data.correlation_matrix[t1][t2]));

    const covTickers = Object.keys(data.covariance_matrix);
    const covZ = covTickers.map(t1 => covTickers.map(t2 => data.covariance_matrix[t1][t2]));

    return (
      <div style={{ marginTop: '2rem' }}>
        <div className="card">
          <h3>Historical Cumulative Returns (Base=100)</h3>
          <Plot
            data={lineData}
            layout={{ 
              autosize: true, 
              margin: { l: 40, r: 20, t: 20, b: 40 },
              legend: { orientation: "h", y: -0.2 }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "400px" }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div className="card">
            <h3>Correlation Matrix</h3>
            <Plot
              data={[{
                z: corrZ,
                x: corrTickers,
                y: corrTickers,
                type: 'heatmap',
                colorscale: 'RdBu',
                zmin: -1, zmax: 1
              }]}
              layout={{ autosize: true, margin: { l: 40, r: 20, t: 20, b: 40 } }}
              useResizeHandler={true}
              style={{ width: "100%", height: "300px" }}
            />
          </div>
          <div className="card">
            <h3>Covariance Matrix (Annualized)</h3>
            <Plot
              data={[{
                z: covZ,
                x: covTickers,
                y: covTickers,
                type: 'heatmap',
                colorscale: 'Viridis'
              }]}
              layout={{ autosize: true, margin: { l: 40, r: 20, t: 20, b: 40 } }}
              useResizeHandler={true}
              style={{ width: "100%", height: "300px" }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <TickerManager 
            tickers={session.tickers} 
            setTickers={(newTickers) => setSession({...session, tickers: newTickers})}
            proxies={proxies}
            setProxies={(newProxies) => setSession({...session, constraints: {...session.constraints, proxies: newProxies}})} 
          />
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3>Data Settings</h3>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Lookback Period</label>
          <select 
            className="input" 
            value={lookback} 
            onChange={(e) => setLookback(e.target.value)}
          >
            <option value="1y">1 Year</option>
            <option value="3y">3 Years</option>
            <option value="5y">5 Years</option>
            <option value="10y">10 Years</option>
            <option value="20y">20 Years</option>
            <option value="30y">30 Years</option>
            <option value="40y">40 Years</option>
            <option value="50y">50 Years</option>
            <option value="ytd">Year to Date (YTD)</option>
            <option value="max">Max</option>
          </select>
        </div>
      </div>

      {loading && <p style={{ marginTop: '1rem', textAlign: 'center' }}>Loading analysis data...</p>}
      
      {renderStatsTable()}
      {renderYearlyStatsTable()}
      {renderCharts()}
      
      {!loading && !data && session.tickers.length > 0 && (
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>No data. Try reloading.</p>
      )}
    </div>
  );
}
