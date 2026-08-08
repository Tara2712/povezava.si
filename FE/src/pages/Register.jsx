import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Gesli se ne ujemata.'); return }
    if (password.length < 6)  { setError('Geslo mora imeti vsaj 6 znakov.'); return }
    setLoading(true)
    try {
      await register(email, password, name)
      navigate('/')
    } catch (err) {
      setError(firebaseError(err.code))
    }
    setLoading(false)
  }

  async function handleGoogleRegister() {
  setError('');
  setLoading(true);

  try {
    await loginWithGoogle();
    navigate('/');
  } catch (err) {
    setError('Prijava z Googlom ni uspela.');
  }

  setLoading(false);
}

  return (
    <div className="auth-split">

      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <img src="/logo.png" alt="Povezave.si" className="auth-left-logo" />
        <div className="auth-left-inner">
          <h2 className="auth-left-title">Pridružite se omrežju</h2>
          <p className="auth-left-desc">
            Ustvarite račun in pridobite dostop do slovenskega poslovnega omrežja,
            akademikov, lobistov in javnih registrov.
          </p>
          <div className="auth-left-stats">
            <div className="auth-left-stat">
              <span className="auth-ls-num">134k+</span>
              <span className="auth-ls-lbl">oseb</span>
            </div>
            <div className="auth-left-stat">
              <span className="auth-ls-num">200k+</span>
              <span className="auth-ls-lbl">podjetij</span>
            </div>
            <div className="auth-left-stat">
              <span className="auth-ls-num">500k+</span>
              <span className="auth-ls-lbl">povezav</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          <h1 className="auth-title">Ustvarite račun</h1>
          <p className="auth-sub">Brezplačna registracija</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label>Ime in priimek</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jana Novak"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field">
              <label>E-pošta</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ime@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label>Geslo</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Vsaj 6 znakov"
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="auth-eye-btn" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label>Potrdi geslo</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Ustvarjam račun...' : 'Ustvari račun'}
            </button>

            <div className="auth-divider">
              <span>ali</span>
            </div>

            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogleRegister}
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.3 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.2C9.4 37.6 16 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.4 5.6-6.5 7.1l6.2 5.2C38.6 37.1 44 31.2 44 24c0-1.3-.1-2.3-.4-3.5z"/>
              </svg>

              Registracija z Googlom
            </button>

          </form>

          <p className="auth-switch">
            Že imate račun? <Link to="/login">Prijava</Link>
          </p>
        </div>
      </div>

    </div>
  )
}

function firebaseError(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ta e-poštni naslov je že registriran.'
    case 'auth/invalid-email':
      return 'Neveljaven e-poštni naslov.'
    case 'auth/weak-password':
      return 'Geslo je prešibko. Uporabite vsaj 6 znakov.'
    default:
      return 'Napaka pri registraciji. Poskusite znova.'
  }
}
