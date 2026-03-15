import React, { useState, useRef, useEffect } from 'react';
import { PageHeader, PageContent } from '../components/common/Layout';
import ReactMarkdown from 'react-markdown';

const CHATBOT_API = process.env.REACT_APP_CHATBOT_API_URL || 'http://localhost:8000';

const INITIAL_MESSAGE = {
  role: 'system',
  text: 'Hello! I am your Industrial Environmental Assistant. I can check live sensor data, forecast pollutant levels, and analyze compliance for your industries. How can I help you today?',
  metadata: null,
};

const QUICK_ACTIONS = [
  'What is the current SO₂ level for AMUL?',
  'Is AMUL compliant with emission standards?',
  'Which industry has highest NO₂ today?',
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (question) => {
    const q = (typeof question === 'string' ? question : input).trim();
    if (!q) return;
    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', text: q, metadata: null }]);
    setLoading(true);
    try {
      const res = await fetch(`${CHATBOT_API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        const msg = Array.isArray(detail) ? detail.map((d) => d.msg || d).join(', ') : detail || 'Request failed';
        throw new Error(msg);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          text: data.answer || 'No response.',
          metadata: data.retrieved_data_summary ? { retrieved_data_summary: data.retrieved_data_summary } : null,
        },
      ]);
    } catch (e) {
      const fallback =
        e.message && !e.message.includes('fetch')
          ? e.message
          : 'Could not reach the chatbot. Ensure the pollution chatbot backend is running on port 8000.';
      setError(fallback);
      setMessages((prev) => [
        ...prev,
        { role: 'system', text: fallback, metadata: null, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Pollution Chatbot"
        subtitle="Ask about air quality, compliance, and industry emissions. Uses the Industrial Compliance Copilot backend."
      />
      <PageContent>
        <div
          className="rounded-xl overflow-hidden border flex flex-col"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border)',
            maxWidth: 900,
            margin: '0 auto',
            minHeight: 520,
          }}
        >
          <div
            className="flex-1 overflow-y-auto p-6 flex flex-col gap-4"
            style={{ minHeight: 360, maxHeight: '60vh' }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`message ${msg.role}`}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: msg.role === 'user' ? 'rgba(20,179,105,0.2)' : 'var(--bg-primary)',
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius: msg.role === 'user' ? 12 : 4,
                }}
              >
                <div
                  className="message-content text-sm prose prose-invert max-w-none"
                  style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}
                >
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 my-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 my-2">{children}</ol>,
                      strong: ({ children }) => <strong style={{ color: '#14b369' }}>{children}</strong>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-3 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                          <table className="w-full text-sm">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="px-3 py-2 text-left border-b font-semibold" style={{ borderColor: 'var(--border)', color: '#14b369' }}>
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                          {children}
                        </td>
                      ),
                      tr: ({ children }) => <tr style={{ background: 'rgba(255,255,255,0.02)' }}>{children}</tr>,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
                {msg.metadata?.retrieved_data_summary && Object.keys(msg.metadata.retrieved_data_summary).length > 0 && (
                  <div
                    className="text-xs mt-2 pt-2 border-t"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    Data source: {Object.keys(msg.metadata.retrieved_data_summary).join(', ')}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div
                className="flex gap-1 items-center px-4 py-2 rounded-xl self-start"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
              >
                <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
            {QUICK_ACTIONS.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => sendMessage(label)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full text-xs border transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-primary)' }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Query air, water, or emission conditions..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading}
                className="px-4 py-2 rounded-lg font-medium text-sm text-white disabled:opacity-50"
                style={{ background: '#14b369' }}
              >
                Send
              </button>
            </div>
            {error && (
              <p className="text-xs mt-2" style={{ color: '#f97316' }}>
                {error}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Backend: {CHATBOT_API}. Start the pollution chatbot server (port 8000) if the chat does not respond.
            </p>
          </div>
        </div>
      </PageContent>
    </>
  );
}
