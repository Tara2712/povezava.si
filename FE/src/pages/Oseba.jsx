import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { useSavedPersons, useRecentlyViewed, useComparison } from '../hooks/usePersonStorage'
import { API } from '../api'

function fmtDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('sl-SI')
}

const ND = <span className="nd">ni podatka</span>

export default function Oseba() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [clanki, setClanki] = useState([])
  const [povFilter, setPovFilter] = useState('')
  const { toggle, isSaved } = useSavedPersons()
  const { track } = useRecentlyViewed()
  const { candidate, select: selectForCompare, clear: clearCompare } = useComparison()

  useEffect(() => {
    fetch(`${API}/osebe/${id}`)
      .then(r => { if (!r.ok) throw new Error('Oseba ni najdena'); return r.json() })
      .then(d => { setData(d); setPovFilter(''); track(d) })
      .catch(e => setError(e.message))
    fetch(`${API}/osebe/${id}/clanki`)
      .then(r => r.json()).then(setClanki).catch(() => {})
  }, [id])

  if (error) return <Layout><p className="error-msg">{error}</p></Layout>
  if (!data) return <Layout><p className="loading-msg">Nalagam...</p></Layout>

  const fullName = `${data.ime} ${data.priimek}`
  const first = data.povezave?.[0]

  const vrsteOrg = [...new Set(
    (data.povezave ?? []).map(p => p.pravna_oblika).filter(Boolean)
  )]

  const vidnePovezave = (data.povezave ?? []).filter(p =>
    !povFilter || p.pravna_oblika === povFilter
  )

  return (
    <Layout>
      <button className="back-btn" onClick={() => navigate(-1)}>← Nazaj</button>

      <div className="profile-card">
        <div className="profile-top">
          <Avatar name={fullName} size="lg" foto={data.fotografija_url} />
          <div className="profile-info">
            <h1>{fullName}</h1>
            {first && <p className="prof-sub">{first.vloga} · {first.popolno_ime}</p>}
            {data.zadnja_posodobitev && (
              <p className="prof-updated">Zadnja posodobitev: {fmtDate(data.zadnja_posodobitev)}</p>
            )}
            <div className="prof-action-btns">
              <Link className="prof-btn prof-btn-network" to={`/omrezje/${id}`}>Odpri v omrežju ↗</Link>
              <Link className="prof-btn prof-btn-ai" to={`/asistent?q=${encodeURIComponent(fullName)}`}>Vprašaj AI ✦</Link>
              <button
                className={`prof-btn prof-btn-save${isSaved(data.id) ? ' saved' : ''}`}
                onClick={() => toggle(data)}
                title={isSaved(data.id) ? 'Odstrani iz shranjenih' : 'Shrani osebo'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved(data.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                {isSaved(data.id) ? 'Shranjeno' : 'Shrani'}
              </button>
              {candidate && candidate.id !== data.id ? (
                <Link
                  className="prof-btn prof-btn-compare"
                  to={`/primerjava?a=${candidate.id}&b=${data.id}`}
                  onClick={clearCompare}
                >
                  ⇄ Primerjaj z {candidate.ime} {candidate.priimek}
                </Link>
              ) : (
                <button
                  className={`prof-btn prof-btn-compare-pick${candidate?.id === data.id ? ' active' : ''}`}
                  onClick={() => candidate?.id === data.id ? clearCompare() : selectForCompare(data)}
                >
                  ⇄ {candidate?.id === data.id ? 'Prekliči primerjavo' : 'Primerjaj'}
                </button>
              )}
            </div>
          </div>
        </div>

        {first && (
          <div className="profile-details">
            <div className="detail-item">
              <label>Vloga</label>
              <span>{first.vloga || ND}</span>
            </div>
            <div className="detail-item">
              <label>Organizacija</label>
              <span>{first.popolno_ime || ND}</span>
            </div>
            <div className="detail-item">
              <label>Obdobje</label>
              <span>
                {first.datum_od ? fmtDate(first.datum_od) : ND}
                {first.datum_od || first.datum_do ? ' – ' : ''}
                {first.datum_do ? fmtDate(first.datum_do) : first.datum_od ? 'danes' : ''}
              </span>
            </div>
            <div className="detail-item">
              <label>Pravna oblika</label>
              <span>{first.pravna_oblika || ND}</span>
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

      <div className="section-title-row">
        <p className="section-title">Povezave ({data.povezave?.length || 0})</p>
        {vrsteOrg.length > 1 && (
          <div className="conn-filter-pills">
            <button
              className={`conn-filter-pill${povFilter === '' ? ' active' : ''}`}
              onClick={() => setPovFilter('')}
            >
              Vse
            </button>
            {vrsteOrg.map(v => (
              <button
                key={v}
                className={`conn-filter-pill${povFilter === v ? ' active' : ''}`}
                onClick={() => setPovFilter(v)}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {vidnePovezave.map((p, i) => (
        <Link key={i} className="conn-card" to={`/podjetje/${p.podjetje_id}`}>
          <Avatar name={p.popolno_ime || '?'} size="sm" />
          <div className="conn-body">
            <div className="conn-name">{p.popolno_ime}</div>
            {p.pravna_oblika && <div className="conn-sub">{p.pravna_oblika}</div>}
          </div>
          <span className="conn-tag">{p.vloga}</span>
        </Link>
      ))}

      {vidnePovezave.length === 0 && (
        <p className="empty-msg">
          {povFilter ? `Ni povezav tipa "${povFilter}"` : 'Ni znanih povezav'}
        </p>
      )}

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
