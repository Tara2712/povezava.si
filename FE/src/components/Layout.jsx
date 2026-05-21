import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CompareFloat from './CompareFloat'

const BAZA = [
  {
    to: '/osebe', key: 'osebe', label: 'Seznam oseb', desc: 'Iskanje po osebah',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
  {
    to: '/podjetja', key: 'podjetja', label: 'Podjetja', desc: 'Seznam organizacij',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
  },
  {
    to: '/zemljevid', key: 'zemljevid', label: 'Zemljevid podjetij', desc: 'Geografski prikaz',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 14 8 14s8-8.75 8-14a8 8 0 0 0-8-8z"/></svg>
  },
  {
    to: '/mediji', key: 'mediji', label: 'V medijih', desc: 'Medijski arhiv',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/></svg>
  },
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

// Bottom nav items (5 main destinations for mobile)
const BOTTOM_NAV = [
  {
    to: '/', key: 'iskanje', label: 'Iskanje',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  },
  {
    to: '/osebe', key: 'osebe', label: 'Osebe',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  },
  {
    to: '/podjetja', key: 'podjetja', label: 'Podjetja',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  },
  {
    to: '/asistent', key: 'asistent', label: 'AI',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
  },
  {
    to: '/profil', key: 'profil', label: 'Profil',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [regOpen, setRegOpen] = useState(false)
  const [bazaOpen, setBazaOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const activeKey =
    pathname === '/' ? 'iskanje' :
    pathname.startsWith('/osebe') ? 'osebe' :
    pathname.startsWith('/podjetja') ? 'podjetja' :
    pathname.startsWith('/zemljevid') ? 'zemljevid' :
    pathname.startsWith('/asistent') ? 'asistent' :
    pathname.startsWith('/profil') ? 'profil' :
    pathname.startsWith('/lobisti') ? 'lobisti' :
    pathname.startsWith('/ovadeni') ? 'ovadeni' :
    pathname.startsWith('/mediji') ? 'mediji' : 'iskanje'

  const regActive = activeKey === 'lobisti' || activeKey === 'ovadeni'
  const bazaActive = ['osebe', 'podjetja', 'zemljevid', 'mediji'].includes(activeKey)

  return (
    <div className="app-layout">
      <header className="topnav">
        <div className="topnav-inner">
          <Link to="/" className="topnav-brand">
            <img src="/logo.png" alt="Povezave.si" className="topnav-logo-img" />
          </Link>

          <nav className="topnav-links">
            <Link to="/" className={`topnav-link${activeKey === 'iskanje' ? ' active' : ''}`}>
              Iskanje
            </Link>

            <div
              className={`topnav-dropdown${bazaActive ? ' reg-active' : ''}`}
              onMouseEnter={() => setBazaOpen(true)}
              onMouseLeave={() => setBazaOpen(false)}
            >
              <button className={`topnav-link topnav-dropdown-btn${bazaActive ? ' active' : ''}`}>
                Baza
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 3, transition: 'transform 0.15s', transform: bazaOpen ? 'rotate(180deg)' : 'none' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {bazaOpen && (
                <div className="topnav-dropdown-menu">
                  {BAZA.map(item => (
                    <Link
                      key={item.key}
                      to={item.to}
                      className={`topnav-dropdown-item${activeKey === item.key ? ' active' : ''}`}
                      onClick={() => setBazaOpen(false)}
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

            <div className="topnav-ai-divider" />
            <Link
              to="/asistent"
              className={`topnav-ai-pill${activeKey === 'asistent' ? ' active' : ''}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              AI Asistent
            </Link>
            <div className="topnav-ai-divider" />
            <div className="topnav-user">
              <Link to="/profil" className="topnav-user-name">{user?.displayName || user?.email}</Link>
              <button className="topnav-logout-btn" onClick={handleLogout}>Odjava</button>
            </div>
          </nav>
        </div>

      </header>

      <main className="app-content">
        {children}
      </main>

      <CompareFloat />

      {/* ── Mobile bottom navigation ── */}
      <nav className="bottom-nav">
        {BOTTOM_NAV.map(item => (
          <Link
            key={item.key}
            to={item.to}
            className={`bottom-nav-item${activeKey === item.key ? ' active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <footer className="site-footer">
        <div className="site-footer-inner">

          <div className="sf-brand">
            <div className="sf-brand-row">
              <img src="/logo.png" alt="Povezave.si" className="sf-logo-img" />
            </div>
            <p className="sf-tagline">
              Zemljevid slovenskega poslovnega omrežja iz javno dostopnih podatkov.
            </p>
            <p className="sf-copy">© 2026 Povezava.si</p>
          </div>

          <div className="sf-col">
            <div className="sf-col-head">Navigacija</div>
            <Link to="/" className="sf-link">Iskanje</Link>
            <Link to="/osebe" className="sf-link">Seznam oseb</Link>
            <Link to="/mediji" className="sf-link">V medijih</Link>
            <Link to="/asistent" className="sf-link">AI Asistent</Link>
          </div>

          <div className="sf-col">
            <div className="sf-col-head">Registri</div>
            <Link to="/lobisti" className="sf-link">Lobisti (KPK)</Link>
            <Link to="/ovadeni" className="sf-link">Kazensko ovadeni</Link>
          </div>

          <div className="sf-col">
            <div className="sf-col-head">Viri podatkov</div>
            <span className="sf-text">AJPES — Poslovni register</span>
            <span className="sf-text">KPK — Register lobistov</span>
            <span className="sf-text">Javne objave in mediji</span>
            <span className="sf-text">Uradni registri RS</span>
          </div>

        </div>

        <div className="sf-bottom">
          <span>Podatki so pridobljeni iz javno dostopnih virov in namenjeni informativni uporabi.</span>
        </div>
      </footer>
    </div>
  )
}
