const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET /povezave — vse povezave
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.vloga,
        o.ime, o.priimek,
        d.popolno_ime AS podjetje
      FROM povezave p
      JOIN osebe o ON o.id = p.oseba_id
      JOIN podjetja d ON d.id = p.podjetje_id
      ORDER BY p.id DESC
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router