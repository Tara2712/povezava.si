import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src="/logo.png" alt="Povezave.si" className="auth-logo-img" />
        </div>

        <h1 className="auth-title">Prijava</h1>
        <p className="auth-sub">Dobrodošli nazaj v Povezave.si</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>E-pošta</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ime@example.com"
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label>Geslo</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
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
