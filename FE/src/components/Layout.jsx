import { Link, useLocation } from 'react-router-dom'

const NAV_MAIN = [
  {
    to: '/', key: 'iskanje', label: 'Iskanje',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  },
  {
    to: '/mapa', key: 'karta', label: 'Karta',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
  },
  {
    to: '/pot', key: 'pot', label: 'Iskanje poti',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 14v4a2 2 0 0 0 2 2h10"/><path d="M5 10V6a2 2 0 0 1 2-2h10"/></svg>
  },
]

const NAV_AI = [
  {
    to: '/asistent', key: 'asistent', label: 'AI Asistent',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
  },
]

const NAV_REGISTRI = [
  {
    to: '/lobisti', key: 'lobisti', label: 'Lobisti',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
  {
    to: '/ovadeni', key: 'ovadeni', label: 'Kazensko ovadeni',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  },
]

const NAV_MEDIJI = [
  {
    to: '/mediji', key: 'mediji', label: 'V medijih',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
  },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()

  const activeKey =
    pathname === '/' ? 'iskanje' :
    pathname.startsWith('/mapa') ? 'karta' :
    pathname.startsWith('/pot') ? 'pot' :
    pathname.startsWith('/asistent') ? 'asistent' :
    pathname.startsWith('/lobisti') ? 'lobisti' :
    pathname.startsWith('/ovadeni') ? 'ovadeni' :
    pathname.startsWith('/mediji') ? 'mediji' :
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
          {NAV_MAIN.map(item => (
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

        <nav className="sidebar-nav" style={{ marginTop: 8 }}>
          {NAV_AI.map(item => (
            <Link
              key={item.key}
              to={item.to}
              className={`sidebar-link sidebar-link-ai${activeKey === item.key ? ' active' : ''}`}
            >
              {item.icon}
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <nav className="sidebar-nav" style={{ marginTop: 8 }}>
          {NAV_MEDIJI.map(item => (
            <Link
              key={item.key}
              to={item.to}
              className={`sidebar-link sidebar-link-mediji${activeKey === item.key ? ' active' : ''}`}
            >
              {item.icon}
              <span className="sidebar-link-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-section-label" style={{ marginTop: 16 }}>Registri</div>

        <nav className="sidebar-nav">
          {NAV_REGISTRI.map(item => (
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
