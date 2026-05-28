require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const neighborCache = new Map()
const nodeCache = new Map()

const CACHE_TTL_MS = 5 * 60 * 1000

function key(tip, id) {
  return `${tip}:${id}`
}

function parseKey(nodeKey) {
  const index = nodeKey.indexOf(':')
  return {
    tip: nodeKey.substring(0, index),
    id: nodeKey.substring(index + 1)
  }
}

function getCached(map, cacheKey) {
  const cached = map.get(cacheKey)
  if (!cached) return null

  if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
    map.delete(cacheKey)
    return null
  }

  return cached.data
}

function setCached(map, cacheKey, data) {
  map.set(cacheKey, {
    createdAt: Date.now(),
    data
  })
}

async function pridobiSosede(tip, id) {
  const cacheKey = key(tip, id)
  const cached = getCached(neighborCache, cacheKey)
  if (cached) return cached

  let rows = []

  if (tip === 'oseba') {
    const result = await pool.query(`
      SELECT 
        'podjetje' AS tip,
        pod.maticna::text AS id,
        COALESCE(p.vloga, p.tip_povezave, 'oseba-podjetje') AS label,
        p.vir::text AS vir
      FROM povezave p
      JOIN podjetja pod ON pod.id = p.podjetje_id
      WHERE p.oseba_id = $1

      UNION ALL

      SELECT 
        'podjetje' AS tip,
        pod.maticna::text AS id,
        COALESCE(p.vloga, p.tip_povezave, 'oseba2-podjetje') AS label,
        p.vir::text AS vir
      FROM povezave p
      JOIN podjetja pod ON pod.id = p.podjetje_id
      WHERE p.oseba2_id = $1

      UNION ALL

      SELECT 
        'oseba' AS tip,
        p.oseba2_id::text AS id,
        COALESCE(p.tip_povezave, p.vloga, 'oseba-oseba') AS label,
        p.vir::text AS vir
      FROM povezave p
      WHERE p.oseba_id = $1 AND p.oseba2_id IS NOT NULL

      UNION ALL

      SELECT 
        'oseba' AS tip,
        p.oseba_id::text AS id,
        COALESCE(p.tip_povezave, p.vloga, 'oseba-oseba') AS label,
        p.vir::text AS vir
      FROM povezave p
      WHERE p.oseba2_id = $1 AND p.oseba_id IS NOT NULL

      UNION ALL

      SELECT
        'clanek' AS tip,
        co.clanek_id::text AS id,
        'omenjen v članku' AS label,
        c.url::text AS vir
      FROM clanki_osebe co
      JOIN clanki c ON c.id = co.clanek_id
      WHERE co.oseba_id = $1

      UNION ALL

      SELECT
        'ovadba' AS tip,
        o.id::text AS id,
        'ovadeni' AS label,
        o.vir_url::text AS vir
      FROM ovadeni o
      WHERE o.oseba_id = $1

      UNION ALL

      SELECT
        'lobist_info' AS tip,
        l.id::text AS id,
        'lobist' AS label,
        l.vir_url::text AS vir
      FROM lobisti_info l
      WHERE l.oseba_id = $1
    `, [id])

    rows = result.rows
  }

  if (tip === 'podjetje') {
    const result = await pool.query(`
      SELECT 
        'oseba' AS tip,
        p.oseba_id::text AS id,
        COALESCE(p.vloga, p.tip_povezave, 'podjetje-oseba') AS label,
        p.vir::text AS vir
      FROM povezave p
      JOIN podjetja pod ON pod.id = p.podjetje_id
      WHERE pod.maticna = $1 AND p.oseba_id IS NOT NULL

      UNION ALL

      SELECT 
        'oseba' AS tip,
        p.oseba2_id::text AS id,
        COALESCE(p.vloga, p.tip_povezave, 'podjetje-oseba2') AS label,
        p.vir::text AS vir
      FROM povezave p
      JOIN podjetja pod ON pod.id = p.podjetje_id
      WHERE pod.maticna = $1 AND p.oseba2_id IS NOT NULL

      UNION ALL

      SELECT 
        'podjetje' AS tip,
        pod2.maticna::text AS id,
        COALESCE(p.tip_povezave, p.vloga, 'podjetje-podjetje') AS label,
        p.vir::text AS vir
      FROM povezave p
      JOIN podjetja pod1 ON pod1.id = p.podjetje_id
      JOIN podjetja pod2 ON pod2.id = p.podjetje2_id
      WHERE pod1.maticna = $1

      UNION ALL

      SELECT 
        'podjetje' AS tip,
        pod1.maticna::text AS id,
        COALESCE(p.tip_povezave, p.vloga, 'podjetje-podjetje') AS label,
        p.vir::text AS vir
      FROM povezave p
      JOIN podjetja pod1 ON pod1.id = p.podjetje_id
      JOIN podjetja pod2 ON pod2.id = p.podjetje2_id
      WHERE pod2.maticna = $1

      UNION ALL

      SELECT
        'podjetje' AS tip,
        parent.maticna::text AS id,
        'nadrejeno podjetje' AS label,
        'podjetja.parent_podjetje_id' AS vir
      FROM podjetja child
      JOIN podjetja parent ON parent.id = child.parent_podjetje_id
      WHERE child.maticna = $1

      UNION ALL

      SELECT
        'podjetje' AS tip,
        child.maticna::text AS id,
        'podrejeno podjetje' AS label,
        'podjetja.parent_podjetje_id' AS vir
      FROM podjetja parent
      JOIN podjetja child ON child.parent_podjetje_id = parent.id
      WHERE parent.maticna = $1
    `, [id])

    rows = result.rows
  }

  if (tip === 'clanek') {
    const result = await pool.query(`
      SELECT
        'oseba' AS tip,
        co.oseba_id::text AS id,
        'omenjen v članku' AS label,
        c.url::text AS vir
      FROM clanki_osebe co
      JOIN clanki c ON c.id = co.clanek_id
      WHERE co.clanek_id = $1
    `, [id])

    rows = result.rows
  }

  if (tip === 'ovadba') {
    const result = await pool.query(`
      SELECT
        'oseba' AS tip,
        o.oseba_id::text AS id,
        'ovadeni' AS label,
        o.vir_url::text AS vir
      FROM ovadeni o
      WHERE o.id = $1 AND o.oseba_id IS NOT NULL
    `, [id])

    rows = result.rows
  }

  if (tip === 'lobist_info') {
    const result = await pool.query(`
      SELECT
        'oseba' AS tip,
        l.oseba_id::text AS id,
        'lobist' AS label,
        l.vir_url::text AS vir
      FROM lobisti_info l
      WHERE l.id = $1 AND l.oseba_id IS NOT NULL
    `, [id])

    rows = result.rows
  }

  const sosedi = rows
    .filter(r => r.id !== null && r.id !== undefined)
    .map(r => ({
      tip: r.tip,
      id: String(r.id),
      label: r.label,
      vir: r.vir
    }))

  setCached(neighborCache, cacheKey, sosedi)

  return sosedi
}

