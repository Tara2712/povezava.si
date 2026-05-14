import { useState, useEffect, useCallback } from 'react'
import { MapContainer, GeoJSON, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

const MOCK_COUNTS = {
  'primorska': 1220,
  'notranjska': 341,
  'dolenjska': 5387,
  'gorenjska': 892,
  'koroska': 312,
  'stajerska': 3546,
  'prekmurje': 234,
}

const REGION_FILL = {
  'primorska': '#8bc34a',
  'notranjska': '#2e7d32',
  'dolenjska': '#81c784',
  'gorenjska': '#66bb6a',
  'koroska': '#1b5e20',
  'stajerska': '#a5d6a7',
  'prekmurje': '#c8e6c9',
}

const SLOVENIA_BOUNDS = [[45.40, 13.35], [46.90, 16.65]]

function regionStyle(feature) {
  return {
    fillColor: REGION_FILL[feature.id] || '#6366f1',
    fillOpacity: 0.22,
    color: '#ffffff',
    weight: 2,
  }
}

function RegionLayer({ geojson, selectedId, onSelect }) {
  const map = useMap()

  const onEachFeature = useCallback((feature, layer) => {
    const count = MOCK_COUNTS[feature.id] || 0
    layer.bindTooltip(
      `<div class="rtip"><b>${count.toLocaleString('sl-SI')}</b><span>${feature.properties.ime}</span></div>`,
      { permanent: true, direction: 'center', className: 'rtip-wrap' }
    )
    layer.on({
      mouseover() { layer.setStyle({ fillOpacity: 0.5 }) },
      mouseout()  { layer.setStyle({ fillOpacity: selectedId === feature.id ? 0.5 : 0.22 }) },
      click()     {
        map.fitBounds(layer.getBounds(), { padding: [50, 50], animate: true, duration: 0.5 })
        onSelect({ id: feature.id, ime: feature.properties.ime, count })
      },
    })
  }, [map, selectedId, onSelect])

  return (
    <GeoJSON
      key={geojson ? 'loaded' : 'empty'}
      data={geojson}
      style={regionStyle}
      onEachFeature={onEachFeature}
    />
  )
}

const IconMap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
  </svg>
)
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconNetwork = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)

export default function Mapa() {
  const [geojson, setGeojson] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('/regije.geojson').then(r => r.json()).then(setGeojson).catch(() => {})
  }, [])

  const totalMock = Object.values(MOCK_COUNTS).reduce((a, b) => a + b, 0)
  const totalRegions = Object.keys(MOCK_COUNTS).length

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" />
          <span className="sidebar-brand-name">Povezava.si</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/" className="sidebar-link active">
            <IconMap />
            <span className="sidebar-link-label">Karta</span>
          </Link>
          <Link to="/iskanje" className="sidebar-link">
            <IconSearch />
            <span className="sidebar-link-label">Iskanje</span>
          </Link>
          <span className="sidebar-link sidebar-link-disabled">
            <IconNetwork />
            <span className="sidebar-link-label">Omrežje</span>
          </span>
        </nav>

        <div className="sidebar-footer">
          {[
            { n: totalRegions, l: 'Regij' },
            { n: totalMock.toLocaleString('sl-SI'), l: 'Podjetij' },
          ].map(({ n, l }) => (
            <div key={l} className="sidebar-stat">
              <span className="sidebar-stat-n">{n}</span>
              <span className="sidebar-stat-l">{l}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="map-main">
        <MapContainer
          center={[46.12, 14.99]}
          zoom={8}
          minZoom={7}
          maxZoom={13}
          maxBounds={SLOVENIA_BOUNDS}
          maxBoundsViscosity={1.0}
          className="map-canvas"
          zoomControl={false}
        >
          {geojson && (
            <RegionLayer
              geojson={geojson}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          )}
        </MapContainer>

        {selected && (
          <aside className="right-panel">
            <button className="panel-close" onClick={() => setSelected(null)}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
              </svg>
            </button>
            <div className="panel-header">
              <div className="panel-color-dot" style={{ background: REGION_FILL[selected.id] }} />
              <div>
                <h2 className="panel-title">{selected.ime}</h2>
                <p className="panel-meta">{selected.count.toLocaleString('sl-SI')} podjetij</p>
              </div>
            </div>
            <div className="panel-divider" />
            <p style={{ fontSize: 13, color: '#6b7280', padding: '0 4px' }}>
              Klikni na podjetje za prikaz podrobnosti.
            </p>
          </aside>
        )}
      </main>
    </div>
  )
}
