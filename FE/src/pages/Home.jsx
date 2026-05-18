import { useState, useEffect } from 'react'
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

const ICONS = {
  osebe: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  podjetja: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  povezave: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  search: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
}

function StatCard({ n, label, color, icon }) {
  return (
    <div className="hstat" style={{ '--c': color }}>
      <div className="hstat-icon">{icon}</div>
      <div className="hstat-body">
        <span className="hstat-n">{n.toLocaleString('sl-SI')}</span>
        <span className="hstat-l">{label}</span>
      </div>
    </div>
  )
}

function PersonCard({ oseba, onClick }) {
  const name = `${oseba.ime} ${oseba.priimek}`
  const isAk = oseba.tip === 'akademik'
  return (
    <button className="hcard" onClick={onClick}>
      <div className="hcard-av">
        <Avatar name={name} size="lg" foto={oseba.fotografija_url} />
        <span className={`hcard-dot ${isAk ? 'hcard-dot-ak' : 'hcard-dot-biz'}`} />
      </div>
      <div className="hcard-name">{name}</div>
      {oseba.naziv && <div className={`hcard-vloga ${isAk ? 'hcard-vloga-ak' : 'hcard-vloga-biz'}`}>{oseba.naziv}</div>}
      {oseba.institucija && <div className="hcard-company">{oseba.institucija}</div>}
      <div className="hcard-foot">
        <span className="hcard-conn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          {oseba.stevilo_povezav}
        </span>
        <span className={`hcard-tag ${isAk ? 'hcard-tag-ak' : 'hcard-tag-biz'}`}>
          {isAk ? 'Akademik' : 'Poslovnež'}
        </span>
      </div>
    </button>
  )
}

function CompanyCard({ podjetje, onClick }) {
  return (
    <button className="hcard" onClick={onClick}>
      <div className="hcard-av">
        <Avatar name={podjetje.popolno_ime} size="lg" />
        <span className="hcard-dot hcard-dot-co" />
      </div>
      <div className="hcard-name">{podjetje.popolno_ime}</div>
      {podjetje.pravna_oblika && <div className="hcard-vloga hcard-vloga-co">{podjetje.pravna_oblika}</div>}
      {podjetje.posta && <div className="hcard-company">{podjetje.posta}</div>}
      <div className="hcard-foot">
        <span className="hcard-conn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          {podjetje.stevilo_povezav}
        </span>
        <span className="hcard-tag hcard-tag-co">Podjetje</span>
      </div>
    </button>
  )
}

const PILLS = [
  { key: 'vsi',      label: 'Vsi' },
  { key: 'poslovnez', label: 'Poslovneži' },
  { key: 'akademik', label: 'Akademiki' },
  { key: 'podjetje', label: 'Podjetja' },
  { key: 'lobisti',  label: 'Lobisti',  to: '/lobisti' },
  { key: 'ovadeni',  label: 'Ovadeni',  to: '/ovadeni' },
]

export default function Home() {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats]   = useState({ osebe: 0, podjetja: 0, povezave: 0 })
  const [top, setTop]       = useState({ poslovnezi: [], akademiki: [], podjetja: [] })
  const [activePill, setActivePill] = useState('vsi')
  const navigate = useNavigate()
  const dq = useDebounce(query, 280)

  useEffect(() => {
    fetch(`${API}/stats`).then(r => r.json()).then(setStats).catch(() => {})
    Promise.all([
      fetch(`${API}/osebe?limit=6&tip=poslovnez`).then(r => r.json()),
      fetch(`${API}/akademiki?limit=6`).then(r => r.json()),
      fetch(`${API}/podjetja?limit=6`).then(r => r.json()),
    ]).then(([poslovnezi, akademiki, podjetja]) =>
      setTop({ poslovnezi, akademiki, podjetja })
    ).catch(() => {})
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

  const isSearching = query.trim().length > 0

  function go(item) {
    if (item.tip === 'oseba') navigate(`/oseba/${item.id}`)
    else navigate(`/podjetje/${item.id}`)
  }

  function itemName(item) {
    return item.tip === 'oseba' ? `${item.ime} ${item.priimek}` : item.naziv
  }

  const showPoslovnezi = activePill === 'vsi' || activePill === 'poslovnez'
  const showAkademiki  = activePill === 'vsi' || activePill === 'akademik'
  const showPodjetja   = activePill === 'vsi' || activePill === 'podjetje'

  return (
    <Layout>
      <div className="home-wrap">

        {/* Stats */}
        <div className="hstats">
          <StatCard n={stats.osebe}    label="Oseb v bazi"      color="#4F46E5" icon={ICONS.osebe} />
          <StatCard n={stats.podjetja} label="Podjetij v bazi"  color="#0D9488" icon={ICONS.podjetja} />
          <StatCard n={stats.povezave} label="Znanih povezav"   color="#D97706" icon={ICONS.povezave} />
        </div>

        {/* Search */}
        <div className="hsearch-wrap">
          <div className="search-wrapper" style={{ marginBottom: 0 }}>
            <svg className="search-icon-svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input hsearch-input"
              placeholder="Išči osebo ali podjetje..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="hpills">
          {PILLS.map(p =>
            p.to
              ? <Link key={p.key} to={p.to} className="hpill hpill-link">{p.label}</Link>
              : <button
                  key={p.key}
                  className={`hpill${activePill === p.key ? ' active' : ''}`}
                  onClick={() => setActivePill(p.key)}
                >{p.label}</button>
          )}
        </div>

        {/* Search results */}
        {isSearching ? (
          <div className="hresults">
            <p className="search-label">
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
        ) : (
          <>
            {showPoslovnezi && top.poslovnezi.length > 0 && (
              <section className="hsection">
                <div className="hsection-head">
                  <h2 className="hsection-title">Poslovneži — najbolj povezani</h2>
                </div>
                <div className="hcards-grid">
                  {top.poslovnezi.map(o => (
                    <PersonCard key={o.id} oseba={o} onClick={() => navigate(`/oseba/${o.id}`)} />
                  ))}
                </div>
              </section>
            )}

            {showAkademiki && top.akademiki.length > 0 && (
              <section className="hsection">
                <div className="hsection-head">
                  <h2 className="hsection-title">Akademiki — UM FERI</h2>
                  <span className="hsection-badge">Inštitut za informatiko</span>
                </div>
                <div className="hcards-grid">
                  {top.akademiki.map(o => (
                    <PersonCard key={o.id} oseba={{ ...o, tip: 'akademik' }} onClick={() => navigate(`/oseba/${o.id}`)} />
                  ))}
                </div>
              </section>
            )}

            {showPodjetja && top.podjetja.length > 0 && (
              <section className="hsection">
                <div className="hsection-head">
                  <h2 className="hsection-title">Najpovezanejša podjetja</h2>
                </div>
                <div className="hcards-grid">
                  {top.podjetja.map(p => (
                    <CompanyCard key={p.id} podjetje={p} onClick={() => navigate(`/podjetje/${p.id}`)} />
                  ))}
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
