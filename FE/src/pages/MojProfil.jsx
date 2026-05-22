import { useState, useRef } from 'react'
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
  const { user, logout, updateUserProfile, updateUserEmail, updateUserPassword } = useAuth()
  const navigate = useNavigate()
  const { saved, toggle } = useSavedPersons()
  const { recent } = useRecentlyViewed()
  const { history: searches, remove: removeSearch, clear: clearSearches } = useSearchHistory()
  const fileRef = useRef(null)

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Uporabnik'
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(displayName)
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setError('')
    setSuccess('')
    if (password && password !== password2) {
      setError('Gesli se ne ujemata.')
      return
    }
    if (password && password.length < 6) {
      setError('Geslo mora imeti vsaj 6 znakov.')
      return
    }
    setSaving(true)
    try {
      await updateUserProfile({ displayName: name, photoFile })
      if (email !== user.email) await updateUserEmail(email)
      if (password) await updateUserPassword(password)
      setSuccess('Profil posodobljen.')
      setEditing(false)
      setPassword('')
      setPassword2('')
      setPhotoFile(null)
      setPhotoPreview(null)
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        setError('Odjavi se in se znova prijavi, nato poskusi znova.')
      } else {
        setError(e.message || 'Napaka pri shranjevanju.')
      }
    } finally {
      setSaving(false)
    }
  }

  const currentPhoto = photoPreview || user?.photoURL || null

  return (
    <Layout>
      <div className="mp-page">

        {/* ── Header ── */}
        <div className="mp-header">
          <div className="mp-avatar-wrap" onClick={() => editing && fileRef.current?.click()} title={editing ? 'Zamenjaj sliko' : ''}>
            {currentPhoto
              ? <img className="mp-avatar mp-avatar-img" src={currentPhoto} alt={displayName} />
              : <div className="mp-avatar">{initials}</div>
            }
            {editing && (
              <div className="mp-avatar-overlay">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="mp-photo-input" onChange={handlePhotoChange} />
          </div>

          <div className="mp-header-info">
            <h1 className="mp-name">{user?.displayName || user?.email?.split('@')[0]}</h1>
            <p className="mp-email">{user?.email}</p>
            {success && <p className="mp-success">{success}</p>}
          </div>

          <div className="mp-header-actions">
            <button className="mp-edit-btn" onClick={() => { setEditing(v => !v); setError(''); setSuccess('') }}>
              {editing ? 'Prekliči' : 'Uredi profil'}
            </button>
            <button className="mp-logout-btn" onClick={handleLogout}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Odjava
            </button>
          </div>
        </div>

        {/* ── Edit forma ── */}
        {editing && (
          <div className="mp-edit-form">
            <div className="mp-edit-grid">
              <div className="mp-edit-field">
                <label className="mp-edit-label">Ime in priimek</label>
                <input className="mp-edit-input" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="mp-edit-field">
                <label className="mp-edit-label">E-pošta</label>
                <input className="mp-edit-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="mp-edit-field">
                <label className="mp-edit-label">Novo geslo</label>
                <input className="mp-edit-input" type="password" placeholder="Pusti prazno, če ne menjavaš" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div className="mp-edit-field">
                <label className="mp-edit-label">Potrdi geslo</label>
                <input className="mp-edit-input" type="password" placeholder="Ponovi novo geslo" value={password2} onChange={e => setPassword2(e.target.value)} />
              </div>
            </div>
            {error && <p className="mp-edit-error">{error}</p>}
            <div className="mp-edit-btns">
              <button className="mp-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Shranjujem…' : 'Shrani spremembe'}
              </button>
              <button className="mp-cancel-btn" type="button" onClick={() => { setEditing(false); setError(''); setPassword(''); setPassword2(''); setPhotoFile(null); setPhotoPreview(null) }}>
                Prekliči
              </button>
            </div>
          </div>
        )}

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
