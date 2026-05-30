const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET vseh podjetij (z iskanjem, sortom, paginacijo)
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 40, 200)
    const offset = parseInt(req.query.offset) || 0
    const q      = req.query.q
    const sort   = req.query.sort || 'povezave'

    const params = []
    const where  = []
    if (q) { params.push(`%${q}%`); where.push(`LOWER(d.popolno_ime) LIKE LOWER($${params.length})`) }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const orderBy =
      sort === 'az' ? 'd.popolno_ime ASC' :
      sort === 'za' ? 'd.popolno_ime DESC' :
      'stevilo_povezav DESC'

    const baseParams = [...params]
    params.push(limit, offset)

    const [result, countResult] = await Promise.all([
      pool.query(`
        SELECT d.id, d.maticna, d.popolno_ime, d.pravna_oblika, d.posta,
          COUNT(p.id) AS stevilo_povezav
        FROM podjetja d
        LEFT JOIN povezave p ON p.podjetje_id = d.id
        ${whereClause}
        GROUP BY d.id
        ORDER BY ${orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      pool.query(`
        SELECT COUNT(*) FROM podjetja d ${whereClause}
      `, baseParams)
    ])

    res.json({ skupaj: parseInt(countResult.rows[0].count), podjetja: result.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET po ID-ju
router.get('/id/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT maticna, popolno_ime, posta, pravna_oblika, ulica, hisna_stevilka, postna_stevilka FROM podjetja WHERE id = $1',
      [req.params.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Podjetje ni najdeno' })
    }

    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// GET posameznega podjetja po matični
router.get('/:maticna', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT maticna, popolno_ime, posta, pravna_oblika, ulica, hisna_stevilka, postna_stevilka FROM podjetja WHERE maticna = $1',
      [req.params.maticna]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Podjetje ni najdeno' })
    }
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /podjetjaVsa — vse informacije o podjetjih (za zemljevid)
router.get('/podjetjaVsa', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50

    const result = await pool.query(`
      SELECT 
        d.id,
        d.maticna,
        d.popolno_ime,
        d.pravna_oblika,
        d.registrski_organ,
        d.ulica,
        d.hisna_stevilka,
        d.naselje,
        d.postna_stevilka,
        d.posta,
        d.drzava,
        COUNT(p.id) AS stevilo_povezav
      FROM podjetja d
      LEFT JOIN povezave p ON p.podjetje_id = d.id
      GROUP BY d.id
      ORDER BY stevilo_povezav DESC
      LIMIT $1
    `, [limit])

    res.json(result.rows)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


/*
// GET /podjetja — seznam podjetij (limit opcijski)
app.get('/podjetja', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50
    const result = await pool.query(`
      SELECT d.id, d.maticna, d.popolno_ime, d.pravna_oblika, d.posta,
        COUNT(p.id) AS stevilo_povezav
      FROM podjetja d
      LEFT JOIN povezave p ON p.podjetje_id = d.id
      GROUP BY d.id
      ORDER BY stevilo_povezav DESC
      LIMIT $1
    `, [limit])
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /podjetja/:id — profil podjetja z osebami

app.get('/podjetja/:id', async (req, res) => {
  try {
    const { id } = req.params

    const podjetje = await pool.query(`SELECT * FROM podjetja WHERE id = $1`, [id])
    if (podjetje.rows.length === 0) return res.status(404).json({ error: 'Podjetje ni najdeno' })

    const osebe = await pool.query(`
      SELECT p.vloga, p.vir, p.datum_od, p.datum_do,
        o.id AS oseba_id, o.ime, o.priimek
      FROM povezave p
      JOIN osebe o ON o.id = p.oseba_id
      WHERE p.podjetje_id = $1
      ORDER BY p.vloga
    `, [id])

    res.json({ ...podjetje.rows[0], osebe: osebe.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})*/

module.exports = router