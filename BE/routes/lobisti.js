const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// GET /lobisti?q=&limit=&offset=
router.get('/', async (req, res) => {
  try {
    const q = req.query.q?.trim() || ''
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0
    const params = []
    let where = "WHERE o.tip = 'lobist'"
    if (q) {
      params.push(`%${q}%`)
      where += ` AND (LOWER(o.ime || ' ' || o.priimek) LIKE LOWER($${params.length})
                  OR LOWER(COALESCE(li.delodajalec,'')) LIKE LOWER($${params.length})
                  OR LOWER(COALESCE(li.narocnik,'')) LIKE LOWER($${params.length}))`
    }
    params.push(limit, offset)

    const result = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.fotografija_url,
        li.delodajalec, li.narocnik, li.datum_vpisa, li.datum_izpisa,
        li.registrska_st, li.vir_url,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN lobisti_info li ON li.oseba_id = o.id
      LEFT JOIN povezave p ON p.oseba_id = o.id
      ${where}
      GROUP BY o.id, li.delodajalec, li.narocnik, li.datum_vpisa,
               li.datum_izpisa, li.registrska_st, li.vir_url
      ORDER BY o.priimek, o.ime
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM osebe o
      LEFT JOIN lobisti_info li ON li.oseba_id = o.id
      ${where}
    `, params.slice(0, -2))

    res.json({ skupaj: parseInt(countResult.rows[0].count), lobisti: result.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /lobisti/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const r = await pool.query(`
      SELECT o.*, li.delodajalec, li.narocnik, li.datum_vpisa, li.datum_izpisa,
        li.registrska_st, li.vir_url
      FROM osebe o
      LEFT JOIN lobisti_info li ON li.oseba_id = o.id
      WHERE o.id = $1 AND o.tip = 'lobist'
    `, [id])
    if (!r.rows.length) return res.status(404).json({ error: 'Lobist ni najden' })
    res.json(r.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
