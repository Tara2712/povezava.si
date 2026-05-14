require('dotenv').config()
const express = require('express')
const { Pool } = require('pg')
const podjetjaRoutes = require('./routes/podjetja')
const osebeRoutes = require('./routes/osebe')
const omrezjeRoutes = require('./routes/omrezje')
const povezaveRoutes = require('./routes/povezave')
const searchRoutes = require('./routes/search')
const statsRoutes = require('./routes/stats')

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

app.use('/api/podjetja', podjetjaRoutes)
app.use('/api/osebe', osebeRoutes)
app.use('/api/omrezje', omrezjeRoutes)
app.use('/api/povezave', povezaveRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/stats', statsRoutes)


app.listen(PORT, () => {
  console.log(`Server teče na portu ${PORT}`)
})

module.exports = app