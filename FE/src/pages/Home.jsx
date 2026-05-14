import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

function StatBlock({ n, label, color }) {
  return (
    <div className="home-stat-block" style={{ '--stat-color': color }}>
      <span className="home-stat-n">{n.toLocaleString('sl-SI')}</span>
      <span className="home-stat-l">{label}</span>
    </div>
  )
}

function PersonCard({ oseba, onClick }) {
  const name = `${oseba.ime} ${oseba.priimek}`
  return (
    <button className="home-person-card" onClick={onClick}>
      <Avatar name={name} size="lg" />
      <span className="home-card-name">{name}</span>
      <span className="home-card-badge">{oseba.stevilo_povezav} povezav</span>
    </button>
  )
}

function CompanyCard({ podjetje, onClick }) {
  return (
    <button className="home-company-card" onClick={onClick}>
      <Avatar name={podjetje.popolno_ime} size="lg" />
      <span className="home-card-name">{podjetje.popolno_ime}</span>
      <span className="home-card-badge">{podjetje.stevilo_povezav} povezav</span>
    </button>
  )
}

export default function Home() {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats]   = useState({ osebe: 0, podjetja: 0, povezave: 0 })
  const [top, setTop]       = useState({ osebe: [], podjetja: [] })
  const navigate = useNavigate()
  const dq = useDebounce(query, 280)

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {})
    Promise.all([
      fetch(`${API}/osebe?limit=5`).then(r => r.json()),
      fetch(`${API}/podjetja?limit=5`).then(r => r.json()),
    ]).then(([osebe, podjetja]) => {
      setTop({ osebe, podjetja })
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
      <div className="home-wrap">

        <div className="home-header">
          <h1 className="home-title">Poslovne povezave<br />v Sloveniji</h1>
          <p className="home-sub">Kdo vodi kaj. Kdo pozna koga.</p>
        </div>

        <div className="search-wrapper home-search">
          <svg className="search-icon-svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Išči osebo ali podjetje..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {isSearching ? (
          <div className="home-results">
            <p className="search-label">
              {loading ? 'Iščem...' : results.length > 0
                ? `${results.length} rezultatov za "${query}"`
                : `Ni rezultatov za "${query}"`}
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
        ) : (
          <>
            <div className="home-stats">
              <StatBlock n={stats.osebe}    label="oseb"     color="#6366f1" />
              <StatBlock n={stats.podjetja} label="podjetij" color="#10b981" />
              <StatBlock n={stats.povezave} label="povezav"  color="#f59e0b" />
            </div>

            <section className="home-section">
              <h2 className="home-section-title">Najbolj povezane osebe</h2>
              <div className="home-cards-row">
                {top.osebe.map(o => (
                  <PersonCard key={o.id} oseba={o} onClick={() => navigate(`/oseba/${o.id}`)} />
                ))}
              </div>
            </section>

            <section className="home-section">
              <h2 className="home-section-title">Najpovezanejša podjetja</h2>
              <div className="home-cards-row">
                {top.podjetja.map(p => (
                  <CompanyCard key={p.id} podjetje={p} onClick={() => navigate(`/podjetje/${p.id}`)} />
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="site-footer">
          <span>Podatki: AJPES PRS, javni viri</span>
          <span>·</span>
          <span>Povezava.si © 2026</span>
        </footer>
      </div>
    </Layout>
  )
}
