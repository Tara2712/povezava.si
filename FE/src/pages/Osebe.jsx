import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { API } from '../api'

const TIP_OPTIONS = [
  { value: '', label: 'Vse' },
  { value: 'poslovnez', label: 'Poslovnež' },
  { value: 'akademik', label: 'Akademik' },
  { value: 'politik', label: 'Politik' },
]

const SORT_OPTIONS = [
  { value: 'povezave', label: 'Največ povezav' },
  { value: 'az', label: 'A → Ž' },
  { value: 'za', label: 'Ž → A' },
]

const PAGE_SIZE = 40

export default function Osebe() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [tip, setTip]           = useState('')
  const [q, setQ]               = useState(() => searchParams.get('q') ?? '')
  const [minPov, setMinPov]     = useState('')
  const [maxPov, setMaxPov]     = useState('')
  const [lobisti, setLobisti]   = useState(false)
  const [ovadeni, setOvadeni]   = useState(false)
  const [sort, setSort]         = useState('povezave')
  const [page, setPage]         = useState(0)

  const [osebe, setOsebe]       = useState([])
  const [skupaj, getSkupaj]     = useState(0)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', PAGE_SIZE)
    params.set('offset', page * PAGE_SIZE)
    params.set('sort', sort)
    if (tip)    params.set('tip', tip)
    if (q)      params.set('q', q)
    if (minPov) params.set('min_povezave', minPov)
    if (maxPov) params.set('max_povezave', maxPov)
    if (lobisti) params.set('lobisti', '1')
    if (ovadeni) params.set('ovadeni', '1')

    fetch(`${API}/api/osebe?${params}`)
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d) ? d : (d.osebe ?? [])
        const total = Array.isArray(d) ? d.length : (d.skupaj ?? 0)
        setOsebe(rows)
        getSkupaj(total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tip, q, minPov, maxPov, lobisti, ovadeni, sort, page])

  useEffect(() => { load() }, [load])

  function applyFilters() {
    setPage(0)
    load()
  }

  function reset() {
    setTip(''); setQ(''); setMinPov(''); setMaxPov('')
    setLobisti(false); setOvadeni(false); setSort('povezave'); setPage(0)
  }

  const totalPages = Math.ceil(skupaj / PAGE_SIZE)

  return (
    <Layout>
      <div className="osebe-page">

        {/* ── FILTER PANEL ── */}
        <aside className="osebe-filters">
          <div className="osebe-filters-head">Filtri</div>

          <label className="osebe-filter-label">Iskanje</label>
          <input
            className="osebe-filter-input"
            placeholder="Ime, priimek, institucija…"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(0) }}
          />

          <label className="osebe-filter-label">Tip entitete</label>
          <div className="osebe-tip-pills">
            {TIP_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`osebe-tip-pill${tip === o.value ? ' active' : ''}`}
                onClick={() => { setTip(o.value); setPage(0) }}
              >
                {o.label}
              </button>
            ))}
          </div>

          <label className="osebe-filter-label">Število povezav</label>
          <div className="osebe-range-row">
            <input
              className="osebe-filter-input"
              type="number"
              placeholder="Min"
              min="0"
              value={minPov}
              onChange={e => { setMinPov(e.target.value); setPage(0) }}
            />
            <span className="osebe-range-dash">–</span>
            <input
              className="osebe-filter-input"
              type="number"
              placeholder="Max"
              min="0"
              value={maxPov}
              onChange={e => { setMaxPov(e.target.value); setPage(0) }}
            />
          </div>

          <label className="osebe-filter-label">Posebni registri</label>
          <label className="osebe-checkbox-row">
            <input type="checkbox" checked={lobisti} onChange={e => { setLobisti(e.target.checked); setPage(0) }} />
            Lobisti (KPK)
          </label>
          <label className="osebe-checkbox-row">
            <input type="checkbox" checked={ovadeni} onChange={e => { setOvadeni(e.target.checked); setPage(0) }} />
            Kazensko ovadeni
          </label>

          <button className="osebe-reset-btn" onClick={reset}>Ponastavi filtre</button>
        </aside>

        {/* ── RESULTS ── */}
        <main className="osebe-results">
          <div className="osebe-results-bar">
            <span className="osebe-count">
              {loading ? 'Nalagam…' : `${skupaj.toLocaleString('sl-SI')} oseb`}
            </span>
            <select
              className="osebe-sort-select"
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(0) }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="osebe-grid">
            {osebe.map(o => {
              const name = `${o.ime} ${o.priimek}`
              return (
                <button key={o.id} className="osebe-card" onClick={() => navigate(`/oseba/${o.id}`)}>
                  <Avatar name={name} size="lg" foto={o.fotografija_url} />
                  <div className="osebe-card-body">
                    <div className="osebe-card-name">{name}</div>
                    {o.naziv && <div className="osebe-card-sub">{o.naziv}</div>}
                    {o.institucija && <div className="osebe-card-org">{o.institucija}</div>}
                    <div className="osebe-card-conn">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      {o.stevilo_povezav} {o.stevilo_povezav == 1 ? 'povezava' : 'povezav'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="osebe-pagination">
              <button
                className="osebe-page-btn"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                ← Prej
              </button>
              <span className="osebe-page-info">Stran {page + 1} / {totalPages}</span>
              <button
                className="osebe-page-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Naprej →
              </button>
            </div>
          )}
        </main>

      </div>
    </Layout>
  )
}
