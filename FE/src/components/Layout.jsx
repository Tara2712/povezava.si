import { Link, useLocation } from 'react-router-dom'

const NAV = [
  {
    to: '/', key: 'iskanje', label: 'Iskanje',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  },
  {
    to: '/mapa', key: 'karta', label: 'Karta',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
  },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()

  const activeKey =
    pathname === '/' ? 'iskanje' :
    pathname.startsWith('/mapa') ? 'karta' :
    pathname.startsWith('/oseba') || pathname.startsWith('/podjetje') ? 'iskanje' :
    pathname.startsWith('/omrezje') ? 'iskanje' :
    'iskanje'

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" />
          <span className="sidebar-brand-name">Povezava.si</span>
        </div>

        <div className="sidebar-section-label">Glavni meni</div>

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <Link
              key={item.key}
              to={item.to}
              className={`sidebar-link${activeKey === item.key ? ' active' : ''}`}
            >
              {item.icon}
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-text">Podatki: AJPES PRS<br />© 2026 Povezava.si</p>
        </div>
      </aside>

      <main className="sidebar-main">
        {children}
      </main>
    </div>
  )
}
