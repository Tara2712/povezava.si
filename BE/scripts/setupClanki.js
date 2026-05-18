require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clanki (
      id SERIAL PRIMARY KEY,
      naslov TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      vir TEXT,
      datum TIMESTAMPTZ,
      povzetek TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clanki_osebe (
      clanek_id INT REFERENCES clanki(id) ON DELETE CASCADE,
      oseba_id INT REFERENCES osebe(id) ON DELETE CASCADE,
      PRIMARY KEY (clanek_id, oseba_id)
    )
  `)
  console.log('Tabeli clanki in clanki_osebe ustvarjeni.')
  await pool.end()
}
main().catch(async e => { console.error(e.message); await pool.end() })
