import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSavedPersons, useRecentlyViewed, useSearchHistory } from '../hooks/usePersonStorage'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'

function PersonRow({ oseba, onRemove }) {
  const name = `${oseba.ime} ${oseba.priimek}`
  return (
    <div className="mp-person-row">
      <Link to={`/oseba/${oseba.id}`} className="mp-person-link">
        <Avatar name={name} size="sm" foto={oseba.fotografija_url} />
        <div className="mp-person-info">
          <span className="mp-person-name">{name}</span>
          {oseba.institucija && <span className="mp-person-sub">{oseba.institucija}</span>}
        </div>
      </Link>
      {onRemove && (
        <button className="mp-remove-btn" onClick={() => onRemove(oseba)} title="Odstrani">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default function MojProfil() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { saved, toggle } = useSavedPersons()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }
  const { recent } = useRecentlyViewed()
  const { history: searches, remove: removeSearch, clear: clearSearches } = useSearchHistory()

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Uporabnik'
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <Layout>
      <div className="mp-page">

        {/* ── Header ── */}
        <div className="mp-header">
          <div className="mp-avatar">{initials}</div>
          <div className="mp-header-info">
            <h1 className="mp-name">{displayName}</h1>
            <p className="mp-email">{user?.email}</p>
          </div>
          <button className="mp-logout-btn" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Odjava
          </button>
        </div>

        <div className="mp-grid">

          {/* ── Shranjene osebe ── */}
          <section className="mp-section">
            <div className="mp-section-head">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              Shranjene osebe
              <span className="mp-badge">{saved.length}</span>
            </div>
            {saved.length === 0
              ? <p className="mp-empty">Še nisi shranila nobene osebe. Na profilu ali v seznamu oseb klikni ikono zaznamka.</p>
              : saved.map(o => <PersonRow key={o.id} oseba={o} onRemove={toggle} />)
            }
          </section>

          {/* ── Nedavno ogledano ── */}
          <section className="mp-section">
            <div className="mp-section-head">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Nedavno ogledano
            </div>
            {recent.length === 0
              ? <p className="mp-empty">Še nisi ogledala nobenega profila.</p>
              : recent.map(o => <PersonRow key={o.id} oseba={o} />)
            }
          </section>

        </div>

        {/* ── Moje poizvedbe ── */}
        {searches.length > 0 && (
          <section className="mp-section mp-section-full">
            <div className="mp-section-head">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Moje poizvedbe
              <span className="mp-badge">{searches.length}</span>
              <button className="mp-clear-btn" onClick={clearSearches}>Počisti vse</button>
            </div>
            <div className="mp-searches">
              {searches.map(e => (
                <Link
                  key={e.q + e.ts}
                  to={`/osebe?q=${encodeURIComponent(e.q)}`}
                  className="mp-search-chip"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  {e.q}
                  <button
                    className="mp-search-remove"
                    onClick={ev => { ev.preventDefault(); removeSearch(e.q) }}
                    title="Odstrani"
                  >✕</button>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </Layout>
  )
}
