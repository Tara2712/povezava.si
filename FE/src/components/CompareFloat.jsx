import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useComparison, useSavedPersons } from '../hooks/usePersonStorage'
import Avatar from './Avatar'
import { API } from '../api'

export default function CompareFloat() {
  const navigate = useNavigate()
  const { candidate, select, clear } = useComparison()
  const { saved } = useSavedPersons()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const showSaved = !q.trim() && saved.length > 0
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQ(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`${API}/api/osebe?q=${encodeURIComponent(q)}&limit=6`)
        .then(r => r.json())
        .then(d => { setResults(Array.isArray(d) ? d : (d.osebe ?? [])); setLoading(false) })
        .catch(() => setLoading(false))
    }, 280)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    function onClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function pick(oseba) {
    if (!candidate) {
      select(oseba)
      setQ(''); setResults([])
    } else if (candidate.id !== oseba.id) {
      const a = candidate.id
      const b = oseba.id
      clear()
      setOpen(false)
      navigate(`/primerjava?a=${a}&b=${b}`)
    }
  }

  const step = candidate ? 2 : 1

  return (
    <div className="cf-wrap" ref={panelRef}>
      {open && (
        <div className="cf-panel">
          <div className="cf-panel-head">
            {step === 1 ? 'Izberi osebo A za primerjavo' : (
              <span>Primerjaj z: <strong>{candidate.ime} {candidate.priimek}</strong></span>
            )}
            {candidate && (
              <button className="cf-cancel" onClick={clear} title="Prekliči">✕</button>
            )}
          </div>

          <div className="cf-search-wrap">
            <svg className="cf-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              className="cf-input"
              placeholder="Ime ali priimek…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          <div className="cf-results">
            {showSaved && <div className="cf-section-label">Shranjene osebe</div>}
            {loading && <div className="cf-hint">Iščem…</div>}
            {!loading && q && results.length === 0 && <div className="cf-hint">Ni rezultatov.</div>}
            {(showSaved ? saved : results).map(o => {
              const name = `${o.ime} ${o.priimek}`
              const isCandidate = candidate?.id === o.id
              return (
                <button
                  key={o.id}
                  className={`cf-result${isCandidate ? ' selected' : ''}`}
                  onClick={() => pick(o)}
                  disabled={isCandidate}
                >
                  <Avatar name={name} size="sm" foto={o.fotografija_url} />
                  <div className="cf-result-info">
                    <span className="cf-result-name">{name}</span>
                    {o.institucija && <span className="cf-result-sub">{o.institucija}</span>}
                  </div>
                  {isCandidate
                    ? <span className="cf-result-badge">A</span>
                    : <span className="cf-result-arrow">{step === 2 ? '⇄' : '+'}</span>
                  }
                </button>
              )
            })}
          </div>
        </div>
      )}

      <button
        className={`cf-fab${candidate ? ' has-candidate' : ''}${open ? ' active' : ''}`}
        onClick={() => setOpen(v => !v)}
        title="Primerjaj osebi"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/>
          <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>
          <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        {candidate && <span className="cf-fab-dot" />}
      </button>
    </div>
  )
}
