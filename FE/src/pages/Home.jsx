import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { API } from '../api'

function fmtDatum(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ClanekCard({ clanek }) {
  return (
    <a className="clanek-card" href={clanek.url} target="_blank" rel="noopener noreferrer">
      <div className="clanek-meta">
        <span className="clanek-vir">{clanek.vir}</span>
        <span className="clanek-datum">{fmtDatum(clanek.datum)}</span>
      </div>
      <div className="clanek-naslov">{clanek.naslov}</div>
      {clanek.osebe?.length > 0 && (
        <div className="clanek-osebe">
          {clanek.osebe.map(o => (
            <Link
              key={o.id}
              className="clanek-oseba-link"
              to={`/oseba/${o.id}`}
              onClick={e => e.stopPropagation()}
            >
              {o.ime} {o.priimek}
            </Link>
          ))}
        </div>
      )}
    </a>
  )
}

function useDebounce(value, delay) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function StatCard({ n, label, color, iconBg, icon }) {
  return (
    <div className="home-stat-card" style={{ '--card-bg': color + '12', '--card-border': color + '30', '--card-color': color, '--card-icon-bg': color + '20' }}>
      <div className="home-stat-icon">{icon}</div>
      <div className="home-stat-body">
        <span className="home-stat-n">{n.toLocaleString('sl-SI')}</span>
        <span className="home-stat-l">{label}</span>
      </div>
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

function AkademikCard({ oseba, onClick }) {
  const name = `${oseba.ime} ${oseba.priimek}`
  const firstArea = oseba.podrocja?.split(' · ')[0]?.trim()
  return (
    <button className="home-person-card home-akademik-card" onClick={onClick}>
      <Avatar name={name} size="lg" foto={oseba.fotografija_url} />
      <span className="home-card-name">{name}</span>
      {oseba.naziv && <span className="home-card-naziv">{oseba.naziv}</span>}
      {firstArea && <span className="home-card-area">{firstArea}</span>}
    </button>
  )
}

export default function Home() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [stats, setStats]       = useState({ osebe: 0, podjetja: 0, povezave: 0 })
  const [top, setTop]           = useState({ osebe: [], podjetja: [] })
  const [akademiki, setAkademiki] = useState([])
  const [clanki, setClanki]     = useState([])
  const navigate = useNavigate()
  const dq = useDebounce(query, 280)

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {})
    Promise.all([
      fetch(`${API}/osebe?limit=5&tip=poslovnez`).then(r => r.json()),
      fetch(`${API}/podjetja?limit=5`).then(r => r.json()),
    ]).then(([osebe, podjetja]) => setTop({ osebe, podjetja })).catch(() => {})
    fetch(`${API}/akademiki?limit=6`).then(r => r.json()).then(setAkademiki).catch(() => {})
    fetch(`${API}/clanki?limit=6`).then(r => r.json()).then(setClanki).catch(() => {})
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

        <div className="home-search-bar">
          <div className="search-wrapper" style={{ marginBottom: 0 }}>
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
              <StatCard
                n={stats.osebe} label="Oseb v bazi" color="#6366f1"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              />
              <StatCard
                n={stats.podjetja} label="Podjetij v bazi" color="#10b981"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
              />
              <StatCard
                n={stats.povezave} label="Znanih povezav" color="#f59e0b"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
              />
            </div>

            <section className="home-section">
              <div className="home-section-head">
                <h2 className="home-section-title">Poslovneži — najbolj povezani</h2>
              </div>
              <div className="home-cards-row">
                {top.osebe.map(o => (
                  <PersonCard key={o.id} oseba={o} onClick={() => navigate(`/oseba/${o.id}`)} />
                ))}
              </div>
            </section>

            {akademiki.length > 0 && (
              <section className="home-section">
                <div className="home-section-head">
                  <h2 className="home-section-title">Akademiki — UM FERI</h2>
                  <span className="home-section-badge">Inštitut za informatiko</span>
                </div>
                <div className="home-cards-row">
                  {akademiki.map(o => (
                    <AkademikCard key={o.id} oseba={o} onClick={() => navigate(`/oseba/${o.id}`)} />
                  ))}
                </div>
              </section>
            )}

            <section className="home-section">
              <div className="home-section-head">
                <h2 className="home-section-title">Najpovezanejša podjetja</h2>
              </div>
              <div className="home-cards-row">
                {top.podjetja.map(p => (
                  <CompanyCard key={p.id} podjetje={p} onClick={() => navigate(`/podjetje/${p.id}`)} />
                ))}
              </div>
            </section>

            {clanki.length > 0 && (
              <section className="home-section">
                <div className="home-section-head">
                  <h2 className="home-section-title">Aktualno v medijih</h2>
                </div>
                <div className="clanki-grid">
                  {clanki.map(c => <ClanekCard key={c.id} clanek={c} />)}
                </div>
              </section>
            )}

            <footer className="site-footer">
              <span>Podatki: AJPES PRS, javni viri</span>
              <span>·</span>
              <span>Povezava.si © 2026</span>
            </footer>
          </>
        )}
      </div>
    </Layout>
  )
}
