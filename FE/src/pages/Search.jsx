// SearchResultsPage.jsx

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import './serch.css'
import ShareBtn from '../components/ShareBtn'
import { useComparison } from '../hooks/usePersonStorage'

const API = import.meta.env.VITE_API_URL

export default function SearchResultsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { candidate, select: selectForCompare, clear: clearCompare } = useComparison()

  const query = useMemo(() => {
    return new URLSearchParams(location.search).get('q') || ''
  }, [location.search])

  const [loading, setLoading] = useState(true)
  const [osebe, setOsebe] = useState([])
  const [podjetja, setPodjetja] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query.trim()) return

    async function fetchResults() {
      try {
        setLoading(true)
        setError('')

        const params = new URLSearchParams({
          q: query,
          limit: 6,
        })

        const [osebeRes, podjetjaRes] = await Promise.all([
          fetch(`${API}/api/osebe?${params}`),
          fetch(`${API}/api/podjetja?${params}`),
        ])

        if (!osebeRes.ok || !podjetjaRes.ok) {
          throw new Error('Napaka pri pridobivanju podatkov')
        }

        const osebeData = await osebeRes.json()
        const podjetjaData = await podjetjaRes.json()

        setOsebe(
          Array.isArray(osebeData)
            ? osebeData
            : osebeData.osebe || []
        )

        setPodjetja(
          Array.isArray(podjetjaData)
            ? podjetjaData
            : podjetjaData.podjetja || []
        )
      } catch (err) {
        console.error(err)
        setError('Prišlo je do napake pri iskanju.')
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query])

  return (
    <Layout>
      <div className="search-page">
        <div className="search-page-container">

          <h1 className="search-title">
            Rezultati za <span>"{query}"</span>
          </h1>

          {loading && (
            <div className="search-loading">
              Nalaganje rezultatov...
            </div>
          )}

          {error && (
            <div className="search-error">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* OSEBE */}
              <section className="search-section">

                <div className="search-section-head">
                  <div className="search-section-title">
                    Top 6 rezultati — osebe
                  </div>

                  {osebe.length > 0 && (
                    <button
                      className="search-more-btn"
                      onClick={() =>
                        navigate(`/osebe?q=${encodeURIComponent(query)}`)
                      }
                    >
                      Poglej vse rezultate →
                    </button>
                  )}
                </div>

                <div className="search-grid-full">
                  {osebe.length === 0 ? (
                    <div className="search-empty">
                      Ni najdenih oseb.
                    </div>
                  ) : (
                    osebe.slice(0, 6).map((o) => {
                    const name = `${o.ime} ${o.priimek}`

                    return (
                        <div key={o.id} className="osebe-card-wrap" >
                        <button
                            className="osebe-card"
                            style={{
                            borderRadius: "22px 22px 0 0",
                            overflow: "hidden"
                          }}
                            onClick={() => navigate(`/oseba/${o.id}`)}
                        >
                            <Avatar
                            name={name}
                            size="lg"
                            foto={o.fotografija_url}
                            />

                            <div className="osebe-card-body">
                            <div className="osebe-card-name">
                                {name}
                            </div>

                            {o.naziv && (
                                <div className="osebe-card-sub">
                                {o.naziv}
                                </div>
                            )}

                            {o.institucija && (
                                <div className="osebe-card-org">
                                {o.institucija}
                                </div>
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
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                </svg>

                                {o.stevilo_povezav}{' '}
                                {o.stevilo_povezav == 1
                                ? 'povezava'
                                : 'povezav'}
                            </div>
                            </div>
                        </button>

                        <div className="osebe-card-actions">
                            <Link
                            className="osebe-card-omrezje"
                            to={`/omrezje/${o.id}`} style={{ fontSize: '10px' }}
                            >
                            Omrežje →
                            </Link>

                            <Link
                            className="osebe-card-ai"
                            to={`/asistent?q=${encodeURIComponent(name)}`}
                            >
                            AI ✦
                            </Link>

                            <div className="osebe-card-icons">
                            <ShareBtn
                                url={`/oseba/${o.id}`}
                                name={name}
                                iconOnly
                            />

                            {candidate && candidate.id !== o.id ? (
                                <Link
                                className="osebe-card-icon-btn osebe-card-compare-icon active"
                                to={`/primerjava?a=${candidate.id}&b=${o.id}`}
                                onClick={clearCompare}
                                title={`Primerjaj z ${candidate.ime} ${candidate.priimek}`}
                                >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                >
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                </Link>
                            ) : (
                                <button
                                className={`osebe-card-icon-btn osebe-card-compare-icon${
                                    candidate?.id === o.id ? ' picking' : ''
                                }`}
                                onClick={e => {
                                    e.stopPropagation()

                                    candidate?.id === o.id
                                    ? clearCompare()
                                    : selectForCompare(o)
                                }}
                                title={
                                    candidate?.id === o.id
                                    ? 'Izbran — klikni drugo osebo'
                                    : 'Primerjaj'
                                }
                                >
                                {candidate?.id === o.id ? (
                                    <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    >
                                    <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                ) : (
                                    <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    >
                                    <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/>
                                    <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>
                                    <line x1="12" y1="8" x2="12" y2="16"/>
                                    <line x1="8" y1="12" x2="16" y2="12"/>
                                    </svg>
                                )}
                                </button>
                            )}
                            </div>
                        </div>
                        </div>
                    )
                    })
                  )}
                </div>
              </section>

              {/* PODJETJA */}
              <section className="search-section">

                <div className="search-section-head">
                  <div className="search-section-title">
                    Top 6 rezultati — podjetja
                  </div>

                  {podjetja.length > 0 && (
                    <button
                      className="search-more-btn"
                      onClick={() =>
                        navigate(`/podjetja?q=${encodeURIComponent(query)}`)
                      }
                    >
                      Poglej vse rezultate →
                    </button>
                  )}
                </div>

                <div className="search-grid-full">
                  {podjetja.length === 0 ? (
                    <div className="search-empty">
                      Ni najdenih podjetij.
                    </div>
                  ) : (
                    podjetja.slice(0, 6).map((d) => (
                      <button
                        key={d.id}
                        className="osebe-card search-card-full"
                        onClick={() => navigate(`/podjetje/${d.id}`)}
                      >
                        <Avatar
                          name={d.popolno_ime}
                          size="lg"
                        />

                        <div className="osebe-card-body">
                          <div className="osebe-card-name">
                            {d.popolno_ime}
                          </div>

                          {d.pravna_oblika && (
                            <div className="osebe-card-sub">
                              {d.pravna_oblika}
                            </div>
                          )}

                          {d.posta && (
                            <div className="osebe-card-org">
                              {d.posta}
                            </div>
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
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                              <circle cx="9" cy="7" r="4"/>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>

                            {d.stevilo_povezav} oseb
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}