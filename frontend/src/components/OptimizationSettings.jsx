import React from 'react';

export default function OptimizationSettings({ constraints, setConstraints }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    let parsed = parseFloat(value);
    if (isNaN(parsed)) parsed = 0;
    
    // Convert percentage input back to decimal for the backend
    setConstraints({
      ...constraints,
      [name]: parsed / 100
    });
  };

  // Convert decimal to percentage for display, removing any floating point imprecision
  const toPercent = (val) => val != null ? Math.round(val * 10000) / 100 : 0;

  return (
    <div className="card">
      <h3>Optimization Constraints</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Minimum Weight per Asset (%)</label>
        <input 
          className="input"
          type="number" 
          name="min_weight" 
          step="1"
          min="0"
          max="100"
          value={toPercent(constraints.min_weight)} 
          onChange={handleChange} 
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Maximum Weight per Asset (%)</label>
        <input 
          className="input"
          type="number" 
          name="max_weight" 
          step="1"
          min="0"
          max="100"
          value={toPercent(constraints.max_weight ?? 1.0)} 
          onChange={handleChange} 
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Target Volatility (%, Optional, leave 0 to max Sharpe)</label>
        <input 
          className="input"
          type="number" 
          name="target_volatility" 
          step="1"
          min="0"
          value={toPercent(constraints.target_volatility)} 
          onChange={handleChange} 
        />
      </div>
    </div>
  );
}
