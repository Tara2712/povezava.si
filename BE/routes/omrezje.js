const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

function podjetjeSubtype(ime, parentId) {
  if (!ime) return 'podjetje'
  const n = ime.toLowerCase()
  if (n.includes('univerza') || n.includes('fakulteta')) return 'univerza'
  if (n.includes('laboratorij')) return 'laboratorij'
  if (parentId) return 'laboratorij'
  return 'podjetje'
}

// GET /omrezje/:id — BFS do 6 stopenj ločenosti
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const maxDepth = Math.min(parseInt(req.query.depth) || 3, 6)
  const maxNodes = 80

  try {
    const startResult = await pool.query(`SELECT id, ime, priimek, tip FROM osebe WHERE id = $1`, [id])
    if (startResult.rows.length === 0) return res.status(404).json({ error: 'Oseba ni najdena' })

    const sp = startResult.rows[0]
    const nodes = new Map()
    const edges = []

    nodes.set(`o-${id}`, {
      key: `o-${id}`, id: parseInt(id), type: 'oseba', subtype: sp.tip,
      name: `${sp.ime} ${sp.priimek}`, depth: 0, isCenter: true
    })

    let frontierOsebe = [parseInt(id)]
    let frontierPodjetja = []
    const visitedO = new Set([parseInt(id)])
    const visitedP = new Set()

    for (let d = 0; d < maxDepth && nodes.size < maxNodes; d++) {
      if (d % 2 === 0) {
        if (!frontierOsebe.length) break
        const r = await pool.query(`
          SELECT p.oseba_id, p.podjetje_id, d.popolno_ime, d.parent_podjetje_id, p.vloga
          FROM povezave p JOIN podjetja d ON d.id = p.podjetje_id
          WHERE p.oseba_id = ANY($1)
        `, [frontierOsebe])

        const next = []
        for (const row of r.rows) {
          if (nodes.size >= maxNodes) break
          const key = `d-${row.podjetje_id}`
          if (!nodes.has(key)) nodes.set(key, {
            key, id: row.podjetje_id, type: 'podjetje',
            subtype: podjetjeSubtype(row.popolno_ime, row.parent_podjetje_id),
            name: row.popolno_ime, parentId: row.parent_podjetje_id, depth: d + 1
          })
          const eKey = `o-${row.oseba_id}__${key}`
          if (!edges.find(e => e.key === eKey)) edges.push({ key: eKey, from: `o-${row.oseba_id}`, to: key, vloga: row.vloga })
          if (!visitedP.has(row.podjetje_id)) { visitedP.add(row.podjetje_id); next.push(row.podjetje_id) }
        }
        frontierPodjetja = next
      } else {
        if (!frontierPodjetja.length) break
        const r = await pool.query(`
          SELECT p.podjetje_id, p.oseba_id, o.ime, o.priimek, o.tip, p.vloga
          FROM povezave p JOIN osebe o ON o.id = p.oseba_id
          WHERE p.podjetje_id = ANY($1)
        `, [frontierPodjetja])

        const next = []
        for (const row of r.rows) {
          if (nodes.size >= maxNodes) break
          const key = `o-${row.oseba_id}`
          if (!nodes.has(key)) nodes.set(key, {
            key, id: row.oseba_id, type: 'oseba', subtype: row.tip,
            name: `${row.ime} ${row.priimek}`, depth: d + 1
          })
          const eKey = `d-${row.podjetje_id}__${key}`
          if (!edges.find(e => e.key === eKey)) edges.push({ key: eKey, from: `d-${row.podjetje_id}`, to: key, vloga: row.vloga })
          if (!visitedO.has(row.oseba_id)) { visitedO.add(row.oseba_id); next.push(row.oseba_id) }
        }
        frontierOsebe = next
      }
    }

    // Dodaj hierarhične robove lab → UM FERI
    const labNodes = [...nodes.values()].filter(n => n.type === 'podjetje' && n.parentId)
    for (const lab of labNodes) {
      const parentKey = `d-${lab.parentId}`
      if (!nodes.has(parentKey)) {
        const pr = await pool.query(`SELECT id, popolno_ime FROM podjetja WHERE id = $1`, [lab.parentId])
        if (pr.rows.length) {
          const p = pr.rows[0]
          nodes.set(parentKey, {
            key: parentKey, id: p.id, type: 'podjetje',
            subtype: podjetjeSubtype(p.popolno_ime, null),
            name: p.popolno_ime, depth: lab.depth + 1
          })
        }
      }
      const eKey = `${lab.key}__${parentKey}`
      if (!edges.find(e => e.key === eKey)) {
        edges.push({ key: eKey, from: lab.key, to: parentKey, vloga: 'del institucije', hierarhija: true })
      }
    }

    res.json({
      center: { id: parseInt(id), name: `${sp.ime} ${sp.priimek}` },
      nodes: [...nodes.values()],
      edges: edges.map(({ key, ...e }) => e),
      maxDepth
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router