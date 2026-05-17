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

const LETA_PRIHODNOST = [2027, 2028, 2029]

export default function Mediji() {
  const [query, setQuery]     = useState('')
  const [data, setData]       = useState({ skupaj: 0, clanki: [] })
  const [loading, setLoading] = useState(true)
  const dq = useDebounce(query, 300)
  const topRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: 200 })
    if (dq) params.set('q', dq)
    fetch(`${API}/clanki?${params}`)
      .then(r => r.json())
      .then(d => setData({ skupaj: d.skupaj ?? 0, clanki: d.clanki ?? [] }))
      .catch(() => setData({ skupaj: 0, clanki: [] }))
      .finally(() => setLoading(false))
  }, [dq])

  // Razvrsti po letih
  const poLetih = {}
  for (const c of data.clanki) {
    const leto = c.datum ? new Date(c.datum).getFullYear() : 'Neznan datum'
    if (!poLetih[leto]) poLetih[leto] = []
    poLetih[leto].push(c)
  }
  const letoSorted = Object.keys(poLetih).sort((a, b) => b - a)
  const tekoceLetο = new Date().getFullYear()

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

        <div className="register-search-wrap" style={{ marginBottom: 28 }}>
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
        ) : (
          <div className="mediji-timeline">

            {/* Dejanska leta z objavami */}
            {letoSorted.map(leto => {
              const jeTekoce = parseInt(leto) === tekoceLetο
              const jePreteklost = parseInt(leto) < tekoceLetο
              return (
                <div key={leto} className={`mediji-leto-skupina ${jeTekoce ? 'tekoce' : jePreteklost ? 'preteklost' : ''}`}>
                  <div className="mediji-leto-header">
                    <span className="mediji-leto-badge">{leto}</span>
                    <span className="mediji-leto-count">{poLetih[leto].length} objav</span>
                  </div>
                  <div className="mediji-leto-list">
                    {poLetih[leto].map(c => <ClanekRow key={c.id} clanek={c} />)}
                  </div>
                </div>
              )
            })}

            {/* Prihodnja leta — sivа placeholderji */}
            {!dq && LETA_PRIHODNOST.filter(l => l > tekoceLetο).map(leto => (
              <div key={leto} className="mediji-leto-skupina prihodnost">
                <div className="mediji-leto-header">
                  <span className="mediji-leto-badge">{leto}</span>
                  <span className="mediji-leto-count mediji-kmalu">— objave bodo dodane</span>
                </div>
                <div className="mediji-leto-placeholder">
                  <div className="mediji-placeholder-bar" style={{ width: '65%' }} />
                  <div className="mediji-placeholder-bar" style={{ width: '80%' }} />
                  <div className="mediji-placeholder-bar" style={{ width: '50%' }} />
                </div>
              </div>
            ))}

            {data.clanki.length === 0 && (
              <div className="register-empty">
                <div className="register-empty-icon">📰</div>
                <p>{dq ? `Ni rezultatov za "${dq}"` : 'Ni objav.'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
