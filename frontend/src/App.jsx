import { useState, useEffect } from 'react'
import * as api from './api'
import AnalysisTab from './components/AnalysisTab'
import OptimizationTab from './components/OptimizationTab'
import BacktestTab from './components/BacktestTab'
import AIChatDrawer from './components/AIChatDrawer'
import MethodologyTab from './components/MethodologyTab'


function App() {
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [currentSession, setCurrentSession] = useState(null)
  const [activeTab, setActiveTab] = useState('analysis') // analysis, optimization, backtest
  const [tickerNames, setTickerNames] = useState({});

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

  // Fetch ticker names when tickers change
  useEffect(() => {
    if (currentSession && currentSession.tickers && currentSession.tickers.length > 0) {
      api.getTickerNames(currentSession.tickers).then(names => {
        setTickerNames(names);
      }).catch(err => {
        console.error("Failed to fetch ticker names", err);
      });
    } else {
      setTickerNames({});
    }
  }, [currentSession?.tickers]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setLoadingSessions(false);
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

  const handleDeleteSession = async (sessionId, sessionName) => {
    if (!window.confirm(`Are you sure you want to delete session "${sessionName || 'Selected Session'}"?`)) return;
    try {
      await api.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession && currentSession.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (err) {
      console.error("Failed to delete session", err);
      alert("Failed to delete session.");
    }
  }

  const handleRenameSession = async (session) => {
    const newName = prompt("Enter new session name:", session.name);
    if (!newName || newName.trim() === '' || newName.trim() === session.name) return;
    const updatedSession = { ...session, name: newName.trim() };
    try {
      const updated = await api.updateSession(session.id, updatedSession);
      setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
      if (currentSession && currentSession.id === session.id) {
        setCurrentSession(updated);
      }
    } catch (err) {
      console.error("Failed to rename session", err);
      alert("Failed to rename session.");
    }
  }

  const handleExportSessions = async () => {
    try {
      const data = await api.exportSessions();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio_sessions_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export sessions.");
    }
  };

  const handleImportSessions = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const sessionsData = parsed.sessions || (Array.isArray(parsed) ? parsed : []);
        if (sessionsData.length === 0) {
          alert("No valid sessions found in the file.");
          return;
        }
        const res = await api.importSessions(sessionsData);
        alert(res.message || "Sessions imported successfully!");
        loadSessions();
      } catch (err) {
        console.error("Import failed:", err);
        alert("Failed to import sessions. Invalid JSON format.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDuplicateSession = async () => {
    if (!currentSession) return;
    const newName = prompt("Enter name for duplicated session:", `${currentSession.name} (Copy)`);
    if (!newName || newName.trim() === '') return;
    
    try {
      const newSession = await api.duplicateSession(currentSession.id, newName.trim());
      setSessions([...sessions, newSession]);
      setCurrentSession(newSession);
      alert("Session duplicated successfully!");
    } catch (err) {
      console.error("Failed to duplicate session", err);
      alert("Failed to duplicate session.");
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Portfolio Optimizer</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleNewSession}>New Session</button>
          
          {/* Export / Import buttons */}
          <button 
            className="btn" 
            onClick={handleExportSessions}
            style={{ background: '#475569', color: '#fff', fontSize: '0.88rem' }}
            title="모든 세션을 JSON 파일로 다운로드하여 백업"
          >
            📤 세션 백업 (Export)
          </button>
          
          <label 
            className="btn" 
            style={{ background: '#0d9488', color: '#fff', fontSize: '0.88rem', cursor: 'pointer', margin: 0 }}
            title="기존 백업 JSON 파일을 불러와 세션 복원"
          >
            📥 세션 복원 (Import)
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportSessions} 
              style={{ display: 'none' }} 
            />
          </label>

          {currentSession && <button className="btn" onClick={handleDuplicateSession} style={{background: '#8b5cf6', color: '#fff'}}>Duplicate Session</button>}
          {currentSession && <button className="btn" onClick={handleSaveSession}>Save Session</button>}
        </div>
      </div>
      
      {!currentSession ? (
        <div className="card">
          <h2>Your Sessions</h2>

          {loadingSessions ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{
                width: '36px',
                height: '36px',
                border: '3px solid #e2e8f0',
                borderTop: '3px solid var(--primary-color, #2563eb)',
                borderRadius: '50%',
                margin: '0 auto 1rem auto',
                animation: 'spin 0.8s linear infinite'
              }} />
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <p style={{ fontWeight: '600', fontSize: '1.05rem', color: '#334155', margin: '0 0 6px 0' }}>
                클라우드 데이터베이스로부터 세션 목록을 불러오는 중입니다...
              </p>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0 }}>
                잠시만 기다려 주세요. Supabase DB와 동기화 중입니다.
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1rem' }}>저장된 세션이 없습니다. 상단의 'New Session' 버튼을 눌러 새로운 포트폴리오를 만들어 보세요.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {sessions.map(session => (
                <li key={session.id} style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '1.05rem' }}>{session.name}</span>
                  <div>
                    <button 
                      className="btn" 
                      style={{ background: 'var(--primary-color)', color: '#fff', marginRight: '8px', padding: '6px 14px' }} 
                      onClick={() => { setCurrentSession(session); setActiveTab('analysis'); }}
                    >
                      Open
                    </button>
                    <button 
                      className="btn" 
                      style={{ background: '#3b82f6', color: '#fff', marginRight: '8px', padding: '6px 14px' }} 
                      onClick={() => handleRenameSession(session)}
                    >
                      Rename
                    </button>
                    <button 
                      className="btn" 
                      style={{ background: '#ef4444', color: '#fff', padding: '6px 14px' }} 
                      onClick={() => handleDeleteSession(session.id, session.name)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
            <h2>Session: {currentSession.name}</h2>
            <div>
              <button 
                className="btn" 
                style={{background: '#3b82f6', color: '#fff', marginRight: '8px'}} 
                onClick={() => handleRenameSession(currentSession)}
              >
                Rename Session
              </button>
              <button 
                className="btn" 
                style={{background: '#ef4444', color: '#fff', marginRight: '8px'}} 
                onClick={() => handleDeleteSession(currentSession.id, currentSession.name)}
              >
                Delete Session
              </button>
              <button className="btn" style={{background: '#64748b'}} onClick={() => setCurrentSession(null)}>Back to Sessions</button>
            </div>
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
            <button 
              className={`tab-btn ${activeTab === 'methodology' ? 'active' : ''}`}
              style={{padding: '1rem', background: 'none', border: 'none', borderBottom: activeTab === 'methodology' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'methodology' ? 'var(--primary-color)' : '#64748b', fontWeight: 'bold', cursor: 'pointer', marginBottom: '-2px'}}
              onClick={() => setActiveTab('methodology')}
            >
              Methodology
            </button>
          </div>

          <div>
            <div style={{ display: activeTab === 'analysis' ? 'block' : 'none' }}>
              <AnalysisTab 
                session={currentSession} 
                setSession={setCurrentSession} 
                onDeleteSession={handleDeleteSession}
                tickerNames={tickerNames}
              />
            </div>
            <div style={{ display: activeTab === 'optimization' ? 'block' : 'none' }}>
              <OptimizationTab 
                session={currentSession} 
                setSession={setCurrentSession} 
                tickerNames={tickerNames}
              />
            </div>
            <div style={{ display: activeTab === 'backtest' ? 'block' : 'none' }}>
              <BacktestTab 
                session={currentSession} 
                setSession={setCurrentSession} 
                tickerNames={tickerNames}
              />
            </div>
            <div style={{ display: activeTab === 'methodology' ? 'block' : 'none' }}>
              <MethodologyTab />
            </div>
          </div>

          <AIChatDrawer session={currentSession} />
        </div>
      )}
    </div>
  )
}

export default App


