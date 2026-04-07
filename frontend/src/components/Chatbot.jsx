import { useState, useRef, useEffect } from 'react'
import { sendChatMessage } from '../api'

export default function Chatbot({ onConstraintsUpdate }) {
  const [messages, setMessages] = useState([
    {
      id: 'intro',
      sender: 'assistant',
      text: "Hi! I'm your scheduling assistant. Describe what you'd like to block, prefer, or change. For example: 'Block lunch from 12 to 1 PM' or 'No Friday classes'",
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    // Add user message
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await sendChatMessage(input)
      
      // Add assistant response
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: response.assistant_message,
        interpretation: response.interpretation,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])

      // Update constraints
      if (response.constraints && onConstraintsUpdate) {
        onConstraintsUpdate(response.constraints)
      }
    } catch (error) {
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: `Sorry, there was an error: ${error.message || 'Something went wrong'}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}>
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-serif)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          Schedule Assistant
        </p>
        <p style={{
          margin: '4px 0 0 0',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          Chat to add constraints and preferences
        </p>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: 0,
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '8px',
                background: msg.sender === 'user'
                  ? 'var(--carolina)'
                  : 'var(--bg-card)',
                border: msg.sender === 'user'
                  ? 'none'
                  : '1px solid var(--border)',
                color: msg.sender === 'user'
                  ? 'white'
                  : 'var(--text-primary)',
                fontSize: '13px',
                lineHeight: '1.4',
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
              {msg.interpretation?.clarification_question && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: `1px solid ${msg.sender === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
                  fontSize: '12px',
                  fontStyle: 'italic',
                  opacity: 0.9,
                }}>
                  {msg.interpretation.clarification_question}
                </div>
              )}
              <div style={{
                fontSize: '10px',
                marginTop: '4px',
                opacity: 0.7,
              }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '4px', padding: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--text-muted)',
              animation: 'pulse 1.4s infinite',
            }} />
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--text-muted)',
              animation: 'pulse 1.4s infinite 0.2s',
            }} />
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--text-muted)',
              animation: 'pulse 1.4s infinite 0.4s',
            }} />
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
              }
            `}</style>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-card)',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Describe what you need..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px',
            background: input.trim() ? 'var(--carolina)' : 'var(--text-muted)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 500,
            opacity: input.trim() && !loading ? 1 : 0.5,
            transition: 'opacity 0.2s',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
