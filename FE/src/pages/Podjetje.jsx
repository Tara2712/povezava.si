import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { generatePodjetjePdf } from '../utils/generatePodjetjePdf'

import { API } from '../api'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI')
}

export default function Podjetje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${API}/podjetja/${id}`)
      .then(r => { if (!r.ok) throw new Error('Podjetje ni najdeno'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [id])

  if (error) return <Layout><p className="error-msg">{error}</p></Layout>
  if (!data) return <Layout><p className="loading-msg">Nalagam...</p></Layout>

  const first = data.osebe?.[0]

  return (
    <Layout>
      <button className="back-btn" onClick={() => navigate(-1)}>← Nazaj</button>

      <div className="profile-card">
        <div className="profile-top">
          <Avatar name={data.popolno_ime || '?'} size="lg" />
          <div className="profile-info">
            <h1>{data.popolno_ime}</h1>
            {data.pravna_oblika && <p className="prof-sub">{data.pravna_oblika}</p>}
            {data.posta && <p className="prof-updated">{data.posta}</p>}
          </div>
          <button className="prof-btn prof-btn-pdf" onClick={() => generatePodjetjePdf(data)}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 15h6" />
                  <path d="M9 11h6" />
                </svg>
                Prenesi PDF
              </button>
        </div>
        {first && (
          <div className="profile-details">
            <div className="detail-item">
              <label>Zastopnik</label>
              <span>{first.ime} {first.priimek}</span>
            </div>
            <div className="detail-item">
              <label>Vloga</label>
              <span>{first.vloga || '—'}</span>
            </div>
            {data.maticna && !data.maticna.startsWith('AI-') && (
              <div className="detail-item">
                <label>Matična številka</label>
                <span>{data.maticna}</span>
              </div>
            )}
            <div className="detail-item">
              <label>Vir</label>
              {first.vir?.startsWith('http')
                ? <a href={first.vir} target="_blank" rel="noopener">Odpri vir ↗</a>
                : <span>{first.vir || '—'}</span>}
            </div>
          </div>
        )}
      </div>

      <p className="section-title">Povezane osebe ({data.osebe?.length || 0})</p>

      {data.osebe?.map((o, i) => (
        <Link key={i} className="conn-card" to={`/oseba/${o.oseba_id}`}>
          <Avatar name={`${o.ime} ${o.priimek}`} size="sm" />
          <div className="conn-body">
            <div className="conn-name">{o.ime} {o.priimek}</div>
            {o.datum_od && <div className="conn-sub">od {fmtDate(o.datum_od)}</div>}
          </div>
          <span className="conn-tag conn-tag-green">{o.vloga}</span>
        </Link>
      ))}

      {data.osebe?.length === 0 && <p className="empty-msg">Ni znanih oseb</p>}
    </Layout>
  )
}
