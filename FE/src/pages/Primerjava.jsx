import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { API } from '../api'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI')
}

function fmtObdobje(od, do_) {
  if (!od && !do_) return '—'
  return `${od ? fmtDate(od) : '?'} – ${do_ ? fmtDate(do_) : 'danes'}`
}

export default function Primerjava() {
  const [searchParams] = useSearchParams()
  const aId = searchParams.get('a')
  const bId = searchParams.get('b')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!aId || !bId) {
      setError('Manjkata osebi za primerjavo.')
      setLoading(false)
      return
    }

    setLoading(true)

    fetch(`${API}/osebe/primerjaj?a=${aId}&b=${bId}`)
      .then(r => {
        if (!r.ok) throw new Error('Napaka pri nalaganju')
        return r.json()
      })
      .then(d => {
        if (
          !d ||
          !d.oseba_a ||
          !d.oseba_b ||
          !Array.isArray(d.skupna_podjetja)
        ) {
          throw new Error('Neveljaven odgovor strežnika')
        }

        setData(d)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [aId, bId])



  if (loading) return <Layout><p className="loading-msg">Nalagam primerjavo...</p></Layout>
  if (error)   return <Layout><p className="error-msg">{error}</p></Layout>

  const { oseba_a, oseba_b, skupna_podjetja } = data
  const nameA = `${oseba_a.ime} ${oseba_a.priimek}`
  const nameB = `${oseba_b.ime} ${oseba_b.priimek}`

  return (
    <Layout>
      <div className="prj-page">
        <h1 className="prj-title">Primerjava oseb</h1>

        <div className="prj-heads">
          <Link to={`/oseba/${oseba_a.id}`} className="prj-head">
            <Avatar name={nameA} size="lg" foto={oseba_a.fotografija_url} />
            <div className="prj-head-name">{nameA}</div>
            {oseba_a.institucija && <div className="prj-head-sub">{oseba_a.institucija}</div>}
          </Link>

          <div className="prj-vs">VS</div>

          <Link to={`/oseba/${oseba_b.id}`} className="prj-head">
            <Avatar name={nameB} size="lg" foto={oseba_b.fotografija_url} />
            <div className="prj-head-name">{nameB}</div>
            {oseba_b.institucija && <div className="prj-head-sub">{oseba_b.institucija}</div>}
          </Link>
        </div>

        <div className="prj-stats">
          <div className="prj-stat-row">
            <div className={`prj-stat-val${Number(oseba_a.stevilo_povezav) >= Number(oseba_b.stevilo_povezav) ? ' prj-winner' : ''}`}>
              {oseba_a.stevilo_povezav}
            </div>
            <div className="prj-stat-label">Število povezav</div>
            <div className={`prj-stat-val${Number(oseba_b.stevilo_povezav) >= Number(oseba_a.stevilo_povezav) ? ' prj-winner' : ''}`}>
              {oseba_b.stevilo_povezav}
            </div>
          </div>
          <div className="prj-stat-row">
            <div className="prj-stat-val">{skupna_podjetja.length}</div>
            <div className="prj-stat-label">Skupnih podjetij</div>
            <div className="prj-stat-val">{skupna_podjetja.length}</div>
          </div>
        </div>

        {skupna_podjetja.length > 0 ? (
          <section className="prj-shared">
            <h2 className="prj-shared-title">Skupna podjetja ({skupna_podjetja.length})</h2>
            <div className="prj-shared-list">
              {skupna_podjetja.map(p => (
                <div key={p.id} className="prj-shared-row">
                  <Link to={`/podjetje/${p.id}`} className="prj-company-name">{p.popolno_ime}</Link>
                  <span className="prj-company-type">{p.pravna_oblika}</span>
                  <div className="prj-roles">
                    <div className="prj-role prj-role-a">
                      <span className="prj-role-who">{oseba_a.priimek}</span>
                      <span className="prj-role-vloga">{p.vloga_a}</span>
                      <span className="prj-role-obdobje">{fmtObdobje(p.od_a, p.do_a)}</span>
                    </div>
                    <div className="prj-role prj-role-b">
                      <span className="prj-role-who">{oseba_b.priimek}</span>
                      <span className="prj-role-vloga">{p.vloga_b}</span>
                      <span className="prj-role-obdobje">{fmtObdobje(p.od_b, p.do_b)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="prj-no-shared">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>
            </svg>
            <p>Ti dve osebi nimata skupnih podjetij.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
