const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  // GET /pot?od=:id&do=:id — BFS najkrajša pot med dvema osebama
  router.get('/', async (req, res) => {
    const fromId = parseInt(req.query.od)
    const toId   = parseInt(req.query.do)
    if (!fromId || !toId) return res.status(400).json({ error: 'Manjkata parametra od in do' })

    try {
      const [startRes, endRes] = await Promise.all([
        pool.query('SELECT id, ime, priimek FROM osebe WHERE id = $1', [fromId]),
        pool.query('SELECT id, ime, priimek FROM osebe WHERE id = $1', [toId])
      ])
      if (!startRes.rows.length) return res.status(404).json({ error: 'Začetna oseba ni najdena' })
      if (!endRes.rows.length)   return res.status(404).json({ error: 'Končna oseba ni najdena' })

      const sp = startRes.rows[0]
      const ep = endRes.rows[0]

      if (fromId === toId) return res.json({
        path: [{ type: 'oseba', id: fromId, name: `${sp.ime} ${sp.priimek}` }], stopnje: 0
      })

      const visitedO = new Map()
      const visitedP = new Map()
      visitedO.set(fromId, [{ type: 'oseba', id: fromId, name: `${sp.ime} ${sp.priimek}` }])

      let frontierOsebe    = [fromId]
      let frontierPodjetja = []

      for (let depth = 0; depth < 12; depth++) {
        if (depth % 2 === 0) {
          if (!frontierOsebe.length) break
          const r = await pool.query(`
            SELECT p.oseba_id, p.podjetje_id, d.popolno_ime, p.vloga
            FROM povezave p JOIN podjetja d ON d.id = p.podjetje_id
            WHERE p.oseba_id = ANY($1::int[])
          `, [frontierOsebe])

          const next = []
          for (const row of r.rows) {
            if (visitedP.has(row.podjetje_id)) continue
            const newPath = [...visitedO.get(row.oseba_id),
              { type: 'podjetje', id: row.podjetje_id, name: row.popolno_ime, vloga: row.vloga }]
            visitedP.set(row.podjetje_id, newPath)
            next.push(row.podjetje_id)
          }
          frontierPodjetja = next
        } else {
          if (!frontierPodjetja.length) break
          const r = await pool.query(`
            SELECT p.podjetje_id, p.oseba_id, o.ime, o.priimek, p.vloga
            FROM povezave p JOIN osebe o ON o.id = p.oseba_id
            WHERE p.podjetje_id = ANY($1::int[])
          `, [frontierPodjetja])

          const next = []
          for (const row of r.rows) {
            if (visitedO.has(row.oseba_id)) continue
            const newPath = [...visitedP.get(row.podjetje_id),
              { type: 'oseba', id: row.oseba_id, name: `${row.ime} ${row.priimek}`, vloga: row.vloga }]

            if (row.oseba_id === toId) {
              return res.json({ path: newPath, stopnje: Math.floor((newPath.length - 1) / 2) })
            }
            visitedO.set(row.oseba_id, newPath)
            next.push(row.oseba_id)
          }
          frontierOsebe = next
        }
      }

      res.json({ path: null, stopnje: null,
        sporocilo: `Pot med ${sp.ime} ${sp.priimek} in ${ep.ime} ${ep.priimek} ni bila najdena v 6 stopnjah ločenosti.` })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}