const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET /lokacije (za zemljevid)
router.get('/', async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT 
        p.id,
        p.maticna,
        p.popolno_ime,
        p.pravna_oblika,
        p.registrski_organ,
        p.ulica,
        p.hisna_stevilka,
        p.postna_stevilka,
        p.posta,
        p.drzava,
        l.lat,
        l.lng
      FROM lokacija l
      INNER JOIN podjetja p
        ON p.maticna = l.maticna
      WHERE l.lat IS NOT NULL
        AND l.lng IS NOT NULL
    `)

    res.json(result.rows)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


module.exports = router