import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { API } from '../api'
import { Network } from 'vis-network'

const DEPTH_COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

// Barve po subtype
const SUBTYPE_STYLE = {
  univerza:    { bg: '#f59e0b', border: '#fbbf24', font: '#1c1917', shape: 'diamond', size: 42 },
  laboratorij: { bg: '#0ea5e9', border: '#38bdf8', font: '#f0f9ff', shape: 'box',     size: 22 },
  podjetje:    { bg: '#10b981', border: '#34d399', font: '#ecfdf5', shape: 'box',     size: 16 },
  akademik:    { bg: '#6366f1', border: '#818cf8', font: '#eef2ff', shape: 'dot',     size: 14 },
  poslovnez:   { bg: '#8b5cf6', border: '#a78bfa', font: '#f5f3ff', shape: 'dot',     size: 14 },
  default:     { bg: '#64748b', border: '#94a3b8', font: '#f8fafc', shape: 'dot',     size: 12 },
}

function getNodeStyle(n, colorMode) {
  if (n.depth === 0) return { bg: '#ffffff', border: '#3b82f6', font: '#1e40af', shape: 'dot', size: 32 }

  if (colorMode === 'tip') {
    if (n.type === 'podjetje') {
      const s = SUBTYPE_STYLE[n.subtype] || SUBTYPE_STYLE.podjetje
      return { ...s }
    }
    const s = SUBTYPE_STYLE[n.subtype] || SUBTYPE_STYLE.default
    return { ...s }
  }

  // Stopnja barva — institucije vedno posebej
  if (n.type === 'podjetje' && (n.subtype === 'univerza' || n.subtype === 'laboratorij')) {
    const s = SUBTYPE_STYLE[n.subtype]
    return { ...s }
  }
  const bg = DEPTH_COLORS[Math.min(n.depth - 1, DEPTH_COLORS.length - 1)]
  const shape = n.type === 'podjetje' ? 'box' : 'dot'
  return { bg, border: 'rgba(255,255,255,0.25)', font: '#f1f5f9', shape, size: n.type === 'podjetje' ? 16 : 12 }
}

function buildVisData(rawNodes, rawEdges, filter, colorMode) {
  const visible = rawNodes.filter(n =>
    n.depth === 0 || filter === 'vse' || n.type === filter
  )
  const ids = new Set(visible.map(n => n.key))

  const nodes = visible.map(n => {
    const isCenter = n.depth === 0
    const s = getNodeStyle(n, colorMode)
    const name = n.name || ''
    // Skrajšaj samo navadna podjetja, ne institucij
    const maxLen = n.subtype === 'univerza' ? 30 : n.subtype === 'laboratorij' ? 24 : 18
    const label = isCenter ? name : (name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name)

    return {
      id: n.key,
      label,
      title: `<b>${name}</b>${n.subtype ? `<br/><i>${n.subtype}</i>` : ''}`,
      shape: isCenter ? 'dot' : s.shape,
      size: isCenter ? 32 : s.size,
      color: {
        background: s.bg,
        border: s.border,
        highlight: { background: s.bg, border: '#ffffff' },
        hover: { background: s.bg, border: '#e2e8f0' },
      },
      font: { color: isCenter ? '#1e40af' : s.font, size: isCenter ? 14 : (n.subtype === 'univerza' ? 12 : n.subtype === 'laboratorij' ? 11 : 10), bold: isCenter || n.subtype === 'univerza' },
      borderWidth: n.subtype === 'univerza' ? 3 : 2,
      shadow: n.subtype === 'univerza' ? { enabled: true, color: 'rgba(245,158,11,0.4)', size: 12 } :
              n.subtype === 'laboratorij' ? { enabled: true, color: 'rgba(14,165,233,0.25)', size: 6 } : false,
      ...(isCenter ? { x: 0, y: 0, fixed: { x: true, y: true }, physics: false } : {}),
    }
  })

  const edges = rawEdges
    .filter(e => ids.has(e.from) && ids.has(e.to))
    .map((e, i) => {
      const fromNode = rawNodes.find(n => n.key === e.from)
      const d = fromNode?.depth ?? 1
      const isHierarhy = e.hierarhija

      return {
        id: i,
        from: e.from,
        to: e.to,
        dashes: isHierarhy ? [6, 4] : d > 2,
        width: isHierarhy ? 2 : d <= 1 ? 2.5 : 1,
        length: isHierarhy ? 120 : undefined,
        color: {
          color: isHierarhy ? 'rgba(245,158,11,0.45)' :
                 d <= 1 ? 'rgba(99,102,241,0.6)' : 'rgba(51,65,85,0.5)',
          highlight: '#60a5fa',
          hover: '#60a5fa',
        },
        smooth: { type: isHierarhy ? 'curvedCW' : 'continuous', roundness: isHierarhy ? 0.2 : 0 },
      }
    })

  return { nodes, edges }
}

const NET_OPTIONS = {
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {
      gravitationalConstant: -160,
      centralGravity: 0.003,
      springLength: 160,
      springConstant: 0.05,
      damping: 0.45,
      avoidOverlap: 1.8,
    },
    stabilization: { enabled: true, iterations: 350, updateInterval: 25 },
  },
  nodes: { borderWidth: 2 },
  edges: { arrows: { to: { enabled: false } } },
  interaction: {
    hover: true,
    dragNodes: true,
    dragView: true,
    zoomView: true,
    selectConnectedEdges: true,
    tooltipDelay: 80,
    navigationButtons: false,
  },
  layout: { improvedLayout: false },
}