async function obstajaNode(tip, id) {
  if (tip === 'oseba') {
    const r = await pool.query(`SELECT 1 FROM osebe WHERE id = $1`, [id])
    return r.rowCount > 0
  }

  if (tip === 'podjetje') {
    const r = await pool.query(`SELECT 1 FROM podjetja WHERE maticna = $1`, [id])
    return r.rowCount > 0
  }

  if (tip === 'clanek') {
    const r = await pool.query(`SELECT 1 FROM clanki WHERE id = $1`, [id])
    return r.rowCount > 0
  }

  if (tip === 'ovadba') {
    const r = await pool.query(`SELECT 1 FROM ovadeni WHERE id = $1`, [id])
    return r.rowCount > 0
  }

  if (tip === 'lobist_info') {
    const r = await pool.query(`SELECT 1 FROM lobisti_info WHERE id = $1`, [id])
    return r.rowCount > 0
  }

  return false
}

async function poisciPotBFS(odTip, odId, doTip, doId, options = {}) {
  const maxStopnje = Number(options.maxStopnje || 4)
  const timeoutMs = Number(options.timeoutMs || 20000)

  const startKey = key(odTip, odId)
  const ciljKey = key(doTip, doId)

  if (startKey === ciljKey) return []

  const startedAt = Date.now()

  let frontierStart = new Set([startKey])
  let frontierEnd = new Set([ciljKey])

  const visitedStart = new Set([startKey])
  const visitedEnd = new Set([ciljKey])

  const parentStart = new Map()
  const parentEnd = new Map()

  for (let stopnja = 0; stopnja < maxStopnje; stopnja++) {
    if (Date.now() - startedAt > timeoutMs) {
      return {
        timeout: true,
        razlog: 'timeout'
      }
    }

    const expandFromStart = frontierStart.size <= frontierEnd.size

    const currentFrontier = expandFromStart ? frontierStart : frontierEnd
    const currentVisited = expandFromStart ? visitedStart : visitedEnd
    const otherVisited = expandFromStart ? visitedEnd : visitedStart
    const currentParent = expandFromStart ? parentStart : parentEnd

    const nextFrontier = new Set()

    for (const currentKey of currentFrontier) {
      const { tip, id } = parseKey(currentKey)
      const sosedi = await pridobiSosede(tip, id)

      for (const sosed of sosedi) {
        const nextKey = key(sosed.tip, sosed.id)

        if (currentVisited.has(nextKey)) continue

        currentVisited.add(nextKey)

        currentParent.set(nextKey, {
          fromKey: currentKey,
          toKey: nextKey,
          label: sosed.label,
          vir: sosed.vir
        })

        if (otherVisited.has(nextKey)) {
          return sestaviPot(nextKey, parentStart, parentEnd)
        }

        nextFrontier.add(nextKey)
      }
    }

    if (expandFromStart) {
      frontierStart = nextFrontier
    } else {
      frontierEnd = nextFrontier
    }
  }

  return null
}

