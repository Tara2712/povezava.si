import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { API } from '../api'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}

const SORT_OPTIONS = [
  { value: 'povezave', label: 'Največ oseb' },
  { value: 'az', label: 'A → Ž' },
  { value: 'za', label: 'Ž → A' },
]

const PAGE_SIZE = 40

export default function Podjetja() {
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 350)

  const [sort, setSort] = useState('povezave')
  const [page, setPage] = useState(0)

  const [podjetja, setPodjetja] = useState([])
  const [skupaj, setSkupaj] = useState(0)
  const [loading, setLoading] = useState(false)

  const isSearching = debouncedQ?.trim().length > 0

  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const fetchData = async () => {
      setLoading(true)
      setShowLoading(true)

      const params = new URLSearchParams()
      params.set('limit', PAGE_SIZE)
      params.set('offset', page * PAGE_SIZE)

      const query = debouncedQ?.trim()

      if (query) {
        params.set('q', query)
      } else {
        params.set('sort', sort)
      }

      try {
        const res = await fetch(`${API}/api/podjetja?${params}`, {
          signal: controller.signal,
        })

        const d = await res.json()

        setPodjetja(d.podjetja ?? [])
        setSkupaj(d.skupaj ?? 0)
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error(e)
        }
      } finally {
        setLoading(false)
        setTimeout(() => setShowLoading(false), 200)
      }
    }

    fetchData()

    return () => controller.abort()
  }, [debouncedQ, sort, page])

  const totalPages = Math.ceil(skupaj / PAGE_SIZE)

  return (
    <Layout>
      <div className="osebe-page">

        {/* filter panel*/}
        <aside className="osebe-filters">
          <div className="osebe-filters-head">Filtri</div>

          <label className="osebe-filter-label">Iskanje</label>
          <input
            className="osebe-filter-input"
            placeholder="Ime podjetja ali organizacije…"
            value={q}
            onChange={e => {
              setQ(e.target.value)
              setPage(0)
            }}
          />

          <button
            className="osebe-reset-btn"
            onClick={() => {
              setQ('')
              setSort('povezave')
              setPage(0)
            }}
          >
            Ponastavi filtre
          </button>
        </aside>

        {/* rezultati */}
        <main className="osebe-results">
          <div className="osebe-results-bar">
            <span className="osebe-count">
              {showLoading
                ? 'Nalagam podatke…'
                : `${skupaj.toLocaleString('sl-SI')} podjetij`}
            </span>

            <select
              className="osebe-sort-select"
              value={sort}
              onChange={e => {
                setSort(e.target.value)
                setPage(0)
              }}
              disabled={isSearching}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="osebe-grid">
            {podjetja.map(d => (
              <button
                key={d.id}
                className="osebe-card"
                onClick={() => navigate(`/podjetje/${d.id}`)}
              >
                <Avatar name={d.popolno_ime} size="lg" />

                <div className="osebe-card-body">
                  <div className="osebe-card-name">{d.popolno_ime}</div>

                  {d.pravna_oblika && (
                    <div className="osebe-card-sub">{d.pravna_oblika}</div>
                  )}

                  {d.posta && (
                    <div className="osebe-card-org">{d.posta}</div>
                  )}

                  <div className="osebe-card-conn">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>

                    {d.stevilo_povezav}{' '}
                    {d.stevilo_povezav == 1 ? 'oseba' : 'oseb'}
                  </div>
                </div>
              </button>
            ))}
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

              <span className="osebe-page-info">
                Stran {page + 1} / {totalPages}
              </span>

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

      <style>{`
        .osebe-card {
          border-radius: 16px;
          overflow: hidden;
        }
      `}</style>
    </Layout>
  )
}