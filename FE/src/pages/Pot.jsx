import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Avatar from '../components/Avatar'
import { API } from '../api'

function usePersonAutocomplete() {
  const [query, setQuery]     = useState('')
  const [options, setOptions] = useState([])
  const [selected, setSelected] = useState(null)
  const [open, setOpen]       = useState(false)
  const timer = useRef(null)

  function onInput(e) {
    const v = e.target.value
    setQuery(v)
    setSelected(null)
    clearTimeout(timer.current)
    if (v.length < 2) { setOptions([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(v)}`)
        const data = await r.json()
        const osebe = data.filter(x => x.vrsta === 'oseba' || x.tip === 'oseba' || x.tip === 'poslovnez' || x.tip === 'akademik').slice(0, 6)
        setOptions(osebe)
        setOpen(true)
      } catch (_) {}
    }, 250)
  }

  function pick(item) {
    const name = `${item.ime} ${item.priimek}`
    setSelected({ id: item.id, name, tip: item.tip })
    setQuery(name)
    setOptions([])
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    setQuery('')
    setOptions([])
    setOpen(false)
  }

  return { query, options, selected, open, onInput, pick, clear, setOpen }
}

function PersonPicker({ label, state, placeholder }) {
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) state.setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [state])

  return (
    <div className="pot-picker" ref={ref}>
      <label className="pot-picker-label">{label}</label>
      {state.selected ? (
        <div className="pot-picker-selected">
          <Avatar name={state.selected.name} size="sm" />
          <span className="pot-picker-name">{state.selected.name}</span>
          <button className="pot-picker-clear" onClick={state.clear} aria-label="Odstrani">✕</button>
        </div>
      ) : (
        <div className="pot-picker-input-wrap">
          <svg className="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="pot-picker-input"
            placeholder={placeholder || 'Išči osebo...'}
            value={state.query}
            onChange={state.onInput}
            onFocus={() => state.options.length && state.setOpen(true)}
          />
        </div>
      )}
      {state.open && state.options.length > 0 && (
        <div className="pot-picker-dropdown">
          {state.options.map(item => (
            <button key={item.id} className="pot-picker-option" onMouseDown={() => state.pick(item)}>
              <Avatar name={`${item.ime} ${item.priimek}`} foto={item.fotografija_url} size="sm" />
              <div className="pot-picker-option-body">
                <span className="pot-picker-option-name">{item.ime} {item.priimek}</span>
                <span className="pot-picker-option-tip">{item.tip === 'akademik' ? 'Akademik' : 'Poslovnež'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PathChain({ path, stopnje }) {
  return (
    <div className="pot-result">
      <div className="pot-result-header">
        <div className="pot-stopnje-badge">{stopnje} {stopnje === 1 ? 'stopnja' : stopnje < 5 ? 'stopnje' : 'stopenj'} ločenosti</div>
        <p className="pot-result-sub">Pot skozi skupne poslovne povezave</p>
      </div>
      <div className="pot-chain">
        {path.map((node, i) => (
          <div key={i} className="pot-chain-item">
            {node.type === 'oseba' ? (
              <Link to={`/oseba/${node.id}`} className="pot-node-oseba">
                <Avatar name={node.name} size="md" />
                <div className="pot-node-body">
                  <span className="pot-node-name">{node.name}</span>
                  {node.vloga && <span className="pot-node-vloga">{node.vloga}</span>}
                </div>
                <svg className="pot-node-arrow-ext" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </Link>
            ) : (
              <Link to={`/podjetje/${node.id}`} className="pot-node-podjetje">
                <div className="pot-node-podjetje-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </div>
                <div className="pot-node-body">
                  <span className="pot-node-name">{node.name}</span>
                  {node.vloga && <span className="pot-node-vloga">{node.vloga}</span>}
                </div>
              </Link>
            )}
            {i < path.length - 1 && <div className="pot-chain-connector" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Pot() {
  const od = usePersonAutocomplete()
  const do_ = usePersonAutocomplete()
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function swap() {
    const odSel = od.selected, doSel = do_.selected
    const odQ = od.query, doQ = do_.query
    od.clear(); do_.clear()
    if (doSel) { od.pick({ id: doSel.id, ime: doSel.name.split(' ')[0], priimek: doSel.name.split(' ').slice(1).join(' '), tip: doSel.tip }) }
    else { od.onInput({ target: { value: '' } }) }
    if (odSel) { do_.pick({ id: odSel.id, ime: odSel.name.split(' ')[0], priimek: odSel.name.split(' ').slice(1).join(' '), tip: odSel.tip }) }
  }

  async function poisciPot() {
    if (!od.selected || !do_.selected) { setError('Izberi obe osebi.'); return }
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch(`${API}/pot?od=${od.selected.id}&do=${do_.selected.id}`)
      const data = await r.json()
      setResult(data)
    } catch (_) {
      setError('Napaka pri iskanju poti.')
    }
    setLoading(false)
  }

  const canSearch = od.selected && do_.selected && od.selected.id !== do_.selected.id

  return (
    <Layout>
      <div className="pot-page">
        <div className="pot-header">
          <h1 className="pot-title">
            <span className="pot-title-icon">🔗</span> Iskanje poti
          </h1>
          <p className="pot-desc">Poišči najkrajšo pot med dvema osebama skozi skupne poslovne povezave — 6 stopenj ločenosti.</p>
        </div>

        <div className="pot-form">
          <PersonPicker label="Od osebe" state={od} placeholder="Npr. Janez Novak..." />

          <button className="pot-swap-btn" onClick={swap} title="Zamenjaj osebi">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
            </svg>
          </button>

          <PersonPicker label="Do osebe" state={do_} placeholder="Npr. Marija Kovač..." />

          <button
            className="pot-search-btn"
            onClick={poisciPot}
            disabled={!canSearch || loading}
          >
            {loading ? (
              <span className="pot-spinner" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Poišči pot
              </>
            )}
          </button>
        </div>

        {error && <p className="pot-error">{error}</p>}

        {result && !loading && (
          result.path ? (
            <PathChain path={result.path} stopnje={result.stopnje} />
          ) : (
            <div className="pot-no-result">
              <div className="pot-no-result-icon">🔍</div>
              <p>{result.sporocilo || 'Pot ni bila najdena.'}</p>
            </div>
          )
        )}

        {!result && !loading && (
          <div className="pot-intro">
            <div className="pot-intro-cards">
              <div className="pot-intro-card">
                <div className="pot-intro-icon">👤</div>
                <strong>Izberi dve osebi</strong>
                <p>Poisci osebi v iskalni vrstici</p>
              </div>
              <div className="pot-intro-arrow">→</div>
              <div className="pot-intro-card">
                <div className="pot-intro-icon">🔗</div>
                <strong>Algoritem najde pot</strong>
                <p>BFS skozi poslovne mreže</p>
              </div>
              <div className="pot-intro-arrow">→</div>
              <div className="pot-intro-card">
                <div className="pot-intro-icon">🗺️</div>
                <strong>Vidi povezanost</strong>
                <p>Pot skozi skupna podjetja</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
