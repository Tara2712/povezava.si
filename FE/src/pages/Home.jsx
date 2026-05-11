import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API = 'http://localhost:3000'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [recent, setRecent] = useState({ osebe: [], podjetja: [] })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/osebe`).then(r => r.json()),
      fetch(`${API}/podjetja`).then(r => r.json()),
    ]).then(([osebe, podjetja]) => {
      setRecent({
        osebe: osebe.slice(0, 5),
        podjetja: podjetja.slice(0, 5),
      })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    fetch(`${API}/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => setResults(data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  function goTo(item) {
    if (item.tip === 'oseba') navigate(`/oseba/${item.id}`)
    else navigate(`/podjetje/${item.id}`)
  }

  return (
    <div className="page">
      <header className="site-header">
        <h1 className="logo">Povezava.si</h1>
        <p className="tagline">Iskanje poslovnih povezav med osebami in podjetji v Sloveniji</p>
      </header>

      <div className="search-box">
        <input
          className="search-input"
          type="text"
          placeholder="Išči osebo ali podjetje..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {loading && <span className="search-spinner" />}
      </div>

      {query.trim() ? (
        <section className="results">
          {results.length === 0 && !loading && (
            <p className="empty">Ni rezultatov za &ldquo;{query}&rdquo;</p>
          )}
          {results.map(item => (
            <button key={`${item.tip}-${item.id}`} className="result-card" onClick={() => goTo(item)}>
              <span className={`badge badge-${item.tip}`}>{item.tip === 'oseba' ? 'Oseba' : 'Podjetje'}</span>
              <span className="result-name">
                {item.tip === 'oseba' ? `${item.ime} ${item.priimek}` : item.naziv}
              </span>
              <span className="result-count">{item.stevilo_povezav} {item.stevilo_povezav === '1' ? 'povezava' : 'povezav'}</span>
            </button>
          ))}
        </section>
      ) : (
        <div className="recent-grid">
          <section className="recent-col">
            <h2>Osebe z največ povezavami</h2>
            <ul className="list">
              {recent.osebe.map(o => (
                <li key={o.id}>
                  <button className="list-btn" onClick={() => navigate(`/oseba/${o.id}`)}>
                    <span>{o.ime} {o.priimek}</span>
                    <span className="count">{o.stevilo_povezav}</span>
                  </button>
                </li>
              ))}
              {recent.osebe.length === 0 && <li className="empty-small">Ni podatkov</li>}
            </ul>
          </section>
          <section className="recent-col">
            <h2>Podjetja z največ povezavami</h2>
            <ul className="list">
              {recent.podjetja.map(p => (
                <li key={p.id}>
                  <button className="list-btn" onClick={() => navigate(`/podjetje/${p.id}`)}>
                    <span>{p.popolno_ime}</span>
                    <span className="count">{p.stevilo_povezav}</span>
                  </button>
                </li>
              ))}
              {recent.podjetja.length === 0 && <li className="empty-small">Ni podatkov</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
