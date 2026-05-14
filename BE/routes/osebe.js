const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET /osebe — seznam oseb
router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null
    const result = await pool.query(`
      SELECT o.id, o.ime, o.priimek,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      GROUP BY o.id
      ORDER BY stevilo_povezav DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /osebe/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const oseba = await pool.query(`SELECT * FROM osebe WHERE id = $1`, [id])
    if (oseba.rows.length === 0) return res.status(404).json({ error: 'Oseba ni najdena' })

    const povezave = await pool.query(`
      SELECT p.vloga, p.datum_od, p.datum_do,
        d.id AS podjetje_id, d.popolno_ime, d.pravna_oblika
      FROM povezave p
      JOIN podjetja d ON d.id = p.podjetje_id
      WHERE p.oseba_id = $1
      ORDER BY p.vloga
    `, [id])

    res.json({ ...oseba.rows[0], povezave: povezave.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router