export default function Omrezje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [depth, setDepth] = useState(2)
  const [filter, setFilter] = useState('vse')
  const [colorMode, setColorMode] = useState('stopnja')
  const [selected, setSelected] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setLoading(true)
    setSelected(null)
    setReady(false)
    fetch(`${API}/omrezje/${id}?depth=${depth}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id, depth])

  useEffect(() => {
    if (!data || !containerRef.current) return

    if (networkRef.current) {
      networkRef.current.destroy()
      networkRef.current = null
    }

    setReady(false)
    setSelected(null)

    const { nodes, edges } = buildVisData(data.nodes, data.edges, filter, colorMode)
    const nodeMap = new Map(data.nodes.map(n => [n.key, n]))

    const net = new Network(containerRef.current, { nodes, edges }, NET_OPTIONS)

    net.on('click', params => {
      if (!params.nodes.length) { setSelected(null); return }
      setSelected(nodeMap.get(params.nodes[0]) ?? null)
    })

    net.once('stabilized', () => {
      setReady(true)
      net.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } })
    })

    networkRef.current = net
    return () => { net.destroy(); networkRef.current = null }
  }, [data, filter, colorMode])

  if (loading) return (
    <Layout>
      <p className="loading-msg" style={{ padding: '40px 32px' }}>Nalagam omrežje...</p>
    </Layout>
  )
  if (!data?.center) return (
    <Layout>
      <p className="error-msg" style={{ padding: '20px 32px' }}>Napaka pri nalaganju.</p>
    </Layout>
  )

  return (
    <Layout>
      <div className="omrezje-page">

        <div className="omrezje-topbar">
          <button className="back-btn omrezje-back" onClick={() => navigate(`/oseba/${id}`)}>← Profil</button>
          <div className="omrezje-title-block">
            <h2 className="omrezje-title">{data.center.name}</h2>
            <span className="omrezje-meta">{data.nodes.length} vozlišč · {data.edges.length} povezav</span>
          </div>
          <div className="depth-control">
            <span className="depth-label">Stopnje:</span>
            {[1, 2, 3, 4, 5, 6].map(d => (
              <button key={d}
                className={`depth-btn${depth === d ? ' active' : ''}`}
                onClick={() => setDepth(d)}
              >{d}</button>
            ))}
            <button
              className="depth-btn"
              style={{ marginLeft: 8, fontSize: 15 }}
              title="Prilagodi pogled"
              onClick={() => networkRef.current?.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } })}
            >⊕</button>
          </div>
        </div>

        <div className="omrezje-toolbar">
          <div className="omrezje-pill-group">
            {[['vse', 'Vse'], ['oseba', 'Osebe'], ['podjetje', 'Podjetja']].map(([v, l]) => (
              <button key={v}
                className={`omrezje-pill${filter === v ? ' active' : ''}`}
                onClick={() => { setFilter(v); setSelected(null) }}
              >{l}</button>
            ))}
          </div>
          <div className="omrezje-pill-group">
            <span className="omrezje-pill-label">Barva:</span>
            {[['stopnja', 'Po stopnji'], ['tip', 'Po tipu']].map(([v, l]) => (
              <button key={v}
                className={`omrezje-pill${colorMode === v ? ' active' : ''}`}
                onClick={() => setColorMode(v)}
              >{l}</button>
            ))}
          </div>
        </div>

        <div className="omrezje-canvas-wrap">
          {!ready && (
            <div className="omrezje-stabilizing">
              <div className="omrezje-spinner" />
              <span>Razporejam omrežje...</span>
            </div>
          )}

          <div ref={containerRef} className="omrezje-canvas" />

          <div className="omrezje-legend">
            {colorMode === 'tip' ? (
              <>
                <LegendItem color="#f59e0b" shape="diamond" label="Univerza" />
                <LegendItem color="#0ea5e9" shape="box"     label="Laboratorij" />
                <LegendItem color="#10b981" shape="box"     label="Podjetje" />
                <LegendItem color="#6366f1" shape="dot"     label="Akademik" />
                <LegendItem color="#8b5cf6" shape="dot"     label="Poslovnež" />
              </>
            ) : (
              DEPTH_COLORS.slice(0, depth).map((c, i) => (
                <LegendItem key={i} color={c} shape="dot" label={`${i + 1}. stopnja`} />
              ))
            )}
          </div>

          {selected && (
            <div className="omrezje-panel">
              <div className="omrezje-panel-left">
                <div className="omrezje-panel-name">{selected.name}</div>
                <div className="omrezje-panel-badges">
                  <span className={`omrezje-badge ${selected.type}`}>
                    {selected.type === 'oseba' ? 'Oseba' : 'Podjetje'}
                  </span>
                  <span className="omrezje-badge omrezje-badge-depth">
                    {selected.depth}. stopnja
                  </span>
                </div>
              </div>
              <button
                className="omrezje-panel-btn"
                onClick={() => navigate(
                  selected.type === 'oseba'
                    ? `/oseba/${selected.id}`
                    : `/podjetje/${selected.id}`
                )}
              >
                Odpri profil →
              </button>
              <button className="omrezje-panel-close" onClick={() => setSelected(null)}>✕</button>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}

function LegendItem({ color, shape, label }) {
  return (
    <span className="omrezje-legend-item">
      {shape === 'box'
        ? <span className="omrezje-legend-box" style={{ background: color }} />
        : shape === 'diamond'
        ? <span className="omrezje-legend-diamond" style={{ background: color }} />
        : <span className="omrezje-legend-dot" style={{ background: color }} />
      }
      {label}
    </span>
  )
}
