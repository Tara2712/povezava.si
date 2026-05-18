import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { API } from '../api'

function useDebounce(value, delay) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Dobro jutro'
  if (h < 18) return 'Dober dan'
  return 'Dober večer'
}

function relTime(d) {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'pravkar'
  if (h < 24) return `${h}h nazaj`
  const days = Math.floor(h / 24)
  if (days === 1) return 'včeraj'
  if (days < 7) return `${days}d nazaj`
  return new Date(d).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })
}

export default function Home() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [top, setTop]         = useState([])
  const [clanki, setClanki]   = useState([])
  const [lobCount, setLobCount] = useState(0)
  const [ovCount, setOvCount]   = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const dq = useDebounce(query, 280)

  useEffect(() => {
    fetch(`${API}/osebe?limit=8&tip=poslovnez`).then(r => r.json()).then(setTop).catch(() => {})
    fetch(`${API}/clanki?limit=3`).then(r => r.json()).then(d => {
      const arr = Array.isArray(d) ? d : (d.clanki ?? [])
      setClanki(arr.slice(0, 3))
    }).catch(() => {})
    fetch(`${API}/lobisti?limit=1`).then(r => r.json()).then(d => setLobCount(d.skupaj ?? 0)).catch(() => {})
    fetch(`${API}/ovadeni?limit=1`).then(r => r.json()).then(d => setOvCount(d.skupaj ?? 0)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dq.trim()) { setResults([]); return }
    setLoading(true)
    fetch(`${API}/search?q=${encodeURIComponent(dq)}`)
      .then(r => r.json())
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [dq])

  function go(item) {
    if (item.tip === 'oseba') navigate(`/oseba/${item.id}`)
    else navigate(`/podjetje/${item.id}`)
  }

  function itemName(item) {
    return item.tip === 'oseba' ? `${item.ime} ${item.priimek}` : item.naziv
  }

  function handleSend() {
    if (query.trim()) {
      navigate(`/asistent?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const isSearching = query.trim().length > 0

  return (
    <Layout>
      <div className="hd-page">

        {/* ── HERO ── */}
        <div className="hd-hero">
          <div className="hd-hero-bg" />
          <div className="hd-hero-content">
            <h1 className="hd-greeting">{getGreeting()}</h1>
            <p className="hd-subtitle">Kaj vas zanima v slovenskem poslovnem omrežju?</p>

            {/* Search bar */}
            <div className="hd-search-card">
              <input
                ref={inputRef}
                className="hd-input"
                placeholder="Išči osebo, podjetje ali vprašaj AI…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                autoFocus
              />
              <div className="hd-search-footer">
                <span className="hd-ai-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  Povezava AI
                </span>
                <div className="hd-search-actions">
                  <button className="hd-send-btn" onClick={handleSend}>Pošlji</button>
                </div>
              </div>
            </div>

            {/* Quick pills */}
            <div className="hd-quick-pills">
              <button className="hd-qpill" onClick={() => inputRef.current?.focus()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Poišči osebo
              </button>
              <Link className="hd-qpill" to="/mediji">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>
                V medijih
              </Link>
              <Link className="hd-qpill" to="/lobisti">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Lobisti
              </Link>
              <Link className="hd-qpill" to="/asistent">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                AI Asistent
              </Link>
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="hd-body">

          {/* Search results overlay */}
          {isSearching && (
            <div className="hd-results-wrap">
              <p className="hd-results-label">
                {loading ? 'Iščem…' : results.length > 0
                  ? `${results.length} rezultatov za „${query}"`
                  : `Ni rezultatov za „${query}"`}
              </p>
              <div className="result-list">
                {results.map(item => (
                  <button key={`${item.tip}-${item.id}`} className="result-card" onClick={() => go(item)}>
                    <Avatar name={itemName(item)} />
                    <div className="card-body">
                      <div className="card-name">{itemName(item)}</div>
                      <div className="card-sub">{item.tip === 'oseba' ? 'Oseba' : 'Organizacija'}</div>
                    </div>
                    <span className="card-count">{item.stevilo_povezav} {item.stevilo_povezav == 1 ? 'povezava' : 'povezav'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isSearching && (
            <>
              {/* Profiles row */}
              {top.length > 0 && (
                <section className="hd-section">
                  <div className="hd-section-label">NAJBOLJ ISKANI PROFILI</div>
                  <div className="hd-profiles-scroll">
                    {top.map(o => {
                      const name = `${o.ime} ${o.priimek}`
                      return (
                        <button key={o.id} className="hd-prof-card" onClick={() => navigate(`/oseba/${o.id}`)}>
                          <Avatar name={name} size="lg" foto={o.fotografija_url} />
                          <div className="hd-prof-name">{name}</div>
                          <div className="hd-prof-sub">{o.naziv || 'Poslovnež'}</div>
                          {o.institucija && <div className="hd-prof-co">{o.institucija}</div>}
                          <div className="hd-prof-conn">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                            {o.stevilo_povezav} pov.
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* 3-column grid */}
              <div className="hd-grid3">

                {/* TOP POVEZAVE */}
                <div className="hd-card3">
                  <div className="hd-card3-head">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    TOP POVEZAVE
                  </div>
                  <div className="hd-card3-list">
                    {top.slice(0, 4).map(o => (
                      <button key={o.id} className="hd-row-item" onClick={() => navigate(`/oseba/${o.id}`)}>
                        <Avatar name={`${o.ime} ${o.priimek}`} size="sm" />
                        <div className="hd-row-body">
                          <span className="hd-row-name">{o.ime} {o.priimek}</span>
                          <span className="hd-row-sub">{o.institucija || o.naziv || ''}</span>
                        </div>
                        <span className="hd-row-badge">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                          {o.stevilo_povezav}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* V MEDIJIH */}
                <div className="hd-card3">
                  <div className="hd-card3-head">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>
                    V MEDIJIH
                    <Link to="/mediji" className="hd-card3-more">Vse →</Link>
                  </div>
                  <div className="hd-card3-list">
                    {clanki.length === 0 && (
                      <p className="hd-empty">Ni člankov.</p>
                    )}
                    {clanki.map(c => (
                      <a key={c.id} className="hd-news-item" href={c.url} target="_blank" rel="noopener noreferrer">
                        <div className="hd-news-meta">
                          <span className="hd-news-vir">{c.vir}</span>
                          <span className="hd-news-time">{relTime(c.datum)}</span>
                        </div>
                        <div className="hd-news-naslov">{c.naslov}</div>
                      </a>
                    ))}
                  </div>
                </div>

                {/* REGISTRI */}
                <div className="hd-card3">
                  <div className="hd-card3-head">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    REGISTRI
                  </div>
                  <div className="hd-card3-list">
                    <Link to="/lobisti" className="hd-reg-item hd-reg-lobist">
                      <div className="hd-reg-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <div>
                          <div className="hd-reg-name">Lobisti</div>
                          <div className="hd-reg-desc">Register KPK</div>
                        </div>
                      </div>
                      {lobCount > 0 && <span className="hd-reg-count">{lobCount}</span>}
                    </Link>
                    <Link to="/ovadeni" className="hd-reg-item hd-reg-ovaden">
                      <div className="hd-reg-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <div>
                          <div className="hd-reg-name">Kazensko ovadeni</div>
                          <div className="hd-reg-desc">Sodne zadeve</div>
                        </div>
                      </div>
                      {ovCount > 0 && <span className="hd-reg-count">{ovCount}</span>}
                    </Link>
                    <Link to="/asistent" className="hd-reg-item hd-reg-ai">
                      <div className="hd-reg-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                        <div>
                          <div className="hd-reg-name">AI Asistent</div>
                          <div className="hd-reg-desc">Vprašaj o omrežju</div>
                        </div>
                      </div>
                      <span className="hd-reg-arrow">→</span>
                    </Link>
                  </div>
                </div>

              </div>

              <footer className="hd-footer">
                <span>Podatki: AJPES PRS, javni viri</span>
                <span>·</span>
                <span>Povezava.si © 2026</span>
              </footer>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
