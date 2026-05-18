const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET /osebe — seznam z filtri
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0
    const tip    = req.query.tip
    const q      = req.query.q
    const minPov = req.query.min_povezave ? parseInt(req.query.min_povezave) : null
    const maxPov = req.query.max_povezave ? parseInt(req.query.max_povezave) : null
    const samo_lobisti = req.query.lobisti === '1'
    const samo_ovadeni = req.query.ovadeni === '1'
    const sort   = req.query.sort || 'povezave'

    const params = []
    const where  = []
    let joins    = ''

    if (tip) { params.push(tip); where.push(`o.tip = $${params.length}`) }
    if (q)   { params.push(`%${q}%`); where.push(`(LOWER(o.ime || ' ' || o.priimek) LIKE LOWER($${params.length}) OR LOWER(COALESCE(o.institucija,'')) LIKE LOWER($${params.length}))`) }
    if (samo_lobisti) joins += ' JOIN lobisti lb ON lb.oseba_id = o.id'
    if (samo_ovadeni) joins += ' JOIN ovadeni ov ON ov.oseba_id = o.id'

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const having = []
    if (minPov !== null) { params.push(minPov); having.push(`COUNT(p.id) >= $${params.length}`) }
    if (maxPov !== null) { params.push(maxPov); having.push(`COUNT(p.id) <= $${params.length}`) }
    const havingClause = having.length ? `HAVING ${having.join(' AND ')}` : ''

    const orderBy =
      sort === 'az' ? 'o.priimek ASC, o.ime ASC' :
      sort === 'za' ? 'o.priimek DESC, o.ime DESC' :
      'stevilo_povezav DESC'

    const baseParams = [...params]
    params.push(limit, offset)

    const result = await pool.query(`
      SELECT o.id, o.ime, o.priimek, o.tip, o.fotografija_url, o.institucija, o.naziv,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      ${joins}
      ${whereClause}
      GROUP BY o.id
      ${havingClause}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM (
        SELECT o.id
        FROM osebe o
        LEFT JOIN povezave p ON p.oseba_id = o.id
        ${joins}
        ${whereClause}
        GROUP BY o.id
        ${havingClause}
      ) sub
    `, baseParams)

    res.json({ skupaj: parseInt(countResult.rows[0].count), osebe: result.rows })
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
