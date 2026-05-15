const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// GET /stats — skupno število oseb, podjetij, povezav
router.get('/', async (req, res) => {
  try {
    const [o, p, pov] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM osebe'),
      pool.query('SELECT COUNT(*) FROM podjetja'),
      pool.query('SELECT COUNT(*) FROM povezave'),
    ])
    res.json({
      osebe: parseInt(o.rows[0].count),
      podjetja: parseInt(p.rows[0].count),
      povezave: parseInt(pov.rows[0].count),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router