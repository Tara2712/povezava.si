import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children, activeTab }) {
  const { pathname } = useLocation()
  const tab = activeTab || (
    pathname === '/' ? 'iskanje' :
    pathname.startsWith('/omrezje') ? 'omrezje' :
    (pathname.startsWith('/oseba') || pathname.startsWith('/podjetje')) ? 'profil' : ''
  )

  return (
    <div>
      <nav className="navbar">
        <Link to="/" className="nav-logo">povezava.si</Link>
        <div className="nav-tabs">
          <Link to="/" className={`nav-tab${tab === 'iskanje' ? ' active' : ''}`}>Iskanje</Link>
          <span className={`nav-tab${tab === 'profil' ? ' active' : ''}`}>Profil</span>
          <span className={`nav-tab${tab === 'omrezje' ? ' active' : ''}`}>Omrežje</span>
        </div>
      </nav>
      <div className="page-content">{children}</div>
    </div>
  )
}
