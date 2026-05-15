require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function main() {
  console.log('Dodajam stolpce za akademike...')

  await pool.query(`
    ALTER TABLE osebe
      ADD COLUMN IF NOT EXISTS tip        VARCHAR(20) DEFAULT 'poslovnez',
      ADD COLUMN IF NOT EXISTS fotografija_url TEXT,
      ADD COLUMN IF NOT EXISTS institucija TEXT,
      ADD COLUMN IF NOT EXISTS naziv      TEXT
  `)

  console.log('✓ Stolpci dodani (tip, fotografija_url, institucija, naziv)')

  const { rows } = await pool.query('SELECT COUNT(*) FROM osebe')
  await pool.query(`UPDATE osebe SET tip = 'poslovnez' WHERE tip IS NULL`)
  console.log(`✓ Označenih ${rows[0].count} obstoječih oseb kot 'poslovnez'`)

  await pool.end()
  console.log('Končano.')
}

main().catch(e => { console.error(e.message); process.exit(1) })
