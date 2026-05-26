import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import Layout from '../components/Layout'
import { API } from '../api'

const PREDLOGI = [
  'Koliko oseb je v bazi?',
  'Kdo so akademiki na FERI?',
  'Katere so najbolj povezane osebe?',
  'Koliko lobistov je registriranih?',
  'Kaj je Povezava.si?',
]

const INITIAL_MSG = {
  role: 'ai',
  text: 'Pozdravljeni! Sem AI asistent za Povezava.si. Vprašajte me o osebah, podjetjih, poslovnih mrežah ali akademikih v bazi.',
  vir: null
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('ai-history')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch {}
  return [INITIAL_MSG]
}

function ProfilLink({ oseba }) {
  if (!oseba?.id) return null
  return (
    <Link to={`/oseba/${oseba.id}`} className="ai-profil-btn">
      Odpri profil: {oseba.ime} {oseba.priimek} →
    </Link>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`ai-msg ${isUser ? 'ai-msg-user' : 'ai-msg-ai'}`}>
      {!isUser && (
        <div className="ai-msg-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
        </div>
      )}
      <div className="ai-msg-bubble">
        {isUser ? (
          <p className="ai-msg-text">{msg.text}</p>
        ) : (
          <div className="ai-msg-md">
            <ReactMarkdown>{msg.text || ''}</ReactMarkdown>
          </div>
        )}
        {msg.podatki?.profil && <ProfilLink oseba={msg.podatki.profil} />}
        {msg.vir && (
          <span className={`ai-msg-vir ${msg.vir === 'gemini' ? 'ai-vir-gemini' : msg.vir === 'groq' ? 'ai-vir-groq' : 'ai-vir-sistem'}`}>
            {msg.vir === 'gemini' ? 'Gemini' : msg.vir === 'groq' ? 'Groq AI' : 'Sistem'}
          </span>
        )}
      </div>
    </div>
  )
}

export default function Asistent() {
  const [messages, setMessages] = useState(loadHistory)
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const messagesRef = useRef(null)
  const inputRef    = useRef(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    try { localStorage.setItem('ai-history', JSON.stringify(messages)) } catch {}
  }, [messages])

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    const newHistory = [...messages, { role: 'user', text: q }]
    setMessages(newHistory)
    setLoading(true)
    inputRef.current?.focus()

    try {
      const response = await fetch(`${API}/ai/vprasaj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vprasanje: q, history: messages.slice(-6) })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiText = ''
      let meta = {}
      let vir = null
      let buffer = ''

      // Add empty streaming message
      setMessages(prev => [...prev, { role: 'ai', text: '', vir: null, _streaming: true }])
      setLoading(false)

      const updateLast = (patch) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch }
          return updated
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const data = JSON.parse(raw)
            if (data.meta) { meta = data.meta; updateLast({ podatki: meta.podatki }) }
            else if (data.vir) { vir = data.vir; updateLast({ vir }) }
            else if (data.chunk) { aiText += data.chunk; updateLast({ text: aiText }) }
            else if (data.done) { updateLast({ _streaming: false }) }
            else if (data.error) { updateLast({ text: 'Napaka: ' + data.error, _streaming: false }) }
          } catch {}
        }
      }
      updateLast({ text: aiText || 'Ni odgovora.', _streaming: false })
    } catch {
      setLoading(false)
      setMessages(prev => [...prev, { role: 'ai', text: 'Napaka pri klicu strežnika.', vir: 'sistem' }])
    }
    inputRef.current?.focus()
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function clearHistory() {
    setMessages([INITIAL_MSG])
    localStorage.removeItem('ai-history')
  }

  return (
    <Layout>
      <div className="ai-page">
        <div className="ai-header">
          <div>
            <h1 className="ai-title">AI Asistent</h1>
            <p className="ai-desc">Postavljajte vprašanja v naravnem jeziku — asistent poišče odgovore v bazi in na spletu.</p>
          </div>
          <button className="ai-clear-btn" onClick={clearHistory} title="Izbriši zgodovino">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Novo
          </button>
        </div>

        <div className="ai-chat">
          <div className="ai-messages" ref={messagesRef}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && (
              <div className="ai-msg ai-msg-ai">
                <div className="ai-msg-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div className="ai-msg-bubble ai-msg-loading"><span /><span /><span /></div>
              </div>
            )}
          </div>

          <div className="ai-predlogi">
            {PREDLOGI.map(p => (
              <button key={p} className="ai-predlog-pill" onClick={() => send(p)} disabled={loading}>
                {p}
              </button>
            ))}
          </div>

          <div className="ai-input-row">
            <textarea
              ref={inputRef}
              className="ai-input"
              placeholder="Vprašajte kaj o osebah, podjetjih ali poslovnih mrežah..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
            />
            <button
              className="ai-send-btn"
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label="Pošlji"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p className="ai-footer-note">
            AI: <a href="https://groq.com" target="_blank" rel="noopener" className="ai-ollama-link">Groq</a> · podatki iz baze + splet
          </p>
        </div>
      </div>
    </Layout>
  )
}
