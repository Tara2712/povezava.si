import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children, activeTab }) {
  const { pathname } = useLocation()
  const tab = activeTab || (
    pathname === '/' ? 'karta' :
    pathname === '/iskanje' ? 'iskanje' :
    pathname.startsWith('/omrezje') ? 'omrezje' :
    (pathname.startsWith('/oseba') || pathname.startsWith('/podjetje')) ? 'profil' :
    'iskanje'
  )

  return (
    <div>
      <nav className="navbar">
        <Link to="/" className="nav-logo">Povezava.si</Link>
        <div className="nav-tabs">
          <Link to="/iskanje" className={`nav-tab${tab === 'iskanje' ? ' active' : ''}`}>Iskanje</Link>
          <Link to="/" className={`nav-tab${tab === 'karta' ? ' active' : ''}`}>Karta</Link>
          <span className={`nav-tab${tab === 'profil' ? ' active' : ''}`}>Profil</span>
          <span className={`nav-tab${tab === 'omrezje' ? ' active' : ''}`}>Omrežje</span>
        </div>
      </nav>
      <div className="page-content">{children}</div>
    </div>
  )
}
