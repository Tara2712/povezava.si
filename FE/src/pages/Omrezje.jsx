import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { API } from '../api'
import { Network } from 'vis-network'

const DEPTH_COLORS = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function getNodeStyle(n, colorMode) {
  if (n.depth === 0) return { bg: '#ffffff', border: '#3b82f6', font: '#1e40af' }
  if (colorMode === 'tip') {
    return n.type === 'oseba'
      ? { bg: '#2563eb', border: '#93c5fd', font: '#dbeafe' }
      : { bg: '#0d9488', border: '#5eead4', font: '#ccfbf1' }
  }
  const bg = DEPTH_COLORS[Math.min(n.depth - 1, DEPTH_COLORS.length - 1)]
  return { bg, border: 'rgba(255,255,255,0.18)', font: '#f1f5f9' }
}

function buildVisData(rawNodes, rawEdges, filter, colorMode) {
  const visible = rawNodes.filter(n =>
    n.depth === 0 || filter === 'vse' || n.type === filter
  )
  const ids = new Set(visible.map(n => n.key))

  const nodes = visible.map(n => {
    const isCenter = n.depth === 0
    const isClose = n.depth <= 1
    const s = getNodeStyle(n, colorMode)
    const name = n.name || ''
    // Napis samo za center in 1. stopnjo — globlje vozlišče dobi prazen napis (hover tooltip)
    const label = isCenter
      ? name
      : isClose
        ? (name.length > 18 ? name.slice(0, 17) + '…' : name)
        : ''
    return {
      id: n.key,
      label,
      title: name,
      shape: n.type === 'podjetje' && !isCenter ? 'box' : 'dot',
      size: isCenter ? 30 : isClose ? 18 : 10,
      color: {
        background: s.bg,
        border: s.border,
        highlight: { background: s.bg, border: '#ffffff' },
        hover: { background: s.bg, border: '#e2e8f0' },
      },
      font: { color: s.font, size: isCenter ? 13 : 11, bold: isCenter },
      ...(isCenter ? { x: 0, y: 0, fixed: { x: true, y: true }, physics: false } : {}),
    }
  })

  const edges = rawEdges
    .filter(e => ids.has(e.from) && ids.has(e.to))
    .map((e, i) => {
      const fromNode = rawNodes.find(n => n.key === e.from)
      const d = fromNode?.depth ?? 1
      return {
        id: i,
        from: e.from,
        to: e.to,
        dashes: d > 1,
        width: d <= 1 ? 2 : 1,
        color: {
          color: d <= 1 ? 'rgba(59,130,246,0.5)' : 'rgba(51,65,85,0.6)',
          highlight: '#60a5fa',
          hover: '#60a5fa',
        },
        smooth: { type: 'continuous' },
      }
    })

  return { nodes, edges }
}

const NET_OPTIONS = {
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {
      gravitationalConstant: -130,
      centralGravity: 0.005,
      springLength: 200,
      springConstant: 0.04,
      damping: 0.4,
      avoidOverlap: 1.5,
    },
    stabilization: { enabled: true, iterations: 250, updateInterval: 25 },
  },
  nodes: { borderWidth: 2 },
  edges: { arrows: { to: { enabled: false } } },
  interaction: {
    hover: true,
    dragNodes: true,
    dragView: true,
    zoomView: true,
    selectConnectedEdges: true,
    tooltipDelay: 100,
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
                <LegendItem color="#2563eb" shape="dot" label="Oseba" />
                <LegendItem color="#0d9488" shape="box" label="Podjetje" />
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
        : <span className="omrezje-legend-dot" style={{ background: color }} />
      }
      {label}
    </span>
  )
}
