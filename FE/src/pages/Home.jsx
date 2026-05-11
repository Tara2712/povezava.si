import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'

const API = 'http://localhost:3000'

function useDebounce(value, delay) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ osebe: 0, podjetja: 0, povezave: 0 })
  const [top, setTop] = useState({ osebe: [], podjetja: [] })
  const navigate = useNavigate()
  const dq = useDebounce(query, 280)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/osebe`).then(r => r.json()),
      fetch(`${API}/podjetja`).then(r => r.json()),
      fetch(`${API}/povezave`).then(r => r.json()),
    ]).then(([osebe, podjetja, povezave]) => {
      setStats({ osebe: osebe.length, podjetja: podjetja.length, povezave: povezave.length })
      setTop({ osebe: osebe.slice(0, 6), podjetja: podjetja.slice(0, 6) })
    }).catch(() => {})
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

  const isSearching = query.trim().length > 0

  return (
    <Layout>
      {!isSearching && (
        <div className="hero">
          <h1 className="hero-title">Poslovne povezave v Sloveniji</h1>
          <p className="hero-sub">Pregledna baza podatkov o vodstvenih funkcijah in lastniških razmerjih v slovenskem gospodarstvu.</p>
          <div className="stats-row">
            <div className="stat"><span className="stat-n">{stats.osebe}</span><span className="stat-l">oseb</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-n">{stats.podjetja}</span><span className="stat-l">podjetij</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-n">{stats.povezave}</span><span className="stat-l">povezav</span></div>
          </div>
        </div>
      )}

      <div className="search-wrapper">
        <svg className="search-icon-svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="search-input"
          placeholder="Išči osebo, podjetje, organizacijo..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {isSearching ? (
        <>
          <p className="search-label">
            {loading ? 'Iščem...' : results.length > 0 ? `${results.length} rezultatov za "${query}"` : `Ni rezultatov za "${query}"`}
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
        </>
      ) : (
        <div className="top-grid">
          <div>
            <p className="section-label">Osebe z največ povezavami</p>
            <div className="top-list">
              {top.osebe.map(o => (
                <button key={o.id} className="top-card" onClick={() => navigate(`/oseba/${o.id}`)}>
                  <Avatar name={`${o.ime} ${o.priimek}`} size="sm" />
                  <span className="top-name">{o.ime} {o.priimek}</span>
                  <span className="top-count">{o.stevilo_povezav}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="section-label">Podjetja z največ povezavami</p>
            <div className="top-list">
              {top.podjetja.map(p => (
                <button key={p.id} className="top-card" onClick={() => navigate(`/podjetje/${p.id}`)}>
                  <Avatar name={p.popolno_ime} size="sm" />
                  <span className="top-name">{p.popolno_ime}</span>
                  <span className="top-count">{p.stevilo_povezav}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="site-footer">
        <span>Podatki: AJPES register, OPSI, javni viri</span>
        <span>·</span>
        <span>Povezava.si © 2026</span>
      </footer>
    </Layout>
  )
}
