import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { API } from '../api'

function fmtDatum(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ClanekRow({ clanek }) {
  return (
    <a className="mediji-row" href={clanek.url} target="_blank" rel="noopener noreferrer">
      <div className="mediji-row-meta">
        <span className="clanek-vir">{clanek.vir}</span>
        <span className="mediji-row-datum">{fmtDatum(clanek.datum)}</span>
      </div>
      <div className="mediji-row-naslov">{clanek.naslov}</div>
      {clanek.osebe?.length > 0 && (
        <div className="mediji-row-osebe">
          {clanek.osebe.map(o => (
            <Link
              key={o.id}
              className="mediji-oseba-tag"
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

function useDebounce(val, ms) {
  const [d, setD] = useState(val)
  useEffect(() => {
    const t = setTimeout(() => setD(val), ms)
    return () => clearTimeout(t)
  }, [val, ms])
  return d
}

const PAGE = 20

export default function Mediji() {
  const [query, setQuery]   = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData]     = useState({ skupaj: 0, clanki: [] })
  const [loading, setLoading] = useState(true)
  const dq = useDebounce(query, 300)
  const topRef = useRef(null)

  useEffect(() => {
    setOffset(0)
  }, [dq])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: PAGE, offset })
    if (dq) params.set('q', dq)
    fetch(`${API}/clanki?${params}`)
      .then(r => r.json())
      .then(d => setData({ skupaj: d.skupaj ?? 0, clanki: d.clanki ?? [] }))
      .catch(() => setData({ skupaj: 0, clanki: [] }))
      .finally(() => setLoading(false))
  }, [dq, offset])

  function changePage(newOffset) {
    setOffset(newOffset)
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const totalPages = Math.ceil(data.skupaj / PAGE)
  const currentPage = Math.floor(offset / PAGE) + 1

  return (
    <Layout>
      <div className="mediji-page" ref={topRef}>
        <div className="mediji-header">
          <div>
            <h1 className="mediji-title">
              <span>📰</span> V medijih
            </h1>
            <p className="mediji-desc">Omembe oseb in podjetij v slovenskih medijih</p>
          </div>
          <span className="mediji-count">{data.skupaj} objav</span>
        </div>

        <div className="register-search-wrap" style={{ marginBottom: 20 }}>
          <svg className="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="register-search"
            placeholder="Išči po naslovu, osebi ali ključnih besedah..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {loading ? (
          <p className="loading-msg">Nalagam...</p>
        ) : data.clanki.length === 0 ? (
          <div className="register-empty">
            <div className="register-empty-icon">📰</div>
            <p>{query ? `Ni rezultatov za "${query}"` : 'Ni objav.'}</p>
          </div>
        ) : (
          <>
            <div className="mediji-list">
              {data.clanki.map(c => <ClanekRow key={c.id} clanek={c} />)}
            </div>

            {totalPages > 1 && (
              <div className="mediji-pagination">
                <button
                  className="mediji-page-btn"
                  disabled={offset === 0}
                  onClick={() => changePage(Math.max(0, offset - PAGE))}
                >← Prejšnja</button>
                <span className="mediji-page-info">{currentPage} / {totalPages}</span>
                <button
                  className="mediji-page-btn"
                  disabled={offset + PAGE >= data.skupaj}
                  onClick={() => changePage(offset + PAGE)}
                >Naslednja →</button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
