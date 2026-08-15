import React, { useState, useEffect } from 'react';
import * as api from '../api';
import TickerManager from './TickerManager';
import Plot from 'react-plotly.js';

export default function AnalysisTab({ session, setSession, onDeleteSession }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lookback, setLookback] = useState(session.constraints.lookback_period || '5y');

  // Axis range control states for the last 3 charts
  const [retXMin, setRetXMin] = useState('');
  const [retXMax, setRetXMax] = useState('');
  const [retYMin, setRetYMin] = useState('');
  const [retYMax, setRetYMax] = useState('');
  const [showRetLabels, setShowRetLabels] = useState(false);

  const [volXMin, setVolXMin] = useState('');
  const [volXMax, setVolXMax] = useState('');
  const [volYMin, setVolYMin] = useState('');
  const [volYMax, setVolYMax] = useState('');
  const [showVolLabels, setShowVolLabels] = useState(false);

  const [cumXMin, setCumXMin] = useState('');
  const [cumXMax, setCumXMax] = useState('');
  const [cumYMin, setCumYMin] = useState('');
  const [cumYMax, setCumYMax] = useState('');

  // Selected tickers for each of the 3 charts
  const [retTickers, setRetTickers] = useState([]);
  const [volTickers, setVolTickers] = useState([]);
  const [cumTickers, setCumTickers] = useState([]);

  useEffect(() => {
    if (session.tickers.length > 0) {
      fetchAnalysis();
    } else {
      setData(null);
    }
  }, [session.tickers, lookback]);

  useEffect(() => {
    if (data && data.stats) {
      const allT = Object.keys(data.stats);
      setRetTickers(allT);
      setVolTickers(allT);
      setCumTickers(allT);
    }
  }, [data]);

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

  const getYAxisLayout = (yMinStr, yMaxStr, defaultValues, title, ticksuffix = '') => {
    const validVals = defaultValues.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (yMinStr === '' && yMaxStr === '') {
      return { title, ticksuffix, autorange: true };
    }

    let minVal = validVals.length > 0 ? Math.min(...validVals) : 0;
    let maxVal = validVals.length > 0 ? Math.max(...validVals) : 100;
    if (!isFinite(minVal)) minVal = 0;
    if (!isFinite(maxVal)) maxVal = 100;

    const margin = Math.abs((maxVal - minVal) * 0.05) || 5;
    const userMin = yMinStr !== '' ? parseFloat(yMinStr) : minVal - margin;
    const userMax = yMaxStr !== '' ? parseFloat(yMaxStr) : maxVal + margin;

    return {
      title,
      ticksuffix,
      autorange: false,
      range: [userMin, userMax]
    };
  };

  const renderRangeControls = (
    xMin, setXMin, xMax, setXMax, yMin, setYMin, yMax, setYMax, sortedYears, yUnit = '%',
    showLabels = null, setShowLabels = null, resetTickers = null
  ) => (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
      {setShowLabels && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', marginRight: '0.4rem', fontWeight: '600', color: '#334155' }}>
          <input 
            type="checkbox" 
            checked={showLabels} 
            onChange={e => setShowLabels(e.target.checked)} 
          />
          Show Values
        </label>
      )}

      <span style={{ fontWeight: '600', color: '#475569' }}>X (Year):</span>
      <select 
        value={xMin} 
        onChange={e => setXMin(e.target.value)} 
        style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
      >
        <option value="">Start</option>
        {sortedYears.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <span>~</span>
      <select 
        value={xMax} 
        onChange={e => setXMax(e.target.value)} 
        style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
      >
        <option value="">End</option>
        {sortedYears.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <span style={{ fontWeight: '600', color: '#475569', marginLeft: '0.6rem' }}>Y ({yUnit}):</span>
      <input 
        type="number" 
        placeholder="Min Y" 
        value={yMin} 
        onChange={e => setYMin(e.target.value)} 
        style={{ width: '65px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
      />
      <span>~</span>
      <input 
        type="number" 
        placeholder="Max Y" 
        value={yMax} 
        onChange={e => setYMax(e.target.value)} 
        style={{ width: '65px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
      />

      {(xMin || xMax || yMin !== '' || yMax !== '' || (setShowLabels && showLabels)) && (
        <button 
          onClick={() => { 
            setXMin(''); 
            setXMax(''); 
            setYMin(''); 
            setYMax(''); 
            if (setShowLabels) setShowLabels(false);
            if (resetTickers) resetTickers();
          }}
          style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', cursor: 'pointer', marginLeft: '0.4rem', fontSize: '0.8rem' }}
        >
          Reset
        </button>
      )}
    </div>
  );

  const renderTickerFilter = (allTickers, selectedTickers, setSelectedTickers) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
      <span style={{ fontWeight: '600', color: '#475569', marginRight: '0.2rem' }}>Assets:</span>
      {allTickers.map(t => {
        const isSelected = selectedTickers.includes(t);
        return (
          <label 
            key={t} 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: isSelected ? '#eff6ff' : '#f1f5f9',
              border: isSelected ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              color: isSelected ? '#1d4ed8' : '#64748b',
              cursor: 'pointer',
              fontWeight: isSelected ? '600' : 'normal',
              userSelect: 'none'
            }}
          >
            <input 
              type="checkbox"
              checked={isSelected}
              onChange={() => {
                if (isSelected) {
                  if (selectedTickers.length > 1) {
                    setSelectedTickers(selectedTickers.filter(x => x !== t));
                  }
                } else {
                  setSelectedTickers([...selectedTickers, t]);
                }
              }}
              style={{ accentColor: '#2563eb' }}
            />
            {t}
          </label>
        );
      })}
    </div>
  );

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
    if (!data || !data.stats) return null;

    const corrTickers = Object.keys(data.correlation_matrix);
    const corrZ = corrTickers.map(t1 => corrTickers.map(t2 => data.correlation_matrix[t1][t2]));
    const corrText = corrZ.map(row => row.map(val => (val !== undefined && val !== null) ? val.toFixed(2) : ''));

    const covTickers = Object.keys(data.covariance_matrix);
    const covZ = covTickers.map(t1 => covTickers.map(t2 => data.covariance_matrix[t1][t2]));

    // Extract Yearly Data for Annual Returns & Volatility Graphs
    const tickers = Object.keys(data.stats);
    const yearsSet = new Set();
    tickers.forEach(t => {
      if (data.stats[t]?.yearly) {
        Object.keys(data.stats[t].yearly).forEach(y => yearsSet.add(y));
      }
    });
    const sortedYears = Array.from(yearsSet).sort();

    // Active tickers for each chart
    const activeRetTickers = retTickers.length > 0 ? tickers.filter(t => retTickers.includes(t)) : tickers;
    const activeVolTickers = volTickers.length > 0 ? tickers.filter(t => volTickers.includes(t)) : tickers;
    const activeCumTickers = cumTickers.length > 0 ? tickers.filter(t => cumTickers.includes(t)) : tickers;

    // 1. Annual Returns (%) Traces & Range Filtering + Values Labeling + Ticker Filtering
    const filteredYearsRet = sortedYears.filter(y => (!retXMin || y >= retXMin) && (!retXMax || y <= retXMax));
    const annualReturnTraces = activeRetTickers.map(ticker => {
      const yVals = filteredYearsRet.map(y => {
        const val = data.stats[ticker]?.yearly?.[y]?.return_rate;
        return val !== undefined && val !== null ? +(val * 100).toFixed(2) : null;
      });

      return {
        x: filteredYearsRet,
        y: yVals,
        name: ticker,
        type: 'bar',
        ...(showRetLabels ? {
          text: yVals.map(v => v !== null && v !== undefined ? `${v}%` : ''),
          textposition: 'auto',
          textfont: { size: 10 }
        } : {})
      };
    });
    const allReturnValues = annualReturnTraces.flatMap(t => t.y);

    // 2. Annual Volatility (%) Traces & Range Filtering + Values Labeling + Ticker Filtering
    const filteredYearsVol = sortedYears.filter(y => (!volXMin || y >= volXMin) && (!volXMax || y <= volXMax));
    const annualVolTraces = activeVolTickers.map(ticker => {
      const yVals = filteredYearsVol.map(y => {
        const val = data.stats[ticker]?.yearly?.[y]?.volatility;
        return val !== undefined && val !== null ? +(val * 100).toFixed(2) : null;
      });

      return {
        x: filteredYearsVol,
        y: yVals,
        name: ticker,
        type: 'bar',
        ...(showVolLabels ? {
          text: yVals.map(v => v !== null && v !== undefined ? `${v}%` : ''),
          textposition: 'auto',
          textfont: { size: 10 }
        } : {})
      };
    });
    const allVolValues = annualVolTraces.flatMap(t => t.y);

    // 3. Historical Cumulative Returns Line Traces & Re-basing on selected Start Year + Ticker Filtering
    const startCutoff = cumXMin ? `${cumXMin}-01-01` : '';
    const endCutoff = cumXMax ? `${cumXMax}-12-31` : '';
    const dateIndices = [];
    data.dates.forEach((d, idx) => {
      if ((!startCutoff || d >= startCutoff) && (!endCutoff || d <= endCutoff)) {
        dateIndices.push(idx);
      }
    });

    const filteredDates = dateIndices.map(i => data.dates[i]);
    const firstIdx = dateIndices.length > 0 ? dateIndices[0] : 0;

    const lineData = activeCumTickers.map(ticker => {
      const baseVal = data.normalized_prices[ticker]?.[firstIdx];
      const rebasedY = dateIndices.map(i => {
        const currentVal = data.normalized_prices[ticker][i];
        if (baseVal && baseVal !== 0) {
          return +((currentVal / baseVal) * 100).toFixed(2);
        }
        return currentVal;
      });

      return {
        x: filteredDates,
        y: rebasedY,
        type: 'scatter',
        mode: 'lines',
        name: ticker
      };
    });
    const allCumValues = lineData.flatMap(t => t.y);

    return (
      <div style={{ marginTop: '2rem' }}>
        {/* 1. Heatmaps: Correlation Matrix & Covariance Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <h3>Correlation Matrix</h3>
            <Plot
              data={[{
                z: corrZ,
                x: corrTickers,
                y: corrTickers,
                text: corrText,
                texttemplate: "%{text}",
                textfont: { size: 12 },
                type: 'heatmap',
                colorscale: 'RdBu',
                zmin: -1, zmax: 1
              }]}
              layout={{ 
                autosize: true, 
                margin: { l: 60, r: 20, t: 20, b: 60 } 
              }}
              useResizeHandler={true}
              style={{ width: "100%", height: "350px" }}
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
              layout={{ autosize: true, margin: { l: 60, r: 20, t: 20, b: 60 } }}
              useResizeHandler={true}
              style={{ width: "100%", height: "350px" }}
            />
          </div>
        </div>

        {/* 2. Annual Returns Chart */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Annual Returns (%)</h3>
            {renderRangeControls(
              retXMin, setRetXMin, retXMax, setRetXMax, retYMin, setRetYMin, retYMax, setRetYMax, sortedYears, '%',
              showRetLabels, setShowRetLabels, () => setRetTickers(tickers)
            )}
          </div>
          {renderTickerFilter(tickers, activeRetTickers, setRetTickers)}
          <Plot
            data={annualReturnTraces}
            layout={{
              autosize: true,
              barmode: 'group',
              margin: { l: 50, r: 20, t: 20, b: 50 },
              xaxis: { title: 'Year', type: 'category' },
              yaxis: getYAxisLayout(retYMin, retYMax, allReturnValues, 'Return (%)', '%'),
              legend: { orientation: 'h', y: -0.25 }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "400px" }}
          />
        </div>

        {/* 3. Annual Volatility Chart */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Annual Volatility (%)</h3>
            {renderRangeControls(
              volXMin, setVolXMin, volXMax, setVolXMax, volYMin, setVolYMin, volYMax, setVolYMax, sortedYears, '%',
              showVolLabels, setShowVolLabels, () => setVolTickers(tickers)
            )}
          </div>
          {renderTickerFilter(tickers, activeVolTickers, setVolTickers)}
          <Plot
            data={annualVolTraces}
            layout={{
              autosize: true,
              barmode: 'group',
              margin: { l: 50, r: 20, t: 20, b: 50 },
              xaxis: { title: 'Year', type: 'category' },
              yaxis: getYAxisLayout(volYMin, volYMax, allVolValues, 'Volatility (%)', '%'),
              legend: { orientation: 'h', y: -0.25 }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "400px" }}
          />
        </div>

        {/* 4. Historical Cumulative Returns Chart */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Historical Cumulative Returns (Base=100{cumXMin ? ` from ${cumXMin}` : ''})</h3>
            {renderRangeControls(
              cumXMin, setCumXMin, cumXMax, setCumXMax, cumYMin, setCumYMin, cumYMax, setCumYMax, sortedYears, 'Price',
              null, null, () => setCumTickers(tickers)
            )}
          </div>
          {renderTickerFilter(tickers, activeCumTickers, setCumTickers)}
          <Plot
            data={lineData}
            layout={{ 
              autosize: true, 
              margin: { l: 50, r: 20, t: 20, b: 50 },
              xaxis: { title: 'Date' },
              yaxis: getYAxisLayout(cumYMin, cumYMax, allCumValues, 'Re-based Price (Base=100)'),
              legend: { orientation: "h", y: -0.25 }
            }}
            useResizeHandler={true}
            style={{ width: "100%", height: "400px" }}
          />
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

