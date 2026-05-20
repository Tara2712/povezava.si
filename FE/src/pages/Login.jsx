import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(firebaseError(err.code))
    }
    setLoading(false)
  }

  return (
    <div className="auth-split">

      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <img src="/logo.png" alt="Povezave.si" className="auth-left-logo" />
        <div className="auth-left-inner">
          <h2 className="auth-left-title">Slovensko poslovno omrežje</h2>
          <p className="auth-left-desc">
            Odkrijte poslovne povezave, akademike in javne registre na enem mestu.
            Transparentnost slovenskega gospodarstva.
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
          <h1 className="auth-title">Dobrodošli nazaj!</h1>
          <p className="auth-sub">Prijavite se v vaš račun</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
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
                  autoFocus
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
                  placeholder="••••••••"
                  autoComplete="current-password"
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

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? 'Prijavljam...' : 'Prijava'}
            </button>
          </form>

          <p className="auth-switch">
            Nimate računa? <Link to="/register">Registracija</Link>
          </p>
        </div>
      </div>

    </div>
  )
}

function firebaseError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Napačen e-poštni naslov ali geslo.'
    case 'auth/too-many-requests':
      return 'Preveč poskusov. Počakajte trenutek.'
    case 'auth/invalid-email':
      return 'Neveljaven e-poštni naslov.'
    default:
      return 'Napaka pri prijavi. Poskusite znova.'
  }
}
