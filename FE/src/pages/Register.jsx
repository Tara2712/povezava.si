import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="Povezave.si" className="auth-logo-img" />
        </div>

        <h1 className="auth-title">Registracija</h1>
        <p className="auth-sub">Ustvarite račun za dostop do Povezave.si</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Ime in priimek</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jana Novak"
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label>E-pošta</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ime@example.com"
              required
            />
          </div>
          <div className="auth-field">
            <label>Geslo</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Vsaj 6 znakov"
              required
            />
          </div>
          <div className="auth-field">
            <label>Potrdi geslo</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Ustvarjam račun...' : 'Ustvari račun'}
          </button>
        </form>

        <p className="auth-switch">
          Že imate račun? <Link to="/login">Prijava</Link>
        </p>
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
