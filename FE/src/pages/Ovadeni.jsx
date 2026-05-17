import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { API } from '../api'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI')
}

const STATUS_COLORS = {
  'obtožen':     { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'obsojen':     { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  'oproščen':    { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  'v postopku':  { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
}

function OvadenecCard({ oseba, onClick }) {
  const name = `${oseba.ime} ${oseba.priimek}`
  const style = STATUS_COLORS[oseba.status?.toLowerCase()] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }
  return (
    <button className="register-card ovadeni-card" onClick={oseba.oseba_id ? onClick : undefined}
      style={{ cursor: oseba.oseba_id ? 'pointer' : 'default' }}>
      <div className="ovadeni-initials" style={{ background: '#6366f130' }}>
        {name.split(' ').map(w => w[0]).slice(0, 2).join('')}
      </div>
      <div className="register-card-body">
        <div className="register-card-name">{name}</div>
        {oseba.zadeva && <div className="register-card-sub">{oseba.zadeva}</div>}
        {oseba.sodisce && <div className="register-card-sub2">{oseba.sodisce}</div>}
      </div>
      <div className="register-card-right">
        {oseba.status && (
          <span className="register-badge" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
            {oseba.status}
          </span>
        )}
        {oseba.datum && (
          <span className="register-card-datum">{fmtDate(oseba.datum)}</span>
        )}
        {oseba.vir_url && (
          <a className="register-vir-link" href={oseba.vir_url} target="_blank" rel="noopener"
            onClick={e => e.stopPropagation()}>
            Vir ↗
          </a>
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

const STATUSI = ['', 'v postopku', 'obtožen', 'obsojen', 'oproščen']

export default function Ovadeni() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [data, setData] = useState({ skupaj: 0, ovadeni: [] })
  const [loading, setLoading] = useState(true)
  const dq = useDebounce(query, 300)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: 100 })
    if (dq) params.set('q', dq)
    if (status) params.set('status', status)
    fetch(`${API}/ovadeni?${params}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ skupaj: 0, ovadeni: [] }))
      .finally(() => setLoading(false))
  }, [dq, status])

  return (
    <Layout>
      <div className="register-page">
        <div className="register-header">
          <div className="register-header-left">
            <h1 className="register-title">
              <span className="register-icon">⚖️</span>
              Register kazensko ovadenih
            </h1>
            <p className="register-desc">
              Osebe zoper katere je bila vložena kazenska ovadba ali so bile obsojene s pravnomočno sodbo.
            </p>
          </div>
          <div className="register-count-badge ovadeni-badge">
            {data.skupaj} {data.skupaj === 1 ? 'oseba' : 'oseb'}
          </div>
        </div>

        <div className="register-toolbar">
          <div className="register-search-wrap">
            <svg className="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="register-search"
              placeholder="Išči po imenu, zadevi, sodišču..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="register-filter-row">
            {STATUSI.map(s => (
              <button
                key={s || 'vse'}
                className={`register-filter-btn${status === s ? ' active' : ''}`}
                onClick={() => setStatus(s)}
              >
                {s || 'Vsi statusi'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="loading-msg">Nalagam...</p>
        ) : data.ovadeni.length === 0 ? (
          <div className="register-empty">
            <div className="register-empty-icon">⚖️</div>
            <p>{query || status ? 'Ni rezultatov za izbrane filtre.' : 'V bazi še ni vnosov. Podatki bodo dodani.'}</p>
          </div>
        ) : (
          <div className="register-list">
            {data.ovadeni.map(o => (
              <OvadenecCard
                key={o.id}
                oseba={o}
                onClick={() => navigate(`/oseba/${o.oseba_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
