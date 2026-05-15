require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function main() {
  await pool.query(`
    ALTER TABLE osebe
      ADD COLUMN IF NOT EXISTS opis       TEXT,
      ADD COLUMN IF NOT EXISTS podrocja   TEXT,
      ADD COLUMN IF NOT EXISTS profil_url TEXT
  `)
  console.log('✓ Stolpci dodani (opis, podrocja, profil_url)')
  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
