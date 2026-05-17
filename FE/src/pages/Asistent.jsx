import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { API } from '../api'

const PREDLOGI = [
  'Koliko oseb je v bazi?',
  'Kdo so akademiki na FERI?',
  'Katere so najbolj povezane osebe?',
  'Koliko lobistov je registriranih?',
  'Kaj je Povezava.si?',
]

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
        <p className="ai-msg-text">{msg.text}</p>
        {msg.podatki && <DataLinks podatki={msg.podatki} />}
        {msg.vir && (
          <span className={`ai-msg-vir ${msg.vir === 'ollama' ? 'ai-vir-ollama' : 'ai-vir-sistem'}`}>
            {msg.vir === 'ollama' ? '🤖 Ollama AI' : '💡 Sistem'}
          </span>
        )}
      </div>
    </div>
  )
}

function DataLinks({ podatki }) {
  if (!podatki) return null

  if (podatki.tip === 'stats') return (
    <div className="ai-data-row">
      <span className="ai-data-chip">👤 {podatki.osebe} oseb</span>
      <span className="ai-data-chip">🏢 {podatki.podjetja} podjetij</span>
      <span className="ai-data-chip">🔗 {podatki.povezave} povezav</span>
    </div>
  )

  if (podatki.tip === 'oseba' && podatki.osebe?.length) return (
    <div className="ai-data-row">
      {podatki.osebe.slice(0, 3).map(o => (
        <Link key={o.id} to={`/oseba/${o.id}`} className="ai-data-link">
          👤 {o.ime} {o.priimek}
        </Link>
      ))}
    </div>
  )

  if (podatki.tip === 'akademiki' && podatki.osebe?.length) return (
    <div className="ai-data-row">
      {podatki.osebe.slice(0, 4).map(o => (
        <Link key={o.id} to={`/oseba/${o.id}`} className="ai-data-link">
          🎓 {o.ime} {o.priimek}
        </Link>
      ))}
    </div>
  )

  if (podatki.tip === 'top_osebe' && podatki.osebe?.length) return (
    <div className="ai-data-row">
      {podatki.osebe.map(o => (
        <Link key={o.id} to={`/oseba/${o.id}`} className="ai-data-link">
          ⭐ {o.ime} {o.priimek} ({o.n})
        </Link>
      ))}
    </div>
  )

  return null
}

export default function Asistent() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'Pozdravljeni! Sem AI asistent za Povezava.si. Vprašajte me o osebah, podjetjih, poslovnih mrežah ali akademikih v bazi. Delam s podatki iz slovenskega poslovnega registra in javnih virov.',
      vir: null
    }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const r = await fetch(`${API}/ai/vprasaj`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vprasanje: q })
      })
      const data = await r.json()
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.odgovor || 'Ni odgovora.',
        podatki: data.podatki,
        vir: data.vir
      }])
    } catch (_) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Napaka pri klicu strežnika. Preverite zvezo.', vir: 'sistem' }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <Layout>
      <div className="ai-page">
        <div className="ai-header">
          <div>
            <h1 className="ai-title">
              <span className="ai-title-icon">🤖</span> AI Asistent
            </h1>
            <p className="ai-desc">Postavljajte vprašanja v naravnem jeziku — asistent poišče odgovore v bazi.</p>
          </div>
          <div className="ai-badge-wrap">
            <span className="ai-ollama-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              Ollama
            </span>
          </div>
        </div>

        <div className="ai-chat">
          <div className="ai-messages">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && (
              <div className="ai-msg ai-msg-ai">
                <div className="ai-msg-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <div className="ai-msg-bubble ai-msg-loading">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
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
              disabled={loading}
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
            Lokalni AI: <a href="https://ollama.com" target="_blank" rel="noopener" className="ai-ollama-link">Ollama</a> (Mistral) · brez strežnika v oblaku
          </p>
        </div>
      </div>
    </Layout>
  )
}
