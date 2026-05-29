import { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from 'react-leaflet'

import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'

import 'leaflet/dist/leaflet.css'
import './zemljevid.css'
import Layout from '../components/Layout.jsx'

import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

const API_URL = import.meta.env.VITE_API_URL + '/kordinate'

const SLOVENIA_CENTER = [46.1512, 14.9955]

const SLOVENIA_BOUNDS = [
  [45.42, 13.37],
  [46.88, 16.61]
]

const FIELD_LABELS = {
  ulica: "Ulica",
  hisna_stevilka: "Hišna številka",
  posta: "Kraj",
  postna_stevilka: "Poštna številka",
  maticna: "Matična številka",
  drzava: "Država",
  popolno_ime: "Ime podjetja",
  pravna_oblika: "Pravna oblika",
  registrski_organ: "Registrski organ"
}

const formatLabel = (key) => FIELD_LABELS[key] || key

const formatValue = (key, value, company) => {
  if (value === null || value === undefined || value === "") return "-"

  if (key === "ulica") return `${company.ulica || ""}`.trim()
  if (key === "posta") return `${company.posta || ""}`.trim()

  return String(value)
}

function MapBoundsController() {
  const map = useMap()

  useEffect(() => {
    map.fitBounds(SLOVENIA_BOUNDS, { padding: [20, 20] })
    map.setMaxBounds(SLOVENIA_BOUNDS)
  }, [map])

  return null
}

export default function Mapa() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState(null)

  const [searchName, setSearchName] = useState("")
  const [searchMaticna, setSearchMaticna] = useState("")
  const [selectedPravnaOblika, setSelectedPravnaOblika] = useState("")
  const [selectedKraj, setSelectedKraj] = useState("")

  // ✅ NOVO: mobile toggle filtra
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    async function loadCompanies() {
      try {
        const res = await fetch(API_URL)
        const data = await res.json()

        if (!Array.isArray(data)) return

        const validCompanies = data
          .filter(c =>
            c.lat !== null &&
            c.lng !== null &&
            !isNaN(Number(c.lat)) &&
            !isNaN(Number(c.lng))
          )
          .map(c => ({
            ...c,
            lat: Number(c.lat),
            lng: Number(c.lng)
          }))

        setCompanies(validCompanies)
        setLoading(false)
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }

    loadCompanies()
  }, [])

  const pravneOblike = [...new Set(companies.map(c => c.pravna_oblika).filter(Boolean))]
  const kraji = [...new Set(companies.map(c => c.posta).filter(Boolean))]

  const filteredCompanies = companies.filter(company => {
    return (
      company.popolno_ime?.toLowerCase().includes(searchName.toLowerCase()) &&
      company.maticna?.toString().includes(searchMaticna) &&
      (selectedPravnaOblika === "" || company.pravna_oblika === selectedPravnaOblika) &&
      (selectedKraj === "" || company.posta === selectedKraj)
    )
  })

  const createClusterCustomIcon = cluster => {
    const count = cluster.getChildCount()

    return L.divIcon({
      html: `<div class="custom-cluster"><span>${count}</span></div>`,
      className: 'cluster-wrapper',
      iconSize: L.point(50, 50, true)
    })
  }

return (
  <Layout>
    <div className="map-wrapper">

      {/* LEVI PANEL */}
      <div className={`left-panel ${filtersOpen ? "open" : ""}`}>
        <h2
          className="filters-title"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filtri
        </h2>

        <div className="filters-content">

          {/* Ime */}
          <div className="filter-group">
            <label>Ime podjetja</label>
            <input value={searchName} onChange={(e) => setSearchName(e.target.value)} />
          </div>

          {/* Matična */}
          <div className="filter-group">
            <label>Matična številka</label>
            <input value={searchMaticna} onChange={(e) => setSearchMaticna(e.target.value)} />
          </div>

          {/* Pravna oblika */}
          <div className="filter-group">
            <label>Pravna oblika</label>
            <select value={selectedPravnaOblika} onChange={(e) => setSelectedPravnaOblika(e.target.value)}>
              <option value="">Vse</option>
              {pravneOblike.map((o, i) => (
                <option key={i} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Kraj */}
          <div className="filter-group">
            <label>Kraj</label>
            <select value={selectedKraj} onChange={(e) => setSelectedKraj(e.target.value)}>
              <option value="">Vsi kraji</option>
              {kraji.map((k, i) => (
                <option key={i} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <button
            className="reset-button"
            onClick={() => {
              setSearchName("")
              setSearchMaticna("")
              setSelectedPravnaOblika("")
              setSelectedKraj("")
            }}
          >
            Ponastavi filtre
          </button>

          <div className="results-count">
            Najdenih podjetij: <strong>{filteredCompanies.length}</strong>
          </div>

        </div>
      </div>

      {/* MAPA */}
      <div className="map-container">
        <MapContainer
          center={SLOVENIA_CENTER}
          zoom={8}
          minZoom={8}
          maxZoom={18}
          maxBounds={SLOVENIA_BOUNDS}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapBoundsController />

          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterCustomIcon}
          >
            {filteredCompanies.map(c => (
              <Marker
                key={c.id}
                position={[c.lat, c.lng]}
                eventHandlers={{
                  click: () => setSelectedCompany(c)
                }}
              >
                <Popup>
                  <strong>{c.popolno_ime}</strong>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {/* DESNI PANEL (desktop ONLY, ORIGINAL STYLE) */}
      {selectedCompany && (
        <div className="right-panel-desktop">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '22px' }}>
              {selectedCompany.popolno_ime}
            </h2>

            <button onClick={() => setSelectedCompany(null)}>✕</button>
          </div>

          <div style={{ marginTop: '20px' }}>
            {Object.entries(selectedCompany).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {formatLabel(key)}
                </div>
                <div style={{ fontSize: 14 }}>
                  {formatValue(key, value, selectedCompany)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM PANEL */}
      {selectedCompany && (
        <div className="mobile-bottom-panel">
          <div className="mobile-bottom-header">
            <h2>{selectedCompany.popolno_ime}</h2>
            <button onClick={() => setSelectedCompany(null)}>✕</button>
          </div>

          <div className="mobile-bottom-content">
            {Object.entries(selectedCompany).map(([key, value]) => (
              <div key={key} className="mobile-row">
                <div className="label">{formatLabel(key)}</div>
                <div className="value">{formatValue(key, value, selectedCompany)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="loading">Nalaganje podjetij...</div>}

    </div>
  </Layout>
)
}