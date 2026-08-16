import React, { useState, useEffect, useRef } from 'react';
import * as api from '../api';

export default function AutocompleteInput({ placeholder, onSelect, value, onChange, onKeyDown, style }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (query) => {
    if (!query || query.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const results = await api.searchTickers(query);
      setSuggestions(results || []);
    } catch (err) {
      console.error("Failed to search tickers", err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    
    if (val.trim().length > 0) {
      setShowDropdown(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(val);
      }, 300);
    } else {
      setShowDropdown(false);
      setSuggestions([]);
    }
  };

  const handleSelect = (ticker) => {
    onSelect(ticker.symbol);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
      <input
        type="text"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={() => { if (value.trim().length > 0) setShowDropdown(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setShowDropdown(false);
          }
          if (onKeyDown) onKeyDown(e);
        }}
        style={{ width: '100%', boxSizing: 'border-box', ...style }}
      />
      
      {showDropdown && (suggestions.length > 0 || loading) && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          maxHeight: '250px',
          overflowY: 'auto',
          zIndex: 1000,
          listStyle: 'none',
          padding: 0,
          margin: '4px 0 0 0'
        }}>
          {loading ? (
            <li style={{ padding: '8px 12px', color: '#64748b', fontSize: '0.9rem' }}>Searching...</li>
          ) : (
            suggestions.map(item => (
              <li 
                key={item.symbol}
                onClick={() => handleSelect(item)}
                style={{ 
                  padding: '8px 12px', 
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div>
                  <strong style={{ color: '#1e293b' }}>{item.symbol}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.name}</div>
                </div>
                <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>
                  {item.market}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