function sestaviPot(meetKey, parentStart, parentEnd) {
  const prviDel = []
  let current = meetKey

  while (parentStart.has(current)) {
    const edge = parentStart.get(current)
    prviDel.unshift({
      from: edge.fromKey,
      to: edge.toKey,
      label: edge.label,
      vir: edge.vir
    })
    current = edge.fromKey
  }

  const drugiDel = []
  current = meetKey

  while (parentEnd.has(current)) {
    const edge = parentEnd.get(current)

    drugiDel.push({
      from: edge.toKey,
      to: edge.fromKey,
      label: edge.label,
      vir: edge.vir
    })

    current = edge.fromKey
  }

  return [...prviDel, ...drugiDel]
}

async function pridobiNodeInfo(nodeKey) {
  const cached = getCached(nodeCache, nodeKey)
  if (cached) return cached

  const { tip, id } = parseKey(nodeKey)

  let info = {
    id: nodeKey,
    originalId: id,
    tip,
    label: nodeKey
  }

  if (tip === 'oseba') {
    const r = await pool.query(`
      SELECT id, ime, priimek, tip
      FROM osebe
      WHERE id = $1
    `, [id])

    if (r.rows[0]) {
      const o = r.rows[0]
      info = {
        id: nodeKey,
        originalId: String(o.id),
        tip: 'oseba',
        label: `${o.ime || ''} ${o.priimek || ''}`.trim(),
        osebaTip: o.tip
      }
    }
  }

  if (tip === 'podjetje') {
    const r = await pool.query(`
      SELECT maticna, popolno_ime, posta
      FROM podjetja
      WHERE maticna = $1
    `, [id])

    if (r.rows[0]) {
      const p = r.rows[0]
      info = {
        id: nodeKey,
        originalId: p.maticna,
        tip: 'podjetje',
        label: p.popolno_ime || p.maticna,
        maticna: p.maticna,
        posta: p.posta
      }
    }
  }

  if (tip === 'clanek') {
    const r = await pool.query(`
      SELECT id, naslov, url, vir, datum
      FROM clanki
      WHERE id = $1
    `, [id])

    if (r.rows[0]) {
      const c = r.rows[0]
      info = {
        id: nodeKey,
        originalId: String(c.id),
        tip: 'clanek',
        label: c.naslov,
        url: c.url,
        vir: c.vir,
        datum: c.datum
      }
    }
  }

  if (tip === 'ovadba') {
    const r = await pool.query(`
      SELECT id, zadeva, status, sodisce, vir_url
      FROM ovadeni
      WHERE id = $1
    `, [id])

    if (r.rows[0]) {
      const o = r.rows[0]
      info = {
        id: nodeKey,
        originalId: String(o.id),
        tip: 'ovadba',
        label: o.zadeva || `Ovadba ${o.id}`,
        status: o.status,
        sodisce: o.sodisce,
        url: o.vir_url
      }
    }
  }

  if (tip === 'lobist_info') {
    const r = await pool.query(`
      SELECT id, delodajalec, narocnik, registrska_st, vir_url
      FROM lobisti_info
      WHERE id = $1
    `, [id])

    if (r.rows[0]) {
      const l = r.rows[0]
      info = {
        id: nodeKey,
        originalId: String(l.id),
        tip: 'lobist_info',
        label: `Lobist ${l.registrska_st || l.id}`,
        delodajalec: l.delodajalec,
        narocnik: l.narocnik,
        url: l.vir_url
      }
    }
  }

  setCached(nodeCache, nodeKey, info)

  return info
}

