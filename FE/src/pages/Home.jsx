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
  const [topPoslovnezi, setTopPoslovnezi] = useState([])
  const [topAkademiki, setTopAkademiki]   = useState([])
  const [clanki, setClanki]   = useState([])
  const [stats, setStats]     = useState(null)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const dq = useDebounce(query, 280)

  const top = [...topPoslovnezi.slice(0, 2), ...topAkademiki.slice(0, 2)]

  useEffect(() => {
    fetch(`${API}/osebe?limit=4&tip=poslovnez`).then(r => r.json()).then(d => setTopPoslovnezi(Array.isArray(d) ? d : (d.osebe ?? []))).catch(() => {})
    fetch(`${API}/akademiki?limit=4`).then(r => r.json()).then(d => setTopAkademiki(Array.isArray(d) ? d : (d.osebe ?? []))).catch(() => {})
    fetch(`${API}/clanki?limit=3`).then(r => r.json()).then(d => {
      const arr = Array.isArray(d) ? d : (d.clanki ?? [])
      setClanki(arr.slice(0, 3))
    }).catch(() => {})
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {})
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

  function handleSearch() {
    if (query.trim()) {
      navigate(`/osebe?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const isSearching = query.trim().length > 0

  return (
    <Layout>
      <div className="hd-page">

        {/* ── HERO ── */}
        <div className="hd-hero hd-hero-light">
          <div className="hd-hero-bg" />
          <div className="hd-hero-content">
            <h1 className="hd-greeting hd-greeting-light">{getGreeting()}</h1>
            <p className="hd-subtitle hd-subtitle-light">Kaj vas zanima v slovenskem poslovnem omrežju?</p>

            {/* Search bar */}
            <div className="hd-search-card hd-search-card-light">
              <div className="hd-search-row">
                <svg className="hd-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  ref={inputRef}
                  className="hd-input hd-input-light"
                  placeholder="Išči osebo ali podjetje…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  autoFocus
                />
                {query && (
                  <button className="hd-clear-btn" onClick={() => setQuery('')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Quick pills */}
            <div className="hd-quick-pills hd-quick-pills-light">
              <Link className="hd-qpill" to="/osebe">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Seznam oseb
              </Link>
              <Link className="hd-qpill" to="/mediji">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>
                V medijih
              </Link>
              <Link className="hd-qpill" to="/lobisti">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Lobisti
              </Link>
              <Link className="hd-qpill" to="/ovadeni">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Ovadeni
              </Link>
            </div>
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {stats && (
          <div className="hd-stats-bar">
            <div className="hd-stat">
              <span className="hd-stat-num">{stats.osebe.toLocaleString('sl-SI')}</span>
              <span className="hd-stat-lbl">oseb v bazi</span>
            </div>
            <div className="hd-stat-sep" />
            <div className="hd-stat">
              <span className="hd-stat-num">{stats.podjetja.toLocaleString('sl-SI')}</span>
              <span className="hd-stat-lbl">podjetij &amp; org.</span>
            </div>
            <div className="hd-stat-sep" />
            <div className="hd-stat">
              <span className="hd-stat-num">{stats.povezave.toLocaleString('sl-SI')}</span>
              <span className="hd-stat-lbl">poslovnih povezav</span>
            </div>
          </div>
        )}

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
              {/* 3-column grid */}
              <div className="hd-grid3">

                {/* NAJBOLJ ISKANI PROFILI */}
                <div className="hd-card3">
                  <div className="hd-card3-head">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    NAJBOLJ ISKANI PROFILI
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

                {/* ZADNJE NOVICE */}
                <div className="hd-card3">
                  <div className="hd-card3-head">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>
                    ZADNJE NOVICE
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

                {/* DRUGI SO VPRAŠALI */}
                <div className="hd-card3">
                  <div className="hd-card3-head">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    DRUGI SO VPRAŠALI
                    <Link to="/asistent" className="hd-card3-more">AI →</Link>
                  </div>
                  <div className="hd-card3-list">
                    {[
                      'Kdo ima največ poslovnih povezav?',
                      'Kateri akademiki so v upravnih odborih?',
                      'Kdo je vpisan v register lobistov?',
                      'Katere osebe so kazensko ovadene?',
                      'Katera podjetja imajo največ direktorjev?',
                    ].map((q, i) => (
                      <button
                        key={i}
                        className="hd-asked-item"
                        onClick={() => navigate(`/asistent?q=${encodeURIComponent(q)}`)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
