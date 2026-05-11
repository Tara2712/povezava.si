import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'

const API = 'http://localhost:3000'

export default function Oseba() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/osebe/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Oseba ni najdena')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
  }, [id])

  if (error) return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>← Nazaj</button>
      <p className="error">{error}</p>
    </div>
  )

  if (!data) return (
    <div className="page">
      <div className="loading">Nalagam...</div>
    </div>
  )

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>← Nazaj</button>

      <div className="profile-header">
        <span className="badge badge-oseba">Oseba</span>
        <h1 className="profile-name">{data.ime} {data.priimek}</h1>
        {data.datum_rojstva && (
          <p className="profile-meta">Datum rojstva: {new Date(data.datum_rojstva).toLocaleDateString('sl-SI')}</p>
        )}
      </div>

      <section className="connections">
        <h2>Poslovne povezave ({data.povezave?.length || 0})</h2>
        {data.povezave?.length === 0 && <p className="empty">Ni znanih povezav</p>}
        <div className="connection-list">
          {data.povezave?.map((p, i) => (
            <Link key={i} className="connection-card" to={`/podjetje/${p.podjetje_id}`}>
              <div className="conn-main">
                <span className="conn-name">{p.popolno_ime}</span>
                {p.pravna_oblika && <span className="conn-sub">{p.pravna_oblika}</span>}
              </div>
              <div className="conn-meta">
                <span className="conn-vloga">{p.vloga}</span>
                {p.datum_od && <span className="conn-dates">od {formatDate(p.datum_od)}{p.datum_do ? ` do ${formatDate(p.datum_do)}` : ''}</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('sl-SI')
}
