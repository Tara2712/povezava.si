import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { API } from '../api'

const DEPTH_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const RADII = [0, 130, 215, 295, 365, 425, 475]

function layoutNodes(nodes) {
  const byDepth = {}
  nodes.forEach(n => {
    if (!byDepth[n.depth]) byDepth[n.depth] = []
    byDepth[n.depth].push(n)
  })
  const cx = 420, cy = 320
  const result = {}
  Object.entries(byDepth).forEach(([depth, group]) => {
    const r = RADII[parseInt(depth)] ?? 475
    group.forEach((n, i) => {
      const angle = (2 * Math.PI * i / group.length) - Math.PI / 2
      result[n.key] = { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
    })
  })
  return result
}

function splitLabel(name, max = 11) {
  const words = (name || '').trim().split(/\s+/)
  if (words.length <= 1) return [(name || '').slice(0, max), '']
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' ').slice(0, max), words.slice(mid).join(' ').slice(0, max)]
}

function GraphSVG({ center, positioned, edges, selected, onSelect }) {
  const W = 840, H = 640
  const centerKey = `o-${center.id}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {edges.map((e, i) => {
        const a = positioned[e.from]
        const b = positioned[e.to]
        if (!a || !b) return null
        const depth = Math.max(a.depth, b.depth)
        const color = DEPTH_COLORS[Math.min(depth - 1, DEPTH_COLORS.length - 1)]
        const direct = depth === 1
        return (
          <line key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={color}
            strokeWidth={direct ? 2 : 1}
            strokeDasharray={direct ? '' : '5 4'}
            opacity={direct ? 0.55 : 0.25}
          />
        )
      })}

      {Object.values(positioned).map(n => {
        if (n.key === centerKey) return null
        const [l1, l2] = splitLabel(n.name)
        const isSel = selected?.key === n.key
        const color = DEPTH_COLORS[Math.min(n.depth - 1, DEPTH_COLORS.length - 1)]
        const isOrg = n.type === 'podjetje'
        return (
          <g key={n.key} onClick={() => onSelect(isSel ? null : n)} style={{ cursor: 'pointer' }}>
            {isOrg
              ? <rect x={n.x - 38} y={n.y - 20} width={76} height={40} rx={7} fill="#fff" stroke={color} strokeWidth={isSel ? 2.5 : 1.5} />
              : <circle cx={n.x} cy={n.y} r={28} fill="#fff" stroke={color} strokeWidth={isSel ? 2.5 : 1.5} />
            }
            <text x={n.x} y={n.y - (l2 ? 5 : 0)} textAnchor="middle" fontSize={9.5} fill="#374151" fontFamily="system-ui, sans-serif">{l1}</text>
            {l2 && <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize={9.5} fill="#374151" fontFamily="system-ui, sans-serif">{l2}</text>}
          </g>
        )
      })}

      {positioned[centerKey] && (() => {
        const n = positioned[centerKey]
        const [l1, l2] = splitLabel(center.name, 13)
        return (
          <g>
            <circle cx={n.x} cy={n.y} r={50} fill="#fff" stroke="#2563eb" strokeWidth={3} />
            <text x={n.x} y={n.y - (l2 ? 7 : 0)} textAnchor="middle" fontSize={12} fontWeight="700" fill="#1e3a8a" fontFamily="system-ui, sans-serif">{l1}</text>
            {l2 && <text x={n.x} y={n.y + 9} textAnchor="middle" fontSize={12} fontWeight="700" fill="#1e3a8a" fontFamily="system-ui, sans-serif">{l2}</text>}
          </g>
        )
      })()}
    </svg>
  )
}

export default function Omrezje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [depth, setDepth]     = useState(3)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    setSelected(null)
    fetch(`${API}/omrezje/${id}?depth=${depth}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, depth])

  const positioned = useMemo(() => {
    if (!data?.nodes) return {}
    return layoutNodes(data.nodes)
  }, [data])

  if (loading) return <Layout><p className="loading-msg">Nalagam omrežje...</p></Layout>
  if (!data?.center) return <Layout><p className="error-msg">Napaka pri nalaganju.</p></Layout>

  return (
    <Layout activeTab="omrezje">
      <button className="back-btn" onClick={() => navigate(`/oseba/${id}`)}>← Profil</button>

      <div className="graph-header">
        <div>
          <h2 className="graph-title">{data.center.name}</h2>
          <p className="graph-subtitle">{data.nodes.length} vozlišč · {data.edges.length} povezav</p>
        </div>
        <div className="depth-control">
          <span className="depth-label">Stopnje ločenosti:</span>
          {[1, 2, 3, 4, 5, 6].map(d => (
            <button key={d}
              className={`depth-btn${depth === d ? ' active' : ''}`}
              onClick={() => setDepth(d)}
            >{d}</button>
          ))}
        </div>
      </div>

      <div className="graph-card">
        <GraphSVG
          center={data.center}
          positioned={positioned}
          edges={data.edges}
          selected={selected}
          onSelect={setSelected}
        />

        {selected && (
          <div className="graph-tooltip">
            <strong>{selected.name}</strong>
            <span> · {selected.depth}. stopnja</span>
            <button className="graph-tooltip-link" onClick={() =>
              navigate(selected.type === 'oseba' ? `/oseba/${selected.id}` : `/podjetje/${selected.id}`)
            }>
              Odpri profil →
            </button>
          </div>
        )}

        <div className="graph-legend">
          {DEPTH_COLORS.slice(0, depth).map((color, i) => (
            <span key={i} className="legend-item">
              <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill={color} /></svg>
              {i + 1}. st.
            </span>
          ))}
          <span className="legend-item" style={{ marginLeft: 'auto' }}>
            <svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#6b7280" strokeWidth="2"/></svg>
            direktna
          </span>
          <span className="legend-item">
            <svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3"/></svg>
            posredna
          </span>
        </div>
      </div>
    </Layout>
  )
}
