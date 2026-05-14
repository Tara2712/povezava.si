const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET /search?q=janez — iskanje oseb in podjetij
router.get('/', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`

    const osebe = await pool.query(`
      SELECT o.id, o.ime, o.priimek, 'oseba' AS tip,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      WHERE LOWER(o.ime || ' ' || o.priimek) LIKE LOWER($1)
      GROUP BY o.id
      LIMIT 10
    `, [q])

    const podjetja = await pool.query(`
      SELECT d.id, d.popolno_ime AS naziv, 'podjetje' AS tip,
        COUNT(p.id) AS stevilo_povezav
      FROM podjetja d
      LEFT JOIN povezave p ON p.podjetje_id = d.id
      WHERE LOWER(d.popolno_ime) LIKE LOWER($1)
      GROUP BY d.id
      LIMIT 10
    `, [q])

    res.json([...osebe.rows, ...podjetja.rows])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router