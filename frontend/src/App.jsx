import { useState, useEffect } from 'react'
import * as api from './api'
import AnalysisTab from './components/AnalysisTab'
import OptimizationTab from './components/OptimizationTab'
import BacktestTab from './components/BacktestTab'

function App() {
  const [sessions, setSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [activeTab, setActiveTab] = useState('analysis') // analysis, optimization, backtest

  useEffect(() => {
    loadSessions();
  }, [])

  // Auto-save session
  useEffect(() => {
    if (currentSession && currentSession.id) {
      const timer = setTimeout(() => {
        api.updateSession(currentSession.id, currentSession).then(updated => {
          setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
        }).catch(err => console.error("Auto-save failed", err));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentSession]);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  }

  const handleNewSession = async () => {
    const name = prompt("Enter session name:");
    if (!name) return;
    try {
      const newSession = await api.createSession(name);
      setSessions([...sessions, newSession]);
      setCurrentSession(newSession);
      setActiveTab('analysis');
    } catch (err) {
      console.error("Failed to create session", err);
    }
  }

  const handleSaveSession = async () => {
    if (!currentSession) return;
    try {
      const updated = await api.updateSession(currentSession.id, currentSession);
      setSessions(sessions.map(s => s.id === updated.id ? updated : s));
      alert("Session saved!");
    } catch (err) {
      console.error("Failed to save session", err);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Portfolio Optimizer</h1>
        <div>
          <button className="btn" onClick={handleNewSession} style={{marginRight: '8px'}}>New Session</button>
          {currentSession && <button className="btn" onClick={handleSaveSession}>Save Session</button>}
        </div>
      </div>
      
      {!currentSession ? (
        <div className="card">
          <h2>Your Sessions</h2>
          {sessions.length === 0 ? (
            <p>No sessions found. Create a new one to get started.</p>
          ) : (
            <ul>
              {sessions.map(session => (
                <li key={session.id} style={{marginBottom: '8px'}}>
                  <button className="btn" style={{background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)'}} onClick={() => { setCurrentSession(session); setActiveTab('analysis'); }}>
                    {session.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h2>Session: {currentSession.name}</h2>
            <button className="btn" style={{background: '#64748b'}} onClick={() => setCurrentSession(null)}>Back to Sessions</button>
          </div>
          
          <div className="tabs" style={{display: 'flex', gap: '1rem', borderBottom: '2px solid #e2e8f0', marginBottom: '2rem'}}>
            <button 
              className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
              style={{padding: '1rem', background: 'none', border: 'none', borderBottom: activeTab === 'analysis' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'analysis' ? 'var(--primary-color)' : '#64748b', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-2px'}}
              onClick={() => setActiveTab('analysis')}
            >
              Data & Analysis
            </button>
            <button 
              className={`tab-btn ${activeTab === 'optimization' ? 'active' : ''}`}
              style={{padding: '1rem', background: 'none', border: 'none', borderBottom: activeTab === 'optimization' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'optimization' ? 'var(--primary-color)' : '#64748b', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-2px'}}
              onClick={() => setActiveTab('optimization')}
            >
              Optimization
            </button>
            <button 
              className={`tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
              style={{padding: '1rem', background: 'none', border: 'none', borderBottom: activeTab === 'backtest' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'backtest' ? 'var(--primary-color)' : '#64748b', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-2px'}}
              onClick={() => setActiveTab('backtest')}
            >
              Backtest
            </button>
          </div>

          <div>
            {activeTab === 'analysis' && (
              <AnalysisTab 
                session={currentSession} 
                setSession={setCurrentSession} 
              />
            )}
            {activeTab === 'optimization' && (
              <OptimizationTab 
                session={currentSession} 
                setSession={setCurrentSession} 
              />
            )}
            {activeTab === 'backtest' && (
              <BacktestTab 
                session={currentSession} 
                setSession={setCurrentSession} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
