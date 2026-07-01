const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  // GET /clanki?limit=&offset=&q= — članki z iskanjem
  router.get('/', async (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit) || 8, 100)
      const offset = parseInt(req.query.offset) || 0
      const q      = req.query.q?.trim() || ''

      const params = []
      let where = ''
      if (q) {
        params.push(`%${q}%`)
        where = `WHERE (LOWER(c.naslov) LIKE LOWER($1) OR LOWER(COALESCE(c.povzetek,'')) LIKE LOWER($1)
                  OR EXISTS (
                    SELECT 1 FROM clanki_osebe co2
                    JOIN osebe o2 ON o2.id = co2.oseba_id
                    WHERE co2.clanek_id = c.id
                    AND LOWER(o2.ime || ' ' || o2.priimek) LIKE LOWER($1)
                  ))`
      }
      params.push(limit, offset)

      const result = await pool.query(`
        SELECT c.id, c.naslov, c.url, c.vir, c.datum, c.povzetek,
          JSON_AGG(JSON_BUILD_OBJECT('id', o.id, 'ime', o.ime, 'priimek', o.priimek))
            FILTER (WHERE o.id IS NOT NULL) AS osebe
        FROM clanki c
        LEFT JOIN clanki_osebe co ON co.clanek_id = c.id
        LEFT JOIN osebe o ON o.id = co.oseba_id
        ${where}
        GROUP BY c.id
        ORDER BY c.datum DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params)

      const countRes = await pool.query(
        `SELECT COUNT(*) FROM clanki c ${where}`,
        params.slice(0, -2)
      )

      res.json({ skupaj: parseInt(countRes.rows[0].count), clanki: result.rows })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}