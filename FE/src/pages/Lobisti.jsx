import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { API } from '../api'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI')
}

function LobistCard({ lobist, onClick }) {
  const name = `${lobist.ime} ${lobist.priimek}`
  const aktiven = !lobist.datum_izpisa
  return (
    <button className="register-card" onClick={onClick}>
      <Avatar name={name} size="sm" foto={lobist.fotografija_url} />
      <div className="register-card-body">
        <div className="register-card-name">{name}</div>
        {lobist.delodajalec && (
          <div className="register-card-sub">{lobist.delodajalec}</div>
        )}
        {lobist.narocnik && (
          <div className="register-card-sub2">Naročnik: {lobist.narocnik}</div>
        )}
      </div>
      <div className="register-card-right">
        {lobist.registrska_st && (
          <span className="register-card-reg">#{lobist.registrska_st}</span>
        )}
        <span className={`register-badge ${aktiven ? 'aktiven' : 'neaktiven'}`}>
          {aktiven ? 'Aktiven' : 'Izpisan'}
        </span>
        {lobist.datum_vpisa && (
          <span className="register-card-datum">{fmtDate(lobist.datum_vpisa)}</span>
        )}
      </div>
    </button>
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

export default function Lobisti() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [data, setData] = useState({ skupaj: 0, lobisti: [] })
  const [loading, setLoading] = useState(true)
  const dq = useDebounce(query, 300)

  useEffect(() => {
    setLoading(true)
    const url = `${API}/lobisti?limit=100${dq ? `&q=${encodeURIComponent(dq)}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ skupaj: 0, lobisti: [] }))
      .finally(() => setLoading(false))
  }, [dq])

  return (
    <Layout>
      <div className="register-page">
        <div className="register-header">
          <div className="register-header-left">
            <h1 className="register-title">
              <span className="register-icon">🤝</span>
              Register lobistov
            </h1>
            <p className="register-desc">
              Osebe vpisane v register lobistov pri Komisiji za preprečevanje korupcije (KPK).
            </p>
          </div>
          <div className="register-count-badge">
            {data.skupaj} {data.skupaj === 1 ? 'lobist' : 'lobistov'}
          </div>
        </div>

        <div className="register-search-wrap">
          <svg className="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="register-search"
            placeholder="Išči po imenu, delodajalcu, naročniku..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {loading ? (
          <p className="loading-msg">Nalagam...</p>
        ) : data.lobisti.length === 0 ? (
          <div className="register-empty">
            <div className="register-empty-icon">🤝</div>
            <p>{query ? `Ni rezultatov za "${query}"` : 'V bazi še ni lobistov. Podatki bodo dodani.'}</p>
          </div>
        ) : (
          <div className="register-list">
            {data.lobisti.map(l => (
              <LobistCard
                key={l.id}
                lobist={l}
                onClick={() => navigate(`/oseba/${l.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
