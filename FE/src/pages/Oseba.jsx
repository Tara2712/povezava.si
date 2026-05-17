import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'

import { API } from '../api'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI')
}

function kratkoImeOrg(name) {
  if (!name) return ''
  if (name.includes('Univerza v Mariboru') && name.includes('elektrotehniko')) return 'UM FERI'
  if (name.includes('Univerza v Mariboru')) return 'UM'
  return name.length > 38 ? name.slice(0, 35) + '…' : name
}

export default function Oseba() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [clanki, setClanki] = useState([])
  const [expandedConn, setExpandedConn] = useState(null)

  useEffect(() => {
    fetch(`${API}/osebe/${id}`)
      .then(r => { if (!r.ok) throw new Error('Oseba ni najdena'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
    fetch(`${API}/osebe/${id}/clanki`)
      .then(r => r.json()).then(setClanki).catch(() => {})
  }, [id])

  if (error) return <Layout><p className="error-msg">{error}</p></Layout>
  if (!data) return <Layout><p className="loading-msg">Nalagam...</p></Layout>

  const fullName = `${data.ime} ${data.priimek}`
  const first = data.povezave?.[0]

  return (
    <Layout>
      <button className="back-btn" onClick={() => navigate('/')}>← Nazaj na iskanje</button>

      <div className="profile-card">
        <div className="profile-top">
          <Avatar name={fullName} size="lg" foto={data.fotografija_url} />
          <div className="profile-info">
            <h1>{fullName}</h1>
            {first && <p className="prof-sub">{first.vloga} · {kratkoImeOrg(first.popolno_ime)}</p>}
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
              <span>{kratkoImeOrg(first.popolno_ime) || '—'}</span>
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

        {data.tip === 'akademik' && (data.opis || data.podrocja) && (
          <div className="akademik-info">
            {data.opis && (
              <div className="akademik-vloga">{data.opis}</div>
            )}
            {data.podrocja && (
              <div className="akademik-podrocja">
                <div className="akademik-podrocja-label">Področja raziskovanja</div>
                <div className="akademik-podrocja-tags">
                  {data.podrocja.split(' · ').map((p, i) => (
                    <span key={i} className="akademik-tag">{p.trim()}</span>
                  ))}
                </div>
              </div>
            )}
            {data.profil_url && (
              <a className="akademik-profil-link" href={data.profil_url} target="_blank" rel="noopener">
                Odpri profil na ii.feri.um.si ↗
              </a>
            )}
          </div>
        )}
      </div>

      <p className="section-title">Povezave ({data.povezave?.length || 0})</p>

      {data.povezave?.map((p, i) => (
        <div key={i} className="conn-card-wrap">
          <div
            className={`conn-card${p.otroci?.length ? ' conn-card-expandable' : ''}`}
            onClick={() => {
              if (p.otroci?.length) {
                setExpandedConn(expandedConn === i ? null : i)
              } else {
                navigate(`/podjetje/${p.podjetje_id}`)
              }
            }}
          >
            <Avatar name={p.popolno_ime || '?'} size="sm" />
            <div className="conn-body">
              <div className="conn-name">{kratkoImeOrg(p.popolno_ime)}</div>
              {p.pravna_oblika && <div className="conn-sub">{p.pravna_oblika}</div>}
            </div>
            <span className="conn-tag">{p.vloga}</span>
            {p.otroci?.length > 0 && (
              <span className="conn-expand-icon">{expandedConn === i ? '▲' : '▼'}</span>
            )}
          </div>
          {p.otroci?.length > 0 && expandedConn === i && (
            <div className="conn-children">
              {p.otroci.map(otrok => (
                <Link key={otrok.id} className="conn-child-item" to={`/podjetje/${otrok.id}`}>
                  <span className="conn-child-dot" />
                  {otrok.ime}
                </Link>
              ))}
              <Link className="conn-child-open" to={`/podjetje/${p.podjetje_id}`}>
                Odpri profil organizacije →
              </Link>
            </div>
          )}
        </div>
      ))}

      {data.povezave?.length === 0 && <p className="empty-msg">Ni znanih povezav</p>}

      <Link className="open-network-btn" to={`/omrezje/${id}`}>
        Odpri v omrežju ↗
      </Link>

      {clanki.length > 0 && (
        <>
          <p className="section-title" style={{ marginTop: 24 }}>Omembe v medijih ({clanki.length})</p>
          <div className="clanki-grid">
            {clanki.map(c => (
              <a key={c.id} className="clanek-card" href={c.url} target="_blank" rel="noopener noreferrer">
                <div className="clanek-meta">
                  <span className="clanek-vir">{c.vir}</span>
                  <span className="clanek-datum">
                    {c.datum ? new Date(c.datum).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>
                <div className="clanek-naslov">{c.naslov}</div>
              </a>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
