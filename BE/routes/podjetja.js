const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET vseh podjetij (z iskanjem)
router.get('/', async (req, res) => {
  try {
    const { q } = req.query
    let result

    if (q) {
      result = await pool.query(
        'SELECT maticna, popolno_ime, posta, pravna_oblika FROM podjetja WHERE popolno_ime ILIKE $1 LIMIT 20',
        [`%${q}%`]
      )
    } else {
      result = await pool.query(
        'SELECT maticna, popolno_ime, posta, pravna_oblika FROM podjetja LIMIT 20'
      )
    }

    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET posameznega podjetja po matični
router.get('/:maticna', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM podjetja WHERE maticna = $1',
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

module.exports = router