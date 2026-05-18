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

import Layout from '../components/Layout'

import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

const API_URL = import.meta.env.VITE_API_URL
// Naredi si .env.local file in not daj: VITE_API_URL=https://povezava-si.onrender.com/podjetjaVsa
// const API_URL = "http://localhost:3000/podjetjaVsa"

const SLOVENIA_CENTER = [46.1512, 14.9955]

const SLOVENIA_BOUNDS = [
  [45.42, 13.37],
  [46.88, 16.61]
]

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
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadCompanies()
  }, [])

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
      className="map-page"
      style={{
        position: 'relative',
        height: '100%',
        width: '100%'
      }}
    >
      {/* MAPA (VEDNO POLNI CELOTEN PROSTOR) */}
      <div style={{ height: '100%', width: '100%' }}>
        <MapContainer
          center={SLOVENIA_CENTER}
          zoom={8}
          minZoom={8}
          maxZoom={18}
          maxBounds={SLOVENIA_BOUNDS}
          style={{ height: '100%', width: '100%' }}
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
            {companies.map(company => (
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

      {/* DESNI PANEL (OVERLAY!) */}
      {selectedCompany && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '420px',
            height: '100%',
            background: '#fff',
            borderLeft: '1px solid #e2e8f0',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '-8px 0 25px rgba(0,0,0,0.15)',
            zIndex: 1000
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
                  {key}
                </div>

                <div style={{ fontSize: '14px' }}>
                  {String(value)}
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
            top: 20,
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