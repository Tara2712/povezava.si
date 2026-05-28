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
//const API_URL = "http://localhost:3000/kordinate"

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

const formatLabel = (key) => {
  return FIELD_LABELS[key] || key
}

const formatValue = (key, value, company) => {
  if (value === null || value === undefined || value === "") return "-"

  if (key === "ulica") {
    return `${company.ulica || ""}`.trim()
  }

  if (key === "posta") {
    return `${company.posta || ""}`.trim()
  }

  return String(value)
}

function MapBoundsController() {
  const map = useMap()

  useEffect(() => {
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
            c.lat !== undefined &&
            c.lng !== undefined &&
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

  const pravneOblike = [
  ...new Set(
    companies
      .map(c => c.pravna_oblika)
      .filter(Boolean)
  )
]

const kraji = [
  ...new Set(
    companies
      .map(c => c.posta)
      .filter(Boolean)
  )
]

  const filteredCompanies = companies.filter(company => {
  const matchName =
    company.popolno_ime
      ?.toLowerCase()
      .includes(searchName.toLowerCase())

  const matchMaticna =
    company.maticna
      ?.toString()
      .includes(searchMaticna)

  const matchPravnaOblika =
    selectedPravnaOblika === "" ||
    company.pravna_oblika === selectedPravnaOblika

  const matchKraj =
    selectedKraj === "" ||
    company.posta === selectedKraj

  return (
    matchName &&
    matchMaticna &&
    matchPravnaOblika &&
    matchKraj
  )
})

  const createClusterCustomIcon = cluster => {
    const count = cluster.getChildCount()

    return L.divIcon({
      html: `
        <div class="custom-cluster">
          <span>${count}</span>
        </div>
      `,
      className: 'cluster-wrapper',
      iconSize: L.point(50, 50, true)
    })
  }

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 'calc(100vh - 80px)',
          overflow: 'hidden'
        }}
      >

        {/* LEVI PANEL */}
<div className="left-panel">
  <h2>Filtri</h2>

  {/* IME */}
  <div className="filter-group">
    <label>Ime podjetja</label>

    <input
      type="text"
      value={searchName}
      onChange={(e) => setSearchName(e.target.value)}
      placeholder="Vnesi ime..."
    />
  </div>

  {/* MATIČNA */}
  <div className="filter-group">
    <label>Matična številka</label>

    <input
      type="text"
      value={searchMaticna}
      onChange={(e) => setSearchMaticna(e.target.value)}
      placeholder="Vnesi matično..."
    />
  </div>

  {/* PRAVNA OBLIKA */}
  <div className="filter-group">
    <label>Pravna oblika</label>

    <select
      value={selectedPravnaOblika}
      onChange={(e) => setSelectedPravnaOblika(e.target.value)}
    >
     <option className="select-placeholder" value="">
        Vse
        </option>

      {pravneOblike.map((oblika, index) => (
        <option key={index} value={oblika}>
          {oblika}
        </option>
      ))}
    </select>
  </div>

  {/* KRAJ */}
  <div className="filter-group">
    <label>Kraj</label>

    <select
      value={selectedKraj}
      onChange={(e) => setSelectedKraj(e.target.value)}
    >
      <option className="select-placeholder" value="">
        Vsi kraji
        </option>

      {kraji.map((kraj, index) => (
        <option key={index} value={kraj}>
          {kraj}
        </option>
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

        {/* MAPA */}
        <div style={{ flex: 1 }}>
          <MapContainer
            center={SLOVENIA_CENTER}
            zoom={8}
            minZoom={8}
            maxZoom={18}
            maxBounds={SLOVENIA_BOUNDS}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />

            <MapBoundsController />

            <MarkerClusterGroup
              chunkedLoading
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
              zoomToBoundsOnClick
              iconCreateFunction={createClusterCustomIcon}
            >
              {filteredCompanies.map(company => (
                <Marker
                  key={company.id}
                  position={[company.lat, company.lng]}
                  eventHandlers={{
                    click: () => setSelectedCompany(company)
                  }}
                >
                  <Popup>
                    <strong>{company.popolno_ime}</strong>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>

        {/* DESNI PANEL */}
        {selectedCompany && (
          <div
            style={{
              width: '420px',
              background: '#fff',
              borderLeft: '1px solid #e2e8f0',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '-8px 0 25px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '22px' }}>
                {selectedCompany.popolno_ime}
              </h2>

              <button
                onClick={() => setSelectedCompany(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '22px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: '20px' }}>
              {Object.entries(selectedCompany).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    marginBottom: '14px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      marginBottom: '4px',
                      textTransform: 'uppercase'
                    }}
                  >
                    {formatLabel(key)}
                  </div>

                  <div style={{ fontSize: '14px' }}>
                    {formatValue(key, value, selectedCompany)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 90,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#0f172a',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: '999px',
              zIndex: 9999
            }}
          >
            Nalaganje podjetij...
          </div>
        )}
      </div>
    </Layout>
  )
}