function barvaZaTip(tip, jeCilj = false) {
  if (jeCilj) {
    return {
      background: '#E74C3C',
      border: '#C0392B'
    }
  }

  if (tip === 'oseba') {
    return {
      background: '#4A90D9',
      border: '#2171B5'
    }
  }

  if (tip === 'podjetje') {
    return {
      background: '#F5A623',
      border: '#D4861A'
    }
  }

  if (tip === 'clanek') {
    return {
      background: '#9B59B6',
      border: '#7D3C98'
    }
  }

  if (tip === 'ovadba') {
    return {
      background: '#E67E22',
      border: '#BA4A00'
    }
  }

  if (tip === 'lobist_info') {
    return {
      background: '#2ECC71',
      border: '#239B56'
    }
  }

  return {
    background: '#95A5A6',
    border: '#7F8C8D'
  }
}

function skrajsaj(text, max = 45) {
  if (!text) return ''
  return text.length > max ? `${text.substring(0, max)}...` : text
}

async function formatZaFrontend(startKey, ciljKey, pot) {
  const nodes = []
  const edges = []
  const nodeKeys = new Set([startKey, ciljKey])

  for (const edge of pot) {
    nodeKeys.add(edge.from)
    nodeKeys.add(edge.to)
  }

  for (const nodeKey of nodeKeys) {
    const info = await pridobiNodeInfo(nodeKey)
    const jeCilj = nodeKey === ciljKey

    nodes.push({
      id: nodeKey,
      label: skrajsaj(info.label),
      title: info.label,
      group: info.tip,
      tip: info.tip,
      originalId: info.originalId,
      color: barvaZaTip(info.tip, jeCilj)
    })
  }

  for (const edge of pot) {
    edges.push({
      from: edge.from,
      to: edge.to,
      label: edge.label || '',
      title: edge.vir || edge.label || '',
      arrows: ''
    })
  }

  return {
    nodes,
    edges
  }
}

async function isciEntitete(q) {
  const search = `%${q}%`

  const result = await pool.query(`
    SELECT *
    FROM (
      SELECT 
        id::text AS id,
        'oseba' AS tip,
        TRIM(CONCAT(COALESCE(ime, ''), ' ', COALESCE(priimek, ''))) AS label
      FROM osebe
      WHERE 
        ime ILIKE $1
        OR priimek ILIKE $1
        OR CONCAT(COALESCE(ime, ''), ' ', COALESCE(priimek, '')) ILIKE $1

      UNION ALL

      SELECT
        maticna::text AS id,
        'podjetje' AS tip,
        COALESCE(popolno_ime, maticna) AS label
      FROM podjetja
      WHERE 
        popolno_ime ILIKE $1
        OR maticna ILIKE $1
    ) rezultati
    WHERE label IS NOT NULL AND label <> ''
    LIMIT 12
  `, [search])

  return result.rows
}

async function nalogajGraf() {
  return true
}

function pretvoriGrafVPotZaFrontend(grafData, pot) {
  const nodeMap = new Map()

  for (const node of grafData.nodes) {
    nodeMap.set(node.id, node)
  }

  const zaporedje = []

  if (pot.length === 0) return zaporedje

  zaporedje.push(pot[0].from)

  for (const edge of pot) {
    zaporedje.push(edge.to)
  }

  return zaporedje.map((nodeId, index) => {
    const node = nodeMap.get(nodeId)
    const previousEdge = index > 0 ? pot[index - 1] : null

    if (!node) {
      return {
        id: nodeId,
        type: 'unknown',
        name: nodeId
      }
    }

    return {
      id: node.originalId,
      type: node.tip === 'podjetje' ? 'podjetje' : 'oseba',
      name: node.title || node.label,
      vloga: previousEdge?.label || null
    }
  })
}

