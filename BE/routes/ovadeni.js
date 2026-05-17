const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// GET /ovadeni?q=&limit=&offset=&status=
router.get('/', async (req, res) => {
  try {
    const q = req.query.q?.trim() || ''
    const status = req.query.status?.trim() || ''
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0
    const params = []
    const conditions = []

    if (q) {
      params.push(`%${q}%`)
      conditions.push(`(LOWER(ime || ' ' || priimek) LIKE LOWER($${params.length})
                     OR LOWER(COALESCE(zadeva,'')) LIKE LOWER($${params.length})
                     OR LOWER(COALESCE(sodisce,'')) LIKE LOWER($${params.length}))`)
    }
    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    params.push(limit, offset)

    const result = await pool.query(`
      SELECT id, ime, priimek, oseba_id, zadeva, opis, datum,
        sodisce, status, vir, vir_url
      FROM ovadeni
      ${where}
      ORDER BY datum DESC NULLS LAST, priimek, ime
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ovadeni ${where}`,
      params.slice(0, -2)
    )

    res.json({ skupaj: parseInt(countResult.rows[0].count), ovadeni: result.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /ovadeni/:id
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM ovadeni WHERE id = $1`, [req.params.id])
    if (!r.rows.length) return res.status(404).json({ error: 'Vnos ni najden' })
    res.json(r.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
