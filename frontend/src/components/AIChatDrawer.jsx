import React, { useState, useEffect, useRef } from 'react';
import * as api from '../api';

export default function AIChatDrawer({ session }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro');
  const [availableModels, setAvailableModels] = useState([]);
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('gemini_custom_api_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Load models
    api.getAIModels().then(data => {
      if (data && data.models) {
        setAvailableModels(data.models);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (session && session.id) {
      api.getChatHistory(session.id).then(data => {
        if (data && data.chat_history) {
          setMessages(data.chat_history);
        } else {
          setMessages([]);
        }
      }).catch(() => setMessages([]));
    }
  }, [session?.id]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading || !session?.id) return;

    setInputMessage('');
    setQuotaWarning(null);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Optimistic update
    const userMsg = { role: 'user', content: text, timestamp: timeStr };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.sendChatMessage(session.id, text, selectedModel, customApiKey);
      if (res.success) {
        setMessages(prev => [
          ...prev, 
          { role: 'model', content: res.reply, timestamp: timeStr, model: res.model_used }
        ]);
      } else {
        if (res.error_type === 'QUOTA_EXCEEDED') {
          setQuotaWarning(res);
        } else if (res.error_type === 'NO_API_KEY') {
          setShowKeyModal(true);
        }
        setMessages(prev => [
          ...prev,
          { 
            role: 'model', 
            content: res.message || '오류가 발생했습니다.', 
            isError: true, 
            errorType: res.error_type,
            timestamp: timeStr 
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: 'model', content: '서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', isError: true, timestamp: timeStr }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("현재 세션의 AI 대화 기록을 모두 지우시겠습니까?")) return;
    try {
      await api.clearChatHistory(session.id);
      setMessages([]);
      setQuotaWarning(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveApiKey = (key) => {
    const trimmed = key.trim();
    setCustomApiKey(trimmed);
    localStorage.setItem('gemini_custom_api_key', trimmed);
    setShowKeyModal(false);
  };

  const handleFallbackToFlash = () => {
    setSelectedModel('gemini-2.5-flash');
    setQuotaWarning(null);
    handleSendMessage("이어서 계속 분석 및 상담을 진행해줘.");
  };

  const quickPrompts = [
    { label: "💡 포트폴리오 종합 진단", text: "현재 구성된 포트폴리오의 자산 배분과 장단점, 보완할 점을 종합적으로 진단해줘." },
    { label: "🛡️ 환헤지/환노출 점검", text: "현재 설정된 종목별 환헤지(H)와 환노출 설정이 거시경제 및 환율 변동성 방어 관점에서 적절한지 분석해줘." },
    { label: "⚖️ USD vs KRW 최적화 비교", text: "USD 펀더멘털 최적 비중과 KRW 실전 리스크 최적 비중 사이에 어떤 차이가 있고, 어떤 비중을 채택하는 것이 유리한지 조언해줘." },
    { label: "📉 백테스트 리스크 해석", text: "백테스트 결과의 누적 수익률, MWRR(연환산), MDD 최대 낙폭을 벤치마크(SPY, 1/N)와 비교하여 해석해줘." }
  ];

  if (!session) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '50px',
          padding: '12px 20px',
          fontSize: '0.95rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <span style={{ fontSize: '1.2rem' }}>💬</span>
        <span>AI 어드바이저</span>
        {messages.length > 0 && (
          <span style={{
            backgroundColor: '#10b981',
            color: '#fff',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '0.75rem'
          }}>
            {messages.length}
          </span>
        )}
      </button>

      {/* Slide-out / Bottom Sheet Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '80px',
            width: '420px',
            maxWidth: 'calc(100vw - 32px)',
            height: '620px',
            maxHeight: 'calc(100vh - 100px)',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            border: '1px solid #e2e8f0',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🤖</span>
                <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>AI Portfolio Advisor</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  title="API Key 설정"
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', padding: '2px 4px' }}
                >
                  ⚙️
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="대화 기록 비우기"
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', padding: '2px 4px' }}
                >
                  🗑️
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="닫기"
                  style={{ background: 'none', border: 'none', color: '#f1f5f9', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Model Selector & Live Context Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  flex: 1,
                  maxWidth: '240px'
                }}
              >
                {availableModels.length > 0 ? (
                  availableModels.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))
                ) : (
                  <>
                    <option value="gemini-2.5-pro">👑 Gemini 2.5 Pro (권장)</option>
                    <option value="gemini-2.0-flash-thinking-exp">🧠 Gemini 2.0 Thinking</option>
                    <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash</option>
                  </>
                )}
              </select>

              <span style={{ fontSize: '0.72rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', backgroundColor: '#4ade80', borderRadius: '50%', display: 'inline-block' }}></span>
                세션 연동됨
              </span>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(qp.text)}
                disabled={loading}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  backgroundColor: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  color: '#334155',
                  fontWeight: '500',
                  flexShrink: 0
                }}
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Chat Messages List */}
          <div style={{
            flex: 1,
            padding: '12px 16px',
            overflowY: 'auto',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px', padding: '0 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💬</div>
                <p style={{ fontWeight: 'bold', margin: '0 0 6px 0', color: '#1e293b' }}>
                  현재 세션의 데이터가 AI에 연결되어 있습니다
                </p>
                <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
                  종목 구성, 환헤지/환노출 효과, USD vs KRW 최적 비중, 백테스트 순손익 및 MDD에 대해 무엇이든 질문해 보세요.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '100%'
                    }}
                  >
                    <div style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      backgroundColor: isUser ? '#2563eb' : (msg.isError ? '#fef2f2' : '#ffffff'),
                      color: isUser ? '#ffffff' : (msg.isError ? '#991b1b' : '#1e293b'),
                      border: isUser ? 'none' : (msg.isError ? '1px solid #fecaca' : '1px solid #e2e8f0'),
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      fontSize: '0.88rem',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {msg.content}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', padding: '0 4px' }}>
                      {msg.timestamp || ''} {msg.model && `• ${msg.model}`}
                    </span>
                  </div>
                );
              })
            )}

            {/* Quota Exceeded Smart Fallback Banner */}
            {quotaWarning && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.85rem',
                color: '#92400e',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div>{quotaWarning.message}</div>
                <button
                  type="button"
                  onClick={handleFallbackToFlash}
                  style={{
                    backgroundColor: '#d97706',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    alignSelf: 'flex-start'
                  }}
                >
                  ⚡ Gemini 2.5 Flash로 계속하기 (무료 1,500회)
                </button>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem', padding: '8px 12px' }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>Gemini가 포트폴리오 데이터를 분석하고 있습니다...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end'
          }}>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="포트폴리오에 대해 질문하세요... (Enter: 전송)"
              rows={2}
              style={{
                flex: 1,
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 10px',
                fontSize: '0.88rem',
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={loading || !inputMessage.trim()}
              style={{
                backgroundColor: loading || !inputMessage.trim() ? '#94a3b8' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem',
                height: '42px'
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* API Key Setting Modal */}
      {showKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '20px',
            width: '400px',
            maxWidth: '100%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>⚙️ Gemini API Key 설정</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 12px 0', lineHeight: '1.4' }}>
              Google AI Studio(aistudio.google.com)에서 무료 발급받은 API 키를 입력하세요. 입력하지 않을 경우 서버의 기본 환경변수 키가 사용됩니다.
            </p>
            <input
              type="password"
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              placeholder="AIzaSy..."
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.9rem',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '6px', cursor: 'pointer' }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => handleSaveApiKey(customApiKey)}
                style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