function setupRoutes(app) {
  app.get('/api/bfs/isci', async (req, res) => {
    try {
      const { q } = req.query

      if (!q) {
        return res.status(400).json({
          error: 'Manjka parameter q'
        })
      }

      const rezultati = await isciEntitete(q)

      return res.json(rezultati)
    } catch (error) {
      console.error('Napaka pri iskanju:', error)
      return res.status(500).json({
        error: 'Napaka pri iskanju'
      })
    }
  })

  app.get('/api/bfs/pot', async (req, res) => {
    try {
      const {
        odTip = 'oseba',
        odId,
        doTip = 'oseba',
        doId,
        maxStopnje = 4
      } = req.query

      if (!odId || !doId) {
        return res.status(400).json({
          error: 'Manjkata parametra odId in doId'
        })
      }

      const dovoljeniTipi = new Set([
        'oseba',
        'podjetje',
        'clanek',
        'ovadba',
        'lobist_info'
      ])

      if (!dovoljeniTipi.has(odTip) || !dovoljeniTipi.has(doTip)) {
        return res.status(400).json({
          error: 'Neveljaven tip entitete'
        })
      }

      const startExists = await obstajaNode(odTip, odId)
      const ciljExists = await obstajaNode(doTip, doId)

      if (!startExists) {
        return res.status(404).json({
          error: `Začetna entiteta ne obstaja: ${odTip}:${odId}`
        })
      }

      if (!ciljExists) {
        return res.status(404).json({
          error: `Ciljna entiteta ne obstaja: ${doTip}:${doId}`
        })
      }

      const startKey = key(odTip, odId)
      const ciljKey = key(doTip, doId)

      const zacetek = Date.now()

      const pot = await poisciPotBFS(odTip, odId, doTip, doId, {
        maxStopnje: Math.min(Number(maxStopnje) || 4, 8),
        timeoutMs: 8000
      })

      const cas = Date.now() - zacetek

      if (pot?.timeout) {
        return res.status(408).json({
          najdeno: false,
          timeout: true,
          razlog: pot.razlog,
          sporocilo: 'Iskanje je trajalo predolgo in je bilo prekinjeno.',
          cas_ms: cas
        })
      }

      if (!pot) {
        return res.json({
          najdeno: false,
          sporocilo: `Ni povezave v ${maxStopnje} stopnjah.`,
          cas_ms: cas
        })
      }

      const graf = await formatZaFrontend(startKey, ciljKey, pot)

      return res.json({
        najdeno: true,
        stopnje: pot.length,
        cas_ms: cas,
        pot,
        graf
      })
    } catch (error) {
      console.error('Napaka pri BFS:', error)
      return res.status(500).json({
        error: 'Napaka pri iskanju poti'
      })
    }
  })

  app.get('/pot', async (req, res) => {
  try {
    const { od, do: do_, maxStopnje = 4 } = req.query

    if (!od || !do_) {
      return res.status(400).json({
        error: 'Manjkata parametra od in do'
      })
    }

    const startExists = await obstajaNode('oseba', od)
    const ciljExists = await obstajaNode('oseba', do_)

    if (!startExists) {
      return res.status(404).json({
        error: `Začetna oseba z ID ${od} ne obstaja`
      })
    }

    if (!ciljExists) {
      return res.status(404).json({
        error: `Ciljna oseba z ID ${do_} ne obstaja`
      })
    }

    const startKey = key('oseba', od)
    const ciljKey = key('oseba', do_)

    const zacetek = Date.now()

    const pot = await poisciPotBFS('oseba', od, 'oseba', do_, {
      maxStopnje: Math.min(Number(maxStopnje) || 4, 8),
      timeoutMs: 8000
    })

    const cas = Date.now() - zacetek

    if (pot?.timeout) {
      return res.status(408).json({
        najdeno: false,
        timeout: true,
        sporocilo: 'Iskanje je trajalo predolgo.',
        cas_ms: cas
      })
    }

    if (!pot) {
      return res.json({
        najdeno: false,
        sporocilo: `Ni povezave v ${maxStopnje} stopnjah.`,
        cas_ms: cas
      })
    }

    const grafData = await formatZaFrontend(startKey, ciljKey, pot)
    const path = pretvoriGrafVPotZaFrontend(grafData, pot)

    return res.json({
      najdeno: true,
      stopnje: pot.length,
      cas_ms: cas,
      path,
      pot,
      graf: grafData
    })
  } catch (error) {
    console.error('Napaka pri /pot:', error)
    return res.status(500).json({
      error: 'Napaka pri iskanju poti'
    })
  }
})

  app.get('/api/bfs/status', async (req, res) => {
    return res.json({
      status: 'OK',
      tip: 'lazy-sql-bfs',
      cache: {
        sosedi: neighborCache.size,
        nodes: nodeCache.size
      }
    })
  })
}

module.exports = {
  nalogajGraf,
  setupRoutes,
  pridobiSosede,
  poisciPotBFS,
  formatZaFrontend
}