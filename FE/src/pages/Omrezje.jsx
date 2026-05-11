import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'

import { API } from '../api'

const MEDIA_KEYWORDS = ['rtv', 'radio', 'tv', 'televizija', 'delo', 'večer', 'dnevnik', 'media', 'novice', 'zurnal', 'žurnal', 'siol', 'finance']

function isMedia(name) {
  const n = (name || '').toLowerCase()
  return MEDIA_KEYWORDS.some(k => n.includes(k))
}

function nodeType(name) {
  if (isMedia(name)) return 'media'
  return 'podjetje'
}

function splitLabel(name, max = 11) {
  const words = (name || '').trim().split(/\s+/)
  if (words.length === 1) return [words[0].slice(0, max), '']
  const mid = Math.ceil(words.length / 2)
  const l1 = words.slice(0, mid).join(' ')
  const l2 = words.slice(mid).join(' ')
  return [l1.slice(0, max), l2.slice(0, max)]
}

function GraphSVG({ centerName, nodes, onSelect, selected }) {
  const W = 700, H = 430
  const cx = W / 2, cy = H / 2

  const visible = nodes
  const R = visible.length <= 3 ? 155 : visible.length <= 6 ? 175 : 195

  const positioned = visible.map((n, i) => ({
    ...n,
    x: cx + R * Math.cos((2 * Math.PI * i / visible.length) - Math.PI / 2),
    y: cy + R * Math.sin((2 * Math.PI * i / visible.length) - Math.PI / 2),
  }))

  const centerLabel = splitLabel(centerName, 12)

  return (
    <svg className="graph-svg" viewBox={`0 0 ${W} ${H}`} style={{ height: 430 }}>
      {/* Lines */}
      {positioned.map((n, i) => (
        <line key={i}
          x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke={n.direct ? '#3b82f6' : '#9ca3af'}
          strokeDasharray={n.direct ? '' : '5 4'}
          strokeWidth={n.direct ? 2 : 1.5}
          opacity={0.7}
        />
      ))}

      {/* Center person node */}
      <circle cx={cx} cy={cy} r={46} fill="#fff" stroke="#2563eb" strokeWidth={2.5} />
      <text x={cx} y={cy - (centerLabel[1] ? 7 : 0)} textAnchor="middle" fontSize={12} fontWeight="700" fill="#1e3a8a" fontFamily="system-ui">
        {centerLabel[0]}
      </text>
      {centerLabel[1] && (
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={12} fontWeight="700" fill="#1e3a8a" fontFamily="system-ui">
          {centerLabel[1]}
        </text>
      )}

      {/* Surrounding nodes */}
      {positioned.map((n, i) => {
        const [l1, l2] = splitLabel(n.name, 11)
        const isSel = selected?.id === n.id
        const isOrg = n.type === 'podjetje'
        const isMediaNode = n.type === 'media'

        const stroke = isSel
          ? (isOrg ? '#059669' : isMediaNode ? '#dc2626' : '#2563eb')
          : (isOrg ? '#10b981' : isMediaNode ? '#ef4444' : '#60a5fa')
        const sw = isSel ? 2.5 : 1.5

        return (
          <g key={i} onClick={() => onSelect(isSel ? null : n)} style={{ cursor: 'pointer' }}>
            {(isOrg || isMediaNode) ? (
              <rect
                x={n.x - 40} y={n.y - 22}
                width={80} height={44}
                rx={8}
                fill="#fff"
                stroke={stroke}
                strokeWidth={sw}
              />
            ) : (
              <circle cx={n.x} cy={n.y} r={32} fill="#fff" stroke={stroke} strokeWidth={sw} />
            )}
            <text x={n.x} y={n.y - (l2 ? 6 : 1)} textAnchor="middle" fontSize={10.5} fill="#374151" fontFamily="system-ui">
              {l1}
            </text>
            {l2 && (
              <text x={n.x} y={n.y + 9} textAnchor="middle" fontSize={10.5} fill="#374151" fontFamily="system-ui">
                {l2}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function Omrezje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [personData, setPersonData] = useState(null)
  const [nodes, setNodes] = useState([])
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState({ podjetje: true, oseba: true, media: true })

  useEffect(() => {
    async function load() {
      const person = await fetch(`${API}/osebe/${id}`).then(r => r.json())
      setPersonData(person)

      const direct = (person.povezave || []).map(p => ({
        id: `p-${p.podjetje_id}`,
        type: nodeType(p.popolno_ime),
        name: p.popolno_ime || '?',
        vloga: p.vloga,
        vir: p.vir,
        direct: true,
      }))
      setNodes(direct)
    }
    load().catch(console.error)
  }, [id])

  if (!personData) return <Layout activeTab="omrezje"><p className="loading-msg">Nalagam omrežje...</p></Layout>

  const centerName = `${personData.ime} ${personData.priimek}`
  const visible = nodes.filter(n => filter[n.type])

  function toggleFilter(type) {
    setFilter(f => ({ ...f, [type]: !f[type] }))
    setSelected(null)
  }

  return (
    <Layout activeTab="omrezje">
      <button className="back-btn" onClick={() => navigate(`/oseba/${id}`)}>← Profil</button>

      <div className="graph-card">
        <GraphSVG
          centerName={centerName}
          nodes={visible}
          onSelect={setSelected}
          selected={selected}
        />

        {selected && (
          <div className="graph-tooltip">
            <strong>{selected.name}</strong>
            {selected.vloga && <span> · {selected.vloga}</span>}
            {selected.vir?.startsWith('http') && (
              <a href={selected.vir} target="_blank" rel="noopener">Vir ↗</a>
            )}
          </div>
        )}

        <div className="graph-legend">
          <span className="legend-item">
            <svg width="16" height="16"><circle cx="8" cy="8" r="7" fill="#fff" stroke="#60a5fa" strokeWidth="1.5"/></svg>
            Oseba
          </span>
          <span className="legend-item">
            <svg width="16" height="12"><rect x="1" y="1" width="14" height="10" rx="3" fill="#fff" stroke="#10b981" strokeWidth="1.5"/></svg>
            Organizacija
          </span>
          <span className="legend-item">
            <svg width="16" height="12"><rect x="1" y="1" width="14" height="10" rx="3" fill="#fff" stroke="#ef4444" strokeWidth="1.5"/></svg>
            Medij
          </span>
          <span className="legend-item">
            <svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="#3b82f6" strokeWidth="2"/></svg>
            Direktna vez
          </span>
          <span className="legend-item">
            <svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5 4"/></svg>
            Posredna vez
          </span>
        </div>
      </div>

      <div className="graph-filters">
        <button className={`filter-btn${filter.podjetje ? ' active-org' : ''}`} onClick={() => toggleFilter('podjetje')}>
          □ Organizacija
        </button>
        <button className={`filter-btn${filter.oseba ? ' active-oseba' : ''}`} onClick={() => toggleFilter('oseba')}>
          ○ Oseba
        </button>
        <button className={`filter-btn${filter.media ? ' active-media' : ''}`} onClick={() => toggleFilter('media')}>
          □ Medij
        </button>
      </div>
    </Layout>
  )
}
