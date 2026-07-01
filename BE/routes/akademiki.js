const express = require('express')

module.exports = (pool) => {
  const router = express.Router()

  // GET /akademiki — seznam akademikov za domačo stran
  router.get('/', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5
      const result = await pool.query(`
        SELECT o.id, o.ime, o.priimek, o.naziv, o.institucija, o.fotografija_url,
          o.opis, o.podrocja, o.profil_url,
          COUNT(p.id) AS stevilo_povezav
        FROM osebe o
        LEFT JOIN povezave p ON p.oseba_id = o.id
        WHERE o.tip = 'akademik'
        GROUP BY o.id
        ORDER BY
          CASE
            WHEN o.opis ILIKE '%Predstojnik inštituta%' THEN 1
            WHEN o.opis ILIKE '%Namestnik predstojnika%' THEN 2
            WHEN o.opis ILIKE '%Redni profesor%' THEN 3
            WHEN o.opis ILIKE '%Izredni profesor%' THEN 4
            WHEN o.opis ILIKE '%Docent%' THEN 5
            WHEN o.opis ILIKE '%Višji predavatelj%' OR o.opis ILIKE '%Predavatelj%' THEN 6
            WHEN o.opis ILIKE '%Asistent%' THEN 7
            WHEN o.opis ILIKE '%Mladi raziskovalec%' THEN 8
            WHEN o.opis ILIKE '%Tehnični sodelavec%' THEN 9
            WHEN o.fotografija_url IS NOT NULL THEN 10
            ELSE 11
          END,
          o.priimek
        LIMIT $1
      `, [limit])
      res.json(result.rows)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}