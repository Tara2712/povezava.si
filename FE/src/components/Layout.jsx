import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/',         key: 'iskanje',  label: 'Iskanje' },
  { to: '/pot',      key: 'pot',      label: 'Iskanje poti' },
  { to: '/mediji',   key: 'mediji',   label: 'V medijih' },
  { to: '/asistent', key: 'asistent', label: 'AI Asistent', accent: true },
]

const REGISTRI = [
  {
    to: '/lobisti', key: 'lobisti', label: 'Lobisti',
    desc: 'Register KPK',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
  {
    to: '/ovadeni', key: 'ovadeni', label: 'Kazensko ovadeni',
    desc: 'Sodne zadeve',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const [regOpen, setRegOpen] = useState(false)

  const activeKey =
    pathname === '/' ? 'iskanje' :
    pathname.startsWith('/pot') ? 'pot' :
    pathname.startsWith('/asistent') ? 'asistent' :
    pathname.startsWith('/lobisti') ? 'lobisti' :
    pathname.startsWith('/ovadeni') ? 'ovadeni' :
    pathname.startsWith('/mediji') ? 'mediji' : 'iskanje'

  const regActive = activeKey === 'lobisti' || activeKey === 'ovadeni'

  return (
    <div className="app-layout">
      <header className="topnav">
        <div className="topnav-inner">
          <Link to="/" className="topnav-brand">
            <div className="topnav-brand-icon" />
            <span className="topnav-brand-name">Povezava.si</span>
          </Link>

          <nav className="topnav-links">
            {NAV_LINKS.map(item => (
              <Link
                key={item.key}
                to={item.to}
                className={`topnav-link${activeKey === item.key ? ' active' : ''}${item.accent ? ' topnav-link-ai' : ''}`}
              >
                {item.label}
              </Link>
            ))}

            <div
              className={`topnav-dropdown${regActive ? ' reg-active' : ''}`}
              onMouseEnter={() => setRegOpen(true)}
              onMouseLeave={() => setRegOpen(false)}
            >
              <button className={`topnav-link topnav-dropdown-btn${regActive ? ' active' : ''}`}>
                Registri
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 3, transition: 'transform 0.15s', transform: regOpen ? 'rotate(180deg)' : 'none' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {regOpen && (
                <div className="topnav-dropdown-menu">
                  {REGISTRI.map(item => (
                    <Link
                      key={item.key}
                      to={item.to}
                      className={`topnav-dropdown-item${activeKey === item.key ? ' active' : ''}`}
                      onClick={() => setRegOpen(false)}
                    >
                      <span className="topnav-dd-icon">{item.icon}</span>
                      <span>
                        <span className="topnav-dd-label">{item.label}</span>
                        <span className="topnav-dd-desc">{item.desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="app-content">
        {children}
      </main>
    </div>
  )
}
