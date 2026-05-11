import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'

import { API } from '../api'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI')
}

export default function Oseba() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/osebe/${id}`)
      .then(r => { if (!r.ok) throw new Error('Oseba ni najdena'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [id])

  if (error) return <Layout><p className="error-msg">{error}</p></Layout>
  if (!data) return <Layout><p className="loading-msg">Nalagam...</p></Layout>

  const fullName = `${data.ime} ${data.priimek}`
  const first = data.povezave?.[0]

  return (
    <Layout>
      <button className="back-btn" onClick={() => navigate(-1)}>← Nazaj</button>

      <div className="profile-card">
        <div className="profile-top">
          <Avatar name={fullName} size="lg" />
          <div className="profile-info">
            <h1>{fullName}</h1>
            {first && <p className="prof-sub">{first.vloga} · {first.popolno_ime}</p>}
            {data.zadnja_posodobitev && (
              <p className="prof-updated">Zadnja posodobitev: {fmtDate(data.zadnja_posodobitev)}</p>
            )}
          </div>
        </div>

        {first && (
          <div className="profile-details">
            <div className="detail-item">
              <label>Vloga</label>
              <span>{first.vloga || '—'}</span>
            </div>
            <div className="detail-item">
              <label>Organizacija</label>
              <span>{first.popolno_ime || '—'}</span>
            </div>
            <div className="detail-item">
              <label>Obdobje</label>
              <span>
                {first.datum_od ? fmtDate(first.datum_od) : '?'}
                {' – '}
                {first.datum_do ? fmtDate(first.datum_do) : 'danes'}
              </span>
            </div>
            <div className="detail-item">
              <label>Vir</label>
              {first.vir?.startsWith('http')
                ? <a href={first.vir} target="_blank" rel="noopener">Odpri vir ↗</a>
                : <span>{first.vir || '—'}</span>}
            </div>
          </div>
        )}
      </div>

      <p className="section-title">Povezave ({data.povezave?.length || 0})</p>

      {data.povezave?.map((p, i) => (
        <Link key={i} className="conn-card" to={`/podjetje/${p.podjetje_id}`}>
          <Avatar name={p.popolno_ime || '?'} size="sm" />
          <div className="conn-body">
            <div className="conn-name">{p.popolno_ime}</div>
            {p.pravna_oblika && <div className="conn-sub">{p.pravna_oblika}</div>}
          </div>
          <span className="conn-tag">{p.vloga}</span>
        </Link>
      ))}

      {data.povezave?.length === 0 && <p className="empty-msg">Ni znanih povezav</p>}

      <Link className="open-network-btn" to={`/omrezje/${id}`}>
        Odpri v omrežju ↗
      </Link>
    </Layout>
  )
}
