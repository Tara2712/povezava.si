import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'

const API = 'http://localhost:3000'

export default function Podjetje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/podjetja/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Podjetje ni najdeno')
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
        <span className="badge badge-podjetje">Podjetje</span>
        <h1 className="profile-name">{data.popolno_ime}</h1>
        <div className="profile-meta-row">
          {data.pravna_oblika && <span className="meta-chip">{data.pravna_oblika}</span>}
          {data.posta && <span className="meta-chip">{data.posta}</span>}
          {data.maticna && !data.maticna.startsWith('AI-') && (
            <span className="meta-chip">MŠ: {data.maticna}</span>
          )}
        </div>
      </div>

      <section className="connections">
        <h2>Povezane osebe ({data.osebe?.length || 0})</h2>
        {data.osebe?.length === 0 && <p className="empty">Ni znanih oseb</p>}
        <div className="connection-list">
          {data.osebe?.map((o, i) => (
            <Link key={i} className="connection-card" to={`/oseba/${o.oseba_id}`}>
              <div className="conn-main">
                <span className="conn-name">{o.ime} {o.priimek}</span>
              </div>
              <div className="conn-meta">
                <span className="conn-vloga">{o.vloga}</span>
                {o.datum_od && <span className="conn-dates">od {formatDate(o.datum_od)}{o.datum_do ? ` do ${formatDate(o.datum_do)}` : ''}</span>}
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
