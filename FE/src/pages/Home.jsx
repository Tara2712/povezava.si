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
  const navigate = useNavigate()
  const dq = useDebounce(query, 300)

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

  return (
    <Layout>
      <div className="search-wrapper">
        <svg className="search-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {query.trim() && (
        <>
          <p className="search-label">
            {loading ? 'Iščem...' : `Rezultati iskanja: "${query}"`}
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
            {!loading && results.length === 0 && (
              <p className="empty-msg">Ni rezultatov za &ldquo;{query}&rdquo;</p>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
