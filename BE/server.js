require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')

const app = express()
const PORT = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  next()
})

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Povezava.si backend deluje!' })
})

// GET /osebe — seznam vseh oseb
app.get('/osebe', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.id, o.ime, o.priimek,
        COUNT(p.id) AS stevilo_povezav
      FROM osebe o
      LEFT JOIN povezave p ON p.oseba_id = o.id
      GROUP BY o.id
      ORDER BY stevilo_povezav DESC
    `)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /osebe/:id — profil osebe z njenimi povezavami
app.get('/osebe/:id', async (req, res) => {
  try {
    const { id } = req.params

    const oseba = await pool.query(`SELECT * FROM osebe WHERE id = $1`, [id])
    if (oseba.rows.length === 0) return res.status(404).json({ error: 'Oseba ni najdena' })

    const povezave = await pool.query(`
      SELECT p.vloga, p.vir, p.datum_od, p.datum_do,
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

// GET /podjetja — seznam vseh podjetij
app.get('/podjetja', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.maticna, d.popolno_ime, d.pravna_oblika, d.posta,
        COUNT(p.id) AS stevilo_povezav
      FROM podjetja d
      LEFT JOIN povezave p ON p.podjetje_id = d.id
      GROUP BY d.id
      ORDER BY stevilo_povezav DESC
    `)
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
})

// GET /povezave — vse povezave
app.get('/povezave', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.vloga, p.vir,
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

// GET /search?q=janez — iskanje oseb in podjetij
app.get('/search', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server teče na portu ${PORT}`)
})
