import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Avatar from '../components/Avatar'
import { API } from '../api'

const COORDS = {
  'Ljubljana':           [46.0569, 14.5058],
  'Maribor':             [46.5547, 15.6459],
  'Koper':               [45.5469, 13.7314],
  'Celje':               [46.2329, 15.2608],
  'Kranj':               [46.2392, 14.3556],
  'Novo Mesto':          [45.8011, 15.1677],
  'Velenje':             [46.3593, 15.1082],
  'Ptuj':                [46.4198, 15.8699],
  'Jesenice':            [46.4358, 13.9356],
  'Nova Gorica':         [45.9563, 13.6418],
  'Ajdovščina':          [45.8876, 13.9069],
  'Idrija':              [45.9985, 14.0269],
  'Železniki':           [46.2244, 14.1742],
  'Domžale':             [46.1378, 14.5942],
  'Krško':               [45.9572, 15.4921],
  'Sladki Vrh':          [46.6794, 15.8500],
  'Trbovlje':            [46.1517, 15.0517],
  'Ivančna Gorica':      [45.9383, 14.8039],
  'Slovenska Bistrica':  [46.3919, 15.5726],
  'Murska Sobota':       [46.6626, 16.1663],
}

const COLORS = ['#10b981','#f59e0b','#6366f1','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']
function pinColor(str) {
  let h = 0
  for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) & 0xfffff
  return COLORS[Math.abs(h) % COLORS.length]
}

function makeIcon(color, selected) {
  return L.divIcon({
    className: '',
    html: `
      <div class="map-pin-wrapper${selected ? ' selected' : ''}">
        <div class="map-pin-pulse" style="background:${color}25;border-color:${color}50"></div>
        <div class="map-pin-dot" style="background:${color}"></div>
      </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    tooltipAnchor: [0, -22],
  })
}

function StatsBar({ stats }) {
  return (
    <div className="map-stats-bar">
      <div className="map-stat">
        <span className="map-stat-n">{stats.podjetja}</span>
        <span className="map-stat-l">Podjetij</span>
      </div>
      <div className="map-stat">
        <span className="map-stat-n">{stats.osebe}</span>
        <span className="map-stat-l">Oseb</span>
      </div>
      <div className="map-stat">
        <span className="map-stat-n">{stats.povezave}</span>
        <span className="map-stat-l">Povezav</span>
      </div>
    </div>
  )
}

// Markers as a separate component so it renders inside MapContainer
function CompanyMarkers({ companies, selected, onSelect, byCity }) {
  return companies.map(company => {
    const base = COORDS[company.posta]
    const group = byCity[company.posta] || []
    const idx = group.indexOf(company)
    const angle = (2 * Math.PI * idx) / Math.max(group.length, 1)
    const offset = group.length > 1 ? 0.02 : 0
    const pos = [
      base[0] + offset * Math.cos(angle),
      base[1] + offset * Math.sin(angle),
    ]
    const isSel = selected?.id === company.id
    const color = pinColor(company.popolno_ime)

    return (
      <Marker
        key={company.id}
        position={pos}
        icon={makeIcon(color, isSel)}
        eventHandlers={{ click: () => onSelect(isSel ? null : company) }}
      />
    )
  })
}

export default function Mapa() {
  const [companies, setCompanies] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [stats, setStats] = useState({ podjetja: 0, osebe: 0, povezave: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/podjetja`).then(r => r.json()),
      fetch(`${API}/osebe`).then(r => r.json()),
      fetch(`${API}/povezave`).then(r => r.json()),
    ]).then(([podjetja, osebe, povezave]) => {
      setStats({ podjetja: podjetja.length, osebe: osebe.length, povezave: povezave.length })
      setCompanies(podjetja.filter(p => p.posta && COORDS[p.posta]))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    setLoading(true)
    fetch(`${API}/podjetja/${selected.id}`)
      .then(r => r.json())
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selected])

  const byCity = {}
  companies.forEach(c => {
    if (!byCity[c.posta]) byCity[c.posta] = []
    byCity[c.posta].push(c)
  })

  const color = detail ? pinColor(detail.popolno_ime) : '#10b981'

  return (
    <div className="map-page">
      <nav className="navbar">
        <Link to="/" className="nav-logo">Povezava.si</Link>
        <div className="nav-tabs">
          <Link to="/iskanje" className="nav-tab">Iskanje</Link>
          <Link to="/" className="nav-tab active">Karta</Link>
          <span className="nav-tab disabled">Omrežje</span>
        </div>
      </nav>

      <div className="map-layout">
        <MapContainer
          center={[46.15, 14.99]}
          zoom={8}
          className="map-canvas"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://opentopomap.org">OpenTopoMap</a> | © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={17}
          />
          <CompanyMarkers
            companies={companies}
            selected={selected}
            onSelect={setSelected}
            byCity={byCity}
          />
        </MapContainer>

        {/* Floating card over map */}
        {selected && (
          <div className="map-overlay-card">
            <button className="panel-close" onClick={() => setSelected(null)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
              </svg>
            </button>

            {loading || !detail ? (
              <p className="loading-msg" style={{ padding: '20px 0' }}>Nalagam...</p>
            ) : (
              <>
                <div className="panel-header">
                  <div className="panel-color-dot" style={{ background: color }} />
                  <div>
                    <h2 className="panel-title">{detail.popolno_ime}</h2>
                    <p className="panel-meta">
                      {[detail.pravna_oblika, detail.posta].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="panel-divider" />

                {detail.osebe?.length > 0 && (
                  <>
                    <p className="panel-section-label">Vodstvo</p>
                    <div className="panel-persons">
                      {detail.osebe.slice(0, 4).map((o, i) => (
                        <Link key={i} className="panel-person" to={`/oseba/${o.oseba_id}`}>
                          <Avatar name={`${o.ime} ${o.priimek}`} size="sm" />
                          <div className="panel-person-info">
                            <span className="panel-person-name">{o.ime} {o.priimek}</span>
                            <span className="panel-person-vloga">{o.vloga}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="panel-divider" />
                  </>
                )}

                <div className="panel-actions">
                  <Link className="panel-btn" to={`/podjetje/${detail.id}`}>
                    Celoten profil
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </Link>
                  <Link className="panel-btn-outline" to={`/omrezje/${detail.id}`}>Graf</Link>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bottom stats bar */}
        <StatsBar stats={stats} />
      </div>
    </div>
  )
}
