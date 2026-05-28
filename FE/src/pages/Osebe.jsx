import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import ShareBtn from '../components/ShareBtn'
import { useSavedPersons, useComparison, useSearchHistory } from '../hooks/usePersonStorage'
import { API } from '../api'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

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

  const [tip, setTip]       = useState('')
  const [q, setQ]           = useState(() => searchParams.get('q') ?? '')
  const [minPov, setMinPov] = useState('')
  const [maxPov, setMaxPov] = useState('')
  const [sort, setSort]     = useState('povezave')
  const [page, setPage]     = useState(0)

  const [osebe, setOsebe]   = useState([])
  const [skupaj, getSkupaj] = useState(0)
  const [loading, setLoading] = useState(false)
  const { toggle, isSaved } = useSavedPersons()
  const { candidate, select: selectForCompare, clear: clearCompare } = useComparison()
  const { track: trackSearch } = useSearchHistory()

  const debouncedQ = useDebounce(q, 350)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', PAGE_SIZE)
    params.set('offset', page * PAGE_SIZE)
    params.set('sort', sort)
    if (tip)        params.set('tip', tip)
    if (debouncedQ) params.set('q', debouncedQ)
    if (minPov) params.set('min_povezave', minPov)
    if (maxPov) params.set('max_povezave', maxPov)

    fetch(`${API}/api/osebe?${params}`)
      .then(r => r.json())
      .then(d => {
        const rows = Array.isArray(d) ? d : (d.osebe ?? [])
        setOsebe(rows)
        if (!Array.isArray(d)) {
          getSkupaj(d.skupaj ?? 0)
        } else {
          fetch(`${API}/api/stats`).then(r => r.json()).then(s => getSkupaj(s.osebe ?? rows.length)).catch(() => getSkupaj(rows.length))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tip, debouncedQ, minPov, maxPov, sort, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (debouncedQ) trackSearch(debouncedQ) }, [debouncedQ])

  function reset() {
    setTip(''); setQ(''); setMinPov(''); setMaxPov('')
    setSort('povezave'); setPage(0)
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
                <div key={o.id} className="osebe-card-wrap">
                  <button
                    className={`osebe-card-save${isSaved(o.id) ? ' saved' : ''}`}
                    onClick={e => { e.stopPropagation(); toggle(o) }}
                    title={isSaved(o.id) ? 'Odstrani iz shranjenih' : 'Shrani'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved(o.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                  <button className="osebe-card" onClick={() => navigate(`/oseba/${o.id}`)}>
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
                  <div className="osebe-card-actions">
                    <Link className="osebe-card-omrezje" to={`/omrezje/${o.id}`}>Omrežje →</Link>
                    <Link className="osebe-card-ai" to={`/asistent?q=${encodeURIComponent(name)}`}>AI ✦</Link>
                    <div className="osebe-card-icons">
                      <ShareBtn url={`/oseba/${o.id}`} name={name} iconOnly />
                      {candidate?.id === o.id ? (
                        <button
                          className="osebe-card-icon-btn osebe-card-compare-icon picking"
                          onClick={e => { e.stopPropagation(); clearCompare() }}
                          title="Izbran — klikni drugo osebo"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                      ) : candidate ? (
                        <Link
                          className="osebe-card-icon-btn osebe-card-compare-icon"
                          to={`/primerjava?a=${candidate.id}&b=${o.id}`}
                          onClick={clearCompare}
                          title={`Primerjaj z ${candidate.ime} ${candidate.priimek}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        </Link>
                      ) : (
                        <button
                          className="osebe-card-icon-btn osebe-card-compare-icon"
                          onClick={e => { e.stopPropagation(); selectForCompare(o) }}
                          title="Primerjaj"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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
